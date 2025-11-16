/**
 * Category Service
 *
 * Manages dynamic category creation and hierarchy using embeddings.
 * Categories are built from topic similarities, not hardcoded.
 */

import { Injectable, Inject, Optional, forwardRef } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import { IEmbedder } from '@application/ports/embedder.port';
import { ISpacyService } from '@application/ports/spacy-service.port';
import { ICategoryRepository } from '@application/ports/category.repository.port';
import {
  Category,
  CreateCategoryInput,
} from '../../domain/entities/category.entity';
import { TopicCatalogService } from './topic-catalog.service';

export interface CategoryAssignmentResult {
  categoryName: string;
  confidence: number;
  isNewCategory: boolean;
  reasoning: string;
}

@Injectable()
export class CategoryService {
  private readonly SIMILARITY_THRESHOLD = 0.7; // Threshold for category assignment
  private readonly HIERARCHY_THRESHOLD = 0.6; // Threshold for parent-child relationships

  constructor(
    @Inject('ICategoryRepository')
    private readonly categoryRepository: ICategoryRepository,
    @Inject('IEmbedder')
    private readonly embedder: IEmbedder,
    @Inject('ILogger')
    private readonly logger: ILogger,
    @Optional()
    @Inject('ISpacyService')
    private readonly spacyService?: ISpacyService,
    @Optional()
    @Inject(forwardRef(() => TopicCatalogService))
    private readonly topicCatalogService?: TopicCatalogService,
  ) {}

  /**
   * Categorize a topic using embeddings (primary) and spaCy (enhancement)
   */
  async categorizeTopic(
    topicName: string,
    topicDescription: string | undefined,
    topicEmbedding: number[],
  ): Promise<CategoryAssignmentResult> {
    this.logger.info(`Categorizing topic: ${topicName}`);

    // Step 1: Find similar categories using embeddings
    const similarCategories =
      await this.categoryRepository.findSimilarCategories(
        topicEmbedding,
        this.SIMILARITY_THRESHOLD,
        5, // Top 5
      );

    if (similarCategories.length > 0) {
      const bestMatch = similarCategories[0];
      this.logger.info(
        `Found similar category: ${bestMatch.category.name} (similarity: ${bestMatch.similarity})`,
      );

      // Enhance with spaCy if available
      let enhancedConfidence = bestMatch.similarity;
      let reasoning = `High embedding similarity (${bestMatch.similarity.toFixed(2)}) to existing category "${bestMatch.category.name}"`;

      if (this.spacyService) {
        try {
          const spacyResult = await this.spacyService.categorizeTopic(
            topicName,
            topicDescription,
            [bestMatch.category.name],
          );

          // Combine embedding similarity with spaCy confidence
          enhancedConfidence =
            (bestMatch.similarity + spacyResult.confidence) / 2;
          reasoning += `. ${spacyResult.reasoning}`;
        } catch (error) {
          this.logger.warn(
            `spaCy service unavailable, using embedding-only categorization: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return {
        categoryName: bestMatch.category.name,
        confidence: enhancedConfidence,
        isNewCategory: false,
        reasoning,
      };
    }

    // Step 2: No similar category found - check if we should create a new one
    // Use spaCy to suggest category name if available
    let suggestedCategoryName = topicName;
    let keywords: string[] = [];
    let entityTypes: string[] = [];

    if (this.spacyService) {
      try {
        const spacyResult = await this.spacyService.categorizeTopic(
          topicName,
          topicDescription,
        );
        const features = await this.spacyService.extractTopicFeatures(
          topicName,
          topicDescription,
        );

        suggestedCategoryName = spacyResult.suggestedCategory;
        keywords = features.keywords;
        entityTypes = features.entities.map((e) => e.label);

        this.logger.info(
          `spaCy suggested category: ${suggestedCategoryName} with ${keywords.length} keywords`,
        );
      } catch (error) {
        this.logger.warn(
          `spaCy service unavailable for category creation: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Step 3: Create new category
    const newCategory = await this.createCategoryFromTopic(
      suggestedCategoryName,
      topicEmbedding,
      keywords,
      entityTypes,
    );

    return {
      categoryName: newCategory.name,
      confidence: 0.5, // Lower confidence for new categories
      isNewCategory: true,
      reasoning: `Created new category "${newCategory.name}" based on topic analysis`,
    };
  }

  /**
   * Create a new category from a topic
   */
  async createCategoryFromTopic(
    categoryName: string,
    topicEmbedding: number[],
    keywords: string[] = [],
    entityTypes: string[] = [],
  ): Promise<Category> {
    this.logger.info(`Creating new category: ${categoryName}`);

    const input: CreateCategoryInput = {
      name: categoryName,
      embedding: topicEmbedding,
      topicId: '', // Will be set when topic is added
      keywords,
      entityTypes,
    };

    const category = await this.categoryRepository.create(input);
    this.logger.info(`Created category: ${category.name} (ID: ${category.id})`);

    return category;
  }

  /**
   * Update category embedding (average of all topic embeddings in category)
   */
  async updateCategoryEmbedding(categoryId: string): Promise<void> {
    this.logger.info(`Updating embedding for category: ${categoryId}`);

    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new Error(`Category not found: ${categoryId}`);
    }

    // Get all topics in this category
    if (!this.topicCatalogService) {
      this.logger.warn(
        'TopicCatalogService not available, cannot update category embedding',
      );
      return;
    }

    try {
      const topics = await this.topicCatalogService.getTopicsByCategory(
        category.name,
      );

      if (topics.length === 0) {
        this.logger.info(
          `No topics found for category ${category.name}, keeping existing embedding`,
        );
        return;
      }

      // Get embeddings for all topics
      const topicEmbeddings: number[][] = [];
      for (const topic of topics) {
        if (topic.embedding && topic.embedding.length > 0) {
          topicEmbeddings.push(topic.embedding);
        }
      }

      if (topicEmbeddings.length === 0) {
        this.logger.warn(
          `No embeddings found for topics in category ${category.name}`,
        );
        return;
      }

      // Average the embeddings
      const embeddingDimension = topicEmbeddings[0].length;
      const averagedEmbedding = new Array(embeddingDimension).fill(0);

      for (const embedding of topicEmbeddings) {
        if (embedding.length !== embeddingDimension) {
          this.logger.warn(
            `Embedding dimension mismatch: expected ${embeddingDimension}, got ${embedding.length}`,
          );
          continue;
        }
        for (let i = 0; i < embeddingDimension; i++) {
          averagedEmbedding[i] += embedding[i];
        }
      }

      // Divide by count to get average
      for (let i = 0; i < embeddingDimension; i++) {
        averagedEmbedding[i] /= topicEmbeddings.length;
      }

      // Update category with averaged embedding
      await this.categoryRepository.update(categoryId, {
        embedding: averagedEmbedding,
      });

      this.logger.info(
        `Category embedding updated: ${categoryId} (averaged ${topicEmbeddings.length} topic embeddings)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update category embedding: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Calculate distance between two categories (using embeddings)
   */
  async calculateCategoryDistance(
    category1Name: string,
    category2Name: string,
  ): Promise<number> {
    const cat1 = await this.categoryRepository.findByName(category1Name);
    const cat2 = await this.categoryRepository.findByName(category2Name);

    if (!cat1 || !cat2) {
      throw new Error('One or both categories not found');
    }

    const similarity = this.embedder.cosineSimilarity(
      cat1.embedding,
      cat2.embedding,
    );

    // Distance is 1 - similarity
    return 1 - similarity;
  }

  /**
   * Build category hierarchy from category similarities
   */
  async buildCategoryHierarchy(): Promise<Category[]> {
    this.logger.info('Building category hierarchy');

    const allCategories = await this.categoryRepository.findAll();
    const rootCategories: Category[] = [];

    // Find root categories (no parent)
    for (const category of allCategories) {
      if (!category.parentCategoryId) {
        rootCategories.push(category);
      }
    }

    // Build parent-child relationships based on similarity
    for (const category of allCategories) {
      if (category.parentCategoryId) {
        continue; // Already has a parent
      }

      // Find most similar category that could be a parent
      let bestParent: Category | null = null;
      let bestSimilarity = 0;

      for (const potentialParent of allCategories) {
        if (potentialParent.id === category.id) {
          continue;
        }

        const similarity = this.embedder.cosineSimilarity(
          category.embedding,
          potentialParent.embedding,
        );

        // Parent should be more general (higher in hierarchy)
        // For now, we'll use similarity threshold
        if (
          similarity > this.HIERARCHY_THRESHOLD &&
          similarity > bestSimilarity
        ) {
          bestParent = potentialParent;
          bestSimilarity = similarity;
        }
      }

      if (bestParent) {
        await this.categoryRepository.update(category.id, {
          parentCategoryId: bestParent.id,
        });

        // Update parent's child list
        const updatedParent = await this.categoryRepository.findById(
          bestParent.id,
        );
        if (updatedParent) {
          await this.categoryRepository.update(bestParent.id, {
            childCategoryIds: [...updatedParent.childCategoryIds, category.id],
          });
        }

        this.logger.info(
          `Set ${category.name} as child of ${bestParent.name} (similarity: ${bestSimilarity.toFixed(2)})`,
        );
      }
    }

    return rootCategories;
  }

  /**
   * Get category by name
   */
  async getCategoryByName(name: string): Promise<Category | null> {
    return this.categoryRepository.findByName(name);
  }

  /**
   * Get all categories
   */
  async getAllCategories(): Promise<Category[]> {
    return this.categoryRepository.findAll();
  }

  /**
   * Get root categories
   */
  async getRootCategories(): Promise<Category[]> {
    return this.categoryRepository.findRootCategories();
  }
}
