import { Injectable, Logger } from '@nestjs/common';
import { MongoClient, Db, Collection } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { CalendarEvent } from '../../../domain/entities';
import { ICalendarEventRepository } from '../../../application/ports/repositories.port';

/**
 * Calendar Event Repository - MongoDB Implementation
 * 
 * Persists calendar events to MongoDB
 * 
 * Infrastructure Adapter - Depends on MongoDB
 */
@Injectable()
export class MongoCalendarEventRepository implements ICalendarEventRepository {
  private readonly logger = new Logger(MongoCalendarEventRepository.name);
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
    this.collection = this.db.collection('calendar_events');

    // Create indexes
    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ calendarId: 1 });
    await this.collection.createIndex({ startTime: 1, endTime: 1 });
    await this.collection.createIndex({ 'metadata.userId': 1 });

    this.logger.log('MongoDB connection established and indexes created');
  }

  async onModuleDestroy() {
    await this.client.close();
    this.logger.log('MongoDB connection closed');
  }

  async save(event: CalendarEvent): Promise<CalendarEvent> {
    try {
      const doc = event.toObject();
      await this.collection.insertOne(doc);
      this.logger.log(`Saved event: ${event.id}`);
      return event;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to save event: ${err.message}`, err.stack);
      throw error;
    }
  }

  async findById(id: string): Promise<CalendarEvent | null> {
    try {
      const doc = await this.collection.findOne({ id });
      return doc ? CalendarEvent.fromObject(doc) : null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to find event by id: ${err.message}`, err.stack);
      throw error;
    }
  }

  async findByCalendarId(calendarId: string): Promise<CalendarEvent[]> {
    try {
      const docs = await this.collection.find({ calendarId }).toArray();
      return docs.map((doc) => CalendarEvent.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find events by calendar id: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findInTimeRange(
    calendarId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<CalendarEvent[]> {
    try {
      const docs = await this.collection
        .find({
          calendarId,
          startTime: { $lt: endTime },
          endTime: { $gt: startTime },
        })
        .toArray();

      return docs.map((doc) => CalendarEvent.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find events in time range: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<CalendarEvent[]> {
    try {
      const docs = await this.collection
        .find({ 'metadata.userId': userId })
        .toArray();

      return docs.map((doc) => CalendarEvent.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find events by user id: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async update(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    try {
      const result = await this.collection.findOneAndUpdate(
        { id },
        { $set: updates },
        { returnDocument: 'after' },
      );

      if (!result || !result.value) {
        throw new Error(`Event ${id} not found`);
      }

      return CalendarEvent.fromObject(result.value);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to update event: ${err.message}`, err.stack);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.collection.deleteOne({ id });
      this.logger.log(`Deleted event: ${id}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to delete event: ${err.message}`, err.stack);
      throw error;
    }
  }

  async batchSave(events: CalendarEvent[]): Promise<CalendarEvent[]> {
    try {
      const docs = events.map((e) => e.toObject());
      await this.collection.insertMany(docs);
      this.logger.log(`Batch saved ${events.length} events`);
      return events;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to batch save events: ${err.message}`, err.stack);
      throw error;
    }
  }

  async deleteByCalendarId(calendarId: string): Promise<void> {
    try {
      const result = await this.collection.deleteMany({ calendarId });
      this.logger.log(
        `Deleted ${result.deletedCount} events for calendar: ${calendarId}`,
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to delete events by calendar id: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
