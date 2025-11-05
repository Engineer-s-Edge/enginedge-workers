/**
 * Redis Cache Adapter
 *
 * Provides Redis-based caching for data processing worker.
 * Implements distributed caching with TTL support.
 */

import { Injectable, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Key namespace prefix
}

@Injectable()
export class RedisCacheAdapter implements OnModuleDestroy {
  private redis: Redis;
  private readonly defaultTTL: number;
  private readonly keyPrefix: string;

  constructor(
    @Inject('ILogger') private readonly logger: Logger,
    private readonly configService: ConfigService,
  ) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379/4';
    const db = parseInt(redisUrl.split('/').pop() || '4', 10);

    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: parseInt(
        this.configService.get<string>('REDIS_PORT') || '6379',
        10,
      ),
      db,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      keyPrefix:
        this.configService.get<string>('REDIS_KEY_PREFIX') ||
        'data-processing:',
      lazyConnect: true,
    });

    this.defaultTTL = parseInt(
      this.configService.get<string>('CACHE_DEFAULT_TTL') || '3600',
      10,
    );
    this.keyPrefix =
      this.configService.get<string>('REDIS_KEY_PREFIX') || 'data-processing:';

    this.redis.on('connect', () => {
      this.logger.info('RedisCacheAdapter: Connected to Redis');
    });

    this.redis.on('error', (error) => {
      this.logger.error('RedisCacheAdapter: Redis error', {
        error: error.message,
      });
    });

    this.redis.connect().catch((error) => {
      this.logger.error('RedisCacheAdapter: Failed to connect to Redis', {
        error: error.message,
      });
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
    this.logger.info('RedisCacheAdapter: Disconnected from Redis');
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(this.buildKey(key));
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error: any) {
      this.logger.error('RedisCacheAdapter: Get error', {
        key,
        error: error.message,
      });
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const ttl = options?.ttl || this.defaultTTL;
      const serialized = JSON.stringify(value);
      if (ttl > 0) {
        await this.redis.setex(fullKey, ttl, serialized);
      } else {
        await this.redis.set(fullKey, serialized);
      }
      this.logger.debug('RedisCacheAdapter: Set cache', { key: fullKey, ttl });
    } catch (error: any) {
      this.logger.error('RedisCacheAdapter: Set error', {
        key,
        error: error.message,
      });
    }
  }

  async delete(key: string, namespace?: string): Promise<void> {
    try {
      const fullKey = this.buildKey(key, namespace);
      await this.redis.del(fullKey);
      this.logger.debug('RedisCacheAdapter: Deleted cache', { key: fullKey });
    } catch (error: any) {
      this.logger.error('RedisCacheAdapter: Delete error', {
        key,
        error: error.message,
      });
    }
  }

  async deletePattern(pattern: string, namespace?: string): Promise<number> {
    try {
      const fullPattern = this.buildKey(pattern, namespace);
      const stream = this.redis.scanStream({ match: fullPattern, count: 100 });
      let deletedCount = 0;
      const keys: string[] = [];
      stream.on('data', (chunk: string[]) => keys.push(...chunk));
      await new Promise<void>((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      if (keys.length > 0) deletedCount = await this.redis.del(...keys);
      this.logger.debug('RedisCacheAdapter: Deleted pattern', {
        pattern: fullPattern,
        deletedCount,
      });
      return deletedCount;
    } catch (error: any) {
      this.logger.error('RedisCacheAdapter: Delete pattern error', {
        pattern,
        error: error.message,
      });
      return 0;
    }
  }

  async exists(key: string, namespace?: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error: any) {
      this.logger.error('RedisCacheAdapter: Exists error', {
        key,
        error: error.message,
      });
      return false;
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  async increment(
    key: string,
    by: number = 1,
    options?: CacheOptions,
  ): Promise<number> {
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const result = await this.redis.incrby(fullKey, by);
      if (options?.ttl) await this.redis.expire(fullKey, options.ttl);
      return result;
    } catch (error: any) {
      this.logger.error('RedisCacheAdapter: Increment error', {
        key,
        error: error.message,
      });
      return 0;
    }
  }

  async getTTL(key: string, namespace?: string): Promise<number> {
    try {
      const fullKey = this.buildKey(key, namespace);
      return await this.redis.ttl(fullKey);
    } catch (error: any) {
      this.logger.error('RedisCacheAdapter: Get TTL error', {
        key,
        error: error.message,
      });
      return -1;
    }
  }

  private buildKey(key: string, namespace?: string): string {
    const parts = [this.keyPrefix];
    if (namespace) parts.push(namespace);
    parts.push(key);
    return parts.join(':');
  }

  async healthCheck(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error: any) {
      return { status: 'unhealthy' };
    }
  }
}
