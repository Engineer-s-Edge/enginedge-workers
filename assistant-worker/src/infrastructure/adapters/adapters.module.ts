/**
 * Adapters Module
 *
 * Infrastructure layer module that exports all adapter implementations
 * Provides dependency injection setup for all external service integrations
 */

import { Module, forwardRef } from '@nestjs/common';
import { ApplicationModule } from '@application/application.module';
import {
  KnowledgeGraphAdapter,
  ValidationAdapter,
  ExpertPoolAdapter,
  TopicCatalogAdapter,
  LearningModeAdapter,
  ScheduledLearningAdapter,
  NewsIntegrationAdapter,
  RAGServiceAdapter,
} from './implementations';

@Module({
  imports: [
    // Import ApplicationModule to access TopicCatalogService and use cases
    forwardRef(() => ApplicationModule),
  ],
  providers: [
    KnowledgeGraphAdapter,
    ValidationAdapter,
    ExpertPoolAdapter,
    TopicCatalogAdapter,
    LearningModeAdapter,
    ScheduledLearningAdapter,
    NewsIntegrationAdapter,
    RAGServiceAdapter,
  ],
  exports: [
    KnowledgeGraphAdapter,
    ValidationAdapter,
    ExpertPoolAdapter,
    TopicCatalogAdapter,
    LearningModeAdapter,
    ScheduledLearningAdapter,
    NewsIntegrationAdapter,
    RAGServiceAdapter,
  ],
})
export class AdaptersModule {}
