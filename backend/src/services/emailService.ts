import nodemailer from 'nodemailer';
import { prisma } from '../config/db';
import { addEmailJob, removeQueueJob } from './queueService';
import { ElasticService } from './elasticService';
import { RateLimiterService } from './rateLimiterService';
import { getEmailTransporter } from '../config/emailTransporter';
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

    const delayMs = input.delayMs !== undefined ? Math.max(0, Number(input.delayMs)) : 2000;
    const hourlyLimit = input.hourlyLimit !== undefined ? Math.max(1, Number(input.hourlyLimit)) : 200;

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

      // Calculate staggered start time based on delayMs
      const scheduledTimeMs = effectiveStartTime.getTime() + i * delayMs;
      const scheduledDate = new Date(scheduledTimeMs);
      const delayUntilRun = Math.max(0, scheduledTimeMs - Date.now());

      // Create DB Record
      const emailRecord = await prisma.scheduledEmail.create({
        data: {
          campaignId: campaign.id,
          userId,
          senderId: sender.id,
          recipientEmail: recipient,
          subject: input.subject,
          body: input.body,
          scheduledAt: scheduledDate,
          status: 'SCHEDULED',
          idempotencyKey,
        },
      });

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
      const bullJobId = await addEmailJob(jobData, delayUntilRun, emailRecord.id);

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
        scheduledAt: scheduledDate.toISOString(),
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

  /**
   * Process a single scheduled email by ID (used by both worker & serverless cron)
   */
  public static async processSingleScheduledEmail(emailId: string): Promise<{
    success: boolean;
    emailId: string;
    status: string;
    messageId?: string;
    etherealUrl?: string | null;
    error?: string;
  }> {
    const existingEmail = await prisma.scheduledEmail.findUnique({
      where: { id: emailId },
      include: { sender: true },
    });

    if (!existingEmail) {
      return { success: false, emailId, status: 'NOT_FOUND', error: 'Email record not found' };
    }

    if (existingEmail.status === 'SENT') {
      return { success: true, emailId, status: 'ALREADY_SENT', messageId: existingEmail.messageId || undefined };
    }

    const sender = existingEmail.sender;
    const activeSenderEmail = sender?.email || 'outreach@reachinbox.test';
    const activeDisplayName = sender?.displayName || null;
    const hourlyLimit = sender?.hourlyLimit || config.worker.maxEmailsPerHour || 200;

    // Rate Limit Check
    const hourlySlot = await RateLimiterService.checkAndReserveHourlySlot(existingEmail.senderId, hourlyLimit);
    if (!hourlySlot.allowed) {
      const retryDelayMs = hourlySlot.retryDelayMs || RateLimiterService.getMillisecondsUntilNextHour();
      const nextScheduledDate = new Date(Date.now() + retryDelayMs);

      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          scheduledAt: nextScheduledDate,
          status: 'SCHEDULED',
        },
      });

      return {
        success: false,
        emailId,
        status: 'RATE_LIMITED_RESCHEDULED',
        error: `Hourly rate limit exceeded for ${activeSenderEmail}. Rescheduled to ${nextScheduledDate.toISOString()}`,
      };
    }

    // Transition to PROCESSING
    await prisma.scheduledEmail.update({
      where: { id: emailId },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
      },
    });

    try {
      const { transporter, fromAddress } = await getEmailTransporter({
        email: activeSenderEmail,
        displayName: activeDisplayName,
      });

      const info = await transporter.sendMail({
        from: fromAddress,
        to: existingEmail.recipientEmail,
        subject: existingEmail.subject,
        text: existingEmail.body,
        html: `<div style="font-family: sans-serif; line-height: 1.6; color: #111;">
          <p>${existingEmail.body.replace(/\\n/g, '<br/>')}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #888;">Sent via ReachInbox Outbound Email Scheduler</p>
        </div>`,
      });

      const isRealMode = config.smtp.provider === 'real';
      const previewUrl = isRealMode ? null : nodemailer.getTestMessageUrl(info) || null;
      const messageId = info.messageId || `reachinbox-${Date.now()}`;
      const sentAt = new Date();

      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'SENT',
          sentAt,
          messageId,
          etherealUrl: previewUrl,
          errorMessage: null,
        },
      });

      ElasticService.indexEmail({
        id: emailId,
        campaignId: existingEmail.campaignId,
        userId: existingEmail.userId,
        senderId: existingEmail.senderId,
        senderEmail: activeSenderEmail,
        recipientEmail: existingEmail.recipientEmail,
        subject: existingEmail.subject,
        body: existingEmail.body,
        status: 'SENT',
        scheduledAt: existingEmail.scheduledAt.toISOString(),
        sentAt: sentAt.toISOString(),
        messageId,
        createdAt: existingEmail.createdAt.toISOString(),
      }).catch(() => {});

      return {
        success: true,
        emailId,
        status: 'SENT',
        messageId,
        etherealUrl: previewUrl,
      };
    } catch (sendError) {
      const errorMessage = (sendError as Error).message;
      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'FAILED',
          errorMessage,
        },
      });

      return {
        success: false,
        emailId,
        status: 'FAILED',
        error: errorMessage,
      };
    }
  }

  /**
   * Process all currently due emails from database (for Vercel Cron / Serverless worker)
   */
  public static async processDueScheduledEmails(limit = 20): Promise<{
    processed: number;
    results: any[];
  }> {
    const dueEmails = await prisma.scheduledEmail.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: new Date() },
      },
      take: limit,
      orderBy: { scheduledAt: 'asc' },
    });

    const results = [];
    for (const email of dueEmails) {
      const res = await this.processSingleScheduledEmail(email.id);
      results.push(res);
    }

    return {
      processed: results.length,
      results,
    };
  }
}
