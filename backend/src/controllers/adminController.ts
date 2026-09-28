
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue, getQueueMetrics } from '../services/queueService';
import { Request, Response, NextFunction } from 'express';

let serverAdapter: ExpressAdapter | null = null;

function getServerAdapter(): ExpressAdapter {
  if (!serverAdapter) {
    serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');
    createBullBoard({
      queues: [new BullMQAdapter(emailQueue as any) as any],
      serverAdapter,
    });
  }
  return serverAdapter;
}

export const bullBoardRouter = (req: Request, res: Response, next: NextFunction) => {
  return getServerAdapter().getRouter()(req, res, next);
};

export async function getQueueStatsHandler(_req: Request, res: Response): Promise<void> {
  try {
    const stats = await getQueueMetrics();
    res.json({
      success: true,
      data: stats,
    });
  } catch (err: any) {
    res.json({
      success: true,
      data: {
        waiting: 0,
        delayed: 0,
        active: 0,
        completed: 0,
        failed: 0,
        total: 0,
      },
      warning: err.message,
    });
  }
}
