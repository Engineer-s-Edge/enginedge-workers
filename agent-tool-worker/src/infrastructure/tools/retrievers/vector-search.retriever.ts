import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { BaseRetriever } from '@domain/tools/base/base-retriever';
import { RetrieverConfig, ErrorEvent } from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, RAGConfig, RetrievalType } from '@domain/entities/tool.entities';

export interface VectorSearchArgs {
  query: string;
  userId: string;
  conversationId?: string;
  limit?: number;
  similarity?: 'cosine' | 'euclidean' | 'dotProduct';
  filters?: Record<string, unknown>;
  [key: string]: unknown; // Index signature for compatibility
}

export interface VectorSearchOutput extends ToolOutput {
  results: Array<{
    documentId: string;
    content: string;
    metadata: Record<string, unknown>;
    score: number;
  }>;
  count: number;
  processingTime: number;
}

/**
 * Vector Search Retriever
 * 
 * Performs semantic vector search using the Data Processing Worker.
 * Integrates with MongoDB vector store for similarity-based document retrieval.
 */
@Injectable()
export class VectorSearchRetriever extends BaseRetriever<VectorSearchArgs, VectorSearchOutput> {
  readonly name = 'vector-search-retriever';
  readonly description = 'Search documents using semantic vector similarity';

  readonly metadata: RetrieverConfig;
  readonly errorEvents: ErrorEvent[];

  private readonly logger = new Logger(VectorSearchRetriever.name);
  private readonly DATA_PROCESSING_URL: string;

  constructor() {
    const errorEvents = [
      new ErrorEvent('vector-search-failed', 'Failed to perform vector search', false),
      new ErrorEvent('embedding-generation-failed', 'Failed to generate query embedding', false),
      new ErrorEvent('data-processing-unavailable', 'Data Processing Worker is not available', false),
      new ErrorEvent('vector-search-timeout', 'Vector search request timed out', true),
    ];

    const metadata = new RetrieverConfig(
      'vector-search-retriever',
      'Search documents using semantic vector similarity',
      'Performs semantic search using vector embeddings via Data Processing Worker',
      {
        type: 'object',
        additionalProperties: false,
        required: ['query', 'userId'],
        properties: {
          query: {
            type: 'string',
            description: 'The search query text',
          },
          userId: {
            type: 'string',
            description: 'User ID for access control',
          },
          conversationId: {
            type: 'string',
            description: 'Optional conversation ID for scoped search',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            minimum: 1,
            maximum: 100,
            default: 5,
          },
          similarity: {
            type: 'string',
            enum: ['cosine', 'euclidean', 'dotProduct'],
            description: 'Similarity metric to use',
            default: 'cosine',
          },
          filters: {
            type: 'object',
            description: 'Optional metadata filters',
          },
        },
      },
      {
        type: 'object',
        required: ['results', 'count', 'processingTime'],
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                documentId: { type: 'string' },
                content: { type: 'string' },
                metadata: { type: 'object' },
                score: { type: 'number' },
              },
            },
          },
          count: { type: 'number' },
          processingTime: { type: 'number' },
        },
      },
      [
        { query: 'machine learning algorithms', userId: 'user-123' },
        { query: 'API documentation', userId: 'user-123', conversationId: 'conv-456', limit: 10 },
        { query: 'python code examples', userId: 'user-123', filters: { sourceType: 'github' } },
      ],
      'database' as RetrievalType,
      true, // caching
      { topK: 5, similarity: 0.7 }, // defaultRAGConfig (similarity threshold 0.7)
    );

    super(metadata, errorEvents);
    this.metadata = metadata;
    this.errorEvents = errorEvents;

    this.DATA_PROCESSING_URL = process.env.DATA_PROCESSING_WORKER_URL || 'http://data-processing-worker:3003';
  }

  /**
   * Perform vector search using Data Processing Worker
   */
  protected async retrieve(args: VectorSearchArgs & { ragConfig?: RAGConfig }): Promise<VectorSearchOutput> {
    const startTime = Date.now();

    try {
      this.logger.log(`Vector search for query: "${args.query.substring(0, 50)}..."`);

      // Step 1: Generate embedding for query using Data Processing embedder
      const embeddingResponse: AxiosResponse = await axios.post(
        `${this.DATA_PROCESSING_URL}/embedders/embed`,
        {
          text: args.query,
          provider: 'openai', // Default to OpenAI, could be configurable
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const queryEmbedding = embeddingResponse.data.embedding;

      if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
        throw new Error('Failed to generate query embedding');
      }

      this.logger.log(`Generated embedding with ${queryEmbedding.length} dimensions`);

      // Step 2: Perform vector search
      let searchEndpoint = `${this.DATA_PROCESSING_URL}/vector-store/search`;
      let requestBody: Record<string, unknown> = {
        queryEmbedding,
        limit: args.limit || args.ragConfig?.topK || 5,
        filter: args.filters || {},
      };

      // Use conversation-scoped search if conversationId provided
      if (args.conversationId) {
        searchEndpoint = `${this.DATA_PROCESSING_URL}/vector-store/search-conversations`;
        requestBody = {
          queryEmbedding,
          conversationId: args.conversationId,
          userId: args.userId,
          limit: args.limit || args.ragConfig?.topK || 5,
          includeGlobalDocuments: true,
        };
      }

      const searchResponse: AxiosResponse = await axios.post(
        searchEndpoint,
        requestBody,
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const results = searchResponse.data.results || [];
      const processingTime = Date.now() - startTime;

      this.logger.log(`Found ${results.length} results in ${processingTime}ms`);

      return {
        results: results.map((r: { document?: { id?: string; content?: string; metadata?: Record<string, unknown> }; id?: string; content?: string; metadata?: Record<string, unknown>; score?: number }) => ({
          documentId: r.document?.id || r.id || 'unknown',
          content: r.document?.content || r.content || '',
          metadata: r.document?.metadata || r.metadata || {},
          score: r.score || 0,
        })),
        count: results.length,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Vector search failed after ${processingTime}ms:`, error instanceof Error ? error.message : error);

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        throw new Error(`Data Processing Worker error (${status}): ${message}`);
      }

      throw error;
    }
  }

  /**
   * Get retrieval type
   */
  get retrievalType(): string {
    return 'database';
  }

  /**
   * Get caching preference
   */
  get caching(): boolean {
    return true;
  }

  /**
   * Validate input parameters
   */
  async validateInput(input: unknown): Promise<boolean> {
    const args = input as VectorSearchArgs;

    if (!args.query || typeof args.query !== 'string') {
      throw new Error('query must be a non-empty string');
    }

    if (!args.userId || typeof args.userId !== 'string') {
      throw new Error('userId must be a non-empty string');
    }

    if (args.limit !== undefined && (typeof args.limit !== 'number' || args.limit < 1 || args.limit > 100)) {
      throw new Error('limit must be a number between 1 and 100');
    }

    if (args.similarity && !['cosine', 'euclidean', 'dotProduct'].includes(args.similarity)) {
      throw new Error('similarity must be one of: cosine, euclidean, dotProduct');
    }

    return true;
  }

  /**
   * Get usage examples
   */
  getUsageExamples(): string[] {
    return [
      'Search for documents about "machine learning": { query: "machine learning", userId: "user-123", limit: 5 }',
      'Conversation-scoped search: { query: "previous discussion", userId: "user-123", conversationId: "conv-456" }',
      'With custom filters: { query: "python code", userId: "user-123", filters: { sourceType: "github" } }',
      'Using RAG config: { query: "API documentation", userId: "user-123", ragConfig: { topK: 10, similarity: "cosine" } }',
    ];
  }

  /**
   * Format results for display
   */
  formatResult(result: VectorSearchOutput): string {
    const { results, count, processingTime } = result;

    if (count === 0) {
      return 'No matching documents found.';
    }

    let output = `Found ${count} document(s) in ${processingTime}ms:\n\n`;

    results.forEach((r, index: number) => {
      output += `${index + 1}. [Score: ${r.score.toFixed(4)}]\n`;
      output += `   Content: ${r.content.substring(0, 200)}...\n`;
      output += `   Source: ${r.metadata.sourceType || 'unknown'}\n`;
      if (r.metadata.url) {
        output += `   URL: ${r.metadata.url}\n`;
      }
      output += '\n';
    });

    return output.trim();
  }

  /**
   * Check if retriever is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.DATA_PROCESSING_URL}/health`, {
        timeout: 3000,
      });
      return response.status === 200;
    } catch (error) {
      this.logger.warn('Data Processing Worker unavailable:', error instanceof Error ? error.message : error);
      return false;
    }
  }
}
