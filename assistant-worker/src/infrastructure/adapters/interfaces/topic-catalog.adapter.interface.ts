/**
 * Topic Catalog Adapter Interface
 * 
 * Port interface for topic discovery and tracking
 * Abstracts external TopicCatalogService implementation
 */

export interface TopicMetadata {
  id: string;
  name: string;
  description: string;
  complexity?: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
  relatedTopics?: string[];
  lastResearched?: Date;
  researchCount?: number;
  confidence?: number;
}

export interface TopicSearchResult {
  topic: string;
  relevanceScore: number;
  similarity: number;
}

export interface ITopicCatalogAdapter {
  /**
   * Add topic to catalog
   */
  addTopic(topic: string, metadata: Omit<TopicMetadata, 'id' | 'name'>): Promise<TopicMetadata>;

  /**
   * Get topic details
   */
  getTopic(topic: string): Promise<TopicMetadata | null>;

  /**
   * Search for related topics
   */
  searchTopics(query: string): Promise<TopicSearchResult[]>;

  /**
   * Get recommended topics for user
   */
  getRecommendedTopics(userId: string, limit?: number): Promise<string[]>;

  /**
   * Update topic metadata
   */
  updateTopic(topic: string, metadata: Partial<TopicMetadata>): Promise<TopicMetadata>;

  /**
   * Get trending topics
   */
  getTrendingTopics(limit?: number): Promise<string[]>;

  /**
   * Track topic research
   */
  trackResearch(topic: string, researchData: Record<string, unknown>): Promise<boolean>;
}
