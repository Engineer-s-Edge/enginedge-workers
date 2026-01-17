import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExperienceBankItemSchema } from '../../infrastructure/database/schemas/experience-bank-item.schema';
import { BulletEvaluatorService } from './bullet-evaluator.service';
import * as crypto from 'crypto';

export interface ExperienceBankItemMetadata {
  technologies: string[];
  role: string;
  company: string;
  dateRange: {
    start: Date;
    end: Date | null;
  };
  metrics: string[];
  keywords: string[];
  reviewed: boolean;
  linkedExperienceId: Types.ObjectId | null;
  category: string;
  impactScore: number;
  atsScore: number;
  lastUsedDate: Date | null;
  usageCount: number;
  needsEditing?: boolean;
  flagComment?: string;
  flagReason?: string;
  flaggedAt?: Date;
  scoreHistory?: Array<{
    impact: number;
    ats: number;
    evaluatedAt: Date;
  }>;
}

export interface ExperienceBankItem {
  _id: Types.ObjectId;
  userId: string;
  bulletText: string;
  vector: number[];
  vectorModel: string;
  metadata: ExperienceBankItemMetadata;
  hash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddBulletData {
  userId: string;
  bulletText: string;
  vector?: number[];
  metadata: ExperienceBankItemMetadata;
}

export interface SearchOptions {
  query?: string;
  filters?: {
    technologies?: string[];
    role?: string;
    reviewed?: boolean;
    minImpactScore?: number;
    needsEditing?: boolean;
  };
  limit?: number;
  sortBy?: 'impactScore' | 'atsScore' | 'usageCount' | 'lastUsedDate';
}

export interface ListOptions {
  reviewed?: boolean;
  limit?: number;
  needsEditing?: boolean;
}

@Injectable()
export class ExperienceBankService {
  private readonly logger = new Logger(ExperienceBankService.name);

  constructor(
    @InjectModel('ExperienceBankItem')
    private readonly experienceBankModel: Model<ExperienceBankItemSchema>,
    private readonly bulletEvaluatorService: BulletEvaluatorService,
  ) {}

  /**
   * Generate a simple vector from text (placeholder - should use actual embedding service)
   */
  private generateVector(text: string): number[] {
    // Simple hash-based vector (in production, use actual embedding service)
    const hash = crypto
      .createHash('sha256')
      .update(text.toLowerCase())
      .digest('hex');
    const vector: number[] = [];
    for (let i = 0; i < 32; i += 2) {
      vector.push(parseInt(hash.substr(i, 2), 16) / 255);
    }
    // Pad to 128 dimensions
    while (vector.length < 128) {
      vector.push(Math.random() * 0.1);
    }
    return vector;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Generate hash for bullet text
   */
  private generateHash(text: string): string {
    return crypto
      .createHash('sha256')
      .update(text.toLowerCase().trim())
      .digest('hex');
  }

  async addBullet(
    userId: string,
    bulletText: string,
    vector: number[],
    metadata: ExperienceBankItemMetadata,
  ): Promise<ExperienceBankItem> {
    const hash = this.generateHash(bulletText);

    // Check if bullet already exists
    const existing = await this.experienceBankModel
      .findOne({ hash, userId })
      .exec();
    if (existing) {
      return this.toItem(existing);
    }

    const item = await this.experienceBankModel.create({
      userId,
      bulletText,
      vector: vector.length > 0 ? vector : this.generateVector(bulletText),
      vectorModel: 'text-embedding-004',
      metadata: {
        ...metadata,
        reviewed: metadata.reviewed ?? false,
        impactScore: metadata.impactScore ?? 0,
        atsScore: metadata.atsScore ?? 0,
        usageCount: metadata.usageCount ?? 0,
      },
      hash,
    });

    return this.toItem(item);
  }

  async add(data: AddBulletData): Promise<ExperienceBankItem> {
    const vector = data.vector || this.generateVector(data.bulletText);
    return this.addBullet(data.userId, data.bulletText, vector, data.metadata);
  }

  async search(
    userIdOrQuery: string | SearchOptions,
    options?: SearchOptions,
  ): Promise<ExperienceBankItem[]> {
    let userId: string;
    let searchOptions: SearchOptions;

    if (typeof userIdOrQuery === 'string') {
      userId = userIdOrQuery;
      searchOptions = options || {};
    } else {
      // If first param is SearchOptions, extract userId from filters or use empty
      searchOptions = userIdOrQuery;
      userId = ''; // Will need to be provided in filters or separate param
    }

    const query: any = {};
    if (userId) {
      query.userId = userId;
    }

    // Apply filters
    if (searchOptions.filters) {
      if (searchOptions.filters.reviewed !== undefined) {
        query['metadata.reviewed'] = searchOptions.filters.reviewed;
      }
      if (
        searchOptions.filters.technologies &&
        searchOptions.filters.technologies.length > 0
      ) {
        query['metadata.technologies'] = {
          $in: searchOptions.filters.technologies,
        };
      }
      if (searchOptions.filters.role) {
        query['metadata.role'] = searchOptions.filters.role;
      }
      if (searchOptions.filters.minImpactScore !== undefined) {
        query['metadata.impactScore'] = {
          $gte: searchOptions.filters.minImpactScore,
        };
      }
      if (searchOptions.filters.needsEditing !== undefined) {
        query['metadata.needsEditing'] = searchOptions.filters.needsEditing;
      }
    }

    let results = await this.experienceBankModel.find(query).exec();

    // If query text provided, do vector similarity search
    if (searchOptions.query) {
      const queryVector = this.generateVector(searchOptions.query);
      const scored = results.map((item) => ({
        item: this.toItem(item),
        similarity: this.cosineSimilarity(queryVector, item.vector),
      }));
      scored.sort((a, b) => b.similarity - a.similarity);
      results = scored.map((s) => s.item as any);
    }

    // Sort results
    if (searchOptions.sortBy) {
      results.sort((a, b) => {
        const aVal = (a.metadata[searchOptions.sortBy!] as number) || 0;
        const bVal = (b.metadata[searchOptions.sortBy!] as number) || 0;
        return bVal - aVal;
      });
    }

    // Apply limit
    const limit = searchOptions.limit || 50;
    return results.slice(0, limit).map((item) => this.toItem(item));
  }

  async findById(id: Types.ObjectId): Promise<ExperienceBankItem | null> {
    const item = await this.experienceBankModel.findById(id).exec();
    return item ? this.toItem(item) : null;
  }

  async findByUser(
    userId: string,
    options?: ListOptions,
  ): Promise<ExperienceBankItem[]> {
    const query: any = { userId };

    if (options?.reviewed !== undefined) {
      query['metadata.reviewed'] = options.reviewed;
    }
    if (options?.needsEditing !== undefined) {
      query['metadata.needsEditing'] = options.needsEditing;
    }

    const items = await this.experienceBankModel
      .find(query)
      .sort({ 'metadata.impactScore': -1 })
      .limit(options?.limit || 100)
      .exec();

    return items.map((item) => this.toItem(item));
  }

  async list(
    userId: string,
    options?: ListOptions,
  ): Promise<ExperienceBankItem[]> {
    return this.findByUser(userId, options);
  }

  async markAsReviewed(bulletId: string): Promise<void> {
    await this.experienceBankModel
      .updateOne({ _id: bulletId }, { $set: { 'metadata.reviewed': true } })
      .exec();
  }

  async markReviewed(id: Types.ObjectId, reviewed: boolean): Promise<void> {
    await this.experienceBankModel
      .updateOne({ _id: id }, { $set: { 'metadata.reviewed': reviewed } })
      .exec();
  }

  async updateUsage(id: Types.ObjectId): Promise<void> {
    await this.experienceBankModel
      .updateOne(
        { _id: id },
        {
          $inc: { 'metadata.usageCount': 1 },
          $set: { 'metadata.lastUsedDate': new Date() },
        },
      )
      .exec();
  }

  async delete(id: Types.ObjectId): Promise<void> {
    await this.experienceBankModel.deleteOne({ _id: id }).exec();
  }

  async getById(bulletId: string): Promise<ExperienceBankItem | null> {
    return this.findById(new Types.ObjectId(bulletId));
  }

  /**
   * Update bullet text and metadata
   */
  async updateBullet(
    id: Types.ObjectId,
    updates: {
      bulletText?: string;
      metadata?: Partial<ExperienceBankItemMetadata>;
      reEvaluate?: boolean;
    },
  ): Promise<ExperienceBankItem> {
    const updateData: any = {};

    if (updates.bulletText) {
      updateData.bulletText = updates.bulletText;
      updateData.vector = this.generateVector(updates.bulletText);
      updateData.hash = this.generateHash(updates.bulletText);
    }

    if (updates.metadata) {
      Object.keys(updates.metadata).forEach((key) => {
        updateData[`metadata.${key}`] = (updates.metadata as any)[key];
      });
    }

    const item = await this.experienceBankModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .exec();

    if (!item) {
      throw new Error('Bullet not found');
    }

    // Re-evaluate if requested
    if (updates.reEvaluate && updates.bulletText) {
      const evaluation = await this.bulletEvaluatorService.evaluateBullet(
        updates.bulletText,
        updates.metadata?.role,
        true,
        false,
      );

      await this.experienceBankModel
        .updateOne(
          { _id: id },
          {
            $set: {
              'metadata.impactScore': evaluation.overallScore,
              'metadata.atsScore': evaluation.overallScore * 0.9, // Approximate ATS score
            },
          },
        )
        .exec();
    }

    return this.toItem(item);
  }

  /**
   * Check if bullet text matches existing entry
   */
  async checkMatch(
    bulletText: string,
    userId: string,
  ): Promise<{
    matches: boolean;
    bulletId?: string;
    exactMatch: boolean;
    similarBullets: Array<{ id: string; text: string; similarity: number }>;
  }> {
    const hash = this.generateHash(bulletText);
    const exact = await this.experienceBankModel
      .findOne({ hash, userId })
      .exec();

    if (exact) {
      return {
        matches: true,
        bulletId: exact._id.toString(),
        exactMatch: true,
        similarBullets: [],
      };
    }

    // Find similar bullets using vector search
    const queryVector = this.generateVector(bulletText);
    const allBullets = await this.experienceBankModel.find({ userId }).exec();
    const similar = allBullets
      .map((item) => ({
        id: item._id.toString(),
        text: item.bulletText,
        similarity: this.cosineSimilarity(queryVector, item.vector),
      }))
      .filter((s) => s.similarity > 0.8)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    return {
      matches: similar.length > 0,
      exactMatch: false,
      similarBullets: similar,
    };
  }

  /**
   * Convert Mongoose document to entity
   */
  private toItem(doc: ExperienceBankItemSchema): ExperienceBankItem {
    return {
      _id: doc._id,
      userId: doc.userId,
      bulletText: doc.bulletText,
      vector: doc.vector,
      vectorModel: doc.vectorModel,
      metadata: doc.metadata as ExperienceBankItemMetadata,
      hash: doc.hash,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
