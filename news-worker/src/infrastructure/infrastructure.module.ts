/**
 * Infrastructure Module
 *
 * Configures adapters, controllers, and external integrations.
 */

import { Module, Global } from '@nestjs/common';
import { ApplicationModule } from '@application/application.module';
import { MetricsAdapter } from './adapters/monitoring/metrics.adapter';
import { RedisCacheAdapter } from './adapters/cache/redis-cache.adapter';
import { MongoDbModule } from './adapters/memory/mongodb.module';
import { NewsController } from './controllers/news.controller';
import { InMemoryNewsRepository } from './adapters/news/in-memory-news.repository';
import { FileNewsRepository } from './adapters/news/file-news.repository';
import { ConsoleLoggerAdapter } from './adapters/logging/console-logger.adapter';
import { KafkaLoggerAdapter } from '../common/logging/kafka-logger.adapter';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

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
    MongoDbModule, // Provides MongoDB client and database connection
    // ThreadingModule moved to AppModule to avoid circular dependency
  ],
  controllers: [
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
    { provide: 'ICachePort', useExisting: RedisCacheAdapter },

    // Repository adapter (file-based by default; set NEWS_REPOSITORY=inmemory to use in-memory)
    {
      provide: 'INewsRepository',
      useClass:
        (process.env.NEWS_REPOSITORY || 'file').toLowerCase() === 'inmemory'
          ? InMemoryNewsRepository
          : FileNewsRepository,
    },

    // Metrics
    MetricsAdapter,

    // Global filters and interceptors
    GlobalExceptionFilter,
    LoggingInterceptor,
  ],
  exports: [
    'ILogger',
    RedisCacheAdapter,
    'ICachePort',
    'INewsRepository',
  ],
})
export class InfrastructureModule {}
