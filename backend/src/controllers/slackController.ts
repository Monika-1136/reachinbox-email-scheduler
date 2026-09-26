import { Request, Response } from 'express';
import { SlackService } from '../services/slackService';
import { config } from '../config/env';

export class SlackController {
  public static async connect(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;

    if (!config.slack.clientId || !config.slack.clientSecret) {
      // In development when Slack credentials are not yet entered in .env
      res.status(400).json({
        success: false,
        message: 'Slack OAuth credentials are not configured in backend .env',
      });
      return;
    }

    const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64');
    const authUrl = SlackService.getAuthorizationUrl(state);

    res.json({
      success: true,
      data: { authUrl },
    });
  }

  public static async callback(req: Request, res: Response): Promise<void> {
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code) {
      res.redirect(`${config.frontendUrl}/dashboard?tab=slack&error=Slack%20authorization%20code%20missing`);
      return;
    }

    try {
      let userId: string | undefined;
      if (state) {
        try {
          const parsed = JSON.parse(Buffer.from(state, 'base64').toString('ascii'));
          userId = parsed.userId;
        } catch {
          // ignore state parse error
        }
      }

      if (!userId && req.user) {
        userId = req.user.id;
      }

      if (!userId) {
        throw new Error('User context missing for Slack connection');
      }

      await SlackService.exchangeCodeForToken(code, userId);

      res.redirect(`${config.frontendUrl}/dashboard?tab=slack&slackConnected=true`);
    } catch (error) {
      console.error('[Slack Callback Error]', error);
      res.redirect(`${config.frontendUrl}/dashboard?tab=slack&error=${encodeURIComponent((error as Error).message)}`);
    }
  }

  public static async disconnect(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    await SlackService.disconnectSlack(userId);

    res.json({
      success: true,
      message: 'Slack disconnected successfully',
    });
  }

  public static async getStatus(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const status = await SlackService.getSlackStatus(userId);

    res.json({
      success: true,
      data: status,
    });
  }
}
