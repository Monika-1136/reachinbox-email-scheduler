import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue, getQueueMetrics } from '../services/queueService';
import { Request, Response } from 'express';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue as any) as any],
  serverAdapter,
});

export const bullBoardRouter = serverAdapter.getRouter();

export async function getQueueStatsHandler(_req: Request, res: Response): Promise<void> {
  const stats = await getQueueMetrics();
  res.json({
    success: true,
    data: stats,
  });
}
