/**
 * Topic Catalog Repository Port
 *
 * Interface for persisting and retrieving topics from storage.
 */

import {
  TopicCatalogEntry,
  CreateTopicInput,
} from '../../domain/entities/topic-catalog.entity';

export interface ITopicCatalogRepository {
  /**
   * Create a new topic entry
   */
  create(input: CreateTopicInput): Promise<TopicCatalogEntry>;

  /**
   * Find topic by ID
   */
  findById(id: string): Promise<TopicCatalogEntry | null>;

  /**
   * Find topic by name
   */
  findByName(name: string): Promise<TopicCatalogEntry | null>;

  /**
   * Update topic
   */
  update(
    id: string,
    updates: Partial<TopicCatalogEntry>,
  ): Promise<TopicCatalogEntry>;

  /**
   * Delete topic
   */
  delete(id: string): Promise<boolean>;

  /**
   * Find topics by status
   */
  findByStatus(
    status: TopicCatalogEntry['status'],
  ): Promise<TopicCatalogEntry[]>;

  /**
   * Find topics by category
   */
  findByCategory(category: string): Promise<TopicCatalogEntry[]>;

  /**
   * Find topics needing research (NOT_STARTED or NEEDS_REFRESH)
   */
  findTopicsNeedingResearch(limit?: number): Promise<TopicCatalogEntry[]>;

  /**
   * Find topics by priority (highest first)
   */
  findTopicsByPriority(limit?: number): Promise<TopicCatalogEntry[]>;

  /**
   * Search topics by name (text search)
   */
  searchByName(query: string, limit?: number): Promise<TopicCatalogEntry[]>;

  /**
   * Find similar topics using embeddings
   */
  findSimilarTopics(
    embedding: number[],
    threshold: number,
    limit?: number,
  ): Promise<
    Array<{
      topic: TopicCatalogEntry;
      similarity: number;
    }>
  >;

  /**
   * Get all topics
   */
  findAll(limit?: number, offset?: number): Promise<TopicCatalogEntry[]>;
}
