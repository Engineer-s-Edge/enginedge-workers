/**
 * Application Module - Data Processing Worker
 *
 * Configures and provides all application-layer services and use cases.
 * Bridges domain logic with infrastructure adapters.
 *
 * Services:
 * - LoaderRegistryService: Manages document loaders
 * - DocumentProcessingService: Main orchestration service
 * - TextSplitterFactoryService: Selects appropriate text splitter
 * - EmbedderFactoryService: Selects appropriate embedder
 * - EmbedderService: Orchestrates embedder operations
 */

import { Module } from '@nestjs/common';
import { DomainModule } from '../domain/domain.module';
import { LoaderRegistryService } from './services/loader-registry.service';
import { DocumentProcessingService } from './services/document-processing.service';
import { UrlDetectionService } from './services/url-detection.service';
import { TextSplitterFactoryService } from './services/text-splitter-factory.service';
import { EmbedderFactoryService } from './services/embedder-factory.service';
import { EmbedderService } from './services/embedder.service';

/**
 * Application module - use cases and application services
 *
 * Note: InfrastructureModule is @Global(), so its providers are automatically available.
 * Default implementations are aliased here for dependency injection.
 */
@Module({
  imports: [DomainModule],
  providers: [
    LoaderRegistryService,
    DocumentProcessingService,
    UrlDetectionService,
    TextSplitterFactoryService,
    EmbedderFactoryService,
    EmbedderService,
  ],
  exports: [
    LoaderRegistryService,
    DocumentProcessingService,
    UrlDetectionService,
    TextSplitterFactoryService,
    EmbedderFactoryService,
    EmbedderService,
  ],
})
export class ApplicationModule {}
