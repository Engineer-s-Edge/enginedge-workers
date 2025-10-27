/**
 * Adapters Module
 * 
 * Infrastructure layer module that exports all adapter implementations
 * Provides dependency injection setup for all external service integrations
 */

import { Module } from '@nestjs/common';
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
