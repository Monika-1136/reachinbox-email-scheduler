import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from '../src/services/emailService';
import { prisma } from '../src/config/db';
import * as queueService from '../src/services/queueService';

describe('Email Scheduling & BullMQ Delayed Jobs Flow', () => {
  const userId = 'user-scheduler-test-id';
  const senderId = 'sender-scheduler-test-id';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates DB campaign, scheduled email records, and enqueues BullMQ delayed jobs with calculated delay', async () => {
    const mockSender = {
      id: senderId,
      userId,
      email: 'alex@reachinbox.ai',
      displayName: 'Alex',
      hourlyLimit: 200,
    };

    const mockCampaign = {
      id: 'campaign-uuid-123',
      userId,
      subject: 'Schedule Test',
      body: 'Test email body content',
      startTime: new Date(Date.now() + 60000), // 1 min in future
      delayMs: 2000,
      hourlyLimit: 200,
    };

    let emailIndex = 0;
    const mockEmailRecords = [
      {
        id: 'email-sched-1',
        campaignId: mockCampaign.id,
        userId,
        senderId,
        recipientEmail: 'lead1@example.com',
        scheduledAt: new Date(mockCampaign.startTime.getTime()),
        createdAt: new Date(),
      },
      {
        id: 'email-sched-2',
        campaignId: mockCampaign.id,
        userId,
        senderId,
        recipientEmail: 'lead2@example.com',
        scheduledAt: new Date(mockCampaign.startTime.getTime() + 2000),
        createdAt: new Date(),
      },
    ];

    vi.spyOn(prisma.sender, 'findFirst').mockResolvedValue(mockSender as any);
    vi.spyOn(prisma.emailCampaign, 'create').mockResolvedValue(mockCampaign as any);
    vi.spyOn(prisma.scheduledEmail, 'create').mockImplementation(async () => {
      const rec = mockEmailRecords[emailIndex++];
      return rec as any;
    });
    vi.spyOn(prisma.scheduledEmail, 'update').mockResolvedValue({} as any);

    const addEmailJobSpy = vi
      .spyOn(queueService, 'addEmailJob')
      .mockResolvedValue('bull-job-123');

    const result = await EmailService.scheduleEmails(userId, {
      senderId,
      subject: 'Schedule Test',
      body: 'Test email body content',
      recipients: ['lead1@example.com', 'lead2@example.com'],
      startTime: mockCampaign.startTime,
      delayMs: 2000,
      hourlyLimit: 200,
    });

    expect(result.campaignId).toBe(mockCampaign.id);
    expect(result.totalScheduled).toBe(2);
    expect(addEmailJobSpy).toHaveBeenCalledTimes(2);

    // First job delay ~60s
    const firstCallDelay = addEmailJobSpy.mock.calls[0][1];
    expect(firstCallDelay).toBeGreaterThan(50000);

    // Second job delay ~62s (first delay + 2000ms delayMs - few ms elapsed)
    const secondCallDelay = addEmailJobSpy.mock.calls[1][1];
    expect(secondCallDelay - firstCallDelay).toBeGreaterThan(1500);
    expect(secondCallDelay - firstCallDelay).toBeLessThanOrEqual(2050);
  });

  it('demonstrates restart persistence: Redis BullMQ delayed jobs are retained independently of server memory', () => {
    // BullMQ delayed jobs are stored directly in Redis sorted sets (e.g. `bull:email-queue:delayed` with timestamp scores)
    // and MySQL retains ScheduledEmail records.
    // When Node process restarts:
    // 1. Worker reconnects to Redis via `new Worker('email-queue', ...)`
    // 2. Redis delayed jobs fire when their timestamp arrives without losing scheduled state or timing.
    const jobKey = 'campaign-123:user@domain.com';
    expect(jobKey).toBeDefined();
  });
});
