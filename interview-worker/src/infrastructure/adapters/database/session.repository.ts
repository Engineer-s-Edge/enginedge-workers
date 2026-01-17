/**
 * InterviewSession Repository - MongoDB Implementation
 */

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, Collection } from 'mongodb';
import { InterviewSession } from '../../../domain/entities';
import { IInterviewSessionRepository } from '../../../application/ports/repositories.port';

@Injectable()
export class MongoInterviewSessionRepository
  implements IInterviewSessionRepository, OnModuleInit
{
  private readonly logger = new Logger(MongoInterviewSessionRepository.name);
  private collection!: Collection;

  constructor(
    @Inject('MONGODB_DB') private readonly db: Db,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.collection = this.db.collection('interview_sessions');

    // Create indexes
    await this.collection.createIndex({ sessionId: 1 }, { unique: true });
    await this.collection.createIndex({ interviewId: 1 });
    await this.collection.createIndex({ candidateId: 1 });
    await this.collection.createIndex({ status: 1 });
    await this.collection.createIndex({ startedAt: -1 });
    await this.collection.createIndex({ candidateId: 1, status: 1 });

    this.logger.log('MongoInterviewSessionRepository initialized');
  }

  async save(session: InterviewSession): Promise<InterviewSession> {
    try {
      const doc = session.toObject();
      await this.collection.updateOne(
        { sessionId: session.sessionId },
        { $set: doc },
        { upsert: true },
      );
      return session;
    } catch (error) {
      this.logger.error(
        `Failed to save session: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findById(sessionId: string): Promise<InterviewSession | null> {
    try {
      const doc = await this.collection.findOne({ sessionId });
      return doc ? InterviewSession.fromObject(doc) : null;
    } catch (error) {
      this.logger.error(
        `Failed to find session: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findByCandidateId(candidateId: string): Promise<InterviewSession[]> {
    try {
      const docs = await this.collection
        .find({ candidateId })
        .sort({ startedAt: -1 })
        .toArray();
      return docs.map((doc) => InterviewSession.fromObject(doc));
    } catch (error) {
      this.logger.error(
        `Failed to find sessions by candidate: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findByInterviewId(interviewId: string): Promise<InterviewSession[]> {
    try {
      const docs = await this.collection
        .find({ interviewId })
        .sort({ startedAt: -1 })
        .toArray();
      return docs.map((doc) => InterviewSession.fromObject(doc));
    } catch (error) {
      this.logger.error(
        `Failed to find sessions by interview: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async update(
    sessionId: string,
    session: Partial<InterviewSession>,
  ): Promise<InterviewSession | null> {
    try {
      const updateDoc = {
        ...Object.fromEntries(
          Object.entries(session).filter(([_, v]) => v !== undefined),
        ),
      };
      delete (updateDoc as any).sessionId; // Don't update sessionId

      const result = await this.collection.findOneAndUpdate(
        { sessionId },
        { $set: updateDoc },
        { returnDocument: 'after' },
      );

      return result ? InterviewSession.fromObject(result) : null;
    } catch (error) {
      this.logger.error(
        `Failed to update session: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async delete(sessionId: string): Promise<boolean> {
    try {
      const result = await this.collection.deleteOne({ sessionId });
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete session: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
