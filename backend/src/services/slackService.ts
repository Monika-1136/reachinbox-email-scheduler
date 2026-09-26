import { WebClient } from '@slack/web-api';
import { prisma } from '../config/db';
import { redisClient } from '../config/redis';
import { config } from '../config/env';
import { RateLimiterService } from './rateLimiterService';

export class SlackService {
  /**
   * Builds the official Slack OAuth authorization URL
   */
  public static getAuthorizationUrl(state: string): string {
    const scopes = ['chat:write', 'chat:write.public', 'channels:read'].join(',');
    const params = new URLSearchParams({
      client_id: config.slack.clientId,
      scope: scopes,
      redirect_uri: config.slack.redirectUri,
      state,
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for OAuth access token
   */
  public static async exchangeCodeForToken(code: string, userId: string): Promise<{
    teamName?: string;
    teamId?: string;
  }> {
    const client = new WebClient();
    const response = await client.oauth.v2.access({
      client_id: config.slack.clientId,
      client_secret: config.slack.clientSecret,
      code,
      redirect_uri: config.slack.redirectUri,
    });

    if (!response.ok || !response.access_token) {
      throw new Error(`Slack OAuth failed: ${response.error || 'Unknown error'}`);
    }

    const accessToken = response.access_token as string;
    const teamId = response.team?.id;
    const teamName = response.team?.name;
    const authedUserId = response.authed_user?.id;
    const incomingWebhookChannel = (response.incoming_webhook as { channel?: string; channel_id?: string })?.channel_id;

    // Store in MySQL
    await prisma.slackConnection.upsert({
      where: { userId },
      create: {
        userId,
        accessToken,
        teamId,
        teamName,
        slackUserId: authedUserId,
        channelId: incomingWebhookChannel,
        connectedAt: new Date(),
        disconnectedAt: null,
      },
      update: {
        accessToken,
        teamId,
        teamName,
        slackUserId: authedUserId,
        channelId: incomingWebhookChannel,
        connectedAt: new Date(),
        disconnectedAt: null,
      },
    });

    return { teamName, teamId };
  }

  /**
   * Disconnect Slack for a user
   */
  public static async disconnectSlack(userId: string): Promise<boolean> {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      return false;
    }

    await prisma.slackConnection.update({
      where: { userId },
      data: {
        disconnectedAt: new Date(),
        accessToken: '', // safely clear token
      },
    });

    return true;
  }

  /**
   * Get user's Slack connection status
   */
  public static async getSlackStatus(userId: string): Promise<{
    connected: boolean;
    teamName?: string | null;
    connectedAt?: Date | null;
  }> {
    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
    });

    if (!connection || connection.disconnectedAt || !connection.accessToken) {
      return { connected: false };
    }

    return {
      connected: true,
      teamName: connection.teamName,
      connectedAt: connection.connectedAt,
    };
  }

  /**
   * Send live Slack notification when sender hourly limit is reached.
   * Fully deduplicated using Redis key `slack-rate-limit-notified:{senderId}:{hourWindow}`.
   */
  public static async sendRateLimitAlert(
    userId: string,
    senderId: string,
    senderEmail: string,
    hourlyLimit: number,
    hourWindow = RateLimiterService.getCurrentHourWindow()
  ): Promise<boolean> {
    const dedupKey = `slack-rate-limit-notified:${senderId}:${hourWindow}`;

    try {
      // Deduplicate: atomic SET with NX (set only if not exists) and 2 hours TTL
      const acquired = await redisClient.set(dedupKey, '1', 'EX', 7200, 'NX');
      if (!acquired) {
        // Already notified for this sender in this hour window!
        return false;
      }

      // Check if user has an active Slack connection
      const connection = await prisma.slackConnection.findUnique({
        where: { userId },
      });

      if (!connection || connection.disconnectedAt || !connection.accessToken) {
        // Not connected or disconnected: do nothing without error or crash
        return false;
      }

      const client = new WebClient(connection.accessToken);

      // Find an appropriate channel to post to
      let targetChannel: string | null = connection.channelId;
      if (!targetChannel) {
        // Fetch list of public channels
        const channelsResponse = await client.conversations.list({
          types: 'public_channel',
          exclude_archived: true,
          limit: 10,
        });
        const firstChannel = channelsResponse.channels?.[0];
        targetChannel = firstChannel?.id || null;
      }

      if (!targetChannel) {
        console.warn(`[Slack] No available channel found to send alert for user ${userId}`);
        return false;
      }

      const messageText = `Email rate limit reached for sender ${senderEmail}. The hourly limit of ${hourlyLimit} emails has been reached. Remaining jobs have been rescheduled.`;

      await client.chat.postMessage({
        channel: targetChannel,
        text: messageText,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '⚠️ Email Rate Limit Reached',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Sender:*\n\`${senderEmail}\``,
              },
              {
                type: 'mrkdwn',
                text: `*Hourly Limit:*\n${hourlyLimit} emails/hour`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `The configured hourly sending limit has been exhausted for the current window. *Remaining email jobs have been automatically rescheduled* to the next hourly window without data loss.`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Sent by *ReachInbox Scheduler* • ${new Date().toUTCString()}`,
              },
            ],
          },
        ],
      });

      console.log(`[Slack] Successfully sent live rate-limit alert for sender ${senderEmail} to channel ${targetChannel}`);
      return true;
    } catch (error) {
      console.warn('[Slack] Failed to send rate-limit notification:', (error as Error).message);
      return false;
    }
  }
}
