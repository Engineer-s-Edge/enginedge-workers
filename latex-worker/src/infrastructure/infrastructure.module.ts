/**
 * Infrastructure Module - LaTeX Worker
 *
 * Configures adapters, controllers, and external integrations.
 * Provides implementations for all domain ports.
 */

import { Module, Global } from '@nestjs/common';
import { HealthModule } from '../health/health.module';
import { XeLaTeXCompilerAdapter } from './adapters/xelatex-compiler.adapter';
import { NodeFileSystemAdapter } from './adapters/filesystem.adapter';
import { StructuredLoggerAdapter } from './adapters/structured-logger.adapter';
import { InMemoryPackageCacheRepository } from './database/repositories/inmemory-package-cache.repository';
import { MongoDBPackageCacheRepository } from './database/repositories/package-cache.repository';
import { KafkaLoggerAdapter } from '../common/logging/kafka-logger.adapter';
import { RedisCacheAdapter } from './adapters/cache/redis-cache.adapter';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { DatabaseModule } from './database/database.module';
import { GridFSService } from './database/services/gridfs.service';
import { KafkaMessageBrokerAdapter } from './adapters/kafka-message-broker.adapter';

/**
 * Infrastructure module - adapters, controllers, and wiring
 *
 * Phase 1: Core compilation infrastructure ⏳
 *
 * Made global to ensure DI providers are available across all modules
 */
@Global()
@Module({
  imports: [HealthModule, DatabaseModule],
  controllers: [],
  providers: [
    // Logger
    {
      provide: 'ILogger',
      useClass: KafkaLoggerAdapter,
    },

    // FileSystem
    {
      provide: 'IFileSystem',
      useClass: NodeFileSystemAdapter,
    },

    // LaTeX Compiler
    {
      provide: 'ILaTeXCompiler',
      useClass: XeLaTeXCompilerAdapter,
    },

    // Cache adapter
    RedisCacheAdapter,

    // Package cache repository (MongoDB for persistence)
    {
      provide: 'IPackageCacheRepository',
      useClass: MongoDBPackageCacheRepository,
    },

    // Global filter/interceptor providers for DI resolution
    GlobalExceptionFilter,
    LoggingInterceptor,

    // GridFS PDF storage
    GridFSService,
    {
      provide: 'IPDFStorage',
      useClass: GridFSService,
    },

    // Kafka message broker (for async processing)
    KafkaMessageBrokerAdapter,
    {
      provide: 'MessageBrokerPort',
      useClass: KafkaMessageBrokerAdapter,
    },
  ],
  exports: [
    'ILogger',
    'IFileSystem',
    'ILaTeXCompiler',
    RedisCacheAdapter,
    'IPackageCacheRepository',
    'IPDFStorage',
    GridFSService,
    'MessageBrokerPort',
    KafkaMessageBrokerAdapter,
  ],
})
export class InfrastructureModule {}
