import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimiterService } from '../src/services/rateLimiterService';
import { redisClient } from '../src/config/redis';

describe('RateLimiterService - Atomic Rate Limiting & Throttling', () => {
  const senderId = 'test-sender-uuid-1234';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should correctly calculate the current hour window and next hour offset', () => {
    // 2026-09-26 10:15:00 UTC
    const fixedTime = new Date('2026-09-26T10:15:00.000Z').getTime();
    const hourWindow = RateLimiterService.getCurrentHourWindow(fixedTime);
    expect(hourWindow).toBe(Math.floor(fixedTime / 3600000));

    const msUntilNext = RateLimiterService.getMillisecondsUntilNextHour(fixedTime);
    // 45 minutes until 11:00:00 = 45 * 60 * 1000 = 2,700,000 ms
    expect(msUntilNext).toBe(45 * 60 * 1000);
  });

  it('should allow send slots up to the hourly limit and reject slots exceeding limit', async () => {
    const hourlyLimit = 3;
    let currentIncr = 0;

    // Mock Redis eval to simulate atomic Lua script behavior
    vi.spyOn(redisClient, 'eval').mockImplementation(async () => {
      currentIncr++;
      if (currentIncr <= hourlyLimit) {
        return [1, currentIncr]; // [allowed: 1, currentCount]
      }
      return [0, currentIncr - 1]; // [allowed: 0, currentCount]
    });

    const res1 = await RateLimiterService.checkAndReserveHourlySlot(senderId, hourlyLimit);
    expect(res1.allowed).toBe(true);

    const res2 = await RateLimiterService.checkAndReserveHourlySlot(senderId, hourlyLimit);
    expect(res2.allowed).toBe(true);

    const res3 = await RateLimiterService.checkAndReserveHourlySlot(senderId, hourlyLimit);
    expect(res3.allowed).toBe(true);

    // 4th request exceeds hourly limit of 3
    const res4 = await RateLimiterService.checkAndReserveHourlySlot(senderId, hourlyLimit);
    expect(res4.allowed).toBe(false);
    expect(res4.retryDelayMs).toBeGreaterThan(0);
    expect(res4.limit).toBe(3);
  });

  it('should enforce rate limits correctly across concurrent worker calls', async () => {
    const hourlyLimit = 5;
    let count = 0;

    vi.spyOn(redisClient, 'eval').mockImplementation(async () => {
      count++;
      if (count <= hourlyLimit) {
        return [1, count];
      }
      return [0, count - 1];
    });

    // Simulate 12 concurrent workers racing for slots
    const concurrentRequests = Array.from({ length: 12 }, () =>
      RateLimiterService.checkAndReserveHourlySlot(senderId, hourlyLimit)
    );

    const results = await Promise.all(concurrentRequests);
    const allowedCount = results.filter((r) => r.allowed).length;
    const rejectedCount = results.filter((r) => !r.allowed).length;

    expect(allowedCount).toBe(5);
    expect(rejectedCount).toBe(7);
    // All rejected workers must receive valid retry delay to the next hour
    results
      .filter((r) => !r.allowed)
      .forEach((r) => {
        expect(r.retryDelayMs).toBeGreaterThan(0);
      });
  });

  it('should enforce minimum delay between successive sends', async () => {
    const minDelayMs = 2000;

    // Simulate first send: allowed
    vi.spyOn(redisClient, 'eval')
      .mockResolvedValueOnce([1, 0])
      // Second send within delay: rejected with waitMs
      .mockResolvedValueOnce([0, 1500]);

    const first = await RateLimiterService.checkAndReserveMinDelaySlot(senderId, minDelayMs);
    expect(first.allowed).toBe(true);
    expect(first.waitMs).toBe(0);

    const second = await RateLimiterService.checkAndReserveMinDelaySlot(senderId, minDelayMs);
    expect(second.allowed).toBe(false);
    expect(second.waitMs).toBe(1500);
  });
});
