import { prisma } from '../config/db';
import { EmailService } from '../services/emailService';
import { createOrGetDevUser } from '../services/authService';

async function seed() {
  console.log('----------------------------------------------------');
  console.log('🌱 Seeding ReachInbox Demonstration Workload...');
  console.log('----------------------------------------------------');

  const { user } = await createOrGetDevUser('demo@reachinbox.ai', 'ReachInbox Demo User');
  console.log(`User: ${user.name} (${user.email})`);

  let sender = await prisma.sender.findFirst({
    where: { userId: user.id },
  });

  if (!sender) {
    sender = await prisma.sender.create({
      data: {
        userId: user.id,
        email: 'alex.recruiter@reachinbox.ai',
        displayName: 'Alex Recruiter',
        hourlyLimit: 10, // Small limit for testing rate-limiting and Slack alerts easily!
      },
    });
  }

  console.log(`Sender: ${sender.displayName} <${sender.email}> (Hourly Limit: ${sender.hourlyLimit})`);

  const demoRecipients = [
    'alice.johnson@techcorp.io',
    'bob.smith@cloudventures.co',
    'charlie.davis@fintechgrowth.com',
    'dana.white@aiinnovations.org',
    'evan.wright@nextgenlabs.dev',
    'fiona.miller@scalepartners.vc',
    'george.clark@enterprisehq.com',
    'hannah.lewis@devopsengine.io',
    'ian.walker@datalabs.ai',
    'julia.roberts@productcraft.org',
    'kevin.turner@inboxvelocity.com',
    'laura.hall@reachoutbox.io',
    'marcus.young@fastpipeline.co',
    'natalie.king@growthmetrics.dev',
    'oliver.scott@saasoutbox.com',
    'patricia.green@leadsync.ai',
    'quentin.adams@outboundpro.net',
    'rachel.baker@hirefast.org',
    'steven.gonzalez@talentops.co',
    'tanya.nelson@reachinbox.test',
  ];

  console.log(`Scheduling ${demoRecipients.length} emails with 2000ms delay...`);

  const result = await EmailService.scheduleEmails(user.id, {
    senderId: sender.id,
    subject: 'Accelerate your outbound pipeline with ReachInbox AI',
    body: 'Hi there,\n\nI noticed your team is scaling outbound outreach. ReachInbox offers distributed queue-based scheduling with atomic rate-limiting, persistence across restarts, and real-time Slack alerts.\n\nWould you be open to a 10-minute demo this Thursday?\n\nBest regards,\nAlex',
    recipients: demoRecipients,
    startTime: new Date(),
    delayMs: 2000,
    hourlyLimit: sender.hourlyLimit,
  });

  console.log('✅ Demo Workload Seeded Successfully!');
  console.log(`Campaign ID: ${result.campaignId}`);
  console.log(`Total Emails Scheduled: ${result.totalScheduled}`);
  console.log(`Start Time: ${result.startTime}`);
  console.log(`Delay: ${result.delayMs}ms between emails`);
  console.log('----------------------------------------------------');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Error seeding workload:', err);
  process.exit(1);
});
