import { prisma } from '../config/db';
import { emailQueue } from '../services/queueService';
import { EmailService } from '../services/emailService';
import { redisClient } from '../config/redis';

async function test1000LoadBehavior() {
  console.log('===============================================================');
  console.log('⚡ REACHINBOX 1000+ LOAD CAPACITY & CONCURRENCY TEST');
  console.log('===============================================================\n');

  // 1. Setup Test User & Sender
  console.log('Step 1: Setting up Test User & Sender...');
  const user = await prisma.user.upsert({
    where: { email: 'loadtest.user@reachinbox.test' },
    create: {
      email: 'loadtest.user@reachinbox.test',
      name: 'Load Test User',
    },
    update: {},
  });

  const sender = await prisma.sender.upsert({
    where: { id: 'sender-loadtest-1000-uuid' },
    create: {
      id: 'sender-loadtest-1000-uuid',
      userId: user.id,
      email: 'load.sender@reachinbox.test',
      displayName: 'Load Sender',
      hourlyLimit: 200,
    },
    update: {},
  });

  console.log(`✅ User ID: ${user.id} | Sender: ${sender.email}\n`);

  // 2. Generate 1000 distinct recipient email leads
  console.log('Step 2: Generating 1,000 distinct recipient leads...');
  const count = 1000;
  const recipients: string[] = [];
  for (let i = 1; i <= count; i++) {
    recipients.push(`loadtest.recipient.${i}@targetdomain.io`);
  }
  console.log(`✅ Generated ${recipients.length} leads in memory.\n`);

  // 3. Schedule 1000 emails with 500ms delay into the future (so SMTP is not flooded during test)
  console.log('Step 3: Scheduling 1,000 email campaign (startTime: +10 minutes)...');
  const futureStartTime = new Date(Date.now() + 10 * 60 * 1000);
  const startTimePerf = Date.now();

  const scheduleResult = await EmailService.scheduleEmails(user.id, {
    senderId: sender.id,
    subject: '1000+ Scalability and Buffer Verification',
    body: 'Testing high-volume distributed BullMQ job scheduling.',
    recipients,
    startTime: futureStartTime,
    delayMs: 500,
    hourlyLimit: 200,
  });

  const durationMs = Date.now() - startTimePerf;
  console.log(`✅ 1,000 emails scheduled in ${durationMs}ms!`);
  console.log(`   Campaign ID: ${scheduleResult.campaignId}`);
  console.log(`   Total Scheduled: ${scheduleResult.totalScheduled}\n`);

  // 4. Verify Database Consistency
  console.log('Step 4: Verifying MySQL database record consistency...');
  const dbCount = await prisma.scheduledEmail.count({
    where: { campaignId: scheduleResult.campaignId },
  });
  console.log(`✅ MySQL ScheduledEmail count: ${dbCount} / 1,000`);

  if (dbCount !== 1000) {
    throw new Error(`Expected 1,000 MySQL records, found ${dbCount}`);
  }

  // 5. Verify BullMQ & Redis Queue Responsiveness
  console.log('\nStep 5: Verifying BullMQ Queue & Redis sorted set responsiveness...');
  const delayedCount = await emailQueue.getDelayedCount();
  console.log(`✅ BullMQ Delayed Jobs in Redis: ${delayedCount} jobs`);

  if (delayedCount < 1000) {
    throw new Error(`Expected at least 1,000 delayed jobs in BullMQ, found ${delayedCount}`);
  }

  const pingResult = await redisClient.ping();
  console.log(`✅ Redis ping under load: ${pingResult}`);

  // 6. Clean up test load data from database and queue to leave workspace pristine
  console.log('\nStep 6: Cleaning up 1,000 load test records from MySQL & BullMQ...');
  const emails = await prisma.scheduledEmail.findMany({
    where: { campaignId: scheduleResult.campaignId },
    select: { bullJobId: true },
  });

  for (const em of emails) {
    if (em.bullJobId) {
      try {
        const job = await emailQueue.getJob(em.bullJobId);
        if (job) await job.remove();
      } catch {
        // ignore
      }
    }
  }

  await prisma.scheduledEmail.deleteMany({
    where: { campaignId: scheduleResult.campaignId },
  });
  await prisma.emailCampaign.delete({
    where: { id: scheduleResult.campaignId },
  });

  console.log('✅ Cleaned up test campaign and jobs from MySQL and Redis.');

  await prisma.$disconnect();
  await redisClient.quit();

  console.log('\n===============================================================');
  console.log('🎉 1000+ LOAD & SCALABILITY TEST PASSED WITH ZERO DATA LOSS!');
  console.log('===============================================================');
}

test1000LoadBehavior().catch((err) => {
  console.error('\n❌ LOAD TEST FAILED:', err.message || err);
  process.exit(1);
});
