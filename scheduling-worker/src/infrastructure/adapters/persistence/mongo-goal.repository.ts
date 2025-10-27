import { Injectable, Logger } from '@nestjs/common';
import { MongoClient, Db, Collection, Document } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { Goal } from '../../../domain/entities';
import { IGoalRepository } from '../../../application/ports/repositories.port';

/**
 * Goal Repository - MongoDB Implementation
 */
@Injectable()
export class MongoGoalRepository implements IGoalRepository {
  private readonly logger = new Logger(MongoGoalRepository.name);
  private client!: MongoClient;
  private db!: Db;
  private collection!: Collection;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const mongoUri = this.configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017';
    const dbName = this.configService.get<string>('MONGODB_DATABASE') || 'scheduling_worker';

    this.client = new MongoClient(mongoUri);
    await this.client.connect();
    this.db = this.client.db(dbName);
    this.collection = this.db.collection('goals');

    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ userId: 1 });
    await this.collection.createIndex({ userId: 1, status: 1 });
    await this.collection.createIndex({ targetDate: 1 });

    this.logger.log('MongoGoalRepository initialized');
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  async save(goal: Goal): Promise<Goal> {
    const doc = goal.toObject();
    await this.collection.insertOne(doc);
    return goal;
  }

  async findById(id: string): Promise<Goal | null> {
    const doc = await this.collection.findOne({ id });
    return doc ? Goal.fromObject(doc) : null;
  }

  async findByUserId(userId: string): Promise<Goal[]> {
    const docs = await this.collection.find({ userId }).toArray();
    return docs.map((doc: Document) => Goal.fromObject(doc));
  }

  async findActiveByUserId(userId: string): Promise<Goal[]> {
    const docs = await this.collection.find({ userId, isActive: true }).toArray();
    return docs.map((doc: Document) => Goal.fromObject(doc));
  }

  async findByStatus(userId: string, status: Goal['status']): Promise<Goal[]> {
    const docs = await this.collection.find({ userId, status }).toArray();
    return docs.map((doc: Document) => Goal.fromObject(doc));
  }

  async findOverdue(userId: string): Promise<Goal[]> {
    const now = new Date();
    const docs = await this.collection
      .find({
        userId,
        targetDate: { $lt: now },
        status: { $nin: ['completed', 'abandoned'] },
      })
      .toArray();
    return docs.map((doc: Document) => Goal.fromObject(doc));
  }

  async findDueSoon(userId: string, daysThreshold: number): Promise<Goal[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
    const docs = await this.collection
      .find({
        userId,
        targetDate: { $gte: now, $lte: futureDate },
        status: { $nin: ['completed', 'abandoned'] },
      })
      .toArray();
    return docs.map((doc: Document) => Goal.fromObject(doc));
  }

  async update(id: string, updates: Partial<Goal>): Promise<Goal> {
    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' },
    );

    if (!result || !result.value) {
      throw new Error(`Goal ${id} not found`);
    }

    return Goal.fromObject(result.value);
  }

  async delete(id: string): Promise<void> {
    await this.collection.deleteOne({ id });
  }
}
