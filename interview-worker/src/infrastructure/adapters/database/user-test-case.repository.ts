/**
 * User Test Case Repository
 *
 * MongoDB repository for user-created test cases during interview sessions.
 */

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { Db, Collection } from 'mongodb';
import { TestCase } from '../../../domain/entities';

export interface UserTestCase extends TestCase {
  sessionId: string;
  userId?: string; // Optional: track which user created it
}

@Injectable()
export class MongoUserTestCaseRepository implements OnModuleInit {
  private readonly logger = new Logger(MongoUserTestCaseRepository.name);
  private collection!: Collection;

  constructor(@Inject('MONGODB_DB') private readonly db: Db) {}

  async onModuleInit() {
    this.collection = this.db.collection('user_test_cases');
    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ sessionId: 1, questionId: 1 });
    await this.collection.createIndex({ sessionId: 1 });
    this.logger.log('MongoUserTestCaseRepository initialized');
  }

  async save(testCase: UserTestCase): Promise<UserTestCase> {
    try {
      const doc = {
        id: testCase.id,
        sessionId: testCase.sessionId,
        questionId: testCase.questionId,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        isHidden: false, // User test cases are always visible
        description: testCase.description,
        userId: testCase.userId,
        createdAt: new Date(),
      };

      await this.collection.insertOne(doc);
      return testCase;
    } catch (error) {
      this.logger.error(
        `Failed to save user test case: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findBySessionAndQuestion(
    sessionId: string,
    questionId: string,
  ): Promise<UserTestCase[]> {
    try {
      const docs = await this.collection
        .find({ sessionId, questionId })
        .toArray();
      return docs.map((doc) => this.toEntity(doc));
    } catch (error) {
      this.logger.error(
        `Failed to find user test cases: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findById(id: string): Promise<UserTestCase | null> {
    try {
      const doc = await this.collection.findOne({ id });
      return doc ? this.toEntity(doc) : null;
    } catch (error) {
      this.logger.error(
        `Failed to find user test case: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.collection.deleteOne({ id });
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete user test case: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async deleteBySession(sessionId: string): Promise<number> {
    try {
      const result = await this.collection.deleteMany({ sessionId });
      return result.deletedCount;
    } catch (error) {
      this.logger.error(
        `Failed to delete user test cases by session: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private toEntity(doc: any): UserTestCase {
    return {
      id: doc.id,
      sessionId: doc.sessionId,
      questionId: doc.questionId,
      input: doc.input,
      expectedOutput: doc.expectedOutput,
      isHidden: false,
      description: doc.description,
      userId: doc.userId,
    };
  }
}
