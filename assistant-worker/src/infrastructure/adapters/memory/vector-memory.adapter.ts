/**
 * Vector Memory Adapter
 *
 * Semantic memory that stores messages as embeddings for similarity search.
 * Retrieves relevant past messages based on semantic similarity to current context.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { Message } from '@domain/value-objects/message.vo';
import { IMemoryAdapter } from './buffer-memory.adapter';
import { ILLMProvider } from '@application/ports/llm-provider.port';

interface VectorMessage {
  message: Message;
  embedding: number[];
  timestamp: Date;
}

/**
 * Vector Memory - semantic search over conversation history
 */
@Injectable()
export class VectorMemoryAdapter implements IMemoryAdapter {
  private memory: Map<string, VectorMessage[]> = new Map();
  private readonly topK = 5; // Retrieve top 5 most relevant messages
  private readonly httpClient: AxiosInstance;
  private readonly embedderBaseUrl: string;

  constructor(
    @Inject('ILLMProvider')
    private readonly llmProvider: ILLMProvider,
    private readonly configService: ConfigService,
  ) {
    // Use data-processing-worker embedder service
    this.embedderBaseUrl =
      this.configService.get<string>('DATA_PROCESSING_WORKER_URL') ||
      'http://data-processing-worker:3003';

    this.httpClient = axios.create({
      baseURL: this.embedderBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Add a message and generate its embedding
   */
  async addMessage(conversationId: string, message: Message): Promise<void> {
    if (!this.memory.has(conversationId)) {
      this.memory.set(conversationId, []);
    }

    // Generate embedding for the message
    const embedding = await this.generateEmbedding(message.content);

    const vectorMessage: VectorMessage = {
      message,
      embedding,
      timestamp: new Date(),
    };

    this.memory.get(conversationId)!.push(vectorMessage);
  }

  /**
   * Get messages (returns all messages, use searchSimilar for semantic retrieval)
   */
  async getMessages(
    conversationId: string,
    limit?: number,
  ): Promise<Message[]> {
    const vectorMessages = this.memory.get(conversationId) || [];
    const messages = vectorMessages.map((vm) => vm.message);

    if (limit && limit > 0) {
      return messages.slice(-limit);
    }

    return messages;
  }

  /**
   * Search for semantically similar messages
   */
  async searchSimilar(
    conversationId: string,
    query: string,
    topK?: number,
  ): Promise<Message[]> {
    const vectorMessages = this.memory.get(conversationId);

    if (!vectorMessages || vectorMessages.length === 0) {
      return [];
    }

    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(query);

    // Calculate cosine similarity for all messages
    const similarities = vectorMessages.map((vm) => ({
      message: vm.message,
      similarity: this.cosineSimilarity(queryEmbedding, vm.embedding),
    }));

    // Sort by similarity (descending) and take top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    const k = topK || this.topK;

    return similarities.slice(0, k).map((s) => s.message);
  }

  /**
   * Clear memory
   */
  async clear(conversationId: string): Promise<void> {
    this.memory.delete(conversationId);
  }

  /**
   * Get context based on semantic relevance to a query
   */
  async getContext(conversationId: string, query?: string): Promise<string> {
    if (!query) {
      // If no query, return recent messages
      const messages = await this.getMessages(conversationId, 5);
      return messages.map((msg) => `${msg.role}: ${msg.content}`).join('\n');
    }

    // Search for relevant messages
    const relevantMessages = await this.searchSimilar(conversationId, query);

    return relevantMessages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  /**
   * Generate embedding for text
   * Uses data-processing-worker embedder service for real embeddings
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Call data-processing-worker embedder service
      const response = await this.httpClient.post<{
        embedding: number[];
        dimensions: number;
      }>('/embedders/embed', {
        text,
        provider: 'openai', // Default to OpenAI, can be configured
        model: 'text-embedding-ada-002', // Default embedding model
      });

      if (response.data && response.data.embedding) {
        return response.data.embedding;
      }

      // Fallback to mock if service unavailable
      return this.mockEmbedding(text);
    } catch (error) {
      // Log error but don't fail - fallback to mock embedding
      console.warn(
        'Failed to generate embedding from embedder service, using mock:',
        error instanceof Error ? error.message : String(error),
      );
      return this.mockEmbedding(text);
    }
  }

  /**
   * Mock embedding generation (for development)
   * In production, replace with actual embedding model (e.g., OpenAI embeddings)
   */
  private mockEmbedding(text: string): number[] {
    // Simple hash-based mock embedding (384 dimensions)
    const dimensions = 384;
    const embedding: number[] = [];

    for (let i = 0; i < dimensions; i++) {
      const hash = this.simpleHash(text + i.toString());
      embedding.push(Math.sin(hash) * 0.5 + 0.5); // Normalize to [0, 1]
    }

    return embedding;
  }

  /**
   * Simple hash function for mock embeddings
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}
