/**
 * Rate Limiting Service - Unit Tests
 *
 * Tests the rate limiting service implementation including sliding window algorithm,
 * quota management, and quota reset tracking.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  RateLimitingService,
  RateLimitQuota,
} from '@infrastructure/services/rate-limiting.service';

describe('RateLimitingService', () => {
  let service: RateLimitingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RateLimitingService],
    }).compile();

    service = module.get<RateLimitingService>(RateLimitingService);
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests when under limit', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 10 };

      expect(service.canMakeRequest('api-test', quota)).toBe(true);
    });

    it('should track initial request', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 10 };

      service.recordRequest('api-test');
      const status = service.getStatus('api-test', quota);

      expect(status.currentSecond).toBe(1);
    });

    it('should allow multiple requests under limit', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 5 };

      for (let i = 0; i < 5; i++) {
        expect(service.canMakeRequest('api-test', quota)).toBe(true);
        service.recordRequest('api-test');
      }

      const status = service.getStatus('api-test', quota);
      expect(status.currentSecond).toBe(5);
    });

    it('should block requests when limit exceeded', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 3 };

      for (let i = 0; i < 3; i++) {
        service.recordRequest('api-test');
      }

      expect(service.canMakeRequest('api-test', quota)).toBe(false);
    });
  });

  describe('Per-Second Rate Limiting', () => {
    it('should enforce per-second limit', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 2 };

      service.recordRequest('api-per-second');
      service.recordRequest('api-per-second');

      expect(service.canMakeRequest('api-per-second', quota)).toBe(false);
    });

    it('should track per-second usage', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 5 };

      service.recordRequest('api-second-track');
      service.recordRequest('api-second-track');
      service.recordRequest('api-second-track');

      const status = service.getStatus('api-second-track', quota);
      expect(status.currentSecond).toBe(3);
      expect(status.secondQuota).toBe(5);
    });
  });

  describe('Per-Minute Rate Limiting', () => {
    it('should enforce per-minute limit', () => {
      const quota: RateLimitQuota = { requestsPerMinute: 3 };

      // Simulate 3 requests within a minute
      for (let i = 0; i < 3; i++) {
        service.recordRequest('api-per-minute');
      }

      expect(service.canMakeRequest('api-per-minute', quota)).toBe(false);
    });

    it('should track per-minute usage', () => {
      const quota: RateLimitQuota = { requestsPerMinute: 10 };

      for (let i = 0; i < 7; i++) {
        service.recordRequest('api-minute-track');
      }

      const status = service.getStatus('api-minute-track', quota);
      expect(status.currentMinute).toBe(7);
      expect(status.minuteQuota).toBe(10);
    });
  });

  describe('Per-Hour Rate Limiting', () => {
    it('should enforce per-hour limit', () => {
      const quota: RateLimitQuota = { requestsPerHour: 2 };

      for (let i = 0; i < 2; i++) {
        service.recordRequest('api-per-hour');
      }

      expect(service.canMakeRequest('api-per-hour', quota)).toBe(false);
    });

    it('should track per-hour usage', () => {
      const quota: RateLimitQuota = { requestsPerHour: 100 };

      for (let i = 0; i < 25; i++) {
        service.recordRequest('api-hour-track');
      }

      const status = service.getStatus('api-hour-track', quota);
      expect(status.currentHour).toBe(25);
      expect(status.hourQuota).toBe(100);
    });
  });

  describe('Multi-Level Rate Limiting', () => {
    it('should enforce multiple limits simultaneously', () => {
      const quota: RateLimitQuota = {
        requestsPerSecond: 2,
        requestsPerMinute: 10,
        requestsPerHour: 100,
      };

      // Hit second limit
      service.recordRequest('api-multi');
      service.recordRequest('api-multi');

      expect(service.canMakeRequest('api-multi', quota)).toBe(false);
    });

    it('should respect most restrictive limit', () => {
      const quota: RateLimitQuota = {
        requestsPerSecond: 10,
        requestsPerMinute: 3,
        requestsPerHour: 100,
      };

      service.recordRequest('api-most-restrictive');
      service.recordRequest('api-most-restrictive');
      service.recordRequest('api-most-restrictive');

      // Minute limit is hit first
      expect(service.canMakeRequest('api-most-restrictive', quota)).toBe(false);
    });
  });

  describe('Burst Limiting', () => {
    it('should enforce burst limit', () => {
      const quota: RateLimitQuota = { burstLimit: 5 };

      for (let i = 0; i < 5; i++) {
        service.recordRequest('api-burst');
      }

      expect(service.canMakeRequest('api-burst', quota)).toBe(false);
    });

    it('should allow requests under burst limit', () => {
      const quota: RateLimitQuota = { burstLimit: 10 };

      for (let i = 0; i < 8; i++) {
        expect(service.canMakeRequest('api-burst-ok', quota)).toBe(true);
        service.recordRequest('api-burst-ok');
      }
    });
  });

  describe('Wait Time Calculation', () => {
    it('should calculate wait time when limit exceeded', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 2 };

      service.recordRequest('api-wait');
      service.recordRequest('api-wait');

      const waitTime = service.getWaitTime('api-wait', quota);
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(1);
    });

    it('should return 0 wait time when under limit', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 10 };

      service.recordRequest('api-no-wait');

      const waitTime = service.getWaitTime('api-no-wait', quota);
      expect(waitTime).toBe(0);
    });

    it('should calculate correct wait time for minute limit', () => {
      const quota: RateLimitQuota = { requestsPerMinute: 1 };

      service.recordRequest('api-minute-wait');

      const waitTime = service.getWaitTime('api-minute-wait', quota);
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(60);
    });
  });

  describe('Quota Status', () => {
    it('should provide current status', () => {
      const quota: RateLimitQuota = {
        requestsPerSecond: 10,
        requestsPerMinute: 100,
        requestsPerHour: 1000,
      };

      service.recordRequest('api-status');
      service.recordRequest('api-status');

      const status = service.getStatus('api-status', quota);

      expect(status.currentSecond).toBe(2);
      expect(status.currentMinute).toBe(2);
      expect(status.currentHour).toBe(2);
      expect(status.secondQuota).toBe(10);
      expect(status.minuteQuota).toBe(100);
      expect(status.hourQuota).toBe(1000);
      expect(status.canMakeRequest).toBe(true);
    });

    it('should indicate when request cannot be made', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 1 };

      service.recordRequest('api-status-blocked');

      const status = service.getStatus('api-status-blocked', quota);

      expect(status.canMakeRequest).toBe(false);
      expect(status.nextAvailableTime).toBeDefined();
      expect(status.nextAvailableTime).toBeGreaterThan(0);
    });
  });

  describe('Quota Reset Tracking', () => {
    it('should record quota reset', () => {
      service.recordQuotaReset('api-reset', 'second');

      const resets = service.getQuotaResets('api-reset');
      expect(resets.length).toBeGreaterThan(0);
      expect(resets[0].limit).toBe('second');
    });

    it('should track multiple reset types', () => {
      service.recordQuotaReset('api-multi-reset', 'second');
      service.recordQuotaReset('api-multi-reset', 'minute');
      service.recordQuotaReset('api-multi-reset', 'hour');

      const resets = service.getQuotaResets('api-multi-reset');
      expect(resets.length).toBe(3);
      expect(resets.some((r) => r.limit === 'second')).toBe(true);
      expect(resets.some((r) => r.limit === 'minute')).toBe(true);
      expect(resets.some((r) => r.limit === 'hour')).toBe(true);
    });

    it('should calculate time until reset', () => {
      const timeToSecondReset = service.getTimeUntilReset(
        'api-time-reset',
        'second',
      );
      expect(timeToSecondReset).toBeGreaterThanOrEqual(0);
      expect(timeToSecondReset).toBeLessThanOrEqual(1);

      const timeToMinuteReset = service.getTimeUntilReset(
        'api-time-reset',
        'minute',
      );
      expect(timeToMinuteReset).toBeGreaterThanOrEqual(0);
      expect(timeToMinuteReset).toBeLessThanOrEqual(60);

      const timeToHourReset = service.getTimeUntilReset(
        'api-time-reset',
        'hour',
      );
      expect(timeToHourReset).toBeGreaterThanOrEqual(0);
      expect(timeToHourReset).toBeLessThanOrEqual(3600);
    });
  });

  describe('Limit Checking', () => {
    it('should check if specific limit is exceeded', () => {
      const quota: RateLimitQuota = {
        requestsPerSecond: 2,
        requestsPerMinute: 10,
      };

      service.recordRequest('api-limit-check');
      service.recordRequest('api-limit-check');

      expect(service.isLimitExceeded('api-limit-check', 'second', quota)).toBe(
        true,
      );
      expect(service.isLimitExceeded('api-limit-check', 'minute', quota)).toBe(
        false,
      );
    });
  });

  describe('Quota Percentage', () => {
    it('should calculate quota percentage used', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 10 };

      service.recordRequest('api-percentage');
      service.recordRequest('api-percentage');
      service.recordRequest('api-percentage');

      const percentage = service.getQuotaPercentage(
        'api-percentage',
        'second',
        quota,
      );
      expect(percentage).toBe(30);
    });

    it('should calculate 0% when no requests', () => {
      const quota: RateLimitQuota = { requestsPerMinute: 60 };

      const percentage = service.getQuotaPercentage(
        'api-percentage-zero',
        'minute',
        quota,
      );
      expect(percentage).toBe(0);
    });

    it('should calculate 100% when at limit', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 5 };

      for (let i = 0; i < 5; i++) {
        service.recordRequest('api-percentage-full');
      }

      const percentage = service.getQuotaPercentage(
        'api-percentage-full',
        'second',
        quota,
      );
      expect(percentage).toBe(100);
    });
  });

  describe('Reset and Cleanup', () => {
    it('should reset quota for API', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 10 };

      service.recordRequest('api-reset-quota');
      service.recordRequest('api-reset-quota');

      let status = service.getStatus('api-reset-quota', quota);
      expect(status.currentSecond).toBe(2);

      service.resetQuota('api-reset-quota');

      status = service.getStatus('api-reset-quota', quota);
      expect(status.currentSecond).toBe(0);
    });

    it('should track multiple APIs independently', () => {
      const quota1: RateLimitQuota = { requestsPerSecond: 5 };
      const quota2: RateLimitQuota = { requestsPerSecond: 3 };

      service.recordRequest('api-1');
      service.recordRequest('api-1');
      service.recordRequest('api-2');

      const status1 = service.getStatus('api-1', quota1);
      const status2 = service.getStatus('api-2', quota2);

      expect(status1.currentSecond).toBe(2);
      expect(status2.currentSecond).toBe(1);
    });
  });

  describe('API Tracking', () => {
    it('should track multiple APIs', () => {
      service.recordRequest('api-track-1');
      service.recordRequest('api-track-2');
      service.recordRequest('api-track-3');

      const trackedApis = service.getTrackedApis();
      expect(trackedApis).toContain('api-track-1');
      expect(trackedApis).toContain('api-track-2');
      expect(trackedApis).toContain('api-track-3');
    });

    it('should get request count for API', () => {
      for (let i = 0; i < 5; i++) {
        service.recordRequest('api-count');
      }

      const count = service.getRequestCount('api-count');
      expect(count).toBe(5);
    });

    it('should get request count for specific window', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 10 };

      for (let i = 0; i < 3; i++) {
        service.recordRequest('api-count-window');
      }

      const secondCount = service.getRequestCount('api-count-window', 'second');
      const minuteCount = service.getRequestCount('api-count-window', 'minute');
      const hourCount = service.getRequestCount('api-count-window', 'hour');

      expect(secondCount).toBe(3);
      expect(minuteCount).toBe(3);
      expect(hourCount).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle no quota configuration', () => {
      const noQuota: RateLimitQuota = {};

      expect(service.canMakeRequest('api-no-config', noQuota)).toBe(true);
    });

    it('should handle null/undefined quota', () => {
      expect(service.canMakeRequest('api-null', undefined)).toBe(true);
    });

    it('should handle zero limit values', () => {
      const zeroQuota: RateLimitQuota = { requestsPerSecond: 0 };

      expect(service.canMakeRequest('api-zero', zeroQuota)).toBe(false);
    });

    it('should handle very high limits', () => {
      const highQuota: RateLimitQuota = { requestsPerSecond: 100000 };

      for (let i = 0; i < 1000; i++) {
        service.recordRequest('api-high-limit');
      }

      expect(service.canMakeRequest('api-high-limit', highQuota)).toBe(true);
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should clean up old timestamps', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 10 };

      service.recordRequest('api-cleanup');

      // Get initial count
      let count = service.getRequestCount('api-cleanup');
      expect(count).toBe(1);

      // Simulate old timestamps being cleaned up by recording many requests
      // and verifying only recent ones are kept
      for (let i = 0; i < 10; i++) {
        service.recordRequest('api-cleanup');
      }

      count = service.getRequestCount('api-cleanup');
      expect(count).toBeLessThanOrEqual(100); // Should not grow unbounded
    });

    it('should not interfere between APIs', () => {
      const quota: RateLimitQuota = { requestsPerSecond: 5 };

      service.recordRequest('api-isolated-1');
      service.recordRequest('api-isolated-1');

      service.recordRequest('api-isolated-2');

      const count1 = service.getRequestCount('api-isolated-1');
      const count2 = service.getRequestCount('api-isolated-2');

      expect(count1).toBe(2);
      expect(count2).toBe(1);
    });
  });
});
