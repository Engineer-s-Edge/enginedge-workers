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
} from '@infrastructure/adapters/memory';
import { ConversationsService } from './conversations.service';

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
    private readonly conversationsService: ConversationsService,
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

    // Conversations persistence managed by conversations service/events
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
    return await this.conversationsService.getConversation(conversationId);
  }

  /**
   * List conversations for a user
   */
  async listConversations(userId: string, limit?: number): Promise<any[]> {
    return await this.conversationsService.listConversations(userId, limit);
  }

  /**
   * Search conversations
   */
  async searchConversations(userId: string, query: string): Promise<any[]> {
    const list = await this.conversationsService.listConversations(userId, 200);
    const q = query.toLowerCase();
    return list.filter(
      (c) =>
        (c.summaries?.latestSummary || '').toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }

  /**
   * Get memory statistics
   */
  async getStats(userId: string): Promise<any> {
    const list = await this.conversationsService.listConversations(
      userId,
      1000,
    );
    const totalMessages = list.reduce(
      (sum, c) => sum + (c.summaries?.messageCount || 0),
      0,
    );
    return {
      totalConversations: list.length,
      totalMessages,
      avgMessagesPerConversation:
        list.length > 0 ? totalMessages / list.length : 0,
    };
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
    // Persistence is handled by ConversationsService via controller mirroring.
    return;
  }
}
