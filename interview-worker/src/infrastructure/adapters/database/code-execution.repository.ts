/**
 * Code Execution Repository
 *
 * MongoDB repository for CodeExecution entities.
 */

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { Db, Collection } from 'mongodb';
import { CodeExecution } from '../../../domain/entities';

export interface ICodeExecutionRepository {
  save(execution: CodeExecution): Promise<CodeExecution>;
  findById(id: string): Promise<CodeExecution | null>;
  findByResponseId(responseId: string): Promise<CodeExecution[]>;
  findBySessionId(sessionId: string): Promise<CodeExecution[]>;
  update(
    id: string,
    execution: Partial<CodeExecution>,
  ): Promise<CodeExecution | null>;
}

@Injectable()
export class MongoCodeExecutionRepository
  implements ICodeExecutionRepository, OnModuleInit
{
  private readonly logger = new Logger(MongoCodeExecutionRepository.name);
  private collection!: Collection;

  constructor(@Inject('MONGODB_DB') private readonly db: Db) {}

  async onModuleInit() {
    this.collection = this.db.collection('code_executions');
    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ responseId: 1 });
    await this.collection.createIndex({ sessionId: 1 });
    this.logger.log('MongoCodeExecutionRepository initialized');
  }

  async save(execution: CodeExecution): Promise<CodeExecution> {
    const doc = this.toDocument(execution);
    // Use upsert to handle retries or updates
    await this.collection.updateOne(
      { id: execution.id },
      { $set: doc },
      { upsert: true },
    );
    return this.toEntity(doc);
  }

  async findById(id: string): Promise<CodeExecution | null> {
    const doc = await this.collection.findOne({ id });
    return doc ? this.toEntity(doc) : null;
  }

  async findByResponseId(responseId: string): Promise<CodeExecution[]> {
    const docs = await this.collection.find({ responseId }).toArray();
    return docs.map((doc) => this.toEntity(doc));
  }

  async findBySessionId(sessionId: string): Promise<CodeExecution[]> {
    const docs = await this.collection.find({ sessionId }).toArray();
    return docs.map((doc) => this.toEntity(doc));
  }

  async update(
    id: string,
    execution: Partial<CodeExecution>,
  ): Promise<CodeExecution | null> {
    const updateDoc: any = { ...execution };
    delete updateDoc.id;

    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: updateDoc },
      { returnDocument: 'after' },
    );

    return result ? this.toEntity(result) : null;
  }

  private toDocument(execution: CodeExecution): any {
    return {
      ...execution,
      createdAt: execution.createdAt,
      completedAt: execution.completedAt,
    };
  }

  private toEntity(doc: any): CodeExecution {
    return {
      id: doc.id,
      responseId: doc.responseId,
      sessionId: doc.sessionId,
      questionId: doc.questionId,
      code: doc.code,
      language: doc.language,
      status: doc.status,
      testResults: doc.testResults,
      output: doc.output,
      error: doc.error,
      executionTime: doc.executionTime,
      memoryUsage: doc.memoryUsage,
      passedTests: doc.passedTests,
      totalTests: doc.totalTests,
      createdAt: new Date(doc.createdAt),
      completedAt: doc.completedAt ? new Date(doc.completedAt) : undefined,
    };
  }
}
