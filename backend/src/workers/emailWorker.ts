import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { redisOptions } from '../config/redis';
import { prisma } from '../config/db';
import { config } from '../config/env';
import { EMAIL_QUEUE_NAME } from '../services/queueService';
import { ElasticService } from '../services/elasticService';
import { getEmailTransporter } from '../config/emailTransporter';
import { EmailJobData } from '../types';

export function createEmailWorker(): Worker<EmailJobData> {
  const concurrency = config.worker.concurrency;

  console.log(`[Worker] Initializing Email Worker with concurrency = ${concurrency}`);

  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailId, campaignId, userId, senderId, senderEmail, recipientEmail, subject, body } = job.data;

      // 1. Idempotency Check & Record Retrieval
      const existingEmail = await prisma.scheduledEmail.findUnique({
        where: { id: emailId },
        include: { sender: true },
      });

      if (!existingEmail) {
        console.warn(`[EmailWorker] Email record ${emailId} not found in database. Skipping.`);
        return { skipped: true, reason: 'Record not found' };
      }

      if (existingEmail.status === 'SENT') {
        console.log(`[EmailWorker] Idempotency: Email ${emailId} is already marked SENT. Skipping dispatch.`);
        return { sent: true, alreadySent: true, messageId: existingEmail.messageId };
      }

      // 2. Fetch Sender details
      const sender = existingEmail.sender || (await prisma.sender.findUnique({ where: { id: senderId } }));
      const activeSenderEmail = sender?.email || senderEmail;
      const activeDisplayName = sender?.displayName || null;

      // 3. Atomically transition to PROCESSING
      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
        },
      });

      // 4. Send Email via Transporter
      try {
        const { transporter, fromAddress } = await getEmailTransporter({
          email: activeSenderEmail,
          displayName: activeDisplayName,
        });

        // Safe development log (NEVER logs credentials or secrets)
        console.log(
          `[EmailWorker]\n` +
          `  Email ID: ${emailId}\n` +
          `  Campaign ID: ${campaignId}\n` +
          `  Job ID: ${job.id}\n` +
          `  From: ${fromAddress}\n` +
          `  To: ${recipientEmail}\n` +
          `  Subject: ${subject}`
        );

        const info = await transporter.sendMail({
          from: fromAddress,
          to: recipientEmail,
          subject: subject,
          text: body,
          html: `<div style="font-family: sans-serif; line-height: 1.6; color: #111;">
            <p>${body.replace(/\n/g, '<br/>')}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 11px; color: #888;">Sent via ReachInbox Outbound Email Scheduler</p>
          </div>`,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info) || null;
        const messageId = info.messageId || `reachinbox-${Date.now()}`;

        // Verify SMTP acceptance
        const accepted = Array.isArray(info.accepted) ? info.accepted.map((a: any) => String(a).toLowerCase()) : [];
        const isRecipientAccepted =
          accepted.length > 0 &&
          (accepted.includes(recipientEmail.toLowerCase()) || !info.rejected?.includes(recipientEmail));

        if (!isRecipientAccepted && info.rejected && info.rejected.length > 0) {
          throw new Error(`SMTP server rejected recipient: ${info.rejected.join(', ')}`);
        }

        console.log(`[EmailWorker] ✅ Email ${emailId} successfully accepted by SMTP for ${recipientEmail}! Message ID: ${messageId}`);
        if (previewUrl) {
          console.log(`[EmailWorker] 🔗 Ethereal Sandbox Preview URL: ${previewUrl}`);
        }

        const sentAt = new Date();

        // 5. Update MySQL state to SENT
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

        // 6. Synchronize with Elasticsearch
        ElasticService.indexEmail({
          id: emailId,
          campaignId,
          userId,
          senderId,
          senderEmail: activeSenderEmail,
          recipientEmail,
          subject,
          body,
          status: 'SENT',
          scheduledAt: updatedEmail.scheduledAt.toISOString(),
          sentAt: sentAt.toISOString(),
          messageId,
          createdAt: updatedEmail.createdAt.toISOString(),
        }).catch((err) => console.warn('[EmailWorker] Elasticsearch indexing warning:', err.message));

        return {
          sent: true,
          messageId,
          previewUrl,
          accepted: info.accepted,
        };
      } catch (sendError) {
        const errorMessage = (sendError as Error).message;
        console.error(`[EmailWorker] ❌ Failed to send email ${emailId} to ${recipientEmail}:`, errorMessage);

        // Update MySQL status to FAILED
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
            senderEmail: activeSenderEmail,
            recipientEmail,
            subject,
            body,
            status: 'FAILED',
            scheduledAt: existingEmail.scheduledAt.toISOString(),
            createdAt: existingEmail.createdAt.toISOString(),
          }).catch(() => {});
        }

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
