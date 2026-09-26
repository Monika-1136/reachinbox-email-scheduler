import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElasticService } from '../src/services/elasticService';
import { prisma } from '../src/config/db';

describe('Elasticsearch & Search Service', () => {
  const userId = 'user-es-123';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('performs database fallback search when Elasticsearch is in degraded state', async () => {
    const mockEmails = [
      {
        id: 'email-es-1',
        userId,
        recipientEmail: 'target@enterprise.com',
        subject: 'Enterprise Outbound Partnership',
        body: 'Excited to connect about scaling your SDR pipeline.',
        status: 'SENT',
        scheduledAt: new Date(),
        sentAt: new Date(),
      },
    ];

    vi.spyOn(prisma.scheduledEmail, 'findMany').mockResolvedValue(mockEmails as any);
    vi.spyOn(prisma.scheduledEmail, 'count').mockResolvedValue(1);

    const result = await ElasticService.searchEmails(userId, 'Enterprise', undefined, 10, 0);

    expect(result.total).toBe(1);
    expect(result.emails.length).toBe(1);
    expect(result.emails[0].recipientEmail).toBe('target@enterprise.com');
  });

  it('filters search by status', async () => {
    vi.spyOn(prisma.scheduledEmail, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.scheduledEmail, 'count').mockResolvedValue(0);

    const result = await ElasticService.searchEmails(userId, '', 'SCHEDULED', 10, 0);
    expect(result.total).toBe(0);
    expect(prisma.scheduledEmail.findMany).toHaveBeenCalled();
  });
});
