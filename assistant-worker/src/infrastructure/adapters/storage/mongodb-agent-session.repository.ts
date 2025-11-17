/**
 * MongoDB Agent Session Repository
 *
 * Persists agent sessions to MongoDB for multi-instance deployment support.
 */

import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ILogger } from '@application/ports/logger.port';
import {
  AgentSession,
  AgentSessionDocument,
} from './agent-session.schema';

export interface IAgentSessionRepository {
  create(session: Omit<AgentSession, 'expiresAt'>): Promise<AgentSession>;
  findById(sessionId: string): Promise<AgentSession | null>;
  findByInstanceKey(instanceKey: string): Promise<AgentSession | null>;
  findByUserId(userId: string, status?: string): Promise<AgentSession[]>;
  findByAgentId(agentId: string, status?: string): Promise<AgentSession[]>;
  updateStatus(sessionId: string, status: string): Promise<boolean>;
  updateActivity(sessionId: string): Promise<boolean>;
  updateMetadata(sessionId: string, metadata: Record<string, unknown>): Promise<boolean>;
  delete(sessionId: string): Promise<boolean>;
  cleanupOldSessions(maxAgeHours?: number): Promise<number>;
}

@Injectable()
export class MongoDBAgentSessionRepository
  implements IAgentSessionRepository
{
  constructor(
    @InjectModel(AgentSession.name)
    private readonly sessionModel: Model<AgentSessionDocument>,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  async create(
    session: Omit<AgentSession, 'expiresAt'>,
  ): Promise<AgentSession> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const doc = new this.sessionModel({
      ...session,
      expiresAt,
    });
    const saved = await doc.save();
    return this.toSession(saved);
  }

  async findById(sessionId: string): Promise<AgentSession | null> {
    const doc = await this.sessionModel.findOne({ sessionId }).exec();
    return doc ? this.toSession(doc) : null;
  }

  async findByInstanceKey(
    instanceKey: string,
  ): Promise<AgentSession | null> {
    const doc = await this.sessionModel
      .findOne({ instanceKey, status: 'active' })
      .sort({ lastActivityAt: -1 })
      .exec();
    return doc ? this.toSession(doc) : null;
  }

  async findByUserId(
    userId: string,
    status?: string,
  ): Promise<AgentSession[]> {
    const query: any = { userId };
    if (status) {
      query.status = status;
    }
    const docs = await this.sessionModel.find(query).sort({ lastActivityAt: -1 }).exec();
    return docs.map((doc) => this.toSession(doc));
  }

  async findByAgentId(
    agentId: string,
    status?: string,
  ): Promise<AgentSession[]> {
    const query: any = { agentId };
    if (status) {
      query.status = status;
    }
    const docs = await this.sessionModel.find(query).sort({ lastActivityAt: -1 }).exec();
    return docs.map((doc) => this.toSession(doc));
  }

  async updateStatus(sessionId: string, status: string): Promise<boolean> {
    const result = await this.sessionModel
      .updateOne(
        { sessionId },
        {
          $set: {
            status,
            lastActivityAt: new Date(),
          },
        },
      )
      .exec();
    return result.modifiedCount > 0;
  }

  async updateActivity(sessionId: string): Promise<boolean> {
    const result = await this.sessionModel
      .updateOne(
        { sessionId },
        {
          $set: {
            lastActivityAt: new Date(),
          },
        },
      )
      .exec();
    return result.modifiedCount > 0;
  }

  async updateMetadata(
    sessionId: string,
    metadata: Record<string, unknown>,
  ): Promise<boolean> {
    const result = await this.sessionModel
      .updateOne(
        { sessionId },
        {
          $set: {
            metadata,
            lastActivityAt: new Date(),
          },
        },
      )
      .exec();
    return result.modifiedCount > 0;
  }

  async delete(sessionId: string): Promise<boolean> {
    const result = await this.sessionModel
      .deleteOne({ sessionId })
      .exec();
    return result.deletedCount > 0;
  }

  async cleanupOldSessions(maxAgeHours: number = 24): Promise<number> {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    const result = await this.sessionModel
      .deleteMany({
        lastActivityAt: { $lt: cutoffTime },
        status: { $in: ['completed', 'failed'] },
      })
      .exec();
    return result.deletedCount;
  }

  private toSession(doc: AgentSessionDocument): AgentSession {
    return {
      sessionId: doc.sessionId,
      agentId: doc.agentId,
      userId: doc.userId,
      instanceKey: doc.instanceKey,
      status: doc.status,
      createdAt: doc.createdAt,
      lastActivityAt: doc.lastActivityAt,
      metadata: doc.metadata || {},
      expiresAt: doc.expiresAt,
    };
  }
}
