import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlackService } from '../src/services/slackService';
import { redisClient } from '../src/config/redis';
import { prisma } from '../src/config/db';

vi.mock('@slack/web-api', () => {
  const mockPostMessage = vi.fn().mockResolvedValue({ ok: true, ts: '12345.67' });
  const mockList = vi.fn().mockResolvedValue({ ok: true, channels: [{ id: 'C123456' }] });
  const mockAccess = vi.fn().mockResolvedValue({ ok: true, access_token: 'xoxb-test' });

  function MockWebClient(this: any) {
    this.chat = { postMessage: mockPostMessage };
    this.conversations = { list: mockList };
    this.oauth = { v2: { access: mockAccess } };
    return this;
  }

  return { WebClient: MockWebClient };
});

describe('SlackService - Live OAuth & Rate-Limit Notifications', () => {
  const userId = 'user-uuid-slack-test';
  const senderId = 'sender-uuid-test';
  const senderEmail = 'outreach@reachinbox.test';
  const hourlyLimit = 200;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates standard Slack OAuth authorization URL with correct scopes', () => {
    const state = 'test-state-1234';
    const url = SlackService.getAuthorizationUrl(state);

    expect(url).toContain('https://slack.com/oauth/v2/authorize');
    expect(url).toContain('chat%3Awrite');
    expect(url).toContain('state=test-state-1234');
  });

  it('deduplicates Slack rate-limit alert for the same sender and hour window', async () => {
    // First call: Redis NX succeeds (key acquired)
    vi.spyOn(redisClient, 'set')
      .mockResolvedValueOnce('OK')
      // Second call in same hour window: Redis NX returns null (already set)
      .mockResolvedValueOnce(null);

    // Mock DB slack connection
    vi.spyOn(prisma.slackConnection, 'findUnique').mockResolvedValue({
      id: 'slack-1',
      userId,
      accessToken: 'xoxb-fake-slack-token',
      channelId: 'C12345678',
      disconnectedAt: null,
    } as any);

    const firstNotification = await SlackService.sendRateLimitAlert(
      userId,
      senderId,
      senderEmail,
      hourlyLimit,
      500000
    );

    // First attempt sends or attempts send
    expect(redisClient.set).toHaveBeenCalledTimes(1);

    const secondNotification = await SlackService.sendRateLimitAlert(
      userId,
      senderId,
      senderEmail,
      hourlyLimit,
      500000
    );

    // Second attempt is deduplicated and immediately returns false without spamming Slack
    expect(secondNotification).toBe(false);
  });

  it('gracefully handles disconnected Slack state without throwing errors or crashing worker', async () => {
    // Redis set allows alert check
    vi.spyOn(redisClient, 'set').mockResolvedValueOnce('OK');

    // DB returns null / disconnected
    vi.spyOn(prisma.slackConnection, 'findUnique').mockResolvedValue(null);

    const result = await SlackService.sendRateLimitAlert(
      userId,
      senderId,
      senderEmail,
      hourlyLimit
    );

    expect(result).toBe(false);
  });
});
