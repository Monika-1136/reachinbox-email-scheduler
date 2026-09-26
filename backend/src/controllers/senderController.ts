import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { z } from 'zod';
import { config } from '../config/env';

export const createSenderSchema = z.object({
  email: z.string().email('Valid email address required'),
  displayName: z.string().min(1, 'Display name is required'),
  hourlyLimit: z.number().int().positive().default(config.worker.maxEmailsPerHour),
});

export class SenderController {
  public static async getSenders(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const senders = await prisma.sender.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      data: senders,
    });
  }

  public static async createSender(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { email, displayName, hourlyLimit } = req.body;

    const existing = await prisma.sender.findFirst({
      where: { userId, email: email.toLowerCase() },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: 'Sender with this email already exists for your account',
      });
      return;
    }

    const sender = await prisma.sender.create({
      data: {
        userId,
        email: email.toLowerCase(),
        displayName,
        hourlyLimit: hourlyLimit || config.worker.maxEmailsPerHour,
      },
    });

    res.status(201).json({
      success: true,
      data: sender,
    });
  }

  public static async deleteSender(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;

    const sender = await prisma.sender.findFirst({
      where: { id, userId },
    });

    if (!sender) {
      res.status(404).json({ success: false, message: 'Sender not found' });
      return;
    }

    // Check if this is the only sender
    const count = await prisma.sender.count({ where: { userId } });
    if (count <= 1) {
      res.status(400).json({ success: false, message: 'Cannot delete the only sender account' });
      return;
    }

    await prisma.sender.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Sender deleted successfully',
    });
  }

  public static async testSender(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;

    const sender = await prisma.sender.findFirst({
      where: { id, userId },
    });

    if (!sender) {
      res.status(404).json({ success: false, message: 'Sender not found' });
      return;
    }

    const { verifySmtpConnection } = await import('../config/emailTransporter');
    const result = await verifySmtpConnection();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  }
}
