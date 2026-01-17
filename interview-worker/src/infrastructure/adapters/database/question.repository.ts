/**
 * InterviewQuestion Repository - MongoDB Implementation
 */

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, Collection } from 'mongodb';
import { InterviewQuestion, QuestionCategory } from '../../../domain/entities';
import { IInterviewQuestionRepository } from '../../../application/ports/repositories.port';

@Injectable()
export class MongoInterviewQuestionRepository
  implements IInterviewQuestionRepository, OnModuleInit
{
  private readonly logger = new Logger(MongoInterviewQuestionRepository.name);
  private collection!: Collection;

  constructor(
    @Inject('MONGODB_DB') private readonly db: Db,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.collection = this.db.collection('questions');

    // Create indexes
    await this.collection.createIndex({ questionId: 1 }, { unique: true });
    await this.collection.createIndex({ category: 1, difficulty: 1 });
    await this.collection.createIndex({ subcategory: 1 });
    await this.collection.createIndex({ tags: 1 });
    await this.collection.createIndex({
      category: 1,
      subcategory: 1,
      difficulty: 1,
    });

    this.logger.log('MongoInterviewQuestionRepository initialized');
  }

  async save(question: InterviewQuestion): Promise<InterviewQuestion> {
    try {
      const doc = question.toObject();
      await this.collection.updateOne(
        { questionId: question.questionId },
        { $set: doc },
        { upsert: true },
      );
      return question;
    } catch (error) {
      this.logger.error(
        `Failed to save question: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findById(questionId: string): Promise<InterviewQuestion | null> {
    try {
      const doc = await this.collection.findOne({ questionId });
      return doc ? InterviewQuestion.fromObject(doc) : null;
    } catch (error) {
      this.logger.error(
        `Failed to find question: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findByCategory(
    category: QuestionCategory,
    difficulty?: 'easy' | 'medium' | 'hard',
    limit?: number,
  ): Promise<InterviewQuestion[]> {
    try {
      const query: Record<string, unknown> = { category };
      if (difficulty) {
        query.difficulty = difficulty;
      }

      let cursor = this.collection.find(query);
      if (limit) {
        cursor = cursor.limit(limit);
      }

      const docs = await cursor.toArray();
      return docs.map((doc) => InterviewQuestion.fromObject(doc));
    } catch (error) {
      this.logger.error(
        `Failed to find questions by category: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findByTags(tags: string[]): Promise<InterviewQuestion[]> {
    try {
      const docs = await this.collection
        .find({ tags: { $in: tags } })
        .toArray();
      return docs.map((doc) => InterviewQuestion.fromObject(doc));
    } catch (error) {
      this.logger.error(
        `Failed to find questions by tags: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findAll(): Promise<InterviewQuestion[]> {
    try {
      const docs = await this.collection.find({}).toArray();
      return docs.map((doc) => InterviewQuestion.fromObject(doc));
    } catch (error) {
      this.logger.error(
        `Failed to find all questions: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async update(
    questionId: string,
    question: Partial<InterviewQuestion>,
  ): Promise<InterviewQuestion | null> {
    try {
      const updateDoc = Object.fromEntries(
        Object.entries(question).filter(([_, v]) => v !== undefined),
      );
      delete (updateDoc as any).questionId; // Don't update questionId

      const result = await this.collection.findOneAndUpdate(
        { questionId },
        { $set: updateDoc },
        { returnDocument: 'after' },
      );

      return result ? InterviewQuestion.fromObject(result) : null;
    } catch (error) {
      this.logger.error(
        `Failed to update question: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async delete(questionId: string): Promise<boolean> {
    try {
      const result = await this.collection.deleteOne({ questionId });
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete question: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
