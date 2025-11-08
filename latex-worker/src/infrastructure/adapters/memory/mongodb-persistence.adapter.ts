/**
 * MongoDB Persistence Adapter
 *
 * Production-ready MongoDB integration for LaTeX documents, projects, and templates.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Connection } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';

// MongoDB document interface for conversations (if needed)
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

@Injectable()
export class MongoDBPersistenceAdapter {
  private readonly collection;

  constructor(@InjectConnection() private readonly connection: Connection) {
    this.collection =
      this.connection.db.collection<ConversationDocument>('conversations');

    // Create indexes for better query performance
    this.collection
      .createIndexes([
        { key: { conversationId: 1 }, unique: true },
        { key: { userId: 1 } },
        { key: { 'metadata.updatedAt': -1 } },
      ])
      .catch(() => {
        // Indexes may already exist, ignore errors
      });
  }

  async saveDocument(documentId: string, data: any): Promise<void> {
    await this.connection.db
      .collection('documents')
      .updateOne(
        { documentId },
        { $set: { ...data, updatedAt: new Date() } },
        { upsert: true },
      );
  }

  async loadDocument(documentId: string): Promise<any> {
    return await this.connection.db
      .collection('documents')
      .findOne({ documentId });
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.connection.db.collection('documents').deleteOne({ documentId });
  }

  async listDocuments(userId?: string, limit = 50): Promise<any[]> {
    const query = userId ? { userId } : {};
    return await this.connection.db
      .collection('documents')
      .find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();
  }
}
