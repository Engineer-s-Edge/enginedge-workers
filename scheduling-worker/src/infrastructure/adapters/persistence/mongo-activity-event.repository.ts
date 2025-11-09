import { Injectable, Logger } from '@nestjs/common';
import { MongoClient, Db, Collection, Document } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { ActivityEvent } from '../../../domain/entities';
import { IActivityEventRepository } from '../../../application/ports/repositories.port';

/**
 * Activity Event Repository - MongoDB Implementation
 */
@Injectable()
export class MongoActivityEventRepository implements IActivityEventRepository {
  private readonly logger = new Logger(MongoActivityEventRepository.name);
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
    this.collection = this.db.collection('activity_events');

    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ userId: 1 });
    await this.collection.createIndex({ eventId: 1 }, { unique: true });
    await this.collection.createIndex({ userId: 1, scheduledTime: 1 });
    await this.collection.createIndex({ userId: 1, completed: 1 });

    this.logger.log('MongoActivityEventRepository initialized');
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  async save(event: ActivityEvent): Promise<ActivityEvent> {
    try {
      const doc = event.toObject();
      // Use upsert to handle both insert and update
      await this.collection.updateOne(
        { eventId: event.eventId },
        { $set: doc },
        { upsert: true },
      );
      this.logger.debug(`Saved activity event: ${event.id}`);
      return event;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to save activity event: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findById(id: string): Promise<ActivityEvent | null> {
    try {
      const doc = await this.collection.findOne({ id });
      return doc ? ActivityEvent.fromObject(doc) : null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find activity event by id: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<ActivityEvent[]> {
    try {
      const docs = await this.collection.find({ userId }).toArray();
      return docs.map((doc: Document) => ActivityEvent.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find activity events by userId: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findByEventId(eventId: string): Promise<ActivityEvent | null> {
    try {
      const doc = await this.collection.findOne({ eventId });
      return doc ? ActivityEvent.fromObject(doc) : null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find activity event by eventId: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ActivityEvent[]> {
    try {
      const docs = await this.collection
        .find({
          userId,
          scheduledTime: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        })
        .toArray();
      return docs.map((doc: Document) => ActivityEvent.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find activity events by date range: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findCompletedByUserId(userId: string): Promise<ActivityEvent[]> {
    try {
      const docs = await this.collection
        .find({ userId, completed: true })
        .toArray();
      return docs.map((doc: Document) => ActivityEvent.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find completed activity events: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.collection.deleteOne({ id });
      this.logger.log(`Deleted activity event: ${id}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to delete activity event: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
