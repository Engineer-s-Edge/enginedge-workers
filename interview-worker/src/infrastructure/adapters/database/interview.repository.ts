/**
 * Interview Repository - MongoDB Implementation
 */

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient, Db, Collection } from 'mongodb';
import { Interview } from '../../../domain/entities';
import { IInterviewRepository } from '../../../application/ports/repositories.port';

@Injectable()
export class MongoInterviewRepository
  implements IInterviewRepository, OnModuleInit
{
  private readonly logger = new Logger(MongoInterviewRepository.name);
  private collection!: Collection;

  constructor(
    @Inject('MONGODB_DB') private readonly db: Db,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.collection = this.db.collection('interviews');

    // Create indexes
    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ createdAt: -1 });
    await this.collection.createIndex({ updatedAt: -1 });
    await this.collection.createIndex({ userId: 1 });
    await this.collection.createIndex({ visibility: 1 });
    await this.collection.createIndex({ publishedAt: -1 });
    await this.collection.createIndex({ visibility: 1, publishedAt: -1 });

    this.logger.log('MongoInterviewRepository initialized');
  }

  async save(interview: Interview): Promise<Interview> {
    try {
      const doc = interview.toObject();
      await this.collection.updateOne(
        { id: interview.id },
        { $set: { ...doc, updatedAt: new Date() } },
        { upsert: true },
      );
      return interview;
    } catch (error) {
      this.logger.error(
        `Failed to save interview: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findById(id: string): Promise<Interview | null> {
    try {
      const doc = await this.collection.findOne({ id });
      return doc ? Interview.fromObject(doc) : null;
    } catch (error) {
      this.logger.error(
        `Failed to find interview: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findAll(): Promise<Interview[]> {
    try {
      const docs = await this.collection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();
      return docs.map((doc) => Interview.fromObject(doc));
    } catch (error) {
      this.logger.error(
        `Failed to find all interviews: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<Interview[]> {
    try {
      const docs = await this.collection
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();
      return docs.map((doc) => Interview.fromObject(doc));
    } catch (error) {
      this.logger.error(
        `Failed to find interviews by userId: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findPublicInterviews(options?: {
    page?: number;
    limit?: number;
    sortBy?: 'popular' | 'recent' | 'usage';
    category?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    search?: string;
  }): Promise<{
    interviews: Interview[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = { visibility: 'public' };

      // Add search filter
      if (options?.search) {
        query.$or = [
          { title: { $regex: options.search, $options: 'i' } },
          { description: { $regex: options.search, $options: 'i' } },
        ];
      }

      // Add category filter (filter by phase type)
      if (options?.category) {
        query['phases.type'] = options.category;
      }

      // Add difficulty filter (filter by phase difficulty)
      if (options?.difficulty) {
        query['phases.difficulty'] = options.difficulty;
      }

      // Build sort
      let sort: any = {};
      if (options?.sortBy === 'recent') {
        sort = { publishedAt: -1 };
      } else if (options?.sortBy === 'usage') {
        sort = { favoriteCount: -1 };
      } else {
        // Default: popular (by usageCount)
        sort = { usageCount: -1 };
      }

      // Get total count
      const total = await this.collection.countDocuments(query);

      // Get interviews
      const docs = await this.collection
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();

      const interviews = docs.map((doc) => Interview.fromObject(doc));
      const totalPages = Math.ceil(total / limit);

      return {
        interviews,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `Failed to find public interviews: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async update(
    id: string,
    interview: Partial<Interview>,
  ): Promise<Interview | null> {
    try {
      const updateDoc = {
        ...Object.fromEntries(
          Object.entries(interview).filter(([_, v]) => v !== undefined),
        ),
        updatedAt: new Date(),
      };
      delete (updateDoc as any).id; // Don't update id

      const result = await this.collection.findOneAndUpdate(
        { id },
        { $set: updateDoc },
        { returnDocument: 'after' },
      );

      return result ? Interview.fromObject(result) : null;
    } catch (error) {
      this.logger.error(
        `Failed to update interview: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.collection.deleteOne({ id });
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete interview: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
