/**
 * MongoDB Research Session Repository
 *
 * Implements IResearchSessionRepository using MongoDB.
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IResearchSessionRepository } from '@application/ports/research-session.repository.port';
import {
  ResearchSession,
  CreateResearchSessionInput,
  ResearchSessionStatus,
} from '../../../../domain/entities/research-session.entity';
import {
  ResearchSessionModel,
  ResearchSessionDocument,
} from './research-session.schema';

@Injectable()
export class MongoDBResearchSessionRepository
  implements IResearchSessionRepository
{
  constructor(
    @InjectModel(ResearchSessionModel.name)
    private readonly sessionModel: Model<ResearchSessionDocument>,
  ) {}

  private toEntity(doc: ResearchSessionDocument): ResearchSession {
    return {
      id: (doc._id as any).toString(),
      userId: doc.userId,
      agentId: doc.agentId,
      conversationId: doc.conversationId,
      query: doc.query,
      domain: doc.domain,
      status: doc.status,
      sources: doc.sources || [],
      sourceCount: doc.sourceCount || 0,
      evidenceCount: doc.evidenceCount || 0,
      averageConfidence: doc.averageConfidence || 0,
      overallConfidence: doc.overallConfidence || 0,
      phases: doc.phases || [],
      report: doc.report,
      startedAt: doc.startedAt,
      completedAt: doc.completedAt,
      executionTimeMs: doc.executionTimeMs,
      metadata: doc.metadata,
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date(),
    };
  }

  async create(input: CreateResearchSessionInput): Promise<ResearchSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const doc = new this.sessionModel({
      _id: sessionId,
      userId: input.userId,
      agentId: input.agentId,
      conversationId: input.conversationId,
      query: input.query,
      domain: input.domain,
      status: ResearchSessionStatus.PENDING,
      sources: [],
      sourceCount: 0,
      evidenceCount: 0,
      averageConfidence: 0,
      overallConfidence: 0,
      phases: [
        { phase: 'aim', status: 'pending' },
        { phase: 'shoot', status: 'pending' },
        { phase: 'skin', status: 'pending' },
      ],
      startedAt: new Date(),
      metadata: input.metadata,
    });

    const saved = await doc.save();
    return this.toEntity(saved);
  }

  async findById(id: string): Promise<ResearchSession | null> {
    const doc = await this.sessionModel.findById(id).exec();
    return doc ? this.toEntity(doc) : null;
  }

  async findByUserId(
    userId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<ResearchSession[]> {
    const docs = await this.sessionModel
      .find({ userId })
      .sort({ startedAt: -1 })
      .limit(limit)
      .skip(offset)
      .exec();
    return docs.map((doc) => this.toEntity(doc));
  }

  async findByAgentId(
    agentId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<ResearchSession[]> {
    const docs = await this.sessionModel
      .find({ agentId })
      .sort({ startedAt: -1 })
      .limit(limit)
      .skip(offset)
      .exec();
    return docs.map((doc) => this.toEntity(doc));
  }

  async findByConversationId(
    conversationId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<ResearchSession[]> {
    const docs = await this.sessionModel
      .find({ conversationId })
      .sort({ startedAt: -1 })
      .limit(limit)
      .skip(offset)
      .exec();
    return docs.map((doc) => this.toEntity(doc));
  }

  async update(
    id: string,
    updates: Partial<ResearchSession>,
  ): Promise<ResearchSession> {
    const doc = await this.sessionModel
      .findByIdAndUpdate(id, { $set: updates }, { new: true })
      .exec();
    if (!doc) {
      throw new Error(`Research session not found: ${id}`);
    }
    return this.toEntity(doc);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.sessionModel.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  async countByUserId(userId: string): Promise<number> {
    return this.sessionModel.countDocuments({ userId }).exec();
  }
}
