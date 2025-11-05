/**
 * Infrastructure Module
 *
 * Configures adapters, controllers, and external integrations.
 */

import { Module, Global } from '@nestjs/common';
import { ApplicationModule } from '@application/application.module';
import { HealthController } from '../health/health.controller';
import { ThreadingModule } from './threading/threading.module';
import { MetricsAdapter } from './adapters/monitoring/metrics.adapter';
import { RedisCacheAdapter } from './adapters/cache/redis-cache.adapter';
import { NewsController } from './controllers/news.controller';
import { InMemoryNewsRepository } from './adapters/news/in-memory-news.repository';
import { ConsoleLoggerAdapter } from './adapters/logging/console-logger.adapter';
import { KafkaLoggerAdapter } from '../common/logging/kafka-logger.adapter';

/**
 * Infrastructure module - adapters, controllers, and wiring
 *
 * Provides:
 * - News controllers (feed, search, trending)
 * - Redis caching adapter
 * - In-memory news repository (replace with DB adapter in production)
 * - Threading support for concurrent processing
 * - Metrics and monitoring
 *
 * Made global to ensure DI providers are available across all modules
 */
@Global()
@Module({
  imports: [
    ApplicationModule,
    ThreadingModule, // Provides WorkerThreadPool, RequestQueue, etc.
  ],
  controllers: [
    HealthController,
    NewsController,
  ],
  providers: [
    // Logger adapter
    {
      provide: 'ILogger',
      useClass: KafkaLoggerAdapter,
    },

    // Cache adapter
    RedisCacheAdapter,

    // Repository adapter
    {
      provide: 'INewsRepository',
      useClass: InMemoryNewsRepository,
    },

    // Metrics
    MetricsAdapter,
  ],
  exports: [
    RedisCacheAdapter,
    'INewsRepository',
  ],
})
export class InfrastructureModule {}
