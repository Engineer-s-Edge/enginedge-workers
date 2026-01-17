/**
 * Redis Cache Adapter
 *
 * Provides Redis-based caching for identity worker.
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
  ttl?: number;
  namespace?: string;
}

@Injectable()
export class RedisCacheAdapter implements OnModuleDestroy {
  private redis: Redis;
  private readonly defaultTTL: number;
  private readonly keyPrefix: string;
  private isConnected = false;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private readonly reconnectIntervalMs = 5000; // Check every 5 seconds

  constructor(
    @Inject('ILogger') private readonly logger: Logger,
    private readonly configService: ConfigService,
  ) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379/8';
    const db = parseInt(redisUrl.split('/').pop() || '8', 10);

    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: parseInt(
        this.configService.get<string>('REDIS_PORT') || '6379',
        10,
      ),
      db,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      keyPrefix:
        this.configService.get<string>('REDIS_KEY_PREFIX') || 'identity:',
      lazyConnect: true,
      retryStrategy: () => {
        // Return null to stop automatic retries (we'll handle it manually)
        return null;
      },
      enableOfflineQueue: false, // Disable offline queue to prevent command accumulation when disconnected
    });

    this.defaultTTL = parseInt(
      this.configService.get<string>('CACHE_DEFAULT_TTL') || '3600',
      10,
    );
    this.keyPrefix =
      this.configService.get<string>('REDIS_KEY_PREFIX') || 'identity:';

    // Handle successful connection
    this.redis.on('connect', () => {
      if (!this.isConnected) {
        this.logger.info('RedisCacheAdapter: Connected to Redis');
        this.isConnected = true;
        // Clear any reconnect interval since we're connected
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      }
    });

    // Handle disconnection
    this.redis.on('close', () => {
      if (this.isConnected) {
        this.isConnected = false;
        this.startReconnectAttempts();
      }
    });

    // Handle errors gracefully to prevent log spam
    this.redis.on('error', (err: Error | AggregateError) => {
      // Check for connection refused errors (Redis not available)
      const errorMessage = err.message || '';
      const errorString = String(err);
      const isConnectionRefused =
        errorMessage.includes('ECONNREFUSED') ||
        errorString.includes('ECONNREFUSED') ||
        (err instanceof AggregateError &&
          err.errors?.some(
            (e: any) =>
              String(e).includes('ECONNREFUSED') ||
              e.message?.includes('ECONNREFUSED'),
          ));

      if (isConnectionRefused) {
        // Connection refused - Redis is likely not running
        // Silently handle this (no logging to prevent spam)
        if (this.isConnected) {
          this.isConnected = false;
        }
        // Start periodic reconnection attempts if not already started
        if (!this.reconnectInterval) {
          this.startReconnectAttempts();
        }
        return;
      }
      // Log other errors that might be important (but only as warning to reduce spam)
      this.logger.warn('RedisCacheAdapter: Redis error', {
        error: errorMessage || errorString,
      });
    });

    // Initial connection attempt
    this.redis.connect().catch(() => {
      // Connection failed - start periodic reconnection attempts
      this.startReconnectAttempts();
    });
  }

  private startReconnectAttempts(): void {
    if (this.reconnectInterval) {
      return; // Already attempting reconnection
    }

    this.reconnectInterval = setInterval(async () => {
      if (this.isConnected) {
        // Already connected, clear interval
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
        return;
      }

      try {
        // Attempt to reconnect
        await this.redis.connect();
      } catch (error) {
        // Connection failed, will retry on next interval
        // Error is already handled by the error event handler
      }
    }, this.reconnectIntervalMs);
  }

  async onModuleDestroy() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    try {
      await this.redis.quit();
      this.logger.info('RedisCacheAdapter: Disconnected from Redis');
    } catch (error) {
      // Ignore errors during shutdown
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      return null; // Silently return null if not connected
    }
    try {
      const value = await this.redis.get(this.buildKey(key));
      return value ? (JSON.parse(value) as T) : null;
    } catch (error: any) {
      // Only log if it's not a connection error
      const errorMessage = error?.message || String(error);
      if (
        !errorMessage.includes('ECONNREFUSED') &&
        !errorMessage.includes('not connected')
      ) {
        this.logger.warn('RedisCacheAdapter: Get error', {
          key,
          error: errorMessage,
        });
      }
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    if (!this.isConnected) {
      return; // Silently skip if not connected
    }
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const ttl = options?.ttl || this.defaultTTL;
      const serialized = JSON.stringify(value);
      if (ttl > 0) await this.redis.setex(fullKey, ttl, serialized);
      else await this.redis.set(fullKey, serialized);
    } catch (error: any) {
      // Only log if it's not a connection error
      const errorMessage = error?.message || String(error);
      if (
        !errorMessage.includes('ECONNREFUSED') &&
        !errorMessage.includes('not connected')
      ) {
        this.logger.warn('RedisCacheAdapter: Set error', {
          key,
          error: errorMessage,
        });
      }
    }
  }

  async delete(key: string, namespace?: string): Promise<void> {
    if (!this.isConnected) {
      return; // Silently skip if not connected
    }
    try {
      await this.redis.del(this.buildKey(key, namespace));
    } catch (error: any) {
      // Only log if it's not a connection error
      const errorMessage = error?.message || String(error);
      if (
        !errorMessage.includes('ECONNREFUSED') &&
        !errorMessage.includes('not connected')
      ) {
        this.logger.warn('RedisCacheAdapter: Delete error', {
          key,
          error: errorMessage,
        });
      }
    }
  }

  async deletePattern(pattern: string, namespace?: string): Promise<number> {
    if (!this.isConnected) {
      return 0; // Silently return 0 if not connected
    }
    try {
      const fullPattern = this.buildKey(pattern, namespace);
      const stream = this.redis.scanStream({ match: fullPattern, count: 100 });
      const keys: string[] = [];
      stream.on('data', (chunk: string[]) => keys.push(...chunk));
      await new Promise<void>((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      return keys.length > 0 ? await this.redis.del(...keys) : 0;
    } catch (error: any) {
      // Only log if it's not a connection error
      const errorMessage = error?.message || String(error);
      if (
        !errorMessage.includes('ECONNREFUSED') &&
        !errorMessage.includes('not connected')
      ) {
        this.logger.warn('RedisCacheAdapter: Delete pattern error', {
          pattern,
          error: errorMessage,
        });
      }
      return 0;
    }
  }

  async exists(key: string, namespace?: string): Promise<boolean> {
    if (!this.isConnected) {
      return false; // Silently return false if not connected
    }
    try {
      return (await this.redis.exists(this.buildKey(key, namespace))) === 1;
    } catch (error: any) {
      // Only log if it's not a connection error
      const errorMessage = error?.message || String(error);
      if (
        !errorMessage.includes('ECONNREFUSED') &&
        !errorMessage.includes('not connected')
      ) {
        this.logger.warn('RedisCacheAdapter: Exists error', {
          key,
          error: errorMessage,
        });
      }
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
    if (!this.isConnected) {
      return 0; // Silently return 0 if not connected
    }
    try {
      const fullKey = this.buildKey(key, options?.namespace);
      const result = await this.redis.incrby(fullKey, by);
      if (options?.ttl) await this.redis.expire(fullKey, options.ttl);
      return result;
    } catch (error: any) {
      // Only log if it's not a connection error
      const errorMessage = error?.message || String(error);
      if (
        !errorMessage.includes('ECONNREFUSED') &&
        !errorMessage.includes('not connected')
      ) {
        this.logger.warn('RedisCacheAdapter: Increment error', {
          key,
          error: errorMessage,
        });
      }
      return 0;
    }
  }

  async getTTL(key: string, namespace?: string): Promise<number> {
    if (!this.isConnected) {
      return -1; // Silently return -1 if not connected
    }
    try {
      return await this.redis.ttl(this.buildKey(key, namespace));
    } catch (error: any) {
      // Only log if it's not a connection error
      const errorMessage = error?.message || String(error);
      if (
        !errorMessage.includes('ECONNREFUSED') &&
        !errorMessage.includes('not connected')
      ) {
        this.logger.warn('RedisCacheAdapter: Get TTL error', {
          key,
          error: errorMessage,
        });
      }
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
      return { status: 'healthy', latency: Date.now() - start };
    } catch {
      return { status: 'unhealthy' };
    }
  }
}
