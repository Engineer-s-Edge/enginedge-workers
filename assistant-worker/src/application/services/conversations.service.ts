import { Injectable, Inject, Optional } from '@nestjs/common';
import {
  IConversationsRepository,
  CreateConversationInput,
  ConversationRecord,
  MessageAppend,
  ToolCallRecord,
} from '@application/ports/conversations.repository';
import { ILogger } from '@application/ports/logger.port';
import { MetricsAdapter } from '@infrastructure/adapters/monitoring/metrics.adapter';

@Injectable()
export class ConversationsService {
  constructor(
    @Inject('IConversationsRepository')
    private readonly repo: IConversationsRepository,
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly metrics?: MetricsAdapter,
  ) {}

  async createConversation(
    input: CreateConversationInput & { initialMessage?: MessageAppend },
  ): Promise<ConversationRecord> {
    const conv = await this.repo.create(input);
    this.logger.info('Conversation created', {
      conversationId: conv.id,
      userId: conv.userId,
      type: conv.type,
    });
    if (input.initialMessage) {
      await this.repo.appendMessage(conv.id, input.initialMessage);
      this.metrics?.recordConversationEvent('message');
    }
    return conv;
  }

  async getConversation(id: string): Promise<ConversationRecord | null> {
    return this.repo.findById(id);
  }

  async listConversations(
    userId: string,
    limit?: number,
  ): Promise<ConversationRecord[]> {
    return this.repo.listByUser(userId, limit);
  }

  async addMessage(
    conversationId: string,
    message: MessageAppend,
  ): Promise<{ version: number }> {
    const res = await this.repo.appendMessage(conversationId, message);
    this.metrics?.recordConversationEvent('message');
    return res;
  }

  async recordToolCall(
    conversationId: string,
    call: ToolCallRecord,
  ): Promise<void> {
    await this.repo.recordToolCall(conversationId, call);
    if (call.latencyMs !== undefined) {
      this.metrics?.observeToolCallDuration(
        call.name,
        call.status,
        call.latencyMs / 1000,
      );
    }
  }

  async editMessage(
    conversationId: string,
    edit: {
      messageId: string;
      version: number;
      role: 'user' | 'assistant' | 'system';
      content: string;
      editedBy?: string;
      diff?: string;
    },
  ): Promise<void> {
    await this.repo.editMessage(conversationId, edit as any);
    this.metrics?.recordMessageEdit(edit.role);
  }

  async createCheckpoint(
    conversationId: string,
    checkpoint: {
      checkpointId: string;
      name?: string;
      description?: string;
      snapshotRefId?: string;
    },
  ): Promise<void> {
    return this.repo.createCheckpoint(conversationId, checkpoint as any);
  }

  async updateSettings(
    conversationId: string,
    overrides: Record<string, unknown>,
  ): Promise<void> {
    return this.repo.updateSettings(conversationId, overrides as any);
  }

  async pause(conversationId: string): Promise<void> {
    await this.repo.updateStatus(conversationId, 'paused' as any);
  }

  async resume(conversationId: string): Promise<void> {
    await this.repo.updateStatus(conversationId, 'active' as any);
  }

  async getEvents(
    conversationId: string,
    since?: Date,
    limit?: number,
  ): Promise<any[]> {
    return this.repo.getEvents(conversationId, since, limit);
  }

  async addChildConversation(parentId: string, childId: string): Promise<void> {
    return this.repo.addChild(parentId, childId);
  }

  async updateAgentState(
    conversationId: string,
    state: Record<string, unknown>,
  ): Promise<void> {
    return this.repo.updateAgentState(conversationId, state);
  }

  /**
   * Search conversation messages using BM25 text search
   */
  async textSearchMessages(
    userId: string,
    query: string,
    topK: number = 10,
    conversationIds?: string[],
  ): Promise<
    Array<{
      id: string;
      conversationId: string;
      role: string;
      content: string;
      score: number;
      timestamp: Date;
    }>
  > {
    this.logger.info(
      `BM25 text search for messages, userId: ${userId}, query: "${query}", topK: ${topK}`,
    );

    // Get messages
    const messages = await this.repo.getMessagesByUser(userId, conversationIds);

    if (messages.length === 0) {
      return [];
    }

    // Use BM25 search
    const BM25 = require('wink-bm25-text-search');
    const nlpUtils = require('wink-nlp-utils');

    const engine = BM25();
    engine.defineConfig({ fldWeights: { text: 1 } });

    const tokenizeAndStem = (input: string): string[] => {
      const normalized = String(input)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/gi, ' ');
      const tokens = nlpUtils.string.tokenize0(normalized);
      return nlpUtils.tokens.stem(tokens);
    };

    engine.definePrepTasks([tokenizeAndStem]);

    // Index messages
    for (const msg of messages) {
      engine.addDoc({ text: msg.content }, msg.id);
    }

    const MIN_DOCS = 3;
    let hits: Array<{ id: string; value: number }> = [];

    if (messages.length >= MIN_DOCS) {
      engine.consolidate();
      hits = engine.search(query, topK);
    } else {
      // Fallback: overlap scoring
      const qTokens = tokenizeAndStem(query).filter(Boolean);
      if (qTokens.length === 0) {
        return [];
      }

      const overlapScore = (text: string): number => {
        const tks = new Set(tokenizeAndStem(text));
        let count = 0;
        for (const qt of qTokens) {
          if (tks.has(qt)) count++;
        }
        return count;
      };

      hits = messages
        .map((m) => ({ id: m.id, value: overlapScore(m.content) }))
        .filter((h) => h.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, topK);
    }

    // Map results back to messages
    const results = hits
      .map((h) => {
        const msg = messages.find((m) => m.id === h.id);
        if (!msg) return null;
        return {
          ...msg,
          score: h.value,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return results;
  }

  /**
   * Search conversation snippets using BM25 text search
   */
  async textSearchSnippets(
    userId: string,
    query: string,
    topK: number = 10,
    conversationIds?: string[],
  ): Promise<
    Array<{
      id: string;
      conversationId: string;
      content: string;
      score: number;
      timestamp: Date;
    }>
  > {
    // For now, snippets are not stored separately - return empty
    // In production, implement snippet storage and search
    return [];
  }
}
