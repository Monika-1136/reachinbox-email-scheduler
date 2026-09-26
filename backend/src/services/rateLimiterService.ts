import { redisClient } from '../config/redis';
import { config } from '../config/env';

export interface RateLimitCheckResult {
  allowed: boolean;
  retryDelayMs?: number;
  hourWindow: number;
  currentCount?: number;
  limit: number;
}

export class RateLimiterService {
  /**
   * Determine the current hour window integer (hours since Unix epoch)
   */
  public static getCurrentHourWindow(timestamp = Date.now()): number {
    return Math.floor(timestamp / 3600000);
  }

  /**
   * Calculate milliseconds until the next hour window starts
   */
  public static getMillisecondsUntilNextHour(timestamp = Date.now()): number {
    const currentHour = this.getCurrentHourWindow(timestamp);
    const nextHourStart = (currentHour + 1) * 3600000;
    return Math.max(1000, nextHourStart - timestamp);
  }

  /**
   * Atomically reserve a send slot for a sender in the current hour window.
   * If limit is reached, returns allowed: false and calculated retryDelayMs.
   */
  public static async checkAndReserveHourlySlot(
    senderId: string,
    customHourlyLimit?: number
  ): Promise<RateLimitCheckResult> {
    const limit = customHourlyLimit || config.worker.maxEmailsPerHour;
    const hourWindow = this.getCurrentHourWindow();
    const redisKey = `email-rate:${senderId}:${hourWindow}`;
    const ttlSeconds = 7200; // 2 hours TTL to guarantee window overlap safety

    const luaScript = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local ttl = tonumber(ARGV[2])

      local current = redis.call('GET', key)
      if current and tonumber(current) >= limit then
        return {0, tonumber(current)}
      end

      local new_val = redis.call('INCR', key)
      if new_val == 1 then
        redis.call('EXPIRE', key, ttl)
      end
      return {1, new_val}
    `;

    try {
      const result = (await redisClient.eval(
        luaScript,
        1,
        redisKey,
        limit.toString(),
        ttlSeconds.toString()
      )) as [number, number];

      const allowed = result[0] === 1;
      const currentCount = result[1];

      if (!allowed) {
        // Calculate delay until next hour window plus small jitter (1-5s) to stagger concurrent workers
        const msUntilNextHour = this.getMillisecondsUntilNextHour();
        const jitter = Math.floor(Math.random() * 4000) + 1000;
        const retryDelayMs = msUntilNextHour + jitter;

        return {
          allowed: false,
          retryDelayMs,
          hourWindow,
          currentCount,
          limit,
        };
      }

      return {
        allowed: true,
        hourWindow,
        currentCount,
        limit,
      };
    } catch (error) {
      console.warn('[RateLimiter] Redis error in hourly check, falling back to permissive mode:', (error as Error).message);
      return {
        allowed: true,
        hourWindow,
        currentCount: 1,
        limit,
      };
    }
  }

  /**
   * Check and enforce minimum delay between sends for this sender.
   * Atomic across all concurrent workers.
   */
  public static async checkAndReserveMinDelaySlot(
    senderId: string,
    minDelayMs: number = config.worker.minDelayMs
  ): Promise<{ allowed: boolean; waitMs: number }> {
    const now = Date.now();
    const redisKey = `sender-last-send:${senderId}`;

    const luaScript = `
      local key = KEYS[1]
      local min_delay = tonumber(ARGV[1])
      local now = tonumber(ARGV[2])

      local last_send = redis.call('GET', key)
      if last_send then
        local diff = now - tonumber(last_send)
        if diff < min_delay then
          return {0, min_delay - diff}
        end
      end

      redis.call('SET', key, now, 'PX', min_delay * 10)
      return {1, 0}
    `;

    try {
      const result = (await redisClient.eval(
        luaScript,
        1,
        redisKey,
        minDelayMs.toString(),
        now.toString()
      )) as [number, number];

      const allowed = result[0] === 1;
      const waitMs = result[1];

      return { allowed, waitMs };
    } catch (error) {
      console.warn('[RateLimiter] Min delay check error:', (error as Error).message);
      return { allowed: true, waitMs: 0 };
    }
  }

  /**
   * Reset hourly limit for testing purposes
   */
  public static async resetHourlyLimit(senderId: string, hourWindow = this.getCurrentHourWindow()): Promise<void> {
    const redisKey = `email-rate:${senderId}:${hourWindow}`;
    await redisClient.del(redisKey);
  }
}
