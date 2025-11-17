import { Injectable, Logger } from '@nestjs/common';
import { MongoClient, Db, Collection } from 'mongodb';
import { ConfigService } from '@nestjs/config';
import { Task } from '../../../domain/entities';
import { ITaskRepository } from '../../../application/ports/repositories.port';

/**
 * Task Repository - MongoDB Implementation
 *
 * Persists tasks to MongoDB
 *
 * Infrastructure Adapter - Depends on MongoDB
 */
@Injectable()
export class MongoTaskRepository implements ITaskRepository {
  private readonly logger = new Logger(MongoTaskRepository.name);
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
    this.collection = this.db.collection('tasks');

    // Create indexes
    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ 'metadata.userId': 1 });
    await this.collection.createIndex({ startTime: 1, endTime: 1 });
    await this.collection.createIndex({ category: 1 });
    await this.collection.createIndex({ priority: 1 });
    await this.collection.createIndex({ completionStatus: 1 });
    await this.collection.createIndex({ isLocked: 1 });
    await this.collection.createIndex({ parentTaskId: 1 });
    await this.collection.createIndex({ splitFromTaskId: 1 });
    await this.collection.createIndex({ tags: 1 });

    this.logger.log('MongoDB connection established and indexes created');
  }

  async onModuleDestroy() {
    await this.client.close();
    this.logger.log('MongoDB connection closed');
  }

  async save(task: Task): Promise<Task> {
    try {
      const doc = task.toObject();
      await this.collection.insertOne(doc);
      this.logger.log(`Saved task: ${task.id}`);
      return task;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to save task: ${err.message}`, err.stack);
      throw error;
    }
  }

  async findById(id: string): Promise<Task | null> {
    try {
      const doc = await this.collection.findOne({ id });
      return doc ? Task.fromObject(doc) : null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find task by id: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findByDateRange(startDate: Date, endDate: Date, userId?: string): Promise<Task[]> {
    try {
      const query: any = {
        startTime: { $lt: endDate },
        endTime: { $gt: startDate },
      };
      if (userId) {
        query['metadata.userId'] = userId;
      }
      const docs = await this.collection.find(query).toArray();
      return docs.map((doc) => Task.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find tasks in date range: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findByCategory(category: string, startDate: Date, endDate: Date, userId?: string): Promise<Task[]> {
    try {
      const query: any = {
        category,
        startTime: { $lt: endDate },
        endTime: { $gt: startDate },
      };
      if (userId) {
        query['metadata.userId'] = userId;
      }
      const docs = await this.collection.find(query).toArray();
      return docs.map((doc) => Task.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find tasks by category: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findLockedTasks(startDate: Date, endDate: Date, userId?: string): Promise<Task[]> {
    try {
      const query: any = {
        isLocked: true,
        startTime: { $lt: endDate },
        endTime: { $gt: startDate },
      };
      if (userId) {
        query['metadata.userId'] = userId;
      }
      const docs = await this.collection.find(query).toArray();
      return docs.map((doc) => Task.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find locked tasks: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findUnlockedTasks(startDate: Date, endDate: Date, userId?: string): Promise<Task[]> {
    try {
      const query: any = {
        $or: [{ isLocked: false }, { isLocked: { $exists: false } }],
        startTime: { $lt: endDate },
        endTime: { $gt: startDate },
      };
      if (userId) {
        query['metadata.userId'] = userId;
      }
      const docs = await this.collection.find(query).toArray();
      return docs.map((doc) => Task.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find unlocked tasks: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findByStatus(status: Task['completionStatus'], startDate: Date, endDate: Date, userId?: string): Promise<Task[]> {
    try {
      const query: any = {
        completionStatus: status,
        startTime: { $lt: endDate },
        endTime: { $gt: startDate },
      };
      if (userId) {
        query['metadata.userId'] = userId;
      }
      const docs = await this.collection.find(query).toArray();
      return docs.map((doc) => Task.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find tasks by status: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findByPriority(priority: Task['priority'], startDate: Date, endDate: Date, userId?: string): Promise<Task[]> {
    try {
      const query: any = {
        priority,
        startTime: { $lt: endDate },
        endTime: { $gt: startDate },
      };
      if (userId) {
        query['metadata.userId'] = userId;
      }
      const docs = await this.collection.find(query).toArray();
      return docs.map((doc) => Task.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find tasks by priority: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findByUserId(userId: string, startDate?: Date, endDate?: Date): Promise<Task[]> {
    try {
      const query: any = {
        'metadata.userId': userId,
      };
      if (startDate && endDate) {
        query.startTime = { $lt: endDate };
        query.endTime = { $gt: startDate };
      }
      const docs = await this.collection.find(query).toArray();
      return docs.map((doc) => Task.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find tasks by user id: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findByParentTaskId(parentTaskId: string): Promise<Task[]> {
    try {
      const docs = await this.collection.find({ parentTaskId }).toArray();
      return docs.map((doc) => Task.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find tasks by parent task id: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async findBySplitFromTaskId(splitFromTaskId: string): Promise<Task[]> {
    try {
      const docs = await this.collection.find({ splitFromTaskId }).toArray();
      return docs.map((doc) => Task.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find tasks by split from task id: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async update(task: Task): Promise<Task> {
    try {
      const doc = task.toObject();
      const result = await this.collection.findOneAndUpdate(
        { id: task.id },
        { $set: doc },
        { returnDocument: 'after' },
      );

      if (!result || !result.value) {
        throw new Error(`Task ${task.id} not found`);
      }

      this.logger.log(`Updated task: ${task.id}`);
      return Task.fromObject(result.value);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to update task: ${err.message}`, err.stack);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.collection.deleteOne({ id });
      this.logger.log(`Deleted task: ${id}`);
      return result.deletedCount > 0;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to delete task: ${err.message}`, err.stack);
      throw error;
    }
  }

  async findWithFilters(filters: {
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    category?: string;
    priority?: Task['priority'];
    status?: Task['completionStatus'];
    isLocked?: boolean;
    tags?: string[];
  }): Promise<Task[]> {
    try {
      const query: any = {};

      if (filters.userId) {
        query['metadata.userId'] = filters.userId;
      }

      if (filters.startDate && filters.endDate) {
        query.startTime = { $lt: filters.endDate };
        query.endTime = { $gt: filters.startDate };
      }

      if (filters.category) {
        query.category = filters.category;
      }

      if (filters.priority) {
        query.priority = filters.priority;
      }

      if (filters.status) {
        query.completionStatus = filters.status;
      }

      if (filters.isLocked !== undefined) {
        query.isLocked = filters.isLocked;
      }

      if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
      }

      const docs = await this.collection.find(query).toArray();
      return docs.map((doc) => Task.fromObject(doc));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to find tasks with filters: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
