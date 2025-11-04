/**
 * MongoDB Persistence Adapter
 *
 * Persists conversation memory to MongoDB for durability.
 * Supports all memory types with flexible schema.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Message } from '@domain/entities/command.entities';

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
 * Note: This is a mock implementation. In production, integrate with actual MongoDB client.
 */
@Injectable()
export class MongoDBPersistenceAdapter {
  // Mock in-memory storage (replace with actual MongoDB connection)
  private storage: Map<string, ConversationDocument> = new Map();

  constructor(
    // @Inject('MONGODB_CONNECTION') private readonly mongoClient: any,
  ) {
    // Initialize MongoDB connection here
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
    }
  ): Promise<void> {
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
        createdAt: this.storage.has(conversationId)
          ? this.storage.get(conversationId)!.metadata.createdAt
          : new Date(),
        updatedAt: new Date(),
        messageCount: messages.length,
      },
    };

    // Mock save (replace with actual MongoDB operation)
    this.storage.set(conversationId, document);

    // In production:
    // await this.mongoClient.db('enginedge').collection('conversations').updateOne(
    //   { conversationId },
    //   { $set: document },
    //   { upsert: true }
    // );
  }

  /**
   * Load conversation from MongoDB
   */
  async loadConversation(conversationId: string): Promise<ConversationDocument | null> {
    // Mock load (replace with actual MongoDB operation)
    return this.storage.get(conversationId) || null;

    // In production:
    // return await this.mongoClient.db('enginedge').collection('conversations').findOne({
    //   conversationId
    // });
  }

  /**
   * Delete conversation from MongoDB
   */
  async deleteConversation(conversationId: string): Promise<void> {
    // Mock delete (replace with actual MongoDB operation)
    this.storage.delete(conversationId);

    // In production:
    // await this.mongoClient.db('enginedge').collection('conversations').deleteOne({
    //   conversationId
    // });
  }

  /**
   * List conversations for a user
   */
  async listConversations(userId: string, limit = 50): Promise<ConversationDocument[]> {
    // Mock list (replace with actual MongoDB operation)
    const conversations = Array.from(this.storage.values())
      .filter((doc) => doc.userId === userId)
      .sort((a, b) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime())
      .slice(0, limit);

    return conversations;

    // In production:
    // return await this.mongoClient.db('enginedge').collection('conversations').find({
    //   userId
    // }).sort({ 'metadata.updatedAt': -1 }).limit(limit).toArray();
  }

  /**
   * Search conversations by content
   */
  async searchConversations(userId: string, query: string): Promise<ConversationDocument[]> {
    // Mock search (replace with actual MongoDB text search)
    const conversations = Array.from(this.storage.values())
      .filter((doc) => {
        if (doc.userId !== userId) return false;

        // Search in messages
        return doc.messages.some((msg) =>
          msg.content.toLowerCase().includes(query.toLowerCase())
        );
      });

    return conversations;

    // In production:
    // return await this.mongoClient.db('enginedge').collection('conversations').find({
    //   userId,
    //   $text: { $search: query }
    // }).toArray();
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
      0
    );

    return {
      totalConversations: conversations.length,
      totalMessages,
      avgMessagesPerConversation:
        conversations.length > 0 ? totalMessages / conversations.length : 0,
    };
  }
}
