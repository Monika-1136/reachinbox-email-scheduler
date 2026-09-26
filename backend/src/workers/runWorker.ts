import { createEmailWorker } from './emailWorker';
import { connectDb } from '../config/db';
import { initElasticsearch } from '../config/elasticsearch';

async function startStandaloneWorker() {
  console.log('[Worker Process] Starting standalone ReachInbox BullMQ Email Worker...');
  await connectDb();
  await initElasticsearch();
  const worker = createEmailWorker();

  const shutdown = async () => {
    console.log('[Worker Process] Gracefully shutting down worker...');
    await worker.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startStandaloneWorker().catch((err) => {
  console.error('[Worker Process] Fatal error starting worker:', err);
  process.exit(1);
});
