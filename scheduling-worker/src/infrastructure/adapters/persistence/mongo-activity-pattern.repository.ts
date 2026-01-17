import { Injectable, Logger } from '@nestjs/common';
import { MongoClient, Db, Collection, Document } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { ActivityPattern } from '../../../domain/entities';
import { IActivityPatternRepository } from '../../../application/ports/repositories.port';

/**
 * Activity Pattern Repository - MongoDB Implementation
 */
@Injectable()
export class MongoActivityPatternRepository
  implements IActivityPatternRepository
{
  private readonly logger = new Logger(MongoActivityPatternRepository.name);
  private client!: MongoClient;
  private db!: Db;
  private collection!: Collection;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const mongoUri =
      this.configService.get<string>('MONGODB_URI') ||
      'mongodb://localhost:27017';
    const dbName =
      this.configService.get<string>('MONGODB_DATABASE') || 'scheduling_worker';

    this.client = new MongoClient(mongoUri);
    await this.client.connect();
    this.db = this.client.db(dbName);
    this.collection = this.db.collection('activity_patterns');

    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ userId: 1 });
    await this.collection.createIndex({ userId: 1, patternType: 1 });

    this.logger.log('MongoActivityPatternRepository initialized');
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  async save(pattern: ActivityPattern): Promise<ActivityPattern> {
    try {
      const doc = pattern.toObject();
      await this.collection.insertOne(doc);
      this.logger.log(`Saved activity pattern: ${pattern.id}`);
      return pattern;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to save activity pattern: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findById(id: string): Promise<ActivityPattern | null> {
    try {
      const doc = await this.collection.findOne({ id });
      return doc ? ActivityPattern.fromObject(doc) : null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find activity pattern by id: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<ActivityPattern | null> {
    try {
      // Get the most recent pattern for the user (typically daily pattern)
      const doc = await this.collection
        .find({ userId })
        .sort({ updatedAt: -1 })
        .limit(1)
        .toArray();
      return doc.length > 0 ? ActivityPattern.fromObject(doc[0]) : null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find activity pattern by userId: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findByUserIdAndType(
    userId: string,
    patternType: ActivityPattern['patternType'],
  ): Promise<ActivityPattern | null> {
    try {
      const doc = await this.collection.findOne({ userId, patternType });
      return doc ? ActivityPattern.fromObject(doc) : null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find activity pattern by userId and type: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async update(
    id: string,
    pattern: Partial<ActivityPattern>,
  ): Promise<ActivityPattern> {
    try {
      // Convert pattern to object for update
      const updateDoc: any = {};
      if (pattern.preferredHours !== undefined) {
        updateDoc.preferredHours = pattern.preferredHours;
      }
      if (pattern.preferredDays !== undefined) {
        updateDoc.preferredDays = pattern.preferredDays;
      }
      if (pattern.productivityScore !== undefined) {
        updateDoc.productivityScore = pattern.productivityScore;
      }
      if (pattern.completionRate !== undefined) {
        updateDoc.completionRate = pattern.completionRate;
      }
      if (pattern.averageFocusDuration !== undefined) {
        updateDoc.averageFocusDuration = pattern.averageFocusDuration;
      }
      if (pattern.peakProductivityHours !== undefined) {
        updateDoc.peakProductivityHours = pattern.peakProductivityHours;
      }
      if (pattern.metadata !== undefined) {
        updateDoc.metadata = pattern.metadata;
      }
      updateDoc.updatedAt = new Date().toISOString();

      const result = await this.collection.findOneAndUpdate(
        { id },
        { $set: updateDoc },
        { returnDocument: 'after' },
      );

      if (!result || !result.value) {
        throw new Error(`Activity pattern ${id} not found`);
      }

      return ActivityPattern.fromObject(result.value);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to update activity pattern: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.collection.deleteOne({ id });
      this.logger.log(`Deleted activity pattern: ${id}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to delete activity pattern: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
