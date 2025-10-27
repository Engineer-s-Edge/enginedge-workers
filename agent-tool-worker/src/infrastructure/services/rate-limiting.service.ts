/**
 * Rate Limiting Service
 *
 * Implements sliding window rate limiting and quota management for API integrations.
 * Supports per-second, per-minute, and per-hour rate limits with configurable
 * burst limits and quota reset tracking.
 *
 * Features:
 * - Sliding window algorithm for accurate rate limiting
 * - Multi-level rate limits (second, minute, hour)
 * - Quota reset tracking and management
 * - Wait time calculation for backoff
 * - Per-API quota configuration
 */

import { Injectable } from '@nestjs/common';

export interface RateLimitQuota {
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  requestsPerHour?: number;
  burstLimit?: number;
}

export interface RateLimitStatus {
  currentSecond: number;
  currentMinute: number;
  currentHour: number;
  secondQuota?: number;
  minuteQuota?: number;
  hourQuota?: number;
  canMakeRequest: boolean;
  nextAvailableTime?: number;
}

export interface QuotaReset {
  apiName: string;
  limit: 'second' | 'minute' | 'hour';
  resetTime: number;
  nextResetTime: number;
}

@Injectable()
export class RateLimitingService {
  private requestTimestamps: Map<string, number[]> = new Map();
  private quotaResets: Map<string, QuotaReset[]> = new Map();

  /**
   * Check if a request can be made within rate limits
   */
  canMakeRequest(apiName: string, quota?: RateLimitQuota): boolean {
    if (!quota) return true;

    const now = Date.now() / 1000;
    const timestamps = this.getRecentTimestamps(apiName, now, 3600);

    // Check requests per second
    if (quota.requestsPerSecond !== undefined) {
      const recentRequests = timestamps.filter(t => now - t < 1);
      if (recentRequests.length >= quota.requestsPerSecond) {
        return false;
      }
    }

    // Check requests per minute
    if (quota.requestsPerMinute !== undefined) {
      const recentRequests = timestamps.filter(t => now - t < 60);
      if (recentRequests.length >= quota.requestsPerMinute) {
        return false;
      }
    }

    // Check requests per hour
    if (quota.requestsPerHour !== undefined) {
      const recentRequests = timestamps.filter(t => now - t < 3600);
      if (recentRequests.length >= quota.requestsPerHour) {
        return false;
      }
    }

    // Check burst limit if defined
    if (quota.burstLimit) {
      const allTimestamps = this.requestTimestamps.get(apiName) || [];
      if (allTimestamps.length >= quota.burstLimit) {
        return false;
      }
    }

    return true;
  }

  /**
   * Record a request timestamp for rate limiting
   */
  recordRequest(apiName: string): void {
    const now = Date.now() / 1000;
    const timestamps = this.requestTimestamps.get(apiName) || [];
    timestamps.push(now);

    // Clean up old timestamps (older than 1 hour)
    const recentTimestamps = timestamps.filter(t => now - t < 3600);
    this.requestTimestamps.set(apiName, recentTimestamps);
  }

  /**
   * Get current rate limit status
   */
  getStatus(apiName: string, quota: RateLimitQuota): RateLimitStatus {
    const now = Date.now() / 1000;
    const timestamps = this.getRecentTimestamps(apiName, now, 3600);

    const currentSecond = quota.requestsPerSecond
      ? timestamps.filter(t => now - t < 1).length
      : 0;

    const currentMinute = quota.requestsPerMinute
      ? timestamps.filter(t => now - t < 60).length
      : 0;

    const currentHour = quota.requestsPerHour
      ? timestamps.filter(t => now - t < 3600).length
      : 0;

    const canMakeRequest = this.canMakeRequest(apiName, quota);
    const nextAvailableTime = canMakeRequest ? undefined : this.getWaitTime(apiName, quota);

    return {
      currentSecond,
      currentMinute,
      currentHour,
      secondQuota: quota.requestsPerSecond,
      minuteQuota: quota.requestsPerMinute,
      hourQuota: quota.requestsPerHour,
      canMakeRequest,
      nextAvailableTime
    };
  }

  /**
   * Calculate time to next available request slot
   */
  getWaitTime(apiName: string, quota: RateLimitQuota): number {
    if (!quota) return 0;

    const now = Date.now() / 1000;
    const timestamps = this.getRecentTimestamps(apiName, now, 3600);

    let maxWait = 0;

    // Check requests per second
    if (quota.requestsPerSecond) {
      const recentRequests = timestamps.filter(t => now - t < 1);
      if (recentRequests.length >= quota.requestsPerSecond) {
        const oldestRequest = Math.min(...recentRequests);
        const wait = oldestRequest + 1 - now;
        maxWait = Math.max(maxWait, wait);
      }
    }

    // Check requests per minute
    if (quota.requestsPerMinute) {
      const recentRequests = timestamps.filter(t => now - t < 60);
      if (recentRequests.length >= quota.requestsPerMinute) {
        const oldestRequest = Math.min(...recentRequests);
        const wait = oldestRequest + 60 - now;
        maxWait = Math.max(maxWait, wait);
      }
    }

    // Check requests per hour
    if (quota.requestsPerHour) {
      const recentRequests = timestamps.filter(t => now - t < 3600);
      if (recentRequests.length >= quota.requestsPerHour) {
        const oldestRequest = Math.min(...recentRequests);
        const wait = oldestRequest + 3600 - now;
        maxWait = Math.max(maxWait, wait);
      }
    }

    return Math.max(0, maxWait);
  }

  /**
   * Reset all quota for an API (useful for maintenance)
   */
  resetQuota(apiName: string): void {
    this.requestTimestamps.delete(apiName);
    this.quotaResets.delete(apiName);
  }

  /**
   * Get quota reset information
   */
  getQuotaResets(apiName: string): QuotaReset[] {
    return this.quotaResets.get(apiName) || [];
  }

  /**
   * Record a quota reset event
   */
  recordQuotaReset(apiName: string, limit: 'second' | 'minute' | 'hour'): void {
    const now = Date.now() / 1000;
    let resetTime: number;

    switch (limit) {
      case 'second':
        resetTime = Math.ceil(now);
        break;
      case 'minute':
        resetTime = Math.ceil(now / 60) * 60;
        break;
      case 'hour':
        resetTime = Math.ceil(now / 3600) * 3600;
        break;
    }

    const resets = this.quotaResets.get(apiName) || [];
    resets.push({
      apiName,
      limit,
      resetTime: now,
      nextResetTime: resetTime
    });

    // Keep only recent resets (last 24 hours)
    const recentResets = resets.filter(r => now - r.resetTime < 86400);
    this.quotaResets.set(apiName, recentResets);
  }

  /**
   * Get time until next quota reset
   */
  getTimeUntilReset(apiName: string, limit: 'second' | 'minute' | 'hour'): number {
    const now = Date.now() / 1000;
    let nextReset: number;

    switch (limit) {
      case 'second':
        nextReset = Math.ceil(now);
        break;
      case 'minute':
        nextReset = Math.ceil(now / 60) * 60;
        break;
      case 'hour':
        nextReset = Math.ceil(now / 3600) * 3600;
        break;
    }

    return Math.max(0, nextReset - now);
  }

  /**
   * Check if rate limit is exceeded for specific window
   */
  isLimitExceeded(apiName: string, limit: 'second' | 'minute' | 'hour', quota: RateLimitQuota): boolean {
    const now = Date.now() / 1000;
    const timestamps = this.getRecentTimestamps(apiName, now, 3600);

    let window: number;
    let maxRequests: number | undefined;

    switch (limit) {
      case 'second':
        window = 1;
        maxRequests = quota.requestsPerSecond;
        break;
      case 'minute':
        window = 60;
        maxRequests = quota.requestsPerMinute;
        break;
      case 'hour':
        window = 3600;
        maxRequests = quota.requestsPerHour;
        break;
    }

    if (!maxRequests) return false;

    const recentRequests = timestamps.filter(t => now - t < window);
    return recentRequests.length >= maxRequests;
  }

  /**
   * Get percentage of quota used
   */
  getQuotaPercentage(apiName: string, limit: 'second' | 'minute' | 'hour', quota: RateLimitQuota): number {
    const now = Date.now() / 1000;
    const timestamps = this.getRecentTimestamps(apiName, now, 3600);

    let window: number;
    let maxRequests: number | undefined;

    switch (limit) {
      case 'second':
        window = 1;
        maxRequests = quota.requestsPerSecond;
        break;
      case 'minute':
        window = 60;
        maxRequests = quota.requestsPerMinute;
        break;
      case 'hour':
        window = 3600;
        maxRequests = quota.requestsPerHour;
        break;
    }

    if (!maxRequests) return 0;

    const recentRequests = timestamps.filter(t => now - t < window);
    return Math.round((recentRequests.length / maxRequests) * 100);
  }

  /**
   * Helper: Get recent timestamps
   */
  private getRecentTimestamps(apiName: string, now: number, windowSize: number): number[] {
    const allTimestamps = this.requestTimestamps.get(apiName) || [];
    return allTimestamps.filter(t => now - t < windowSize);
  }

  /**
   * Get all tracked APIs
   */
  getTrackedApis(): string[] {
    return Array.from(this.requestTimestamps.keys());
  }

  /**
   * Get request count for API
   */
  getRequestCount(apiName: string, limit?: 'second' | 'minute' | 'hour'): number {
    const now = Date.now() / 1000;
    const timestamps = this.requestTimestamps.get(apiName) || [];

    if (!limit) {
      return timestamps.length;
    }

    let window: number;
    switch (limit) {
      case 'second':
        window = 1;
        break;
      case 'minute':
        window = 60;
        break;
      case 'hour':
        window = 3600;
        break;
    }

    return timestamps.filter(t => now - t < window).length;
  }
}
