/**
 * Buffer Memory Adapter
 *
 * Simple short-term memory that stores all messages in a buffer.
 * No summarization or compression - just raw message history.
 */

import { Injectable } from '@nestjs/common';
import { Message } from '@domain/value-objects/message.vo';

export interface IMemoryAdapter {
  addMessage(conversationId: string, message: Message): Promise<void>;
  getMessages(conversationId: string, limit?: number): Promise<Message[]>;
  clear(conversationId: string): Promise<void>;
  getContext(conversationId: string): Promise<string>;
}

/**
 * Buffer Memory - stores all messages without compression
 */
@Injectable()
export class BufferMemoryAdapter implements IMemoryAdapter {
  private memory: Map<string, Message[]> = new Map();

  /**
   * Add a message to the conversation buffer
   */
  async addMessage(conversationId: string, message: Message): Promise<void> {
    if (!this.memory.has(conversationId)) {
      this.memory.set(conversationId, []);
    }

    const messages = this.memory.get(conversationId)!;
    messages.push(message);
  }

  /**
   * Get all messages (or last N messages)
   */
  async getMessages(
    conversationId: string,
    limit?: number,
  ): Promise<Message[]> {
    const messages = this.memory.get(conversationId) || [];

    if (limit && limit > 0) {
      return messages.slice(-limit);
    }

    return messages;
  }

  /**
   * Clear all messages for a conversation
   */
  async clear(conversationId: string): Promise<void> {
    this.memory.delete(conversationId);
  }

  /**
   * Get formatted context string
   */
  async getContext(conversationId: string): Promise<string> {
    const messages = await this.getMessages(conversationId);

    return messages.map((msg) => `${msg.role}: ${msg.content}`).join('\n');
  }

  /**
   * Get memory statistics
   */
  async getStats(conversationId: string): Promise<{
    messageCount: number;
    estimatedTokens: number;
  }> {
    const messages = await this.getMessages(conversationId);
    const estimatedTokens = messages.reduce((sum, msg) => {
      // Rough estimate: 1 token ≈ 4 characters
      return sum + Math.ceil(msg.content.length / 4);
    }, 0);

    return {
      messageCount: messages.length,
      estimatedTokens,
    };
  }
}
