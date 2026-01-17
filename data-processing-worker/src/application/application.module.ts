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
import { MongooseModule } from '@nestjs/mongoose';
import { DomainModule } from '../domain/domain.module';
import {
  DocumentModel,
  DocumentSchema,
} from '../infrastructure/database/schemas/document.schema';
import { LoaderRegistryService } from './services/loader-registry.service';
import { DocumentProcessingService } from './services/document-processing.service';
import { UrlDetectionService } from './services/url-detection.service';
import { TextSplitterFactoryService } from './services/text-splitter-factory.service';
import { EmbedderFactoryService } from './services/embedder-factory.service';
import { EmbedderService } from './services/embedder.service';
import { EmbeddingSimilarityService } from './services/embedding-similarity.service';
import { BM25SearchService } from './services/bm25-search.service';
import { VectorStoreService } from './services/vector-store.service';
import { HybridSearchService } from './services/hybrid-search.service';

/**
 * Application module - use cases and application services
 *
 * Note: InfrastructureModule is @Global(), so its providers are automatically available.
 * Default implementations are aliased here for dependency injection.
 */
@Module({
  imports: [
    DomainModule,
    MongooseModule.forFeature([
      { name: DocumentModel.name, schema: DocumentSchema },
    ]),
  ],
  providers: [
    LoaderRegistryService,
    DocumentProcessingService,
    UrlDetectionService,
    TextSplitterFactoryService,
    EmbedderFactoryService,
    EmbedderService,
    EmbeddingSimilarityService,
    BM25SearchService,
    VectorStoreService,
    HybridSearchService,
    // Provide EmbedderService and VectorStoreService with aliases for dependency injection
    {
      provide: 'EmbedderService',
      useExisting: EmbedderService,
    },
    {
      provide: 'VectorStoreService',
      useExisting: VectorStoreService,
    },
  ],
  exports: [
    LoaderRegistryService,
    DocumentProcessingService,
    UrlDetectionService,
    TextSplitterFactoryService,
    EmbedderFactoryService,
    EmbedderService,
    EmbeddingSimilarityService,
    BM25SearchService,
    VectorStoreService,
    HybridSearchService,
  ],
})
export class ApplicationModule {}
