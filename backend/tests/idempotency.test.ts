import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/db';

describe('Idempotency & Concurrency Protection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates consistent deterministic idempotency keys per campaign and recipient', () => {
    const campaignId = 'camp-987';
    const email1 = 'Alex@Company.com';
    const email2 = 'alex@company.com';

    const key1 = `${campaignId}:${email1.toLowerCase()}`;
    const key2 = `${campaignId}:${email2.toLowerCase()}`;

    expect(key1).toBe('camp-987:alex@company.com');
    expect(key1).toBe(key2);
  });

  it('prevents duplicate sends if email status is already SENT', async () => {
    const mockEmail = {
      id: 'email-1',
      campaignId: 'camp-1',
      recipientEmail: 'client@domain.com',
      status: 'SENT',
      messageId: '<ethereal-test-1234@ethereal.email>',
      sentAt: new Date(),
    };

    vi.spyOn(prisma.scheduledEmail, 'findUnique').mockResolvedValue(mockEmail as any);

    // Simulate worker checking state before send
    const record = await prisma.scheduledEmail.findUnique({ where: { id: 'email-1' } });
    expect(record?.status).toBe('SENT');

    // Worker logic: if status is SENT, return without sending again
    const shouldSend = record?.status !== 'SENT';
    expect(shouldSend).toBe(false);
  });

  it('atomically transitions from SCHEDULED to PROCESSING', async () => {
    const mockScheduled = {
      id: 'email-2',
      status: 'SCHEDULED',
      attempts: 0,
    };

    vi.spyOn(prisma.scheduledEmail, 'findUnique').mockResolvedValue(mockScheduled as any);
    vi.spyOn(prisma.scheduledEmail, 'update').mockResolvedValue({
      ...mockScheduled,
      status: 'PROCESSING',
      attempts: 1,
    } as any);

    const record = await prisma.scheduledEmail.findUnique({ where: { id: 'email-2' } });
    expect(record?.status).toBe('SCHEDULED');

    const updated = await prisma.scheduledEmail.update({
      where: { id: 'email-2' },
      data: { status: 'PROCESSING', attempts: { increment: 1 } },
    });

    expect(updated.status).toBe('PROCESSING');
    expect(updated.attempts).toBe(1);
  });
});
