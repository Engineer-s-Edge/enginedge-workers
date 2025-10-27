/**
 * Window Memory Adapter
 * 
 * Sliding window memory that keeps only the last N messages.
 * Automatically discards older messages to maintain a fixed window size.
 */

import { Injectable, Optional } from '@nestjs/common';
import { Message } from '@domain/value-objects/message.vo';
import { IMemoryAdapter } from './buffer-memory.adapter';

/**
 * Window Memory - maintains a sliding window of recent messages
 */
@Injectable()
export class WindowMemoryAdapter implements IMemoryAdapter {
  private memory: Map<string, Message[]> = new Map();
  private readonly defaultWindowSize = 10; // Default: keep last 10 messages

  constructor(@Optional() private readonly windowSize: number = 10) {}

  /**
   * Add a message and maintain window size
   */
  async addMessage(conversationId: string, message: Message): Promise<void> {
    if (!this.memory.has(conversationId)) {
      this.memory.set(conversationId, []);
    }
    
    const messages = this.memory.get(conversationId)!;
    messages.push(message);

    // Maintain window size
    if (messages.length > this.windowSize) {
      messages.shift(); // Remove oldest message
    }
  }

  /**
   * Get messages in the current window
   */
  async getMessages(conversationId: string, limit?: number): Promise<Message[]> {
    const messages = this.memory.get(conversationId) || [];
    
    if (limit && limit > 0) {
      return messages.slice(-Math.min(limit, this.windowSize));
    }
    
    return messages;
  }

  /**
   * Clear the window
   */
  async clear(conversationId: string): Promise<void> {
    this.memory.delete(conversationId);
  }

  /**
   * Get formatted context string
   */
  async getContext(conversationId: string): Promise<string> {
    const messages = await this.getMessages(conversationId);
    
    return messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  /**
   * Get window configuration
   */
  getWindowSize(): number {
    return this.windowSize;
  }

  /**
   * Check if window is full
   */
  async isWindowFull(conversationId: string): Promise<boolean> {
    const messages = this.memory.get(conversationId) || [];
    return messages.length >= this.windowSize;
  }
}

