/**
 * Topic Catalog Domain Entity
 *
 * Represents a topic that needs to be researched.
 * Topics are NOT knowledge graph nodes - they're a separate catalog/queue.
 */

export enum TopicStatus {
  NOT_STARTED = 'not-started',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  NEEDS_REFRESH = 'needs-refresh',
  BLOCKED = 'blocked',
  USER_ESCALATED = 'user-escalated',
}

export enum TopicSourceType {
  WIKIPEDIA = 'wikipedia',
  WIKIDATA = 'wikidata',
  ORGANIC = 'organic',
  USER = 'user',
  CURATED = 'curated',
}

export enum ICSLayer {
  L1_DOMAIN = 1,
  L2_CATEGORY = 2,
  L3_TOPIC = 3,
  L4_DETAIL = 4,
  L5_IMPLEMENTATION = 5,
  L6_EDGE_CASE = 6,
}

export interface TopicCatalogEntry {
  id: string;
  name: string;
  description?: string;
  category: string;
  subcategories: string[];
  estimatedComplexity: ICSLayer;
  prerequisiteTopics: string[];
  status: TopicStatus;
  knowledgeNodeId?: string; // Link to knowledge graph node AFTER research
  lastUpdated?: Date;
  sourceType: TopicSourceType;
  externalIds?: {
    wikipediaUrl?: string;
    wikipediaPageId?: number;
    wikidataId?: string;
  };
  relatedCategories: string[];
  researchPriority: number; // 0-100
  discoveredBy?: string; // Agent ID
  discoveredAt?: Date;
  metadata?: {
    description?: string;
    keywords?: string[];
    estimatedResearchTime?: number; // Minutes
    difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  };
  embedding?: number[]; // Cached embedding for similarity calculations
  categorizationConfidence?: number; // 0-1
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTopicInput {
  name: string;
  description?: string;
  category?: string;
  estimatedComplexity?: ICSLayer;
  sourceType: TopicSourceType;
  externalIds?: TopicCatalogEntry['externalIds'];
  metadata?: TopicCatalogEntry['metadata'];
  discoveredBy?: string;
}
