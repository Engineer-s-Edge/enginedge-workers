/**
 * Memory Service
 *
 * Orchestrates conversation memory operations across different memory types.
 * Provides a unified interface for memory management.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Message } from '@domain/value-objects/message.vo';
import { ILogger } from '@application/ports/logger.port';
import {
  IMemoryAdapter,
  BufferMemoryAdapter,
  WindowMemoryAdapter,
  SummaryMemoryAdapter,
  VectorMemoryAdapter,
  EntityMemoryAdapter,
  MongoDBPersistenceAdapter,
} from '@infrastructure/adapters/memory';

export type MemoryType = 'buffer' | 'window' | 'summary' | 'vector' | 'entity';

/**
 * Memory Service - manages conversation memory
 */
@Injectable()
export class MemoryService {
  private memoryAdapters: Map<string, IMemoryAdapter> = new Map();

  constructor(
    private readonly bufferMemory: BufferMemoryAdapter,
    private readonly windowMemory: WindowMemoryAdapter,
    private readonly summaryMemory: SummaryMemoryAdapter,
    private readonly vectorMemory: VectorMemoryAdapter,
    private readonly entityMemory: EntityMemoryAdapter,
    private readonly persistence: MongoDBPersistenceAdapter,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {
    // Register memory adapters
    this.memoryAdapters.set('buffer', bufferMemory);
    this.memoryAdapters.set('window', windowMemory);
    this.memoryAdapters.set('summary', summaryMemory);
    this.memoryAdapters.set('vector', vectorMemory);
    this.memoryAdapters.set('entity', entityMemory);
  }

  /**
   * Add a message to conversation memory
   */
  async addMessage(
    conversationId: string,
    message: Message,
    memoryType: MemoryType = 'buffer',
  ): Promise<void> {
    this.logger.debug(`Adding message to ${memoryType} memory`, {
      conversationId,
    });

    const adapter = this.getAdapter(memoryType);
    await adapter.addMessage(conversationId, message);

    // Optionally persist to MongoDB
    await this.persistIfNeeded(conversationId, memoryType);
  }

  /**
   * Get conversation messages
   */
  async getMessages(
    conversationId: string,
    memoryType: MemoryType = 'buffer',
    limit?: number,
  ): Promise<Message[]> {
    const adapter = this.getAdapter(memoryType);
    return await adapter.getMessages(conversationId, limit);
  }

  /**
   * Get formatted conversation context
   */
  async getContext(
    conversationId: string,
    memoryType: MemoryType = 'buffer',
    query?: string,
  ): Promise<string> {
    const adapter = this.getAdapter(memoryType);

    // Vector memory supports query-based context
    if (memoryType === 'vector' && query) {
      return await (adapter as VectorMemoryAdapter).getContext(
        conversationId,
        query,
      );
    }

    return await adapter.getContext(conversationId);
  }

  /**
   * Clear conversation memory
   */
  async clearMemory(
    conversationId: string,
    memoryType: MemoryType = 'buffer',
  ): Promise<void> {
    this.logger.info(`Clearing ${memoryType} memory`, { conversationId });

    const adapter = this.getAdapter(memoryType);
    await adapter.clear(conversationId);

    // Also clear from persistence
    await this.persistence.deleteConversation(conversationId);
  }

  /**
   * Get conversation summary (for summary memory)
   */
  async getSummary(conversationId: string): Promise<string> {
    return await this.summaryMemory.getSummary(conversationId);
  }

  /**
   * Search for similar messages (for vector memory)
   */
  async searchSimilar(
    conversationId: string,
    query: string,
    topK?: number,
  ): Promise<Message[]> {
    return await this.vectorMemory.searchSimilar(conversationId, query, topK);
  }

  /**
   * Get entities (for entity memory)
   */
  async getEntities(conversationId: string): Promise<any[]> {
    return this.entityMemory.getEntities(conversationId);
  }

  /**
   * Search entities (for entity memory)
   */
  async searchEntities(conversationId: string, query: string): Promise<any[]> {
    return this.entityMemory.searchEntities(conversationId, query);
  }

  /**
   * Load conversation from persistence
   */
  async loadConversation(conversationId: string): Promise<any> {
    return await this.persistence.loadConversation(conversationId);
  }

  /**
   * List conversations for a user
   */
  async listConversations(userId: string, limit?: number): Promise<any[]> {
    return await this.persistence.listConversations(userId, limit);
  }

  /**
   * Search conversations
   */
  async searchConversations(userId: string, query: string): Promise<any[]> {
    return await this.persistence.searchConversations(userId, query);
  }

  /**
   * Get memory statistics
   */
  async getStats(userId: string): Promise<any> {
    return await this.persistence.getStats(userId);
  }

  /**
   * Get memory adapter by type
   */
  private getAdapter(memoryType: MemoryType): IMemoryAdapter {
    const adapter = this.memoryAdapters.get(memoryType);

    if (!adapter) {
      throw new Error(`Unknown memory type: ${memoryType}`);
    }

    return adapter;
  }

  /**
   * Persist memory to MongoDB if needed
   */
  private async persistIfNeeded(
    conversationId: string,
    memoryType: MemoryType,
  ): Promise<void> {
    // Persist every 10 messages or on summary generation
    // This is a simplified version - in production, use more sophisticated logic
    try {
      const adapter = this.getAdapter(memoryType);
      const messages = await adapter.getMessages(conversationId);

      if (messages.length % 10 === 0) {
        // Extract additional data based on memory type
        const options: any = {};

        if (memoryType === 'summary') {
          options.summary = await this.summaryMemory.getSummary(conversationId);
        }

        if (memoryType === 'entity') {
          options.entities = this.entityMemory.getEntities(conversationId);
        }

        // Save to MongoDB (userId should be extracted from context)
        await this.persistence.saveConversation(
          conversationId,
          'user-id', // TODO: Get from context
          messages,
          options,
        );
      }
    } catch (error) {
      this.logger.error('Failed to persist memory', { error, conversationId });
    }
  }
}
