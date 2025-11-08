/**
 * MongoDB Topic Catalog Repository
 *
 * Implements ITopicCatalogRepository using MongoDB.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ITopicCatalogRepository } from '@application/ports/topic-catalog.repository.port';
import {
  TopicCatalogEntry,
  CreateTopicInput,
  TopicStatus,
} from '../../../../domain/entities/topic-catalog.entity';
import { TopicCatalog, TopicCatalogDocument } from './topic-catalog.schema';

@Injectable()
export class MongoDBTopicCatalogRepository implements ITopicCatalogRepository {
  constructor(
    @InjectModel(TopicCatalog.name)
    private readonly topicModel: Model<TopicCatalogDocument>,
  ) {}

  private toEntity(doc: TopicCatalogDocument): TopicCatalogEntry {
    return {
      id: doc._id.toString(),
      name: doc.name,
      description: doc.description,
      category: doc.category,
      subcategories: doc.subcategories || [],
      estimatedComplexity: doc.estimatedComplexity,
      prerequisiteTopics: doc.prerequisiteTopics || [],
      status: doc.status,
      knowledgeNodeId: doc.knowledgeNodeId,
      lastUpdated: doc.lastUpdated,
      sourceType: doc.sourceType,
      externalIds: doc.externalIds,
      relatedCategories: doc.relatedCategories || [],
      researchPriority: doc.researchPriority,
      discoveredBy: doc.discoveredBy,
      discoveredAt: doc.discoveredAt,
      metadata: doc.metadata,
      embedding: doc.embedding,
      categorizationConfidence: doc.categorizationConfidence,
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
    };
  }

  async create(input: CreateTopicInput): Promise<TopicCatalogEntry> {
    const doc = new this.topicModel({
      ...input,
      category: input.category || 'Uncategorized',
      status: TopicStatus.NOT_STARTED,
      researchPriority: 50,
      estimatedComplexity: input.estimatedComplexity || 3,
    });

    const saved = await doc.save();
    return this.toEntity(saved);
  }

  async findById(id: string): Promise<TopicCatalogEntry | null> {
    const doc = await this.topicModel.findById(id).exec();
    return doc ? this.toEntity(doc) : null;
  }

  async findByName(name: string): Promise<TopicCatalogEntry | null> {
    const doc = await this.topicModel.findOne({ name }).exec();
    return doc ? this.toEntity(doc) : null;
  }

  async update(
    id: string,
    updates: Partial<TopicCatalogEntry>,
  ): Promise<TopicCatalogEntry> {
    const doc = await this.topicModel
      .findByIdAndUpdate(id, { $set: updates }, { new: true })
      .exec();

    if (!doc) {
      throw new Error(`Topic not found: ${id}`);
    }

    return this.toEntity(doc);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.topicModel.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  async findByStatus(status: TopicStatus): Promise<TopicCatalogEntry[]> {
    const docs = await this.topicModel.find({ status }).exec();
    return docs.map((doc) => this.toEntity(doc));
  }

  async findByCategory(category: string): Promise<TopicCatalogEntry[]> {
    const docs = await this.topicModel.find({ category }).exec();
    return docs.map((doc) => this.toEntity(doc));
  }

  async findTopicsNeedingResearch(
    limit: number = 10,
  ): Promise<TopicCatalogEntry[]> {
    const docs = await this.topicModel
      .find({
        status: { $in: [TopicStatus.NOT_STARTED, TopicStatus.NEEDS_REFRESH] },
      })
      .sort({ researchPriority: -1 })
      .limit(limit)
      .exec();

    return docs.map((doc) => this.toEntity(doc));
  }

  async findTopicsByPriority(limit: number = 10): Promise<TopicCatalogEntry[]> {
    const docs = await this.topicModel
      .find()
      .sort({ researchPriority: -1 })
      .limit(limit)
      .exec();

    return docs.map((doc) => this.toEntity(doc));
  }

  async searchByName(
    query: string,
    limit: number = 20,
  ): Promise<TopicCatalogEntry[]> {
    const docs = await this.topicModel
      .find({ $text: { $search: query } })
      .limit(limit)
      .exec();

    return docs.map((doc) => this.toEntity(doc));
  }

  async findSimilarTopics(
    embedding: number[],
    threshold: number,
    limit: number = 10,
  ): Promise<Array<{ topic: TopicCatalogEntry; similarity: number }>> {
    // Get all topics with embeddings
    const docs = await this.topicModel
      .find({ embedding: { $exists: true, $ne: null } })
      .exec();

    // Calculate cosine similarity for each
    const results: Array<{ topic: TopicCatalogEntry; similarity: number }> = [];

    for (const doc of docs) {
      if (!doc.embedding) continue;

      const similarity = this.cosineSimilarity(embedding, doc.embedding);
      if (similarity >= threshold) {
        results.push({
          topic: this.toEntity(doc),
          similarity,
        });
      }
    }

    // Sort by similarity and return top results
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  async findAll(
    limit: number = 100,
    offset: number = 0,
  ): Promise<TopicCatalogEntry[]> {
    const docs = await this.topicModel.find().skip(offset).limit(limit).exec();

    return docs.map((doc) => this.toEntity(doc));
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
