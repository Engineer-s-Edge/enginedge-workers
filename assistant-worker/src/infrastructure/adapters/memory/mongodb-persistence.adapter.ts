/**
 * MongoDB Persistence Adapter
 *
 * Persists conversation memory to MongoDB for durability.
 * Supports all memory types with flexible schema.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Message } from '@domain/value-objects/message.vo';
import { Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';

// MongoDB document interface
interface ConversationDocument {
  conversationId: string;
  userId: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }>;
  summary?: string;
  entities?: Array<{
    name: string;
    type: string;
    attributes: Record<string, string>;
    mentions: number;
    lastMentioned: Date;
  }>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
  };
}

/**
 * MongoDB Persistence Adapter
 *
 * Production-ready MongoDB integration for conversation persistence.
 */
@Injectable()
export class MongoDBPersistenceAdapter {
  private readonly collection;

  constructor(@InjectConnection() private readonly connection: Connection) {
    this.collection = this.connection.db.collection<ConversationDocument>('conversations');

    // Create indexes for better query performance
    this.collection.createIndexes([
      { key: { conversationId: 1 }, unique: true },
      { key: { userId: 1 } },
      { key: { 'metadata.updatedAt': -1 } },
    ]).catch(() => {
      // Indexes may already exist, ignore errors
    });
  }

  /**
   * Save conversation to MongoDB
   */
  async saveConversation(
    conversationId: string,
    userId: string,
    messages: Message[],
    options?: {
      summary?: string;
      entities?: any[];
    },
  ): Promise<void> {
    const existing = await this.collection.findOne({ conversationId });

    const document: ConversationDocument = {
      conversationId,
      userId,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date(),
        metadata: msg.metadata,
      })),
      summary: options?.summary,
      entities: options?.entities,
      metadata: {
        createdAt: existing?.metadata?.createdAt || new Date(),
        updatedAt: new Date(),
        messageCount: messages.length,
      },
    };

    await this.collection.updateOne(
      { conversationId },
      { $set: document },
      { upsert: true },
    );
  }

  /**
   * Load conversation from MongoDB
   */
  async loadConversation(
    conversationId: string,
  ): Promise<ConversationDocument | null> {
    return await this.collection.findOne({ conversationId });
  }

  /**
   * Delete conversation from MongoDB
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.collection.deleteOne({ conversationId });
  }

  /**
   * List conversations for a user
   */
  async listConversations(
    userId: string,
    limit = 50,
  ): Promise<ConversationDocument[]> {
    return await this.collection
      .find({ userId })
      .sort({ 'metadata.updatedAt': -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Search conversations by content
   */
  async searchConversations(
    userId: string,
    query: string,
  ): Promise<ConversationDocument[]> {
    // Use regex for text search (for production, consider using MongoDB text indexes)
    return await this.collection
      .find({
        userId,
        $or: [
          { 'messages.content': { $regex: query, $options: 'i' } },
          { summary: { $regex: query, $options: 'i' } },
        ],
      })
      .toArray();
  }

  /**
   * Get conversation statistics
   */
  async getStats(userId: string): Promise<{
    totalConversations: number;
    totalMessages: number;
    avgMessagesPerConversation: number;
  }> {
    const conversations = await this.listConversations(userId, 1000);
    const totalMessages = conversations.reduce(
      (sum, conv) => sum + conv.metadata.messageCount,
      0,
    );

    return {
      totalConversations: conversations.length,
      totalMessages,
      avgMessagesPerConversation:
        conversations.length > 0 ? totalMessages / conversations.length : 0,
    };
  }
}
