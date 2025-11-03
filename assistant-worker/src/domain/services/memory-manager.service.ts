/**
 * Memory Manager Service
 *
 * Manages conversation history, context, and memory for agents.
 * Provides conversation tracking, context extraction, and memory operations.
 */

import { Injectable } from '@nestjs/common';
import { Message } from '../value-objects/message.vo';

export interface ConversationContext {
  conversationId: string;
  userId?: string;
  sessionId?: string;
  messages: Message[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemorySnapshot {
  conversationId: string;
  messageCount: number;
  totalTokens?: number;
  lastUpdated: Date;
  summary?: string;
}

/**
 * Service for managing agent memory and conversation context
 */
@Injectable()
export class MemoryManager {
  private conversations: Map<string, ConversationContext> = new Map();
  private snapshots: Map<string, MemorySnapshot> = new Map();

  /**
   * Create a new conversation context
   */
  createConversation(
    conversationId: string,
    userId?: string,
    sessionId?: string,
  ): ConversationContext {
    const context: ConversationContext = {
      conversationId,
      userId,
      sessionId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.conversations.set(conversationId, context);
    return context;
  }

  /**
   * Add a message to conversation
   */
  addMessage(
    conversationId: string,
    message: Message,
  ): ConversationContext | null {
    const context = this.conversations.get(conversationId);
    if (!context) {
      return null;
    }

    context.messages.push(message);
    context.updatedAt = new Date();

    return context;
  }

  /**
   * Get conversation context
   */
  getConversation(conversationId: string): ConversationContext | null {
    return this.conversations.get(conversationId) || null;
  }

  /**
   * Get conversation messages
   */
  getMessages(conversationId: string): Message[] {
    const context = this.conversations.get(conversationId);
    return context ? [...context.messages] : [];
  }

  /**
   * Get last N messages for context window
   */
  getRecentMessages(conversationId: string, count: number = 10): Message[] {
    const messages = this.getMessages(conversationId);
    return messages.slice(Math.max(0, messages.length - count));
  }

  /**
   * Clear conversation messages
   */
  clearConversation(conversationId: string): boolean {
    const context = this.conversations.get(conversationId);
    if (!context) {
      return false;
    }

    context.messages = [];
    context.updatedAt = new Date();
    return true;
  }

  /**
   * Delete conversation
   */
  deleteConversation(conversationId: string): boolean {
    return this.conversations.delete(conversationId);
  }

  /**
   * Create memory snapshot
   */
  createSnapshot(conversationId: string): MemorySnapshot {
    const context = this.conversations.get(conversationId);
    if (!context) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const snapshot: MemorySnapshot = {
      conversationId,
      messageCount: context.messages.length,
      lastUpdated: new Date(),
      summary: this.generateSummary(context),
    };

    this.snapshots.set(conversationId, snapshot);
    return snapshot;
  }

  /**
   * Get memory snapshot
   */
  getSnapshot(conversationId: string): MemorySnapshot | null {
    return this.snapshots.get(conversationId) || null;
  }

  /**
   * Generate summary of conversation
   */
  private generateSummary(context: ConversationContext): string {
    const messageCount = context.messages.length;
    const roles = context.messages.reduce(
      (acc, msg) => {
        acc[msg.role] = (acc[msg.role] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return `Conversation with ${messageCount} messages: ${JSON.stringify(roles)}`;
  }

  /**
   * Extract context keywords
   */
  extractContext(conversationId: string): Record<string, unknown> {
    const context = this.conversations.get(conversationId);
    if (!context) {
      return {};
    }

    return {
      messageCount: context.messages.length,
      userMessageCount: context.messages.filter((m) => m.role === 'user')
        .length,
      assistantMessageCount: context.messages.filter(
        (m) => m.role === 'assistant',
      ).length,
      lastMessage:
        context.messages[context.messages.length - 1]?.content || null,
      metadata: context.metadata,
    };
  }

  /**
   * Get all conversations for user
   */
  getUserConversations(userId: string): ConversationContext[] {
    return Array.from(this.conversations.values()).filter(
      (c) => c.userId === userId,
    );
  }

  /**
   * Get conversation statistics
   */
  getStatistics() {
    return {
      totalConversations: this.conversations.size,
      totalSnapshots: this.snapshots.size,
      averageMessageCount:
        Array.from(this.conversations.values()).reduce(
          (sum, c) => sum + c.messages.length,
          0,
        ) / (this.conversations.size || 1),
    };
  }
}
