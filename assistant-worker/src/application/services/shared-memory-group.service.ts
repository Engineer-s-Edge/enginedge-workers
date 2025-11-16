/**
 * Shared Memory Group Service
 *
 * Routes memory requests to shared memory group instances.
 * Multiple nodes in a graph agent can share the same memory group,
 * allowing them to access the same vector store, knowledge graph, or RAG instance.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import { MemoryService } from './memory.service';
import { ConversationsService } from './conversations.service';
import { MemoryType } from './memory.service';

export interface SharedMemoryGroupConfig {
  id: string;
  name: string;
  memoryType?: MemoryType;
  vectorStore?: string;
  knowledgeGraphId?: string;
  ragPipelineId?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryGroupRequest {
  graphId: string;
  groupId: string;
  operation: 'getContext' | 'addMessage' | 'getMessages' | 'search';
  params?: {
    query?: string;
    message?: {
      role: string;
      content: string;
      metadata?: Record<string, unknown>;
    };
    limit?: number;
    memoryType?: MemoryType;
  };
}

@Injectable()
export class SharedMemoryGroupService {
  constructor(
    private readonly memoryService: MemoryService,
    private readonly conversationsService: ConversationsService,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * Get conversation ID for a memory group
   */
  private getConversationId(graphId: string, groupId: string): string {
    const normalizedGraph = graphId?.trim().length ? graphId : 'graph';
    return `graph:${normalizedGraph}:memory:${groupId}`;
  }

  /**
   * Ensure a memory group exists and is configured
   */
  async ensureGroup(
    graphId: string,
    config: SharedMemoryGroupConfig,
  ): Promise<void> {
    const conversationId = this.getConversationId(graphId, config.id);

    try {
      // Check if conversation exists
      const conversation = await this.conversationsService.getConversation(
        conversationId,
      );

      if (!conversation) {
        // Create conversation for the memory group
        await this.conversationsService.createConversation({
          id: conversationId,
          userId: `graph-${graphId}`,
          agentType: 'graph',
          title: `Memory Group: ${config.name}`,
          metadata: {
            graphId,
            memoryGroupId: config.id,
            memoryGroupName: config.name,
            memoryType: config.memoryType,
            vectorStore: config.vectorStore,
            knowledgeGraphId: config.knowledgeGraphId,
            ragPipelineId: config.ragPipelineId,
            provider: config.provider,
            ...config.metadata,
          },
        });

        // If memory type is specified, add it to the conversation
        if (config.memoryType) {
          await this.conversationsService.addMemory(conversationId, {
            type: config.memoryType,
            config: {
              vectorStore: config.vectorStore,
              knowledgeGraphId: config.knowledgeGraphId,
              ragPipelineId: config.ragPipelineId,
              provider: config.provider,
            },
            metadata: config.metadata,
          });
        }
      } else {
        // Update metadata if needed
        if (config.memoryType && conversation.settingsOverrides?.memories) {
          const existingMemory = conversation.settingsOverrides.memories.find(
            (m) => m.type === config.memoryType,
          );
          if (!existingMemory) {
            await this.conversationsService.addMemory(conversationId, {
              type: config.memoryType,
              config: {
                vectorStore: config.vectorStore,
                knowledgeGraphId: config.knowledgeGraphId,
                ragPipelineId: config.ragPipelineId,
                provider: config.provider,
              },
              metadata: config.metadata,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to ensure memory group', {
        graphId,
        groupId: config.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Route a memory request to the appropriate group instance
   */
  async routeRequest(
    request: MemoryGroupRequest,
  ): Promise<string | any[] | void> {
    const conversationId = this.getConversationId(
      request.graphId,
      request.groupId,
    );

    this.logger.debug('Routing memory request to group', {
      graphId: request.graphId,
      groupId: request.groupId,
      operation: request.operation,
      conversationId,
    });

    try {
      switch (request.operation) {
        case 'getContext': {
          const memoryType =
            request.params?.memoryType ||
            (await this.getDefaultMemoryType(conversationId));
          const query = request.params?.query;
          return await this.memoryService.getContext(
            conversationId,
            memoryType,
            query,
          );
        }

        case 'addMessage': {
          if (!request.params?.message) {
            throw new Error('Message is required for addMessage operation');
          }
          const memoryType =
            request.params?.memoryType ||
            (await this.getDefaultMemoryType(conversationId));
          await this.memoryService.addMessage(
            conversationId,
            {
              id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              role: request.params.message.role as any,
              content: request.params.message.content,
              timestamp: new Date(),
              metadata: request.params.message.metadata,
            },
            memoryType,
          );
          return;
        }

        case 'getMessages': {
          const memoryType =
            request.params?.memoryType ||
            (await this.getDefaultMemoryType(conversationId));
          const limit = request.params?.limit || 10;
          return await this.memoryService.getMessages(
            conversationId,
            memoryType,
            limit,
          );
        }

        case 'search': {
          if (!request.params?.query) {
            throw new Error('Query is required for search operation');
          }
          const memoryType =
            request.params?.memoryType ||
            (await this.getDefaultMemoryType(conversationId));
          if (memoryType !== 'vector') {
            throw new Error('Search operation requires vector memory type');
          }
          return await this.memoryService.getContext(
            conversationId,
            'vector',
            request.params.query,
          );
        }

        default:
          throw new Error(`Unknown operation: ${request.operation}`);
      }
    } catch (error) {
      this.logger.error('Failed to route memory request', {
        graphId: request.graphId,
        groupId: request.groupId,
        operation: request.operation,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get default memory type for a conversation
   */
  private async getDefaultMemoryType(
    conversationId: string,
  ): Promise<MemoryType> {
    try {
      const memories = await this.conversationsService.getMemories(
        conversationId,
      );
      if (memories.length > 0) {
        return memories[0].type as MemoryType;
      }
    } catch (error) {
      this.logger.warn('Failed to get default memory type', {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return 'buffer'; // Default fallback
  }

  /**
   * Get combined context from all active memory types in a group
   */
  async getCombinedContext(
    graphId: string,
    groupId: string,
    query?: string,
  ): Promise<string> {
    const conversationId = this.getConversationId(graphId, groupId);
    return await this.memoryService.getCombinedContext(conversationId, query);
  }

  /**
   * Add a message to a memory group
   */
  async addMessage(
    graphId: string,
    groupId: string,
    role: string,
    content: string,
    metadata?: Record<string, unknown>,
    memoryType?: MemoryType,
  ): Promise<void> {
    await this.routeRequest({
      graphId,
      groupId,
      operation: 'addMessage',
      params: {
        message: {
          role,
          content,
          metadata,
        },
        memoryType,
      },
    });
  }

  /**
   * Get context from a memory group
   */
  async getContext(
    graphId: string,
    groupId: string,
    query?: string,
    memoryType?: MemoryType,
  ): Promise<string> {
    return (await this.routeRequest({
      graphId,
      groupId,
      operation: 'getContext',
      params: {
        query,
        memoryType,
      },
    })) as string;
  }
}
