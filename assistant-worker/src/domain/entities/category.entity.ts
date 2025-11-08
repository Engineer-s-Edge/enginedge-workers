/**
 * Category Domain Entity
 *
 * Represents a dynamically generated category for organizing topics.
 * Categories are built from topic embeddings, not hardcoded.
 */

export interface Category {
  id: string;
  name: string;
  description?: string;
  embedding: number[]; // Category embedding (average of topic embeddings)
  topicIds: string[]; // Topics in this category
  parentCategoryId?: string;
  childCategoryIds: string[];
  keywords: string[]; // Extracted keywords from topics
  entityTypes: string[]; // Entity types found in topics (from spaCy)
  createdAt: Date;
  updatedAt: Date;
  topicCount: number;
  lastTopicAddedAt?: Date;
}

export interface CategoryHierarchy {
  rootCategories: Category[];
  relationships: Array<{
    parentId: string;
    childId: string;
    similarity: number;
  }>;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  embedding: number[];
  topicId: string;
  keywords?: string[];
  entityTypes?: string[];
}
