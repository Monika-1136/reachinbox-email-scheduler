import { Request, Response } from 'express';
import { z } from 'zod';
import { EmailService } from '../services/emailService';
import { ElasticService } from '../services/elasticService';
import { parseEmailList } from '../utils/csvParser';
import { prisma } from '../config/db';

export const scheduleEmailSchema = z.object({
  senderId: z.string().min(1, 'Sender ID is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string()).min(1, 'At least one recipient is required'),
  startTime: z.string().or(z.date()).optional(),
  delayMs: z.number().int().nonnegative().optional(),
  hourlyLimit: z.number().int().positive().optional(),
});

export class EmailController {
  public static async schedule(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await EmailService.scheduleEmails(userId, req.body);

    res.status(201).json({
      success: true,
      message: `Successfully scheduled ${result.totalScheduled} emails`,
      data: result,
    });
  }

  public static async getScheduled(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const data = await EmailService.getScheduledEmails(userId, page, limit);

    res.json({
      success: true,
      data: data.emails,
      meta: {
        total: data.total,
        page: data.page,
        totalPages: data.totalPages,
      },
    });
  }

  public static async getSent(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const data = await EmailService.getSentEmails(userId, page, limit);

    res.json({
      success: true,
      data: data.emails,
      meta: {
        total: data.total,
        page: data.page,
        totalPages: data.totalPages,
      },
    });
  }

  public static async search(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const q = (req.query.q as string) || '';
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const result = await ElasticService.searchEmails(userId, q, status, limit, offset);

    res.json({
      success: true,
      data: result.emails,
      meta: {
        total: result.total,
        source: result.source,
        query: q,
      },
    });
  }

  public static async getStats(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const stats = await EmailService.getEmailStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  }

  public static async getById(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;

    const email = await prisma.scheduledEmail.findFirst({
      where: { id, userId },
      include: { sender: true, campaign: true },
    });

    if (!email) {
      res.status(404).json({ success: false, message: 'Email not found' });
      return;
    }

    res.json({
      success: true,
      data: email,
    });
  }

  public static async cancel(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;

    const canceled = await EmailService.cancelScheduledEmail(userId, id);
    if (!canceled) {
      res.status(404).json({
        success: false,
        message: 'Email not found or already sent',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Scheduled email cancelled successfully',
    });
  }

  public static async parseCsv(req: Request, res: Response): Promise<void> {
    const { content } = req.body;
    if (typeof content !== 'string') {
      res.status(400).json({ success: false, message: 'Content string required' });
      return;
    }

    const result = parseEmailList(content);

    res.json({
      success: true,
      data: result,
    });
  }
}
