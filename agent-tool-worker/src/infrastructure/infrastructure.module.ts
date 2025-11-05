/**
 * Infrastructure Module
 *
 * Configures adapters, controllers, and external integrations.
 */

import { Module, Global } from '@nestjs/common';
import { ApplicationModule } from '@application/application.module';
import { HealthModule } from 'health/health.module';
import { ThreadingModule } from './threading/threading.module';
import { MetricsAdapter } from './adapters/monitoring';
import { ToolsInfrastructureModule } from './tools/tools.infrastructure.module';
import { CommandInfrastructureModule } from './command-infrastructure.module';
import { StructuredLogger } from './adapters/logging/structured-logger';
import { ToolValidator } from './adapters/tool-validator.adapter';
import { ToolCache } from './adapters/tool-cache.adapter';
import { ToolMetrics } from './adapters/tool-metrics.adapter';
import { RedisCacheAdapter } from './adapters/cache/redis-cache.adapter';
import { KafkaLoggerAdapter } from '../common/logging/kafka-logger.adapter';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

/**
 * Infrastructure module - adapters, controllers, and wiring
 *
 * Phase 1: Core agent infrastructure ✅
 * Phase 2: Specialized agent controllers ✅
 * Phase 3: Memory systems ✅
 * Phase 4: Knowledge graph ✅
 * Phase 5: Advanced features ⏳
 *
 * Made global to ensure DI providers are available across all modules
 */
@Global()
@Module({
  imports: [
    ApplicationModule,
    ThreadingModule, // Provides WorkerThreadPool, RequestQueue, etc.
    ToolsInfrastructureModule, // Provides all tool implementations
    CommandInfrastructureModule, // Provides command processing controller and services
    HealthModule, // Provides health check controller and service
  ],
  controllers: [],
  providers: [
    // Logger provider - available globally via DI
    {
      provide: 'ILogger',
      useClass: KafkaLoggerAdapter,
    },
    // Tool Validator provider - available globally via DI
    {
      provide: 'IToolValidator',
      useClass: ToolValidator,
    },
    // Tool Cache provider - available globally via DI
    {
      provide: 'IToolCache',
      useClass: ToolCache,
    },
    // Tool Metrics provider - available globally via DI
    {
      provide: 'IToolMetrics',
      useClass: ToolMetrics,
    },
    MetricsAdapter,

    // Cache adapter
    RedisCacheAdapter,

    // Global filter/interceptor for DI resolution
    GlobalExceptionFilter,
    LoggingInterceptor,
  ],
  exports: [
    'ILogger',
    'IToolValidator',
    'IToolCache',
    'IToolMetrics',
    'RedisCacheAdapter',
  ],
})
export class InfrastructureModule {}
