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
import { KafkaLoggerAdapter } from '../common/logging/kafka-logger.adapter';
import { RedisCacheAdapter } from './adapters/cache/redis-cache.adapter';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

/**
 * Infrastructure module - adapters, controllers, and wiring
 *
 * Phase 1: Core compilation infrastructure ⏳
 *
 * Made global to ensure DI providers are available across all modules
 */
@Global()
@Module({
  imports: [HealthModule],
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

    // Package cache repository (in-memory default)
    {
      provide: 'IPackageCacheRepository',
      useClass: InMemoryPackageCacheRepository,
    },

    // Global filter/interceptor providers for DI resolution
    GlobalExceptionFilter,
    LoggingInterceptor,

    // TODO: Add MongoDB repositories
    // TODO: Add Kafka message broker
    // TODO: Add GridFS PDF storage
  ],
  exports: [
    'ILogger',
    'IFileSystem',
    'ILaTeXCompiler',
    RedisCacheAdapter,
    'IPackageCacheRepository',
  ],
})
export class InfrastructureModule {}
