/**
 * Graph Memory Router Service
 *
 * Provides shared memory conversations for Graph Agent memory groups by
 * leveraging the existing in-memory conversation manager. Each memory group
 * gets its own logical conversation so multiple nodes can read/write the same
 * context regardless of execution order.
 */

import { MemoryManager } from './memory-manager.service';
import { Message, MessageRole } from '../value-objects/message.vo';
import { GraphMemoryGroup } from '../agents/graph-agent/graph-agent.types';

export interface GraphMemoryRecord {
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
}

export class GraphMemoryRouter {
  constructor(private readonly memoryManager: MemoryManager) {}

  ensureGroup(graphId: string, group: GraphMemoryGroup | { id: string; name?: string; memoryType?: string; provider?: string; vectorStore?: string; ragPipelineId?: string; knowledgeGraphId?: string }): void {
    const conversationId = this.getConversationId(graphId, group.id);
    const existing = this.memoryManager.getConversation(conversationId);

    if (!existing) {
      const context = this.memoryManager.createConversation(
        conversationId,
        graphId,
        `graph-${graphId}`,
      );
      context.metadata = {};
    }

    const context = this.memoryManager.getConversation(conversationId);
    if (context) {
      context.metadata = {
        ...(context.metadata ?? {}),
        graphId,
        memoryGroupId: group.id,
        memoryGroupName: group.name ?? group.id,
        memoryType: group.memoryType ?? context.metadata?.memoryType,
        provider: group.provider ?? context.metadata?.provider,
        vectorStore: group.vectorStore ?? context.metadata?.vectorStore,
        ragPipelineId: group.ragPipelineId ?? context.metadata?.ragPipelineId,
        knowledgeGraphId:
          group.knowledgeGraphId ?? context.metadata?.knowledgeGraphId,
      };
    }
  }

  appendRecords(graphId: string, groupId: string, records: GraphMemoryRecord[]): void {
    if (!records.length) {
      return;
    }

    const conversationId = this.getConversationId(graphId, groupId);
    let context = this.memoryManager.getConversation(conversationId);
    if (!context) {
      context = this.memoryManager.createConversation(
        conversationId,
        graphId,
        `graph-${graphId}`,
      );
      context.metadata = {
        graphId,
        memoryGroupId: groupId,
      };
    }

    for (const record of records) {
      const message = this.createMessage(record);
      this.memoryManager.addMessage(conversationId, message);
    }
  }

  getRecentMessages(graphId: string, groupId: string, limit: number = 10): Message[] {
    const conversationId = this.getConversationId(graphId, groupId);
    return this.memoryManager.getRecentMessages(conversationId, limit);
  }

  getConversationId(graphId: string, groupId: string): string {
    const normalizedGraph = graphId?.trim().length ? graphId : 'graph';
    return `graph:${normalizedGraph}:memory:${groupId}`;
  }

  private createMessage(record: GraphMemoryRecord): Message {
    switch (record.role) {
      case 'system':
        return Message.system(record.content, record.metadata);
      case 'assistant':
        return Message.assistant(record.content, record.metadata);
      case 'user':
      default:
        return Message.user(record.content, record.metadata);
    }
  }
}
