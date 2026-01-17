import { Injectable, Logger } from '@nestjs/common';
import { MongoClient, Db, Collection } from 'mongodb';
import { ConfigService } from '@nestjs/config';

/**
 * Day Lock Repository - MongoDB Implementation
 *
 * Persists locked days to MongoDB
 *
 * Infrastructure Adapter - Depends on MongoDB
 */
@Injectable()
export class MongoDayLockRepository {
  private readonly logger = new Logger(MongoDayLockRepository.name);
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

    this.logger.log(`Connecting to MongoDB: ${mongoUri}`);

    this.client = new MongoClient(mongoUri);
    await this.client.connect();
    this.db = this.client.db(dbName);
    this.collection = this.db.collection('day_locks');

    // Create indexes
    await this.collection.createIndex({ userId: 1, date: 1 }, { unique: true });
    await this.collection.createIndex({ userId: 1 });
    await this.collection.createIndex({ date: 1 });

    this.logger.log('MongoDB connection established and indexes created');
  }

  async onModuleDestroy() {
    await this.client.close();
    this.logger.log('MongoDB connection closed');
  }

  async lockDay(userId: string, date: Date): Promise<void> {
    try {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      await this.collection.updateOne(
        { userId, date: dateStr },
        {
          $set: {
            userId,
            date: dateStr,
            isLocked: true,
            lockedAt: new Date(),
          },
        },
        { upsert: true },
      );
      this.logger.log(`Locked day ${dateStr} for user ${userId}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to lock day: ${err.message}`, err.stack);
      throw error;
    }
  }

  async unlockDay(userId: string, date: Date): Promise<void> {
    try {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      await this.collection.deleteOne({ userId, date: dateStr });
      this.logger.log(`Unlocked day ${dateStr} for user ${userId}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to unlock day: ${err.message}`, err.stack);
      throw error;
    }
  }

  async isDayLocked(userId: string, date: Date): Promise<boolean> {
    try {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const doc = await this.collection.findOne({ userId, date: dateStr });
      return doc !== null && doc.isLocked === true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to check if day is locked: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async getLockedDays(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Date[]> {
    try {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      const docs = await this.collection
        .find({
          userId,
          date: { $gte: startDateStr, $lte: endDateStr },
          isLocked: true,
        })
        .toArray();

      return docs.map((doc) => new Date(doc.date));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get locked days: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getLockedDaysWithMetadata(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ date: Date; lockedAt: Date }>> {
    try {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      const docs = await this.collection
        .find({
          userId,
          date: { $gte: startDateStr, $lte: endDateStr },
          isLocked: true,
        })
        .toArray();

      return docs.map((doc) => ({
        date: new Date(doc.date),
        lockedAt: new Date(doc.lockedAt),
      }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to get locked days with metadata: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
