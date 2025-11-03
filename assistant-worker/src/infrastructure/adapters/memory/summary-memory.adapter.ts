/**
 * Summary Memory Adapter
 *
 * Intelligent memory that summarizes old messages to save context space.
 * Keeps recent messages verbatim and older messages as summaries.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Message } from '@domain/value-objects/message.vo';
import { IMemoryAdapter } from './buffer-memory.adapter';
import { ILLMProvider } from '@application/ports/llm-provider.port';

/**
 * Summary Memory - condenses old messages into summaries
 */
@Injectable()
export class SummaryMemoryAdapter implements IMemoryAdapter {
  private memory: Map<
    string,
    {
      summary: string;
      recentMessages: Message[];
    }
  > = new Map();

  private readonly summaryThreshold = 10; // Summarize after 10 messages
  private readonly keepRecentCount = 5; // Keep last 5 messages verbatim

  constructor(
    @Inject('ILLMProvider')
    private readonly llmProvider: ILLMProvider,
  ) {}

  /**
   * Add a message and trigger summarization if needed
   */
  async addMessage(conversationId: string, message: Message): Promise<void> {
    if (!this.memory.has(conversationId)) {
      this.memory.set(conversationId, {
        summary: '',
        recentMessages: [],
      });
    }

    const memoryData = this.memory.get(conversationId)!;
    memoryData.recentMessages.push(message);

    // Trigger summarization if threshold reached
    if (memoryData.recentMessages.length > this.summaryThreshold) {
      await this.summarize(conversationId);
    }
  }

  /**
   * Get all messages (summary + recent)
   */
  async getMessages(
    conversationId: string,
    limit?: number,
  ): Promise<Message[]> {
    const memoryData = this.memory.get(conversationId);

    if (!memoryData) {
      return [];
    }

    // Return recent messages (summary is accessed via getContext)
    if (limit && limit > 0) {
      return memoryData.recentMessages.slice(-limit);
    }

    return memoryData.recentMessages;
  }

  /**
   * Clear memory
   */
  async clear(conversationId: string): Promise<void> {
    this.memory.delete(conversationId);
  }

  /**
   * Get formatted context (summary + recent messages)
   */
  async getContext(conversationId: string): Promise<string> {
    const memoryData = this.memory.get(conversationId);

    if (!memoryData) {
      return '';
    }

    const parts: string[] = [];

    // Add summary if exists
    if (memoryData.summary) {
      parts.push(`Previous conversation summary:\n${memoryData.summary}\n`);
    }

    // Add recent messages
    if (memoryData.recentMessages.length > 0) {
      parts.push('Recent messages:');
      parts.push(
        memoryData.recentMessages
          .map((msg) => `${msg.role}: ${msg.content}`)
          .join('\n'),
      );
    }

    return parts.join('\n');
  }

  /**
   * Summarize old messages
   */
  private async summarize(conversationId: string): Promise<void> {
    const memoryData = this.memory.get(conversationId);

    if (!memoryData) {
      return;
    }

    // Take messages to summarize (all except the recent ones we want to keep)
    const messagesToSummarize = memoryData.recentMessages.slice(
      0,
      -this.keepRecentCount,
    );

    if (messagesToSummarize.length === 0) {
      return;
    }

    // Create summary prompt
    const conversationText = messagesToSummarize
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');

    const summaryPrompt = `Summarize the following conversation concisely, preserving key information:\n\n${conversationText}\n\nSummary:`;

    try {
      // Generate summary using LLM
      const summaryResponse = await this.llmProvider.complete({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that creates concise summaries.',
          },
          {
            role: 'user',
            content: summaryPrompt,
          },
        ],
        temperature: 0.3,
        maxTokens: 500,
      });

      // Append new summary to existing summary
      const newSummary = summaryResponse.content;
      memoryData.summary = memoryData.summary
        ? `${memoryData.summary}\n\n${newSummary}`
        : newSummary;

      // Keep only recent messages
      memoryData.recentMessages = memoryData.recentMessages.slice(
        -this.keepRecentCount,
      );
    } catch (error) {
      // If summarization fails, just keep all messages (fallback to buffer behavior)
      console.error('Failed to summarize conversation:', error);
    }
  }

  /**
   * Get current summary
   */
  async getSummary(conversationId: string): Promise<string> {
    const memoryData = this.memory.get(conversationId);
    return memoryData?.summary || '';
  }
}
