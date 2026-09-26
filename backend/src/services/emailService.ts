import { prisma } from '../config/db';
import { addEmailJob, removeQueueJob } from './queueService';
import { ElasticService } from './elasticService';
import { parseEmailList } from '../utils/csvParser';
import { ScheduleEmailsRequest, EmailJobData } from '../types';
import { config } from '../config/env';

export class EmailService {
  /**
   * Schedules a batch of emails as a campaign with BullMQ delayed jobs
   */
  public static async scheduleEmails(
    userId: string,
    input: ScheduleEmailsRequest
  ): Promise<{
    campaignId: string;
    totalScheduled: number;
    startTime: Date;
    delayMs: number;
  }> {
    // 1. Verify Sender
    const sender = await prisma.sender.findFirst({
      where: { id: input.senderId, userId },
    });

    if (!sender) {
      throw new Error('Sender account not found or does not belong to user');
    }

    // 2. Validate and deduplicate recipients
    const parseResult = parseEmailList(input.recipients.join('\n'));
    if (parseResult.validEmails.length === 0) {
      throw new Error('No valid email recipients provided in request');
    }

    const validRecipients = parseResult.validEmails;
    const baseStartTime = input.startTime ? new Date(input.startTime) : new Date();
    const effectiveStartTime = isNaN(baseStartTime.getTime()) || baseStartTime.getTime() < Date.now()
      ? new Date()
      : baseStartTime;

    const delayMs = input.delayMs !== undefined ? Math.max(0, input.delayMs) : config.worker.minDelayMs;
    const hourlyLimit = input.hourlyLimit || sender.hourlyLimit || config.worker.maxEmailsPerHour;

    // 3. Create Campaign in DB
    const campaign = await prisma.emailCampaign.create({
      data: {
        userId,
        subject: input.subject,
        body: input.body,
        startTime: effectiveStartTime,
        delayMs,
        hourlyLimit,
      },
    });

    // 4. Create ScheduledEmail records & BullMQ jobs
    const createdEmails = [];

    for (let i = 0; i < validRecipients.length; i++) {
      const recipient = validRecipients[i];
      // Deterministic idempotency key: unique per campaign + recipient
      const idempotencyKey = `${campaign.id}:${recipient.toLowerCase()}`;

      // Calculate scheduled time with incremental delay
      const scheduledTimeMs = effectiveStartTime.getTime() + (i * delayMs);
      const scheduledAt = new Date(scheduledTimeMs);

      // Create DB Record
      const emailRecord = await prisma.scheduledEmail.create({
        data: {
          campaignId: campaign.id,
          userId,
          senderId: sender.id,
          recipientEmail: recipient,
          subject: input.subject,
          body: input.body,
          scheduledAt,
          status: 'SCHEDULED',
          idempotencyKey,
        },
      });

      // Compute initial BullMQ delay in ms
      const delayUntilRun = Math.max(0, scheduledTimeMs - Date.now());

      const jobData: EmailJobData = {
        emailId: emailRecord.id,
        campaignId: campaign.id,
        userId,
        senderId: sender.id,
        senderEmail: sender.email,
        recipientEmail: recipient,
        subject: input.subject,
        body: input.body,
        hourlyLimit,
      };

      // Add to BullMQ delayed jobs
      const bullJobId = await addEmailJob(jobData, delayUntilRun, idempotencyKey);

      // Link bullJobId in DB
      await prisma.scheduledEmail.update({
        where: { id: emailRecord.id },
        data: { bullJobId },
      });

      // Index in Elasticsearch
      ElasticService.indexEmail({
        id: emailRecord.id,
        campaignId: campaign.id,
        userId,
        senderId: sender.id,
        senderEmail: sender.email,
        recipientEmail: recipient,
        subject: input.subject,
        body: input.body,
        status: 'SCHEDULED',
        scheduledAt: scheduledAt.toISOString(),
        createdAt: emailRecord.createdAt.toISOString(),
      }).catch(() => {});

      createdEmails.push(emailRecord);
    }

    return {
      campaignId: campaign.id,
      totalScheduled: createdEmails.length,
      startTime: effectiveStartTime,
      delayMs,
    };
  }

  /**
   * Fetch scheduled/pending emails for user
   */
  public static async getScheduledEmails(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ emails: any[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where: {
          userId,
          status: { in: ['SCHEDULED', 'PROCESSING'] },
        },
        include: { sender: true, campaign: true },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.scheduledEmail.count({
        where: {
          userId,
          status: { in: ['SCHEDULED', 'PROCESSING'] },
        },
      }),
    ]);

    return {
      emails,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Fetch sent or failed emails for user
   */
  public static async getSentEmails(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ emails: any[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where: {
          userId,
          status: { in: ['SENT', 'FAILED'] },
        },
        include: { sender: true, campaign: true },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.scheduledEmail.count({
        where: {
          userId,
          status: { in: ['SENT', 'FAILED'] },
        },
      }),
    ]);

    return {
      emails,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Fetch dashboard email statistics
   */
  public static async getEmailStats(userId: string): Promise<{
    scheduled: number;
    sent: number;
    failed: number;
    total: number;
  }> {
    const [scheduled, sent, failed] = await Promise.all([
      prisma.scheduledEmail.count({
        where: { userId, status: { in: ['SCHEDULED', 'PROCESSING'] } },
      }),
      prisma.scheduledEmail.count({
        where: { userId, status: 'SENT' },
      }),
      prisma.scheduledEmail.count({
        where: { userId, status: 'FAILED' },
      }),
    ]);

    return {
      scheduled,
      sent,
      failed,
      total: scheduled + sent + failed,
    };
  }

  /**
   * Cancel a scheduled email
   */
  public static async cancelScheduledEmail(userId: string, emailId: string): Promise<boolean> {
    const email = await prisma.scheduledEmail.findFirst({
      where: { id: emailId, userId, status: 'SCHEDULED' },
    });

    if (!email) {
      return false;
    }

    if (email.bullJobId) {
      await removeQueueJob(email.bullJobId);
    }

    await prisma.scheduledEmail.delete({
      where: { id: emailId },
    });

    return true;
  }
}
