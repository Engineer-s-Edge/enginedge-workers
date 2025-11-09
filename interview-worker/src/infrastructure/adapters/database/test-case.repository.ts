/**
 * Test Case Repository
 *
 * MongoDB repository for TestCase entities.
 */

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { Db, Collection } from 'mongodb';
import { TestCase } from '../../../domain/entities';

export interface ITestCaseRepository {
  save(testCase: TestCase): Promise<TestCase>;
  saveMany(testCases: TestCase[]): Promise<TestCase[]>;
  findByQuestionId(questionId: string): Promise<TestCase[]>;
  findById(id: string): Promise<TestCase | null>;
}

@Injectable()
export class MongoTestCaseRepository
  implements ITestCaseRepository, OnModuleInit
{
  private readonly logger = new Logger(MongoTestCaseRepository.name);
  private collection!: Collection;

  constructor(@Inject('MONGODB_DB') private readonly db: Db) {}

  async onModuleInit() {
    this.collection = this.db.collection('test_cases');
    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ questionId: 1 });
    this.logger.log('MongoTestCaseRepository initialized');
  }

  async save(testCase: TestCase): Promise<TestCase> {
    const doc = this.toDocument(testCase);
    await this.collection.insertOne(doc);
    return this.toEntity(doc);
  }

  async saveMany(testCases: TestCase[]): Promise<TestCase[]> {
    const docs = testCases.map((tc) => this.toDocument(tc));
    await this.collection.insertMany(docs);
    return docs.map((doc) => this.toEntity(doc));
  }

  async findByQuestionId(questionId: string): Promise<TestCase[]> {
    const docs = await this.collection.find({ questionId }).toArray();
    return docs.map((doc) => this.toEntity(doc));
  }

  async findById(id: string): Promise<TestCase | null> {
    const doc = await this.collection.findOne({ id });
    return doc ? this.toEntity(doc) : null;
  }

  private toDocument(testCase: TestCase): any {
    return {
      ...testCase,
    };
  }

  private toEntity(doc: any): TestCase {
    return {
      id: doc.id,
      questionId: doc.questionId,
      input: doc.input,
      expectedOutput: doc.expectedOutput,
      isHidden: doc.isHidden,
      description: doc.description,
    };
  }
}
