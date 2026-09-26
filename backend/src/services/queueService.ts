import { Queue } from 'bullmq';
import { redisOptions } from '../config/redis';
import { EmailJobData } from '../types';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false, // keep for BullMQ dashboard visibility
    removeOnFail: false,
  },
});

export async function addEmailJob(
  jobData: EmailJobData,
  delayMs: number,
  jobId: string
): Promise<string> {
  const safeDelay = Math.max(0, Math.floor(delayMs));
  const job = await emailQueue.add('send-email', jobData, {
    delay: safeDelay,
    jobId, // Idempotent job key in BullMQ
  });
  return job.id as string;
}

export async function getQueueMetrics(): Promise<{
  waiting: number;
  delayed: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
}> {
  try {
    const [waiting, delayed, active, completed, failed] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getDelayedCount(),
      emailQueue.getActiveCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
    ]);

    return {
      waiting,
      delayed,
      active,
      completed,
      failed,
      total: waiting + delayed + active + completed + failed,
    };
  } catch (err) {
    console.warn('[BullMQ] Could not fetch queue metrics:', (err as Error).message);
    return { waiting: 0, delayed: 0, active: 0, completed: 0, failed: 0, total: 0 };
  }
}

export async function removeQueueJob(jobId: string): Promise<boolean> {
  try {
    const job = await emailQueue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
