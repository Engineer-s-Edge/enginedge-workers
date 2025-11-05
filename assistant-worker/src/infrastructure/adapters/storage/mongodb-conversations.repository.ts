import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IConversationsRepository,
  CreateConversationInput,
  ConversationRecord,
  MessageAppend,
  MessageEdit,
  ToolCallRecord,
  CheckpointRecord,
} from '@application/ports/conversations.repository';
import { Conversation, ConversationDocument } from './conversations/conversation.schema';
import { ConversationEvent, ConversationEventDocument } from './conversations/conversation-event.schema';
import { MessageVersion, MessageVersionDocument } from './conversations/message-version.schema';

@Injectable()
export class MongoDBConversationsRepository implements IConversationsRepository {
  constructor(
    @InjectModel(Conversation.name) private readonly convModel: Model<ConversationDocument>,
    @InjectModel(ConversationEvent.name) private readonly eventModel: Model<ConversationEventDocument>,
    @InjectModel(MessageVersion.name) private readonly verModel: Model<MessageVersionDocument>,
  ) {}

  private toRecord(doc: ConversationDocument): ConversationRecord {
    return {
      id: doc._id?.toString() || (doc as any).id,
      userId: doc.userId,
      rootAgentId: doc.rootAgentId,
      type: doc.type as any,
      status: doc.status as any,
      settingsOverrides: doc.settingsOverrides as any,
      childConversationIds: doc.childConversationIds || [],
      parentConversationId: doc.parentConversationId,
      graphRefId: doc.graphRefId,
      collectiveRefId: doc.collectiveRefId,
      summaries: doc.summaries as any,
      agentState: doc.agentState as any,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async create(input: CreateConversationInput): Promise<ConversationRecord> {
    const created = await this.convModel.create({
      userId: input.userId,
      rootAgentId: input.rootAgentId,
      type: input.type,
      status: 'active',
      settingsOverrides: input.settingsOverrides,
      parentConversationId: input.parentConversationId,
      childConversationIds: [],
      summaries: { messageCount: 0 },
    } as any);
    return this.toRecord(created);
  }

  async findById(id: string): Promise<ConversationRecord | null> {
    const doc = await this.convModel.findById(id).exec();
    return doc ? this.toRecord(doc) : null;
  }

  async listByUser(userId: string, limit = 50): Promise<ConversationRecord[]> {
    const docs = await this.convModel
      .find({ userId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .exec();
    return docs.map((d) => this.toRecord(d));
  }

  async updateSettings(id: string, overrides: any): Promise<void> {
    await this.convModel.updateOne({ _id: id }, { $set: { settingsOverrides: overrides } }).exec();
  }

  async updateStatus(id: string, status: any): Promise<void> {
    await this.convModel.updateOne({ _id: id }, { $set: { status } }).exec();
  }

  async addChild(parentId: string, childId: string): Promise<void> {
    await this.convModel.updateOne({ _id: parentId }, { $addToSet: { childConversationIds: childId } }).exec();
  }

  async updateAgentState(id: string, state: Record<string, unknown>): Promise<void> {
    await this.convModel.updateOne({ _id: id }, { $set: { agentState: state } }).exec();
  }

  async appendMessage(conversationId: string, message: MessageAppend, ts?: Date): Promise<{ version: number }> {
    const now = ts || new Date();
    // message versions start at 1
    const version = 1;
    await this.verModel.create({
      conversationId,
      messageId: message.messageId,
      version,
      role: message.role,
      content: message.content,
      editedAt: now,
    } as any);
    await this.eventModel.create({
      conversationId,
      ts: now,
      type: 'message',
      payload: { kind: 'message', data: { messageId: message.messageId, role: message.role, content: message.content, metadata: message.metadata, version } },
    } as any);
    await this.convModel.updateOne(
      { _id: conversationId },
      { $set: { updatedAt: now }, $inc: { 'summaries.messageCount': 1 } },
    ).exec();
    return { version };
  }

  async editMessage(conversationId: string, edit: MessageEdit): Promise<void> {
    const now = new Date();
    await this.verModel.create({
      conversationId,
      messageId: edit.messageId,
      version: edit.version,
      role: edit.role,
      content: edit.content,
      editedBy: edit.editedBy,
      editedAt: now,
      diff: edit.diff,
      previousRefVersion: edit.version - 1,
    } as any);
    await this.eventModel.create({
      conversationId,
      ts: now,
      type: 'message',
      payload: { kind: 'message', data: { messageId: edit.messageId, role: edit.role, content: edit.content, version: edit.version } },
    } as any);
    await this.convModel.updateOne({ _id: conversationId }, { $set: { updatedAt: now } }).exec();
  }

  async recordToolCall(conversationId: string, call: ToolCallRecord, ts?: Date): Promise<void> {
    const now = ts || new Date();
    await this.eventModel.create({
      conversationId,
      ts: now,
      type: 'tool_call',
      payload: { kind: 'tool_call', data: call },
    } as any);
    await this.convModel.updateOne({ _id: conversationId }, { $set: { updatedAt: now } }).exec();
  }

  async createCheckpoint(conversationId: string, checkpoint: CheckpointRecord, ts?: Date): Promise<void> {
    const now = ts || new Date();
    await this.eventModel.create({
      conversationId,
      ts: now,
      type: 'checkpoint',
      payload: { kind: 'checkpoint', data: checkpoint },
    } as any);
    await this.convModel.updateOne({ _id: conversationId }, { $set: { updatedAt: now } }).exec();
  }

  async getEvents(conversationId: string, sinceTs?: Date, limit = 200): Promise<any[]> {
    const q: any = { conversationId };
    if (sinceTs) q.ts = { $gt: sinceTs };
    const docs = await this.eventModel.find(q).sort({ ts: 1 }).limit(limit).exec();
    return docs.map((d) => ({ id: d._id?.toString(), conversationId: d.conversationId, ts: d.ts, type: d.type, payload: d.payload }));
  }

  async getMessagesByUser(userId: string, conversationIds?: string[]): Promise<Array<{ id: string; conversationId: string; role: string; content: string; timestamp: Date }>> {
    // Get conversations for user
    const convQuery: any = { userId };
    if (conversationIds && conversationIds.length > 0) {
      convQuery._id = { $in: conversationIds };
    }
    const conversations = await this.convModel.find(convQuery).select('_id').exec();
    const convIds = conversations.map((c) => c._id.toString());

    // Get message events
    const messageEvents = await this.eventModel.find({
      conversationId: { $in: convIds },
      type: 'message',
    }).sort({ ts: 1 }).exec();

    // Extract messages from events
    const messages: Array<{ id: string; conversationId: string; role: string; content: string; timestamp: Date }> = [];
    for (const event of messageEvents) {
      const payload = event.payload as any;
      if (payload.kind === 'message' && payload.data) {
        messages.push({
          id: payload.data.messageId || event._id.toString(),
          conversationId: event.conversationId,
          role: payload.data.role || 'user',
          content: payload.data.content || '',
          timestamp: event.ts,
        });
      }
    }

    return messages;
  }

  async getSnippetsByUser(userId: string, conversationIds?: string[]): Promise<Array<{ id: string; conversationId: string; content: string; timestamp: Date }>> {
    // For now, snippets are not stored separately - they would need to be extracted from messages
    // This is a placeholder - in production, you might want to store snippets separately
    // For now, return empty array or derive from messages
    return [];
  }
}
