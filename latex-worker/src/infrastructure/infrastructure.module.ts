/**
 * Infrastructure Module - LaTeX Worker
 *
 * Configures adapters, controllers, and external integrations.
 * Provides implementations for all domain ports.
 */

import { Module, Global } from '@nestjs/common';
import { ApplicationModule } from '../application/application.module';
import { HealthController } from '../health/health.controller';
import { XeLaTeXCompilerAdapter } from './adapters/xelatex-compiler.adapter';
import { NodeFileSystemAdapter } from './adapters/filesystem.adapter';
import { StructuredLoggerAdapter } from './adapters/structured-logger.adapter';

/**
 * Infrastructure module - adapters, controllers, and wiring
 *
 * Phase 1: Core compilation infrastructure ⏳
 *
 * Made global to ensure DI providers are available across all modules
 */
@Global()
@Module({
  imports: [ApplicationModule],
  controllers: [HealthController],
  providers: [
    // Logger
    {
      provide: 'ILogger',
      useClass: StructuredLoggerAdapter,
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

    // TODO: Add MongoDB repositories
    // TODO: Add Kafka message broker
    // TODO: Add GridFS PDF storage
  ],
  exports: ['ILogger', 'IFileSystem', 'ILaTeXCompiler'],
})
export class InfrastructureModule {}
