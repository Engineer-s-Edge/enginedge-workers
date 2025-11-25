/**
 * Whiteboard Repository
 *
 * MongoDB repository for whiteboard state.
 */

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { Db, Collection } from 'mongodb';
import { WhiteboardState } from '../../../domain/entities/whiteboard-state.entity';

@Injectable()
export class MongoWhiteboardRepository implements OnModuleInit {
  private readonly logger = new Logger(MongoWhiteboardRepository.name);
  private collection!: Collection;

  constructor(@Inject('MONGODB_DB') private readonly db: Db) {}

  async onModuleInit() {
    this.collection = this.db.collection('whiteboard_states');
    await this.collection.createIndex(
      { sessionId: 1, questionId: 1 },
      { unique: true },
    );
    await this.collection.createIndex({ sessionId: 1 });
    await this.collection.createIndex({ 'metadata.updatedAt': -1 });
    this.logger.log('MongoWhiteboardRepository initialized');
  }

  async save(state: WhiteboardState): Promise<WhiteboardState> {
    try {
      // Get existing state to increment version
      const existing = await this.collection.findOne({
        sessionId: state.sessionId,
        questionId: state.questionId,
      });

      const doc = {
        id: state.id,
        sessionId: state.sessionId,
        questionId: state.questionId,
        diagram: state.diagram,
        metadata: {
          createdAt: existing?.metadata?.createdAt || new Date(),
          updatedAt: new Date(),
          version: existing?.metadata?.version
            ? existing.metadata.version + 1
            : 1,
        },
      };

      await this.collection.updateOne(
        { sessionId: state.sessionId, questionId: state.questionId },
        { $set: doc },
        { upsert: true },
      );

      return state;
    } catch (error) {
      this.logger.error(
        `Failed to save whiteboard state: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findBySessionAndQuestion(
    sessionId: string,
    questionId: string,
  ): Promise<WhiteboardState | null> {
    try {
      const doc = await this.collection.findOne({ sessionId, questionId });
      if (!doc) {
        return null;
      }

      return {
        id: doc.id,
        sessionId: doc.sessionId,
        questionId: doc.questionId,
        diagram: doc.diagram,
        metadata: {
          createdAt: doc.metadata?.createdAt
            ? new Date(doc.metadata.createdAt)
            : new Date(),
          updatedAt: doc.metadata?.updatedAt
            ? new Date(doc.metadata.updatedAt)
            : new Date(),
          version: doc.metadata?.version || 1,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to find whiteboard state: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findBySession(sessionId: string): Promise<WhiteboardState[]> {
    try {
      const docs = await this.collection
        .find({ sessionId })
        .sort({ 'metadata.updatedAt': -1 })
        .toArray();

      return docs.map((doc) => ({
        id: doc.id,
        sessionId: doc.sessionId,
        questionId: doc.questionId,
        diagram: doc.diagram,
        metadata: {
          createdAt: doc.metadata?.createdAt
            ? new Date(doc.metadata.createdAt)
            : new Date(),
          updatedAt: doc.metadata?.updatedAt
            ? new Date(doc.metadata.updatedAt)
            : new Date(),
          version: doc.metadata?.version || 1,
        },
      }));
    } catch (error) {
      this.logger.error(
        `Failed to find whiteboard states by session: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getHistory(
    sessionId: string,
    questionId: string,
  ): Promise<WhiteboardState[]> {
    // For now, return current state. In future, can implement versioning
    const state = await this.findBySessionAndQuestion(sessionId, questionId);
    return state ? [state] : [];
  }
}
