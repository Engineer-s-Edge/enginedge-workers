/**
 * Cache Module
 *
 * Infrastructure adapter module for caching functionality.
 * Follows hexagonal architecture - this is an infrastructure adapter.
 *
 * Responsibilities:
 * - Provides Redis-based caching implementation
 * - Exports cache adapter for use in other infrastructure modules
 * - Configures cache dependencies (ConfigService, Logger)
 */

import { Module } from '@nestjs/common';
import { RedisCacheAdapter } from './redis-cache.adapter';

@Module({
  providers: [RedisCacheAdapter],
  exports: [RedisCacheAdapter],
})
export class CacheModule {}
