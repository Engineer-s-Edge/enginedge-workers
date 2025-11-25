/**
 * Favorite Repository
 *
 * MongoDB repository for interview favorites.
 */

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { Db, Collection } from 'mongodb';

export interface InterviewFavorite {
  id: string;
  userId: string;
  interviewId: string;
  createdAt: Date;
}

@Injectable()
export class MongoFavoriteRepository implements OnModuleInit {
  private readonly logger = new Logger(MongoFavoriteRepository.name);
  private collection!: Collection;

  constructor(@Inject('MONGODB_DB') private readonly db: Db) {}

  async onModuleInit() {
    this.collection = this.db.collection('interview_favorites');
    await this.collection.createIndex(
      { userId: 1, interviewId: 1 },
      { unique: true },
    );
    await this.collection.createIndex({ userId: 1 });
    await this.collection.createIndex({ interviewId: 1 });
    this.logger.log('MongoFavoriteRepository initialized');
  }

  async addFavorite(userId: string, interviewId: string): Promise<boolean> {
    try {
      await this.collection.updateOne(
        { userId, interviewId },
        {
          $set: {
            userId,
            interviewId,
            createdAt: new Date(),
          },
        },
        { upsert: true },
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add favorite: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  async removeFavorite(userId: string, interviewId: string): Promise<boolean> {
    try {
      const result = await this.collection.deleteOne({ userId, interviewId });
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(
        `Failed to remove favorite: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  async isFavorite(userId: string, interviewId: string): Promise<boolean> {
    try {
      const doc = await this.collection.findOne({ userId, interviewId });
      return !!doc;
    } catch (error) {
      this.logger.error(
        `Failed to check favorite: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  async getUserFavorites(userId: string): Promise<string[]> {
    try {
      const docs = await this.collection.find({ userId }).toArray();
      return docs.map((doc) => doc.interviewId);
    } catch (error) {
      this.logger.error(
        `Failed to get user favorites: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      return [];
    }
  }

  async getFavoriteCount(interviewId: string): Promise<number> {
    try {
      return await this.collection.countDocuments({ interviewId });
    } catch (error) {
      this.logger.error(
        `Failed to get favorite count: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      return 0;
    }
  }
}
