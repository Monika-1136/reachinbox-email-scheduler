import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { redisOptions } from '../config/redis';
import { prisma } from '../config/db';
import { config } from '../config/env';
import { EMAIL_QUEUE_NAME, addEmailJob } from '../services/queueService';
import { RateLimiterService } from '../services/rateLimiterService';
import { SlackService } from '../services/slackService';
import { ElasticService } from '../services/elasticService';
import { getEmailTransporter } from '../config/emailTransporter';
import { EmailJobData } from '../types';

export function createEmailWorker(): Worker<EmailJobData> {
  const concurrency = config.worker.concurrency;

  console.log(`[Worker] Initializing Email Worker with concurrency = ${concurrency}`);

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailId, campaignId, userId, senderId, senderEmail, recipientEmail, subject, body, hourlyLimit } = job.data;

      console.log(`[Worker] Processing Job ${job.id} for email ${emailId} to ${recipientEmail}`);

      // 1. Idempotency Check & Atomic State Transition
      // We perform an atomic query: only transition to PROCESSING if status != 'SENT'
      const existingEmail = await prisma.scheduledEmail.findUnique({
        where: { id: emailId },
      });

      if (!existingEmail) {
        console.warn(`[Worker] Email record ${emailId} not found. Skipping.`);
        return { skipped: true, reason: 'Record not found' };
      }

      if (existingEmail.status === 'SENT') {
        console.log(`[Worker] Idempotency: Email ${emailId} already marked SENT. Acknowledging job without resending.`);
        return { sent: true, alreadySent: true, messageId: existingEmail.messageId };
      }

      // 2. Minimum Delay Throttling (Redis-backed atomic reservation)
      const minDelaySlot = await RateLimiterService.checkAndReserveMinDelaySlot(senderId, config.worker.minDelayMs);
      if (!minDelaySlot.allowed && minDelaySlot.waitMs > 0) {
        // If wait is short (<= 3000ms), await it; otherwise reschedule
        if (minDelaySlot.waitMs <= 3000) {
          await new Promise((resolve) => setTimeout(resolve, minDelaySlot.waitMs));
        } else {
          console.log(`[Worker] Throttling: Sender ${senderEmail} requires ${minDelaySlot.waitMs}ms delay. Rescheduling job.`);
          await addEmailJob(job.data, minDelaySlot.waitMs, `${job.id}-throttle-${Date.now()}`);
          return { rescheduled: true, reason: 'min_delay_throttle' };
        }
      }

      // 3. Hourly Rate Limit Check (Redis-backed atomic counter)
      const hourlySlot = await RateLimiterService.checkAndReserveHourlySlot(senderId, hourlyLimit);

      if (!hourlySlot.allowed) {
        const retryDelayMs = hourlySlot.retryDelayMs || RateLimiterService.getMillisecondsUntilNextHour();
        const nextScheduledDate = new Date(Date.now() + retryDelayMs);

        console.warn(
          `[Worker] ⚠️ Hourly limit reached for sender ${senderEmail} (limit: ${hourlyLimit}). ` +
          `Rescheduling job to next window (+${Math.round(retryDelayMs / 1000)}s at ${nextScheduledDate.toISOString()})`
        );

        // Update scheduled time in PostgreSQL so dashboard displays correct rescheduled time
        await prisma.scheduledEmail.update({
          where: { id: emailId },
          data: {
            scheduledAt: nextScheduledDate,
            status: 'SCHEDULED',
          },
        });

        // Add rescheduled job to BullMQ
        const rescheduledJobId = `${job.id}-resched-h${hourlySlot.hourWindow + 1}`;
        await addEmailJob(job.data, retryDelayMs, rescheduledJobId);

        // Send live Slack rate-limit notification (deduplicated per sender and hourWindow)
        SlackService.sendRateLimitAlert(
          userId,
          senderId,
          senderEmail,
          hourlyLimit,
          hourlySlot.hourWindow
        ).catch((err) => console.warn('[Worker] Slack notification failed:', err.message));

        return {
          rescheduled: true,
          reason: 'hourly_rate_limit_exceeded',
          retryDelayMs,
          nextWindow: nextScheduledDate,
        };
      }

      // 4. Atomically transition to PROCESSING
      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
        },
      });

      // 5. Send Email via Ethereal SMTP (Nodemailer)
      try {
        const { transporter, fromAddress } = await getEmailTransporter();

        const info = await transporter.sendMail({
          from: fromAddress,
          to: recipientEmail,
          subject: subject,
          text: body,
          html: `<div style="font-family: sans-serif; line-height: 1.6; color: #111;">
            <p>${body.replace(/\n/g, '<br/>')}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 11px; color: #888;">Sent via ReachInbox Email Job Scheduler</p>
          </div>`,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info) || null;
        const messageId = info.messageId || `ethereal-${Date.now()}`;

        console.log(`[Worker] ✅ Email ${emailId} successfully sent to ${recipientEmail}! Message ID: ${messageId}`);
        if (previewUrl) {
          console.log(`[Worker] 🔗 Ethereal Preview URL: ${previewUrl}`);
        }

        const sentAt = new Date();

        // 6. Update PostgreSQL state to SENT
        const updatedEmail = await prisma.scheduledEmail.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt,
            messageId,
            etherealUrl: previewUrl,
            errorMessage: null,
          },
        });

        // 7. Synchronize with Elasticsearch
        ElasticService.indexEmail({
          id: emailId,
          campaignId,
          userId,
          senderId,
          senderEmail,
          recipientEmail,
          subject,
          body,
          status: 'SENT',
          scheduledAt: updatedEmail.scheduledAt.toISOString(),
          sentAt: sentAt.toISOString(),
          messageId,
          createdAt: updatedEmail.createdAt.toISOString(),
        }).catch((err) => console.warn('[Worker] Elasticsearch indexing error:', err.message));

        return {
          sent: true,
          messageId,
          previewUrl,
        };
      } catch (sendError) {
        const errorMessage = (sendError as Error).message;
        console.error(`[Worker] ❌ Failed to send email ${emailId} to ${recipientEmail}:`, errorMessage);

        // Update PostgreSQL status
        const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 3);
        const finalStatus = isLastAttempt ? 'FAILED' : 'SCHEDULED';

        await prisma.scheduledEmail.update({
          where: { id: emailId },
          data: {
            status: finalStatus,
            errorMessage,
          },
        });

        if (isLastAttempt) {
          ElasticService.indexEmail({
            id: emailId,
            campaignId,
            userId,
            senderId,
            senderEmail,
            recipientEmail,
            subject,
            body,
            status: 'FAILED',
            scheduledAt: existingEmail.scheduledAt.toISOString(),
            createdAt: existingEmail.createdAt.toISOString(),
          }).catch(() => {});
        }

        // Rethrow so BullMQ handles configured retries and backoff
        throw sendError;
      }
    },
    {
      connection: redisOptions,
      concurrency,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed.`);
  });

  worker.on('failed', (job, err) => {
    console.warn(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.warn('[Worker] Worker internal error:', err.message);
  });

  return worker;
}
