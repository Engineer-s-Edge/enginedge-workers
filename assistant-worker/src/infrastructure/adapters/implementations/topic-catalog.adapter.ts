/**
 * Topic Catalog Adapter Implementation
 *
 * Bridges orchestrator with TopicCatalogService
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ITopicCatalogAdapter,
  TopicMetadata,
  TopicSearchResult,
} from '../interfaces';
import { TopicCatalogService } from '@application/services/topic-catalog.service';
import { GetTopicsForResearchUseCase } from '@application/use-cases/get-topics-for-research.use-case';
import {
  TopicSourceType,
  TopicStatus,
} from '@domain/entities/topic-catalog.entity';

@Injectable()
export class TopicCatalogAdapter implements ITopicCatalogAdapter {
  private readonly logger = new Logger(TopicCatalogAdapter.name);

  constructor(
    private readonly topicCatalogService: TopicCatalogService,
    private readonly getTopicsUseCase: GetTopicsForResearchUseCase,
  ) {}

  async addTopic(
    topic: string,
    metadata: Omit<TopicMetadata, 'id' | 'name'>,
  ): Promise<TopicMetadata> {
    try {
      this.logger.log(`Adding topic: ${topic}`);

      const result = await this.topicCatalogService.addTopic({
        name: topic,
        description: metadata.description,
        sourceType: metadata.confidence
          ? TopicSourceType.CURATED
          : TopicSourceType.ORGANIC,
        estimatedComplexity: metadata.complexity
          ? (parseInt(metadata.complexity.substring(1)) as any)
          : undefined,
        metadata: {
          description: metadata.description,
          keywords: metadata.relatedTopics,
        },
      });

      return {
        id: result.topic.id,
        name: result.topic.name,
        description: result.topic.description || '',
        complexity: `L${result.topic.estimatedComplexity}` as any,
        relatedTopics: result.topic.relatedCategories,
        lastResearched: result.topic.lastUpdated,
        researchCount: 0,
        confidence: result.categorizationConfidence,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to add topic: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getTopic(topic: string): Promise<TopicMetadata | null> {
    try {
      const topicEntry = await this.topicCatalogService.getTopicByName(topic);
      if (!topicEntry) {
        return null;
      }

      return {
        id: topicEntry.id,
        name: topicEntry.name,
        description: topicEntry.description || '',
        complexity: `L${topicEntry.estimatedComplexity}` as any,
        relatedTopics: topicEntry.relatedCategories,
        lastResearched: topicEntry.lastUpdated,
        researchCount: 0,
        confidence: topicEntry.categorizationConfidence,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get topic: ${err.message}`, err.stack);
      throw error;
    }
  }

  async searchTopics(query: string): Promise<TopicSearchResult[]> {
    try {
      this.logger.log(`Searching topics for: ${query}`);

      const topics = await this.topicCatalogService.searchTopics(query);
      return topics.map((t) => ({
        topic: t.name,
        relevanceScore: t.categorizationConfidence || 0.5,
        similarity: t.categorizationConfidence || 0.5,
      }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to search topics: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getRecommendedTopics(userId: string, limit = 10): Promise<string[]> {
    try {
      this.logger.log(`Getting recommended topics for user ${userId}`);

      const topics = await this.getTopicsUseCase.execute({ limit });
      return topics.map((t) => t.name);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to get recommended topics: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async updateTopic(
    topic: string,
    metadata: Partial<TopicMetadata>,
  ): Promise<TopicMetadata> {
    try {
      this.logger.log(`Updating topic: ${topic}`);

      const topicEntry = await this.topicCatalogService.getTopicByName(topic);
      if (!topicEntry) {
        throw new Error(`Topic not found: ${topic}`);
      }

      // Update the topic
      const updated = await this.topicCatalogService.updateTopicStatus(
        topicEntry.id,
        metadata.confidence ? TopicStatus.COMPLETED : TopicStatus.IN_PROGRESS,
      );

      return {
        id: updated.id,
        name: updated.name,
        description: updated.description || '',
        complexity: `L${updated.estimatedComplexity}` as any,
        relatedTopics: updated.relatedCategories,
        lastResearched: updated.lastUpdated,
        researchCount: 0,
        confidence: updated.categorizationConfidence,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to update topic: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getTrendingTopics(limit = 5): Promise<string[]> {
    try {
      this.logger.log(`Getting ${limit} trending topics`);

      const topics = await this.topicCatalogService.getTopicsByPriority(limit);
      return topics.map((t) => t.name);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to get trending topics: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async trackResearch(
    topic: string,
    researchData: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      this.logger.log(`Tracking research for topic: ${topic}`);

      const topicEntry = await this.topicCatalogService.getTopicByName(topic);
      if (!topicEntry) {
        return false;
      }

      // Update topic status to IN_PROGRESS if not already
      if (topicEntry.status === TopicStatus.NOT_STARTED) {
        await this.topicCatalogService.updateTopicStatus(
          topicEntry.id,
          TopicStatus.IN_PROGRESS,
        );
      }

      // If research data includes knowledgeNodeId, link it
      if (researchData.knowledgeNodeId) {
        await this.topicCatalogService.linkToKnowledgeNode(
          topicEntry.id,
          researchData.knowledgeNodeId as string,
        );
      }

      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to track research: ${err.message}`, err.stack);
      throw error;
    }
  }

  async deleteTopic(topic: string): Promise<boolean> {
    try {
      this.logger.log(`Deleting topic: ${topic}`);

      const topicEntry = await this.topicCatalogService.getTopicByName(topic);
      if (!topicEntry) {
        this.logger.warn(`Topic not found: ${topic}`);
        return false;
      }

      // Delete the topic using the service
      const deleted = await this.topicCatalogService.deleteTopic(topicEntry.id);
      if (deleted) {
        this.logger.log(
          `Successfully deleted topic: ${topic} (id: ${topicEntry.id})`,
        );
      }
      return deleted;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to delete topic: ${err.message}`, err.stack);
      throw error;
    }
  }
}
