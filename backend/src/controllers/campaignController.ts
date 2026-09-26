import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { EmailService } from '../services/emailService';

export class CampaignController {
  public static async getCampaigns(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const campaigns = await prisma.emailCampaign.findMany({
      where: { userId },
      include: {
        _count: {
          select: { scheduledEmails: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: campaigns,
    });
  }

  public static async getCampaignById(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;

    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, userId },
      include: {
        scheduledEmails: {
          orderBy: { scheduledAt: 'asc' },
          take: 50,
        },
      },
    });

    if (!campaign) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    res.json({
      success: true,
      data: campaign,
    });
  }

  public static async createCampaign(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await EmailService.scheduleEmails(userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Campaign scheduled successfully',
      data: result,
    });
  }
}
