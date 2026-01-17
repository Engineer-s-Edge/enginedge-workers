/**
 * Topic Catalog Service
 *
 * Manages the topic catalog - a queue of topics that need research.
 * Integrates with CategoryService for automatic categorization using embeddings.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import { IEmbedder } from '@application/ports/embedder.port';
import { ISpacyService } from '@application/ports/spacy-service.port';
import { ITopicCatalogRepository } from '@application/ports/topic-catalog.repository.port';
import { CategoryService } from './category.service';
import {
  TopicCatalogEntry,
  CreateTopicInput,
  TopicStatus,
  TopicSourceType,
  ICSLayer,
} from '../../domain/entities/topic-catalog.entity';

export interface AddTopicResult {
  topic: TopicCatalogEntry;
  categoryAssigned: string;
  categorizationConfidence: number;
}

@Injectable()
export class TopicCatalogService {
  constructor(
    @Inject('ITopicCatalogRepository')
    private readonly repository: ITopicCatalogRepository,
    private readonly categoryService: CategoryService,
    @Inject('IEmbedder')
    private readonly embedder: IEmbedder,
    @Inject('ILogger')
    private readonly logger: ILogger,
    @Optional()
    @Inject('ISpacyService')
    private readonly spacyService?: ISpacyService,
  ) {}

  /**
   * Add a topic to the catalog with automatic categorization
   */
  async addTopic(input: CreateTopicInput): Promise<AddTopicResult> {
    this.logger.info(`Adding topic to catalog: ${input.name}`);

    // Step 1: Check if topic already exists
    const existing = await this.repository.findByName(input.name);
    if (existing) {
      this.logger.warn(`Topic already exists: ${input.name}`);
      return {
        topic: existing,
        categoryAssigned: existing.category,
        categorizationConfidence: existing.categorizationConfidence || 0.5,
      };
    }

    // Step 2: Generate embedding for topic
    const topicText = input.description
      ? `${input.name}. ${input.description}`
      : input.name;
    const embedding = await this.embedder.embedText(topicText);

    // Step 3: Categorize topic using CategoryService
    const categoryResult = await this.categoryService.categorizeTopic(
      input.name,
      input.description,
      embedding,
    );

    // Step 4: Create topic entry (repository will set status and default priority)
    const topicEntry = await this.repository.create({
      ...input,
      category: categoryResult.categoryName,
      estimatedComplexity: input.estimatedComplexity || ICSLayer.L3_TOPIC,
    });

    // Update priority, categorization confidence, and embedding after creation
    const calculatedPriority = this.calculateInitialPriority(input);
    await this.repository.update(topicEntry.id, {
      researchPriority: calculatedPriority,
      categorizationConfidence: categoryResult.confidence,
      embedding: embedding,
    });

    // Step 5: Add topic to category
    const category = await this.categoryService.getCategoryByName(
      categoryResult.categoryName,
    );
    if (category) {
      // Update category to include this topic
      // This would be handled by the repository when we add the topic
      // For now, we'll just log it
      this.logger.info(
        `Topic ${topicEntry.name} assigned to category ${categoryResult.categoryName}`,
      );
    }

    this.logger.info(
      `Topic added: ${topicEntry.name} (category: ${categoryResult.categoryName}, confidence: ${categoryResult.confidence.toFixed(2)})`,
    );

    return {
      topic: topicEntry,
      categoryAssigned: categoryResult.categoryName,
      categorizationConfidence: categoryResult.confidence,
    };
  }

  /**
   * Get topic by ID
   */
  async getTopicById(id: string): Promise<TopicCatalogEntry | null> {
    return this.repository.findById(id);
  }

  /**
   * Get topic by name
   */
  async getTopicByName(name: string): Promise<TopicCatalogEntry | null> {
    return this.repository.findByName(name);
  }

  /**
   * Get topics needing research
   */
  async getTopicsNeedingResearch(
    limit: number = 10,
  ): Promise<TopicCatalogEntry[]> {
    return this.repository.findTopicsNeedingResearch(limit);
  }

  /**
   * Get topics by priority
   */
  async getTopicsByPriority(limit: number = 10): Promise<TopicCatalogEntry[]> {
    return this.repository.findTopicsByPriority(limit);
  }

  /**
   * Get topics by category
   */
  async getTopicsByCategory(category: string): Promise<TopicCatalogEntry[]> {
    return this.repository.findByCategory(category);
  }

  /**
   * Search topics by name
   */
  async searchTopics(
    query: string,
    limit: number = 20,
  ): Promise<TopicCatalogEntry[]> {
    return this.repository.searchByName(query, limit);
  }

  /**
   * Find similar topics using embeddings
   */
  async findSimilarTopics(
    topicName: string,
    threshold: number = 0.7,
    limit: number = 10,
  ): Promise<Array<{ topic: TopicCatalogEntry; similarity: number }>> {
    // Get the topic's embedding
    const topic = await this.repository.findByName(topicName);
    if (!topic || !topic.embedding) {
      // Generate embedding if not cached
      const topicText = topic?.description
        ? `${topic.name}. ${topic.description}`
        : topic?.name || topicName;
      const embedding = await this.embedder.embedText(topicText);

      // Update topic with embedding
      if (topic) {
        await this.repository.update(topic.id, { embedding });
      }

      return this.repository.findSimilarTopics(embedding, threshold, limit);
    }

    return this.repository.findSimilarTopics(topic.embedding, threshold, limit);
  }

  /**
   * Update topic status
   */
  async updateTopicStatus(
    topicId: string,
    status: TopicStatus,
  ): Promise<TopicCatalogEntry> {
    return this.repository.update(topicId, {
      status,
      lastUpdated: new Date(),
    });
  }

  /**
   * Link topic to knowledge graph node after research
   */
  async linkToKnowledgeNode(
    topicId: string,
    knowledgeNodeId: string,
  ): Promise<TopicCatalogEntry> {
    return this.repository.update(topicId, {
      knowledgeNodeId,
      status: TopicStatus.COMPLETED,
      lastUpdated: new Date(),
    });
  }

  /**
   * Update topic priority
   */
  async updateTopicPriority(
    topicId: string,
    priority: number,
  ): Promise<TopicCatalogEntry> {
    // Clamp priority to 0-100
    const clampedPriority = Math.max(0, Math.min(100, priority));

    return this.repository.update(topicId, {
      researchPriority: clampedPriority,
      lastUpdated: new Date(),
    });
  }

  /**
   * Recalculate topic priority based on various factors
   */
  async recalculatePriority(topicId: string): Promise<TopicCatalogEntry> {
    const topic = await this.repository.findById(topicId);
    if (!topic) {
      throw new Error(`Topic not found: ${topicId}`);
    }

    let priority = 50; // Base priority

    // Factor 1: Status (completed topics have lower priority)
    if (topic.status === TopicStatus.COMPLETED) {
      priority -= 30;
    } else if (topic.status === TopicStatus.NOT_STARTED) {
      priority += 10;
    } else if (topic.status === TopicStatus.NEEDS_REFRESH) {
      priority += 20; // High priority for refresh
    }

    // Factor 2: Age (older topics might need refresh)
    if (topic.lastUpdated) {
      const daysSinceUpdate =
        (Date.now() - topic.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 30) {
        priority += 15; // Boost priority for stale topics
      }
    }

    // Factor 3: Source type (user/curated topics have higher priority)
    if (topic.sourceType === TopicSourceType.USER) {
      priority += 20;
    } else if (topic.sourceType === TopicSourceType.CURATED) {
      priority += 15;
    }

    // Factor 4: Prerequisites (topics with unmet prerequisites have lower priority)
    if (topic.prerequisiteTopics.length > 0) {
      // Check if prerequisites are completed
      const prerequisites = await Promise.all(
        topic.prerequisiteTopics.map((id) => this.repository.findById(id)),
      );
      const completedPrerequisites = prerequisites.filter(
        (p) => p?.status === TopicStatus.COMPLETED,
      ).length;

      if (completedPrerequisites < topic.prerequisiteTopics.length) {
        priority -= 20; // Lower priority if prerequisites not met
      }
    }

    return this.updateTopicPriority(topicId, priority);
  }

  /**
   * Calculate initial priority for a new topic
   */
  private calculateInitialPriority(input: CreateTopicInput): number {
    let priority = 50; // Base priority

    // User-requested topics get higher priority
    if (input.sourceType === TopicSourceType.USER) {
      priority += 20;
    } else if (input.sourceType === TopicSourceType.CURATED) {
      priority += 15;
    }

    // Higher complexity topics might need more research
    if (input.estimatedComplexity) {
      if (input.estimatedComplexity >= ICSLayer.L4_DETAIL) {
        priority += 10; // More complex = higher priority
      }
    }

    return Math.max(0, Math.min(100, priority));
  }

  /**
   * Delete a topic from the catalog
   */
  async deleteTopic(topicId: string): Promise<boolean> {
    this.logger.info(`Deleting topic: ${topicId}`);
    const result = await this.repository.delete(topicId);
    if (result) {
      this.logger.info(`Topic deleted successfully: ${topicId}`);
    } else {
      this.logger.warn(`Topic not found or already deleted: ${topicId}`);
    }
    return result;
  }

  /**
   * Batch import topics (e.g., from Wikipedia)
   */
  async batchImportTopics(
    topics: CreateTopicInput[],
  ): Promise<AddTopicResult[]> {
    this.logger.info(`Batch importing ${topics.length} topics`);

    const results: AddTopicResult[] = [];

    // Process in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < topics.length; i += batchSize) {
      const batch = topics.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((topic) => this.addTopic(topic)),
      );
      results.push(...batchResults);

      this.logger.info(
        `Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(topics.length / batchSize)}`,
      );
    }

    this.logger.info(`Batch import complete: ${results.length} topics added`);

    return results;
  }
}
