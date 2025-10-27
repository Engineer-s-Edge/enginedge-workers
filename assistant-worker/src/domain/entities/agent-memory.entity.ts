import { Message } from '../value-objects/message.vo';

/**
 * Agent Memory Entity - Manages conversation history
 * 
 * Features:
 * - Immutable message history
 * - Automatic truncation at token limit
 * - Message ordering preservation
 */
export class AgentMemory {
  private constructor(
    private readonly messages: readonly Message[],
    private readonly maxMessages: number = 100,
  ) {}

  /**
   * Create empty memory
   */
  static empty(maxMessages: number = 100): AgentMemory {
    return new AgentMemory([], maxMessages);
  }

  /**
   * Create from existing messages
   */
  static fromMessages(messages: Message[], maxMessages: number = 100): AgentMemory {
    return new AgentMemory(messages, maxMessages);
  }

  /**
   * Add a message to memory (immutable)
   */
  addMessage(message: Message): AgentMemory {
    const newMessages = [...this.messages, message];
    
    // Truncate if exceeds max
    const truncated = newMessages.length > this.maxMessages
      ? newMessages.slice(-this.maxMessages)
      : newMessages;

    return new AgentMemory(truncated, this.maxMessages);
  }

  /**
   * Add multiple messages
   */
  addMessages(messages: Message[]): AgentMemory {
    let memory = this as AgentMemory;
    for (const message of messages) {
      memory = memory.addMessage(message);
    }
    return memory;
  }

  /**
   * Get all messages
   */
  getMessages(): readonly Message[] {
    return this.messages;
  }

  /**
   * Get recent messages
   */
  getRecentMessages(count: number): readonly Message[] {
    return this.messages.slice(-count);
  }

  /**
   * Get messages by role
   */
  getMessagesByRole(role: 'user' | 'assistant' | 'system'): readonly Message[] {
    return this.messages.filter(msg => msg.role === role);
  }

  /**
   * Count total messages
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Check if memory is empty
   */
  isEmpty(): boolean {
    return this.messages.length === 0;
  }

  /**
   * Clear all messages
   */
  clear(): AgentMemory {
    return AgentMemory.empty(this.maxMessages);
  }

  /**
   * Get last N messages as conversation context
   */
  getContext(messageCount: number = 10): readonly Message[] {
    return this.getRecentMessages(messageCount);
  }

  /**
   * Convert to plain object
   */
  toPlainObject(): Record<string, unknown> {
    return {
      messages: this.messages.map(msg => msg.toPlainObject()),
      maxMessages: this.maxMessages,
      messageCount: this.messages.length,
    };
  }
}
