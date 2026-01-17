/**
 * Category Repository Port
 *
 * Interface for persisting and retrieving categories from storage.
 */

import {
  Category,
  CreateCategoryInput,
} from '../../domain/entities/category.entity';

export interface ICategoryRepository {
  /**
   * Create a new category
   */
  create(input: CreateCategoryInput): Promise<Category>;

  /**
   * Find category by ID
   */
  findById(id: string): Promise<Category | null>;

  /**
   * Find category by name
   */
  findByName(name: string): Promise<Category | null>;

  /**
   * Update category
   */
  update(id: string, updates: Partial<Category>): Promise<Category>;

  /**
   * Delete category
   */
  delete(id: string): Promise<boolean>;

  /**
   * Find all categories
   */
  findAll(): Promise<Category[]>;

  /**
   * Find categories by parent
   */
  findByParent(parentId: string): Promise<Category[]>;

  /**
   * Find root categories (no parent)
   */
  findRootCategories(): Promise<Category[]>;

  /**
   * Find similar categories using embeddings
   */
  findSimilarCategories(
    embedding: number[],
    threshold: number,
    limit?: number,
  ): Promise<
    Array<{
      category: Category;
      similarity: number;
    }>
  >;

  /**
   * Add topic to category
   */
  addTopicToCategory(categoryId: string, topicId: string): Promise<Category>;

  /**
   * Remove topic from category
   */
  removeTopicFromCategory(
    categoryId: string,
    topicId: string,
  ): Promise<Category>;
}
