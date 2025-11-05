/**
 * MongoDB Assistant Repository Adapter
 *
 * Infrastructure layer - MongoDB implementation of IAssistantRepository
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { IAssistantRepository } from '@application/ports/assistant.repository';
import { Assistant, AssistantStatus } from '@domain/entities/assistant.entity';
import { AssistantFiltersDto } from '@application/dto/assistant.dto';
import {
  AssistantDocument,
  AssistantSchema,
} from './assistant.schema';

@Injectable()
export class MongoDBAssistantRepository implements IAssistantRepository {
  constructor(
    @InjectModel(AssistantDocument.name)
    private assistantModel: Model<AssistantDocument>,
  ) {}

  /**
   * Convert MongoDB document to domain entity
   */
  private toDomain(doc: AssistantDocument): Assistant {
    return Assistant.create({
      id: doc._id.toString(),
      name: doc.name,
      description: doc.description,
      type: doc.type,
      primaryMode: doc.primaryMode,
      status: doc.status,
      agentType: doc.agentType,
      reactConfig: doc.reactConfig as any,
      graphConfig: doc.graphConfig as any,
      blocks: doc.blocks as any,
      customPrompts: doc.customPrompts as any,
      contextBlocks: doc.contextBlocks as any,
      tools: doc.tools as any,
      subjectExpertise: doc.subjectExpertise,
      isPublic: doc.isPublic,
      userId: doc.userId,
      metadata: doc.metadata,
      lastExecuted: doc.lastExecuted,
      executionCount: doc.executionCount,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  async create(assistantData: Partial<Assistant>): Promise<Assistant> {
    const doc = new this.assistantModel({
      name: assistantData.name,
      description: assistantData.description,
      type: assistantData.type || 'custom',
      primaryMode: assistantData.primaryMode || 'balanced',
      status: assistantData.status || 'active',
      agentType: assistantData.agentType || 'custom',
      reactConfig: assistantData.reactConfig,
      graphConfig: assistantData.graphConfig,
      blocks: assistantData.blocks || [],
      customPrompts: assistantData.customPrompts || [],
      contextBlocks: assistantData.contextBlocks || [],
      tools: assistantData.tools || [],
      subjectExpertise: assistantData.subjectExpertise || [],
      isPublic: assistantData.isPublic || false,
      userId: assistantData.userId,
      metadata: assistantData.metadata || {},
    });
    const saved = await doc.save();
    return this.toDomain(saved);
  }

  async findAll(filters: AssistantFiltersDto = {}): Promise<Assistant[]> {
    const query: FilterQuery<AssistantDocument> = {};

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.isPublic !== undefined) {
      query.isPublic = filters.isPublic;
    }

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.agentType) {
      query.agentType = filters.agentType;
    }

    if (filters.name) {
      query.name = { $regex: filters.name, $options: 'i' };
    }

    const docs = await this.assistantModel.find(query).exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findByName(name: string): Promise<Assistant | null> {
    const doc = await this.assistantModel.findOne({ name }).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async findById(id: string): Promise<Assistant | null> {
    const doc = await this.assistantModel.findById(id).exec();
    return doc ? this.toDomain(doc) : null;
  }

  async update(
    name: string,
    updateData: Partial<Assistant>,
  ): Promise<Assistant | null> {
    const doc = await this.assistantModel
      .findOneAndUpdate({ name }, updateData, { new: true })
      .exec();
    return doc ? this.toDomain(doc) : null;
  }

  async delete(name: string): Promise<boolean> {
    const result = await this.assistantModel.deleteOne({ name }).exec();
    return result.deletedCount > 0;
  }

  async exists(name: string): Promise<boolean> {
    const count = await this.assistantModel.countDocuments({ name }).exec();
    return count > 0;
  }

  async updateExecutionStats(name: string): Promise<void> {
    await this.assistantModel
      .updateOne(
        { name },
        {
          $set: { lastExecuted: new Date() },
          $inc: { executionCount: 1 },
        },
      )
      .exec();
  }

  async findPublicAssistants(): Promise<Assistant[]> {
    const docs = await this.assistantModel
      .find({ isPublic: true, status: AssistantStatus.ACTIVE })
      .exec();
    return docs.map((doc) => this.toDomain(doc));
  }

  async findUserAssistants(userId: string): Promise<Assistant[]> {
    const docs = await this.assistantModel
      .find({ userId, status: { $ne: AssistantStatus.DISABLED } })
      .exec();
    return docs.map((doc) => this.toDomain(doc));
  }
}
