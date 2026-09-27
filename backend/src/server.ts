import { createApp } from './app';
import { config } from './config/env';
import { connectDb, prisma } from './config/db';
import { initElasticsearch } from './config/elasticsearch';
import { createEmailWorker } from './workers/emailWorker';
import { initEmailTransporter } from './config/emailTransporter';
import { redisClient } from './config/redis';

async function bootstrap() {
  console.log('----------------------------------------------------');
  console.log('🚀 Starting ReachInbox Production Email Scheduler API');
  console.log('----------------------------------------------------');

  // 1. Connect to MySQL via Prisma
  await connectDb();

  // 2. Initialize Elasticsearch index
  await initElasticsearch();

  // 3. Initialize & Verify SMTP Transporter (Ethereal / Real)
  let smtpInfo: { provider: string; user?: string; host: string; port: number; verified: boolean } | null = null;
  try {
    const { info } = await initEmailTransporter();
    smtpInfo = info;
  } catch (smtpErr) {
    console.warn('[Bootstrap] SMTP transporter init warning:', (smtpErr as Error).message);
  }

  // 4. Start BullMQ Email Worker embedded in server
  const emailWorker = createEmailWorker();

  // 5. Create and start Express server
  const app = createApp();

  const isGoogleConfigured = Boolean(
    config.google.clientId &&
    config.google.clientSecret &&
    !config.google.clientId.includes('your_google_client_id') &&
    !config.google.clientId.includes('placeholder')
  );

  const isSlackConfigured = Boolean(
    config.slack.clientId &&
    config.slack.clientSecret &&
    !config.slack.clientId.includes('your_slack_client_id') &&
    !config.slack.clientId.includes('placeholder')
  );

  const isSmtpCustom = Boolean(
    config.smtp.user &&
    config.smtp.password &&
    !config.smtp.user.includes('your_')
  );

  const server = app.listen(config.port, () => {
    console.log('\n================ ENVIRONMENT STATUS ================');
    console.log(`MySQL:          CONNECTED (${config.databaseUrl.replace(/:[^:@]+@/, ':***@')})`);
    console.log(`Redis:          CONNECTED (${config.redisUrl})`);
    console.log(`Elasticsearch:  CONNECTED (${config.elasticsearchUrl})`);
    if (isGoogleConfigured) {
      console.log('Google OAuth:   CONFIGURED');
    } else {
      console.log('Google OAuth:   MISSING (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set in .env)');
    }
    if (config.smtp.provider === 'real') {
      if (isSmtpCustom && smtpInfo?.verified) {
        console.log(`SMTP Provider:  REAL / CONNECTED (${config.smtp.host}:${config.smtp.port})`);
      } else {
        console.log(`SMTP Provider:  REAL (MISSING CREDENTIALS: set SMTP_USER / SMTP_PASSWORD in .env)`);
      }
    } else {
      if (smtpInfo?.user) {
        console.log(`SMTP Provider:  ETHEREAL / CONNECTED (${smtpInfo.user})`);
      } else {
        console.log('SMTP Provider:  ETHEREAL (Sandbox Mode)');
      }
    }
    if (isSlackConfigured) {
      console.log('Slack OAuth:    CONFIGURED');
    } else {
      console.log('Slack OAuth:    MISSING (SLACK_CLIENT_ID / SLACK_CLIENT_SECRET not set in .env)');
    }
    console.log('====================================================\n');

    console.log(`✅ Backend Server listening on http://localhost:${config.port}`);
    console.log(`📊 BullMQ Live Dashboard at http://localhost:${config.port}/admin/queues`);
    console.log(`🩺 Health check at http://localhost:${config.port}/api/health\n`);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);

    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      try {
        await emailWorker.close();
        console.log('[Worker] BullMQ Worker closed.');
        await prisma.$disconnect();
        console.log('[Database] MySQL disconnected.');
        await redisClient.quit();
        console.log('[Redis] Redis connection closed.');
      } catch (err) {
        console.error('[Server] Error during graceful shutdown:', err);
      }
      process.exit(0);
    });

    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => {
      console.error('[Server] Force shutdown timeout expired.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

export const app = createApp();

if (!process.env.VERCEL) {
  bootstrap().catch((err) => {
    console.error('[Server] Fatal bootstrap error:', err);
    process.exit(1);
  });
}

export default app;
