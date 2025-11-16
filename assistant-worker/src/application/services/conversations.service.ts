import { Injectable, Inject, Optional, forwardRef } from '@nestjs/common';
import {
  IConversationsRepository,
  CreateConversationInput,
  ConversationRecord,
  MessageAppend,
  ToolCallRecord,
} from '@application/ports/conversations.repository';
import {
  ConversationStatistics,
  ConversationType,
} from '@domain/conversations/conversation.types';
import { ILogger } from '@application/ports/logger.port';
import { MetricsAdapter } from '@infrastructure/adapters/monitoring/metrics.adapter';
import { AgentService } from './agent.service';
import { ModelValidationService } from './model-validation.service';

@Injectable()
export class ConversationsService {
  constructor(
    @Inject('IConversationsRepository')
    private readonly repo: IConversationsRepository,
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly metrics?: MetricsAdapter,
    @Inject(forwardRef(() => AgentService))
    private readonly agentService?: AgentService,
    private readonly modelValidation?: ModelValidationService,
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
    // Get current conversation state to store in checkpoint
    const conv = await this.repo.findById(conversationId);
    if (!conv) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Get all messages up to this point
    const events = await this.repo.getEvents(conversationId);
    const messages = events
      .filter((e) => e.type === 'message')
      .map((e) => {
        const payload = e.payload as any;
        if (payload.kind === 'message' && payload.data) {
          return {
            messageId: payload.data.messageId,
            role: payload.data.role,
            content: payload.data.content,
            metadata: payload.data.metadata,
            version: payload.data.version || 1,
          };
        }
        return null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    // Create checkpoint with full state snapshot
    const checkpointWithState = {
      ...checkpoint,
      conversationState: {
        messages,
        agentState: conv.agentState,
        settingsOverrides: conv.settingsOverrides,
      },
    };

    return this.repo.createCheckpoint(conversationId, checkpointWithState as any);
  }

  async updateSettings(
    conversationId: string,
    overrides: Record<string, unknown>,
  ): Promise<void> {
    // Validate model/provider if specified
    const settings = overrides as ConversationSettingsOverrides;
    if (settings.llm && this.modelValidation) {
      const llmConfig = settings.llm;
      if (llmConfig.provider && llmConfig.model) {
        const validation = await this.modelValidation.validateModel(
          llmConfig.provider,
          llmConfig.model,
        );
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        // Validate token limits if maxTokens is specified
        if (llmConfig.maxTokens) {
          const tokenValidation = await this.modelValidation.validateTokenLimits(
            llmConfig.provider,
            llmConfig.model,
            llmConfig.maxTokens,
          );
          if (!tokenValidation.valid) {
            throw new Error(tokenValidation.error);
          }
        }
      }
    }

    return this.repo.updateSettings(conversationId, overrides as any);
  }

  /**
   * Get all active memory types for a conversation
   */
  async getMemories(conversationId: string): Promise<any[]> {
    const conv = await this.repo.findById(conversationId);
    if (!conv) {
      throw new Error(`Conversation ${conversationId} not found`);
    }
    return conv.settingsOverrides?.memories || [];
  }

  /**
   * Add a memory type to conversation
   */
  async addMemory(
    conversationId: string,
    memoryConfig: any,
  ): Promise<{ id: string }> {
    const conv = await this.repo.findById(conversationId);
    if (!conv) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const memories = conv.settingsOverrides?.memories || [];
    const memoryId = memoryConfig.id || `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newMemory = {
      ...memoryConfig,
      id: memoryId,
    };

    const updatedOverrides = {
      ...conv.settingsOverrides,
      memories: [...memories, newMemory],
    };

    await this.repo.updateSettings(conversationId, updatedOverrides as any);
    return { id: memoryId };
  }

  /**
   * Update a memory type configuration
   */
  async updateMemory(
    conversationId: string,
    memoryId: string,
    updates: Partial<any>,
  ): Promise<void> {
    const conv = await this.repo.findById(conversationId);
    if (!conv) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const memories = conv.settingsOverrides?.memories || [];
    const memoryIndex = memories.findIndex((m: any) => m.id === memoryId);

    if (memoryIndex === -1) {
      throw new Error(`Memory ${memoryId} not found in conversation ${conversationId}`);
    }

    const updatedMemories = [...memories];
    updatedMemories[memoryIndex] = {
      ...updatedMemories[memoryIndex],
      ...updates,
      id: memoryId, // Ensure ID doesn't change
    };

    const updatedOverrides = {
      ...conv.settingsOverrides,
      memories: updatedMemories,
    };

    await this.repo.updateSettings(conversationId, updatedOverrides as any);
  }

  /**
   * Remove a memory type from conversation
   */
  async removeMemory(conversationId: string, memoryId: string): Promise<void> {
    const conv = await this.repo.findById(conversationId);
    if (!conv) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const memories = conv.settingsOverrides?.memories || [];
    const filteredMemories = memories.filter((m: any) => m.id !== memoryId);

    if (filteredMemories.length === memories.length) {
      throw new Error(`Memory ${memoryId} not found in conversation ${conversationId}`);
    }

    const updatedOverrides = {
      ...conv.settingsOverrides,
      memories: filteredMemories,
    };

    await this.repo.updateSettings(conversationId, updatedOverrides as any);
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

  /**
   * Get all checkpoints for a conversation
   */
  async getCheckpoints(conversationId: string): Promise<any[]> {
    const checkpoints = await this.repo.getCheckpoints(conversationId);
    // Get timestamps from events
    const events = await this.repo.getEvents(conversationId);
    const checkpointEvents = events.filter((e) => e.type === 'checkpoint');

    return checkpoints.map((cp) => {
      const event = checkpointEvents.find((e) => {
        const payload = e.payload as any;
        return payload.kind === 'checkpoint' &&
               payload.data?.checkpointId === cp.checkpointId;
      });

      return {
        id: cp.checkpointId,
        name: cp.name,
        description: cp.description,
        timestamp: event?.ts,
        type: 'conversation', // Default type
      };
    });
  }

  /**
   * Restore conversation from checkpoint
   */
  async restoreCheckpoint(
    conversationId: string,
    checkpointId: string,
  ): Promise<void> {
    await this.repo.restoreCheckpoint(conversationId, checkpointId);
  }

  /**
   * Advanced search for conversations with filters
   */
  async searchConversations(
    userId: string,
    filters: {
      query?: string;
      agentType?: string;
      status?: string;
      folderId?: string;
      tags?: string[];
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    conversations: ConversationRecord[];
    total: number;
    limit: number;
    offset: number;
  }> {
    // Get all conversations for user
    let conversations = await this.repo.listByUser(userId, 10000); // Large limit to get all

    // Apply filters
    if (filters.agentType) {
      conversations = conversations.filter((c) => c.type === filters.agentType);
    }

    if (filters.status) {
      conversations = conversations.filter((c) => c.status === filters.status);
    }

    if (filters.folderId) {
      // TODO: Implement folderId filter once folder schema is added
      // For now, skip this filter
    }

    if (filters.tags && filters.tags.length > 0) {
      // TODO: Implement tags filter once tags schema is added
      // For now, skip this filter
    }

    if (filters.dateFrom) {
      conversations = conversations.filter(
        (c) => c.createdAt && c.createdAt >= filters.dateFrom!,
      );
    }

    if (filters.dateTo) {
      conversations = conversations.filter(
        (c) => c.createdAt && c.createdAt <= filters.dateTo!,
      );
    }

    // Text search if query provided
    if (filters.query) {
      const queryLower = filters.query.toLowerCase();
      conversations = conversations.filter((c) => {
        // Search in conversation metadata (would need to search messages for full-text)
        // For now, basic filtering - in production would use BM25 or semantic search
        return true; // Placeholder - would search message content
      });

      // Use BM25 search on messages if query provided
      const searchResults = await this.textSearchMessages(
        userId,
        filters.query,
        100,
        conversations.map((c) => c.id),
      );

      // Get unique conversation IDs from search results
      const matchingConvIds = new Set(
        searchResults.map((r) => r.conversationId),
      );

      // Filter to only conversations with matching messages
      conversations = conversations.filter((c) =>
        matchingConvIds.has(c.id),
      );
    }

    const total = conversations.length;
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    // Sort by updatedAt descending (most recent first)
    conversations.sort((a, b) => {
      const aTime = a.updatedAt?.getTime() || 0;
      const bTime = b.updatedAt?.getTime() || 0;
      return bTime - aTime;
    });

    // Paginate
    const paginated = conversations.slice(offset, offset + limit);

    return {
      conversations: paginated,
      total,
      limit,
      offset,
    };
  }

  /**
   * Search snippets with highlighted context
   */
  async searchSnippets(
    userId: string,
    query: string,
    options: {
      conversationIds?: string[];
      contextLines?: number;
      limit?: number;
    } = {},
  ): Promise<
    Array<{
      id: string;
      conversationId: string;
      content: string;
      score: number;
      timestamp: Date;
      contextBefore?: string;
      contextAfter?: string;
      highlightedContent?: string;
    }>
  > {
    const contextLines = options.contextLines || 2;
    const limit = options.limit || 10;

    // Get search results
    const results = await this.textSearchMessages(
      userId,
      query,
      limit * 2, // Get more to filter
      options.conversationIds,
    );

    // For each result, get context (before/after lines)
    // In production, this would extract context from message history
    // For now, return results with basic highlighting
    return results.slice(0, limit).map((r) => ({
      ...r,
      contextBefore: '', // Would extract from message history
      contextAfter: '', // Would extract from message history
      highlightedContent: r.content, // Would highlight query terms
    }));
  }

  /**
   * Bulk delete conversations
   */
  async bulkDelete(
    userId: string,
    conversationIds: string[],
  ): Promise<Array<{ id: string; success: boolean; error?: string }>> {
    const results = [];

    for (const id of conversationIds) {
      try {
        const conv = await this.repo.findById(id);
        if (!conv) {
          results.push({ id, success: false, error: 'Conversation not found' });
          continue;
        }

        if (conv.userId !== userId) {
          results.push({
            id,
            success: false,
            error: 'Unauthorized',
          });
          continue;
        }

        // Delete conversation
        await this.repo.delete(id);
        results.push({ id, success: true });
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Bulk archive conversations
   */
  async bulkArchive(
    userId: string,
    conversationIds: string[],
  ): Promise<Array<{ id: string; success: boolean; error?: string }>> {
    const results = [];

    for (const id of conversationIds) {
      try {
        const conv = await this.repo.findById(id);
        if (!conv) {
          results.push({ id, success: false, error: 'Conversation not found' });
          continue;
        }

        if (conv.userId !== userId) {
          results.push({
            id,
            success: false,
            error: 'Unauthorized',
          });
          continue;
        }

        await this.repo.updateStatus(id, 'archived' as any);
        results.push({ id, success: true });
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get conversation statistics
   */
  async getStatistics(conversationId: string): Promise<ConversationStatistics> {
    const conv = await this.repo.findById(conversationId);
    if (!conv) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Get all events for this conversation
    const events = await this.repo.getEvents(conversationId);

    // Calculate tokens and costs from tool call events
    let inputTokens = 0;
    let outputTokens = 0;
    let totalCost = 0;
    let messageCount = 0;
    let firstMessageTime: Date | null = null;
    let lastMessageTime: Date | null = null;

    for (const event of events) {
      if (event.type === 'tool_call') {
        const payload = event.payload as any;
        if (payload.kind === 'tool_call' && payload.data) {
          inputTokens += payload.data.tokensIn || 0;
          outputTokens += payload.data.tokensOut || 0;
          totalCost += payload.data.cost || 0;
        }
      } else if (event.type === 'message') {
        messageCount++;
        if (!firstMessageTime) {
          firstMessageTime = event.ts;
        }
        lastMessageTime = event.ts;
      }
    }

    // Also check summaries for token counts
    if (conv.summaries?.tokens) {
      inputTokens += conv.summaries.tokens.input || 0;
      outputTokens += conv.summaries.tokens.output || 0;
    }

    const durationSeconds =
      firstMessageTime && lastMessageTime
        ? Math.floor(
            (lastMessageTime.getTime() - firstMessageTime.getTime()) / 1000,
          )
        : null;

    return {
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      cost: totalCost,
      messageCount: messageCount || conv.summaries?.messageCount || 0,
      duration: {
        start: firstMessageTime,
        end: lastMessageTime,
        seconds: durationSeconds,
      },
      agentType: conv.type,
    };
  }

  /**
   * Get aggregate statistics for filtered conversations
   */
  async getAggregateStatistics(
    userId: string,
    filters: {
      agentType?: string;
      status?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {},
  ): Promise<{
    totalConversations: number;
    totalTokens: { input: number; output: number; total: number };
    totalCost: number;
    averageTokensPerConversation: number;
    averageCostPerConversation: number;
    groupedByAgentType?: Record<string, number>;
  }> {
    // Get conversations matching filters
    const searchResult = await this.searchConversations(userId, {
      ...filters,
      limit: 10000, // Get all for aggregation
    });

    const conversations = searchResult.conversations;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    const groupedByAgentType: Record<string, number> = {};

    // Calculate statistics for each conversation
    for (const conv of conversations) {
      const stats = await this.getStatistics(conv.id);
      totalInputTokens += stats.tokens.input;
      totalOutputTokens += stats.tokens.output;
      totalCost += stats.cost;

      // Group by agent type
      const type = stats.agentType;
      groupedByAgentType[type] = (groupedByAgentType[type] || 0) + 1;
    }

    const totalConversations = conversations.length;
    const averageTokensPerConversation =
      totalConversations > 0
        ? (totalInputTokens + totalOutputTokens) / totalConversations
        : 0;
    const averageCostPerConversation =
      totalConversations > 0 ? totalCost / totalConversations : 0;

    return {
      totalConversations,
      totalTokens: {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalInputTokens + totalOutputTokens,
      },
      totalCost,
      averageTokensPerConversation,
      averageCostPerConversation,
      groupedByAgentType,
    };
  }

  /**
   * Pin/unpin conversation
   */
  async pinConversation(conversationId: string): Promise<void> {
    await this.repo.updatePinned(conversationId, true);
  }

  async unpinConversation(conversationId: string): Promise<void> {
    await this.repo.updatePinned(conversationId, false);
  }

  /**
   * Duplicate conversation
   */
  async duplicateConversation(
    conversationId: string,
    newUserId?: string,
  ): Promise<ConversationRecord> {
    const original = await this.repo.findById(conversationId);
    if (!original) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Get all messages from events
    const events = await this.repo.getEvents(conversationId);
    const messages = events
      .filter((e) => e.type === 'message')
      .map((e) => {
        const payload = e.payload as any;
        if (payload.kind === 'message' && payload.data) {
          return {
            messageId: payload.data.messageId,
            role: payload.data.role,
            content: payload.data.content,
            metadata: payload.data.metadata,
          };
        }
        return null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    // Create new conversation
    const newConv = await this.repo.create({
      userId: newUserId || original.userId,
      rootAgentId: original.rootAgentId,
      type: original.type,
      settingsOverrides: original.settingsOverrides,
    });

    // Add all messages to new conversation
    for (const msg of messages) {
      await this.repo.appendMessage(newConv.id, {
        messageId: msg.messageId,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        metadata: msg.metadata,
      });
    }

    return newConv;
  }

  /**
   * Export conversation
   */
  async exportConversation(
    conversationId: string,
    format: 'json' | 'markdown' | 'csv',
    options: {
      includeTranscripts?: boolean;
      includeMetadata?: boolean;
      includeToolCalls?: boolean;
    } = {},
  ): Promise<{ content: string; mimeType: string; filename: string }> {
    const conv = await this.repo.findById(conversationId);
    if (!conv) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const events = await this.repo.getEvents(conversationId);
    const messages = events
      .filter((e) => e.type === 'message')
      .map((e) => {
        const payload = e.payload as any;
        if (payload.kind === 'message' && payload.data) {
          return {
            role: payload.data.role,
            content: payload.data.content,
            timestamp: e.ts,
            metadata: options.includeMetadata ? payload.data.metadata : undefined,
          };
        }
        return null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    const toolCalls = options.includeToolCalls
      ? events
          .filter((e) => e.type === 'tool_call')
          .map((e) => {
            const payload = e.payload as any;
            if (payload.kind === 'tool_call' && payload.data) {
              return {
                name: payload.data.name,
                args: payload.data.args,
                result: payload.data.result,
                status: payload.data.status,
                timestamp: e.ts,
              };
            }
            return null;
          })
          .filter((tc): tc is NonNullable<typeof tc> => tc !== null)
      : [];

    let content: string;
    let mimeType: string;
    let filename: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(
          {
            conversation: {
              id: conv.id,
              userId: conv.userId,
              type: conv.type,
              status: conv.status,
              createdAt: conv.createdAt,
              updatedAt: conv.updatedAt,
              ...(options.includeMetadata && {
                settingsOverrides: conv.settingsOverrides,
                agentState: conv.agentState,
              }),
            },
            ...(options.includeTranscripts && { messages }),
            ...(toolCalls.length > 0 && { toolCalls }),
          },
          null,
          2,
        );
        mimeType = 'application/json';
        filename = `conversation-${conversationId}.json`;
        break;

      case 'markdown':
        content = `# Conversation ${conversationId}\n\n`;
        content += `**Type:** ${conv.type}\n`;
        content += `**Status:** ${conv.status}\n`;
        content += `**Created:** ${conv.createdAt}\n\n`;
        if (options.includeTranscripts) {
          content += `## Messages\n\n`;
          for (const msg of messages) {
            content += `### ${msg.role} (${msg.timestamp})\n\n`;
            content += `${msg.content}\n\n`;
          }
        }
        if (toolCalls.length > 0) {
          content += `## Tool Calls\n\n`;
          for (const tc of toolCalls) {
            content += `### ${tc.name} (${tc.timestamp})\n\n`;
            content += `**Status:** ${tc.status}\n\n`;
            content += `**Args:** \`\`\`json\n${JSON.stringify(tc.args, null, 2)}\n\`\`\`\n\n`;
          }
        }
        mimeType = 'text/markdown';
        filename = `conversation-${conversationId}.md`;
        break;

      case 'csv':
        const rows: string[] = [];
        rows.push('Role,Content,Timestamp');
        if (options.includeTranscripts) {
          for (const msg of messages) {
            const escapedContent = msg.content.replace(/"/g, '""');
            rows.push(`"${msg.role}","${escapedContent}","${msg.timestamp}"`);
          }
        }
        content = rows.join('\n');
        mimeType = 'text/csv';
        filename = `conversation-${conversationId}.csv`;
        break;
    }

    return { content, mimeType, filename };
  }

  /**
   * Bulk export conversations
   */
  async bulkExport(
    userId: string,
    conversationIds: string[],
    format: 'json' | 'markdown' | 'csv',
    options: {
      includeTranscripts?: boolean;
      includeMetadata?: boolean;
      includeToolCalls?: boolean;
    } = {},
  ): Promise<{ content: string; mimeType: string; filename: string }> {
    const exports = await Promise.all(
      conversationIds.map(async (id) => {
        try {
          const result = await this.exportConversation(id, format, options);
          return { conversationId: id, ...result };
        } catch (err: any) {
          return {
            conversationId: id,
            error: err.message,
            content: '',
            mimeType: '',
            filename: '',
          };
        }
      }),
    );

    if (format === 'json') {
      const conversations = exports.map((exp) => {
        if (exp.error) {
          return { conversationId: exp.conversationId, error: exp.error };
        }
        return JSON.parse(exp.content);
      });
      return {
        content: JSON.stringify({ conversations }, null, 2),
        mimeType: 'application/json',
        filename: `conversations-bulk-export-${Date.now()}.json`,
      };
    } else {
      // For markdown/csv, combine all exports
      const combined = exports
        .map((exp) => {
          if (exp.error) {
            return `# Error exporting conversation ${exp.conversationId}: ${exp.error}`;
          }
          return exp.content;
        })
        .join('\n\n---\n\n');
      return {
        content: combined,
        mimeType: format === 'markdown' ? 'text/markdown' : 'text/csv',
        filename: `conversations-bulk-export-${Date.now()}.${format === 'markdown' ? 'md' : 'csv'}`,
      };
    }
  }

  /**
   * Bulk tag/untag conversations
   */
  async bulkTag(
    userId: string,
    conversationIds: string[],
    tags: string[],
    operation: 'add' | 'remove' | 'replace',
  ): Promise<Array<{ id: string; success: boolean; error?: string }>> {
    const results = [];

    for (const id of conversationIds) {
      try {
        const conv = await this.repo.findById(id);
        if (!conv) {
          results.push({ id, success: false, error: 'Conversation not found' });
          continue;
        }

        if (conv.userId !== userId) {
          results.push({
            id,
            success: false,
            error: 'Unauthorized',
          });
          continue;
        }

        const currentTags = (conv as any).tags || [];
        let newTags: string[];

        switch (operation) {
          case 'add':
            newTags = [...new Set([...currentTags, ...tags])];
            break;
          case 'remove':
            newTags = currentTags.filter((t: string) => !tags.includes(t));
            break;
          case 'replace':
            newTags = tags;
            break;
          default:
            newTags = currentTags;
        }

        await this.repo.updateTags(id, newTags);
        results.push({ id, success: true });
      } catch (error: any) {
        results.push({
          id,
          success: false,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Merge multiple conversations into one
   */
  async mergeConversations(
    userId: string,
    conversationIds: string[],
    targetConversationId?: string,
  ): Promise<ConversationRecord> {
    if (conversationIds.length < 2) {
      throw new Error('At least 2 conversations required for merge');
    }

    // Get all conversations
    const conversations = await Promise.all(
      conversationIds.map((id) => this.repo.findById(id)),
    );

    // Verify all exist and belong to user
    for (const conv of conversations) {
      if (!conv) {
        throw new Error('One or more conversations not found');
      }
      if (conv.userId !== userId) {
        throw new Error('Unauthorized: conversation belongs to different user');
      }
    }

    // Use first conversation as target, or specified target
    const targetId = targetConversationId || conversationIds[0];
    const targetConv = conversations.find((c) => c!.id === targetId);
    if (!targetConv) {
      throw new Error('Target conversation not found');
    }

    // Collect all messages from all conversations with timestamps
    const allMessages: Array<{
      conversationId: string;
      messageId: string;
      role: string;
      content: string;
      metadata?: Record<string, unknown>;
      timestamp: Date;
    }> = [];

    for (const conv of conversations) {
      if (!conv) continue;
      const events = await this.repo.getEvents(conv.id);
      const messages = events
        .filter((e) => e.type === 'message')
        .map((e) => {
          const payload = e.payload as any;
          if (payload.kind === 'message' && payload.data) {
            return {
              conversationId: conv.id,
              messageId: payload.data.messageId,
              role: payload.data.role,
              content: payload.data.content,
              metadata: payload.data.metadata,
              timestamp: e.ts,
            };
          }
          return null;
        })
        .filter((m): m is NonNullable<typeof m> => m !== null);
      allMessages.push(...messages);
    }

    // Sort by timestamp
    allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Merge settings (target takes precedence, but merge custom fields)
    const mergedSettings = {
      ...targetConv.settingsOverrides,
      custom: {
        ...(targetConv.settingsOverrides?.custom || {}),
        mergedFrom: conversationIds.filter((id) => id !== targetId),
        mergedAt: new Date().toISOString(),
      },
    };

    // Update target conversation settings
    await this.repo.updateSettings(targetId, mergedSettings as any);

    // Add all messages from other conversations to target (skip duplicates by messageId)
    const existingMessageIds = new Set<string>();
    const targetEvents = await this.repo.getEvents(targetId);
    for (const event of targetEvents) {
      if (event.type === 'message') {
        const payload = event.payload as any;
        if (payload.kind === 'message' && payload.data?.messageId) {
          existingMessageIds.add(payload.data.messageId);
        }
      }
    }

    for (const msg of allMessages) {
      // Only add if not already in target and from a different conversation
      if (
        !existingMessageIds.has(msg.messageId) &&
        msg.conversationId !== targetId
      ) {
        await this.repo.appendMessage(targetId, {
          messageId: msg.messageId,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          metadata: msg.metadata,
        });
        existingMessageIds.add(msg.messageId);
      }
    }

    // Delete other conversations (or archive them)
    for (const id of conversationIds) {
      if (id !== targetId) {
        // Archive instead of delete to preserve history
        await this.repo.updateStatus(id, 'archived' as any);
      }
    }

    // Return updated target conversation
    const updated = await this.repo.findById(targetId);
    if (!updated) {
      throw new Error('Failed to retrieve merged conversation');
    }
    return updated;
  }

  /**
   * Execute a tool for a conversation (tool re-run)
   */
  async executeTool(
    conversationId: string,
    toolName: string,
    parameters: Record<string, unknown>,
  ): Promise<{ success: boolean; result: any; error?: string }> {
    const conv = await this.repo.findById(conversationId);
    if (!conv) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    if (!this.agentService) {
      throw new Error('AgentService not available');
    }

    try {
      // Get agent instance
      const agentInstance = await this.agentService.getAgentInstance(
        conv.rootAgentId,
        conv.userId,
      );

      // Execute tool - agents have executeTool method (may be private, so we'll use a workaround)
      // For ReAct agents and other agents that support tools, we can execute via the agent
      // Check if agent has a public method to execute tools
      if (typeof (agentInstance as any).executeTool === 'function') {
        const result = await (agentInstance as any).executeTool(
          toolName,
          parameters,
        );
        return { success: true, result };
      }

      // Alternative: Call agent-tool-worker service if available
      // For now, return error if tool execution not directly supported
      throw new Error(
        `Tool execution not directly supported for agent type. Tool '${toolName}' must be executed through agent execution.`,
      );
    } catch (error: any) {
      this.logger.error('Tool execution failed', {
        conversationId,
        toolName,
        error: error.message,
      });
      return {
        success: false,
        result: null,
        error: error.message || 'Unknown error',
      };
    }
  }
}
