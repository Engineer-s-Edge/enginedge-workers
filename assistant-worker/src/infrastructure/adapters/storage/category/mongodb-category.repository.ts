/**
 * MongoDB Category Repository
 *
 * Implements ICategoryRepository using MongoDB.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ICategoryRepository } from '@application/ports/category.repository.port';
import {
  Category,
  CreateCategoryInput,
} from '../../../../domain/entities/category.entity';
import { CategoryModel, CategoryDocument } from './category.schema';

@Injectable()
export class MongoDBCategoryRepository implements ICategoryRepository {
  constructor(
    @InjectModel(CategoryModel.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  private toEntity(doc: CategoryDocument): Category {
    return {
      id: (doc._id as any).toString(),
      name: doc.name,
      description: doc.description,
      embedding: doc.embedding,
      topicIds: doc.topicIds || [],
      parentCategoryId: doc.parentCategoryId,
      childCategoryIds: doc.childCategoryIds || [],
      keywords: doc.keywords || [],
      entityTypes: doc.entityTypes || [],
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
      topicCount: doc.topicCount || 0,
      lastTopicAddedAt: doc.lastTopicAddedAt,
    };
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const doc = new this.categoryModel({
      name: input.name,
      description: input.description,
      embedding: input.embedding,
      topicIds: input.topicId ? [input.topicId] : [],
      keywords: input.keywords || [],
      entityTypes: input.entityTypes || [],
      topicCount: input.topicId ? 1 : 0,
      lastTopicAddedAt: input.topicId ? new Date() : undefined,
    });

    const saved = await doc.save();
    return this.toEntity(saved);
  }

  async findById(id: string): Promise<Category | null> {
    const doc = await this.categoryModel.findById(id).exec();
    return doc ? this.toEntity(doc) : null;
  }

  async findByName(name: string): Promise<Category | null> {
    const doc = await this.categoryModel.findOne({ name }).exec();
    return doc ? this.toEntity(doc) : null;
  }

  async update(id: string, updates: Partial<Category>): Promise<Category> {
    const doc = await this.categoryModel
      .findByIdAndUpdate(id, { $set: updates }, { new: true })
      .exec();

    if (!doc) {
      throw new Error(`Category not found: ${id}`);
    }

    return this.toEntity(doc);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.categoryModel.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  async findAll(): Promise<Category[]> {
    const docs = await this.categoryModel.find().exec();
    return docs.map((doc) => this.toEntity(doc));
  }

  async findByParent(parentId: string): Promise<Category[]> {
    const docs = await this.categoryModel
      .find({ parentCategoryId: parentId })
      .exec();
    return docs.map((doc) => this.toEntity(doc));
  }

  async findRootCategories(): Promise<Category[]> {
    const docs = await this.categoryModel
      .find({ parentCategoryId: { $exists: false } })
      .exec();
    return docs.map((doc) => this.toEntity(doc));
  }

  async findSimilarCategories(
    embedding: number[],
    threshold: number,
    limit: number = 10,
  ): Promise<Array<{ category: Category; similarity: number }>> {
    const docs = await this.categoryModel.find().exec();

    const results: Array<{ category: Category; similarity: number }> = [];

    for (const doc of docs) {
      const similarity = this.cosineSimilarity(embedding, doc.embedding);
      if (similarity >= threshold) {
        results.push({
          category: this.toEntity(doc),
          similarity,
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  async addTopicToCategory(
    categoryId: string,
    topicId: string,
  ): Promise<Category> {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) {
      throw new Error(`Category not found: ${categoryId}`);
    }

    if (!category.topicIds.includes(topicId)) {
      category.topicIds.push(topicId);
      category.topicCount = category.topicIds.length;
      category.lastTopicAddedAt = new Date();
      await category.save();
    }

    return this.toEntity(category);
  }

  async removeTopicFromCategory(
    categoryId: string,
    topicId: string,
  ): Promise<Category> {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) {
      throw new Error(`Category not found: ${categoryId}`);
    }

    category.topicIds = category.topicIds.filter((id) => id !== topicId);
    category.topicCount = category.topicIds.length;
    await category.save();

    return this.toEntity(category);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
