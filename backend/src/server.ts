import { createApp } from './app';
import { config } from './config/env';
import { connectDb, prisma } from './config/db';
import { initElasticsearch } from './config/elasticsearch';
import { createEmailWorker } from './workers/emailWorker';
import { redisClient } from './config/redis';

async function bootstrap() {
  console.log('----------------------------------------------------');
  console.log('🚀 Starting ReachInbox Production Email Scheduler API');
  console.log('----------------------------------------------------');

  // 1. Connect to PostgreSQL via Prisma
  await connectDb();

  // 2. Initialize Elasticsearch index
  await initElasticsearch();

  // 3. Start BullMQ Email Worker embedded in server
  const emailWorker = createEmailWorker();

  // 4. Create and start Express server
  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log(`\n✅ Backend Server listening on http://localhost:${config.port}`);
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
        console.log('[Database] PostgreSQL disconnected.');
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

bootstrap().catch((err) => {
  console.error('[Server] Fatal bootstrap error:', err);
  process.exit(1);
});
