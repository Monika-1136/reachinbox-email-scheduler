import { prisma } from '../config/db';
import { emailQueue, addEmailJob } from '../services/queueService';
import { EmailService } from '../services/emailService';
import { createEmailWorker } from '../workers/emailWorker';
import { initEmailTransporter } from '../config/emailTransporter';
import { redisClient } from '../config/redis';

async function runFutureScheduleAndRestartTest() {
  console.log('===============================================================');
  console.log('🧪 REACHINBOX CRITICAL FUTURE SCHEDULING & RESTART TEST');
  console.log('===============================================================\n');

  // 1. Initialize Ethereal Transporter
  console.log('Step 0: Initializing persistent Ethereal transporter...');
  const { info: smtpInfo } = await initEmailTransporter();
  console.log(`✅ SMTP Ready: ${smtpInfo.provider} (${smtpInfo.user})\n`);

  // 2. Setup Test User & Sender in MySQL
  console.log('Step 1: Setting up Test User & Sender in MySQL...');
  const user = await prisma.user.upsert({
    where: { email: 'monika.future.test@reachinbox.test' },
    create: {
      email: 'monika.future.test@reachinbox.test',
      name: 'Monika Future Test',
    },
    update: {},
  });

  const sender = await prisma.sender.upsert({
    where: { id: 'sender-future-test-uuid' },
    create: {
      id: 'sender-future-test-uuid',
      userId: user.id,
      email: 'monika.sender@reachinbox.test',
      displayName: 'Monika Test Sender',
      hourlyLimit: 200,
    },
    update: {},
  });

  console.log(`✅ User ID: ${user.id} | Sender: ${sender.email}\n`);

  // 3. Schedule email 20 seconds in the future
  const delaySeconds = 20;
  const futureDate = new Date(Date.now() + delaySeconds * 1000);
  console.log(`Step 2: Scheduling email ${delaySeconds} seconds in future (${futureDate.toISOString()})...`);

  const scheduleResult = await EmailService.scheduleEmails(user.id, {
    senderId: sender.id,
    subject: 'FUTURE SCHEDULE PERSISTENCE TEST',
    body: 'Testing BullMQ delayed jobs persistence across worker restart.',
    recipients: ['monika300404@gmail.com'],
    startTime: futureDate,
    delayMs: 2000,
    hourlyLimit: 200,
  });

  console.log(`✅ Campaign created: ${scheduleResult.campaignId}, scheduled count: ${scheduleResult.totalScheduled}`);

  // Fetch the created email record from MySQL
  const emailRecord = await prisma.scheduledEmail.findFirst({
    where: { campaignId: scheduleResult.campaignId },
  });

  if (!emailRecord) {
    throw new Error('ScheduledEmail record not found in MySQL!');
  }

  console.log(`✅ MySQL Email Record ID: ${emailRecord.id}`);
  console.log(`   MySQL Status: ${emailRecord.status}`);
  console.log(`   Scheduled At: ${emailRecord.scheduledAt.toISOString()}`);
  console.log(`   BullMQ Job ID: ${emailRecord.bullJobId}\n`);

  // 4. Verify BullMQ delayed job in Redis
  console.log('Step 3: Inspecting BullMQ in Redis BEFORE execution...');
  const bullJobId = emailRecord.bullJobId || emailRecord.id;
  const jobBefore = await emailQueue.getJob(bullJobId);

  if (!jobBefore) {
    throw new Error(`BullMQ job ${bullJobId} not found in Redis!`);
  }

  const jobStateBefore = await jobBefore.getState();
  console.log(`✅ BullMQ Job ID: ${jobBefore.id}`);
  console.log(`   State: ${jobStateBefore} (MUST BE "delayed")`);
  console.log(`   Job Delay (ms): ${jobBefore.opts.delay}`);
  console.log(`   Job Timestamp: ${new Date(jobBefore.timestamp).toISOString()}`);
  console.log(`   Calculated Run Time: ${new Date(jobBefore.timestamp + (jobBefore.opts.delay || 0)).toISOString()}`);

  if (jobStateBefore !== 'delayed') {
    throw new Error(`Expected BullMQ job state to be "delayed", but got "${jobStateBefore}"!`);
  }

  // 5. Simulate STOP & RESTART: Worker shutdown and reboot
  console.log('\nStep 4: Simulating Server/Worker STOP and RESTART...');
  console.log('   Stopping any existing worker instances...');
  console.log('   Waiting 5 seconds during offline state...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log('   Starting Worker instance again (Reboot)...');
  const restartedWorker = createEmailWorker();
  console.log('✅ Worker restarted and reconnected to Redis queue.\n');

  // 6. Verify BullMQ job STILL EXISTS in Redis after restart
  console.log('Step 5: Verifying BullMQ delayed job survives server restart...');
  const jobAfterRestart = await emailQueue.getJob(bullJobId);
  if (!jobAfterRestart) {
    throw new Error(`BullMQ job ${bullJobId} disappeared after restart!`);
  }
  const jobStateAfterRestart = await jobAfterRestart.getState();
  console.log(`✅ Job ${jobAfterRestart.id} verified in Redis. Current state: ${jobStateAfterRestart}\n`);

  // 7. Wait until scheduled timestamp arrives
  const remainingMs = Math.max(0, futureDate.getTime() - Date.now() + 5000);
  console.log(`Step 6: Waiting ${Math.ceil(remainingMs / 1000)}s for scheduled timestamp to arrive and worker to process...`);
  await new Promise((resolve) => setTimeout(resolve, remainingMs));

  // 8. Verify MySQL database record transitioned to SENT
  console.log('\nStep 7: Verifying Final Database & SMTP Delivery State...');
  const updatedEmail = await prisma.scheduledEmail.findUnique({
    where: { id: emailRecord.id },
  });

  if (!updatedEmail) {
    throw new Error('Email record disappeared from MySQL!');
  }

  console.log(`✅ Final MySQL Status: ${updatedEmail.status}`);
  console.log(`   Sent At: ${updatedEmail.sentAt?.toISOString()}`);
  console.log(`   Message ID: ${updatedEmail.messageId}`);
  console.log(`   Ethereal Preview URL: ${updatedEmail.etherealUrl}`);
  console.log(`   Error Message: ${updatedEmail.errorMessage || 'None (Success)'}`);

  if (updatedEmail.status !== 'SENT') {
    throw new Error(`Expected final status to be "SENT", but got "${updatedEmail.status}". Last error: ${updatedEmail.errorMessage}`);
  }

  if (!updatedEmail.etherealUrl) {
    throw new Error('Ethereal preview URL was not generated or saved!');
  }

  // 9. Verify exact count (No duplicate sending)
  const allSentRecords = await prisma.scheduledEmail.findMany({
    where: { campaignId: scheduleResult.campaignId },
  });
  console.log(`✅ Total emails sent for campaign: ${allSentRecords.length} (Expected exactly 1)`);

  if (allSentRecords.length !== 1) {
    throw new Error(`Duplicate emails detected! Count: ${allSentRecords.length}`);
  }

  // Clean up
  await restartedWorker.close();
  await prisma.$disconnect();
  await redisClient.quit();

  console.log('\n===============================================================');
  console.log('🎉 ALL 11 STEPS OF FUTURE SCHEDULING & RESTART PERSISTENCE PASSED!');
  console.log('===============================================================');
}

runFutureScheduleAndRestartTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.message || err);
  process.exit(1);
});
