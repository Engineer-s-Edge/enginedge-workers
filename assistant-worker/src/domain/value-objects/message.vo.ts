/**
 * Message Value Object - Represents a single message in conversation
 * 
 * Immutable by design
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export class Message {
  private constructor(
    public readonly id: string,
    public readonly role: MessageRole,
    public readonly content: string,
    public readonly timestamp: Date,
    public readonly metadata?: Record<string, unknown>,
  ) {}

  /**
   * Create a new message
   */
  static create(
    role: MessageRole,
    content: string,
    metadata?: Record<string, unknown>,
  ): Message {
    if (!content || content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }

    return new Message(
      crypto.randomUUID(),
      role,
      content.trim(),
      new Date(),
      metadata,
    );
  }

  /**
   * Create user message
   */
  static user(content: string, metadata?: Record<string, unknown>): Message {
    return Message.create('user', content, metadata);
  }

  /**
   * Create assistant message
   */
  static assistant(content: string, metadata?: Record<string, unknown>): Message {
    return Message.create('assistant', content, metadata);
  }

  /**
   * Create system message
   */
  static system(content: string, metadata?: Record<string, unknown>): Message {
    return Message.create('system', content, metadata);
  }

  /**
   * Restore from plain object
   */
  static restore(data: {
    id: string;
    role: MessageRole;
    content: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }): Message {
    return new Message(
      data.id,
      data.role,
      data.content,
      data.timestamp,
      data.metadata,
    );
  }

  /**
   * Check if message is from user
   */
  isUser(): boolean {
    return this.role === 'user';
  }

  /**
   * Check if message is from assistant
   */
  isAssistant(): boolean {
    return this.role === 'assistant';
  }

  /**
   * Check if message is system
   */
  isSystem(): boolean {
    return this.role === 'system';
  }

  /**
   * Get content length
   */
  getContentLength(): number {
    return this.content.length;
  }

  /**
   * Convert to plain object
   */
  toPlainObject(): Record<string, unknown> {
    return {
      id: this.id,
      role: this.role,
      content: this.content,
      timestamp: this.timestamp,
      metadata: this.metadata,
    };
  }

  /**
   * Format for LLM API
   */
  toLLMFormat(): { role: string; content: string } {
    return {
      role: this.role,
      content: this.content,
    };
  }
}
