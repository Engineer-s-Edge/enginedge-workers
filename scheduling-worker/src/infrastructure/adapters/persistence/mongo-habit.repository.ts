import { Injectable, Logger } from '@nestjs/common';
import { MongoClient, Db, Collection, Document } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { Habit } from '../../../domain/entities';
import { IHabitRepository } from '../../../application/ports/repositories.port';

/**
 * Habit Repository - MongoDB Implementation
 */
@Injectable()
export class MongoHabitRepository implements IHabitRepository {
  private readonly logger = new Logger(MongoHabitRepository.name);
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
    this.collection = this.db.collection('habits');

    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ userId: 1 });
    await this.collection.createIndex({ userId: 1, isActive: 1 });

    this.logger.log('MongoHabitRepository initialized');
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  async save(habit: Habit): Promise<Habit> {
    const doc = habit.toObject();
    await this.collection.insertOne(doc);
    return habit;
  }

  async findById(id: string): Promise<Habit | null> {
    const doc = await this.collection.findOne({ id });
    return doc ? Habit.fromObject(doc) : null;
  }

  async findByUserId(userId: string): Promise<Habit[]> {
    const docs = await this.collection.find({ userId }).toArray();
    return docs.map((doc: Document) => Habit.fromObject(doc));
  }

  async findActiveByUserId(userId: string): Promise<Habit[]> {
    const docs = await this.collection
      .find({ userId, isActive: true })
      .toArray();
    return docs.map((doc: Document) => Habit.fromObject(doc));
  }

  async findDueToday(userId: string): Promise<Habit[]> {
    const habits = await this.findActiveByUserId(userId);
    return habits.filter((h) => h.isDueToday());
  }

  async update(id: string, updates: Partial<Habit>): Promise<Habit> {
    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' },
    );

    if (!result || !result.value) {
      throw new Error(`Habit ${id} not found`);
    }

    return Habit.fromObject(result.value);
  }

  async delete(id: string): Promise<void> {
    await this.collection.deleteOne({ id });
  }
}
