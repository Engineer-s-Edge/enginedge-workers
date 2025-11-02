/**
 * InterviewResponse Repository - MongoDB Implementation
 */

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, Collection } from 'mongodb';
import { InterviewResponse } from '../../../domain/entities';
import { IInterviewResponseRepository } from '../../../application/ports/repositories.port';

@Injectable()
export class MongoInterviewResponseRepository
  implements IInterviewResponseRepository, OnModuleInit
{
  private readonly logger = new Logger(MongoInterviewResponseRepository.name);
  private collection!: Collection;

  constructor(
    @Inject('MONGODB_DB') private readonly db: Db,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.collection = this.db.collection('interview_responses');

    // Create indexes
    await this.collection.createIndex({ responseId: 1 }, { unique: true });
    await this.collection.createIndex({ sessionId: 1 });
    await this.collection.createIndex({ questionId: 1 });
    await this.collection.createIndex({ sessionId: 1, questionId: 1 });
    await this.collection.createIndex({ submittedAt: -1 });

    this.logger.log('MongoInterviewResponseRepository initialized');
  }

  async save(response: InterviewResponse): Promise<InterviewResponse> {
    try {
      const doc = response.toObject();
      await this.collection.updateOne(
        { responseId: response.responseId },
        { $set: doc },
        { upsert: true },
      );
      return response;
    } catch (error) {
      this.logger.error(`Failed to save response: ${error}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async findById(responseId: string): Promise<InterviewResponse | null> {
    try {
      const doc = await this.collection.findOne({ responseId });
      return doc ? InterviewResponse.fromObject(doc) : null;
    } catch (error) {
      this.logger.error(`Failed to find response: ${error}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async findBySessionId(sessionId: string): Promise<InterviewResponse[]> {
    try {
      const docs = await this.collection
        .find({ sessionId })
        .sort({ submittedAt: 1 })
        .toArray();
      return docs.map((doc) => InterviewResponse.fromObject(doc));
    } catch (error) {
      this.logger.error(`Failed to find responses by session: ${error}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async findByQuestionId(questionId: string): Promise<InterviewResponse[]> {
    try {
      const docs = await this.collection.find({ questionId }).toArray();
      return docs.map((doc) => InterviewResponse.fromObject(doc));
    } catch (error) {
      this.logger.error(`Failed to find responses by question: ${error}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async findBySessionAndQuestion(
    sessionId: string,
    questionId: string,
  ): Promise<InterviewResponse | null> {
    try {
      const doc = await this.collection.findOne({
        sessionId,
        questionId,
      });
      return doc ? InterviewResponse.fromObject(doc) : null;
    } catch (error) {
      this.logger.error(`Failed to find response by session and question: ${error}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async update(
    responseId: string,
    response: Partial<InterviewResponse>,
  ): Promise<InterviewResponse | null> {
    try {
      const updateDoc = Object.fromEntries(
        Object.entries(response).filter(([_, v]) => v !== undefined),
      );
      delete (updateDoc as any).responseId; // Don't update responseId

      const result = await this.collection.findOneAndUpdate(
        { responseId },
        { $set: updateDoc },
        { returnDocument: 'after' },
      );

      return result ? InterviewResponse.fromObject(result) : null;
    } catch (error) {
      this.logger.error(`Failed to update response: ${error}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }
}

