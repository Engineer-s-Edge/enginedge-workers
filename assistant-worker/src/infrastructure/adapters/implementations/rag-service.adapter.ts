/**
 * RAG Service Adapter Implementation
 *
 * Hexagonal architecture adapter that bridges the Assistant Worker with the Data Processing Worker.
 * Implements the IRAGServiceAdapter port interface.
 * Provides document processing and vector search capabilities for Expert Agent.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { MetricsAdapter } from '../monitoring/metrics.adapter';
import {
  IRAGServicePort,
  RAGDocument,
  RAGDocumentProcessingResult,
  RAGSearchRequest,
  RAGSearchResult,
  RAGConversationDocsRequest,
  RAGConversationDocsResult,
  EmbeddingModelsResult,
} from '@domain/ports/rag-service.port';

/**
 * Configuration for RAG service connection
 */
interface RAGServiceConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  retryDelay: number;
}

@Injectable()
export class RAGServiceAdapter implements IRAGServicePort {
  private readonly logger = new Logger(RAGServiceAdapter.name);
  private readonly httpClient: AxiosInstance;
  private readonly config: RAGServiceConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly metrics: MetricsAdapter,
  ) {
    // Load configuration from environment variables
    this.config = {
      baseUrl:
        this.configService.get<string>('DATA_PROCESSING_WORKER_URL') ||
        'http://data-processing-worker:3003',
      timeout: this.configService.get<number>('RAG_SERVICE_TIMEOUT') || 30000,
      retries: this.configService.get<number>('RAG_SERVICE_RETRIES') || 3,
      retryDelay:
        this.configService.get<number>('RAG_SERVICE_RETRY_DELAY') || 1000,
    };

    // Create axios instance with retry logic
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for logging
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`RAG service responded: ${response.config.url}`, {
          status: response.status,
          duration: response.headers['x-response-time'],
        });
        return response;
      },
      async (error: AxiosError) => {
        const config = error.config as typeof error.config & {
          __retryCount?: number;
        };
        if (!config) throw error;

        // Retry logic
        const retryCount = config.__retryCount || 0;
        if (retryCount < this.config.retries) {
          config.__retryCount = retryCount + 1;
          this.logger.warn(
            `RAG service request failed, retrying (${retryCount + 1}/${this.config.retries})`,
            {
              url: config.url,
              error: error.message,
            },
          );

          await this.sleep(this.config.retryDelay * Math.pow(2, retryCount));
          return this.httpClient.request(config);
        }

        this.logger.error(
          `RAG service request failed after ${retryCount} retries`,
          {
            url: config.url,
            error: error.message,
            status: error.response?.status,
          },
        );
        throw error;
      },
    );

    this.logger.log('RAG Service Adapter initialized', {
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      retries: this.config.retries,
    });
  }

  /**
   * Process a document for RAG (chunking + embedding + storage)
   */
  async processDocument(
    document: RAGDocument,
  ): Promise<RAGDocumentProcessingResult> {
    const startTime = Date.now();

    try {
      this.logger.log('Processing document for RAG', {
        userId: document.userId,
        conversationId: document.conversationId,
        contentLength: document.content.length,
      });

      const response = await this.httpClient.post<RAGDocumentProcessingResult>(
        '/documents/process-for-rag',
        document,
      );

      const durationSeconds = (Date.now() - startTime) / 1000;

      // Record metrics
      this.metrics.recordRAGDocumentProcessing(
        'success',
        document.conversationId || 'none',
        durationSeconds,
      );
      this.metrics.recordDataProcessingRequest(
        '/documents/process-for-rag',
        'success',
        durationSeconds,
      );

      this.logger.log('Document processed successfully', {
        documentId: response.data.documentId,
        chunks: response.data.chunks,
        embeddings: response.data.embeddings,
        durationSeconds,
      });

      return response.data;
    } catch (error) {
      const durationSeconds = (Date.now() - startTime) / 1000;
      const err = error instanceof Error ? error : new Error(String(error));

      // Record error metrics
      this.metrics.recordRAGDocumentProcessing(
        'error',
        document.conversationId || 'none',
        durationSeconds,
      );
      this.metrics.recordDataProcessingRequest(
        '/documents/process-for-rag',
        'error',
        durationSeconds,
      );
      this.metrics.recordDataProcessingError(
        '/documents/process-for-rag',
        err.name,
      );

      this.logger.error('Failed to process document', {
        error: err.message,
        userId: document.userId,
        durationSeconds,
      });
      throw new Error(`RAG document processing failed: ${err.message}`);
    }
  }

  /**
   * Search for relevant content in conversation context
   */
  async searchConversation(
    request: RAGSearchRequest,
  ): Promise<RAGSearchResult> {
    const startTime = Date.now();

    try {
      this.logger.log('Searching conversation for RAG', {
        conversationId: request.conversationId,
        userId: request.userId,
        queryLength: request.query.length,
        limit: request.limit,
      });

      // Step 1: Generate embedding for query
      const embeddingResponse = await this.httpClient.post<{
        embedding: number[];
        dimensions: number;
      }>('/embedders/embed', {
        text: request.query,
      });

      const queryEmbedding = embeddingResponse.data.embedding;

      // Step 2: Perform conversation-scoped vector search
      const searchResponse = await this.httpClient.post<RAGSearchResult>(
        '/vector-store/search-conversations',
        {
          queryEmbedding,
          userId: request.userId,
          conversationId: request.conversationId,
          limit: request.limit || 5,
          similarityThreshold: request.similarityThreshold || 0.7,
          includeMetadata: request.includeMetadata !== false,
          filters: request.filters || {},
        },
      );

      const durationSeconds = (Date.now() - startTime) / 1000;

      // Record metrics
      this.metrics.recordRAGSearch(
        'success',
        request.conversationId,
        durationSeconds,
        searchResponse.data.count,
      );
      this.metrics.recordDataProcessingRequest(
        '/vector-store/search-conversations',
        'success',
        durationSeconds,
      );

      this.logger.log('Conversation search completed', {
        conversationId: request.conversationId,
        resultsFound: searchResponse.data.count,
        totalMatches: searchResponse.data.totalMatches,
        durationSeconds,
      });

      return searchResponse.data;
    } catch (error) {
      const durationSeconds = (Date.now() - startTime) / 1000;
      const err = error instanceof Error ? error : new Error(String(error));

      // Record error metrics
      this.metrics.recordRAGSearch(
        'error',
        request.conversationId,
        durationSeconds,
        0,
      );
      this.metrics.recordDataProcessingRequest(
        '/vector-store/search-conversations',
        'error',
        durationSeconds,
      );
      this.metrics.recordDataProcessingError(
        '/vector-store/search-conversations',
        err.name,
      );

      this.logger.error('Failed to search conversation', {
        error: err.message,
        conversationId: request.conversationId,
        durationSeconds,
      });
      throw new Error(`RAG conversation search failed: ${err.message}`);
    }
  }

  /**
   * Get all documents for a conversation
   */
  async getConversationDocuments(
    request: RAGConversationDocsRequest,
  ): Promise<RAGConversationDocsResult> {
    try {
      this.logger.log('Fetching conversation documents', {
        conversationId: request.conversationId,
        userId: request.userId,
        limit: request.limit,
      });

      const response = await this.httpClient.get<RAGConversationDocsResult>(
        `/documents/by-conversation/${request.conversationId}`,
        {
          params: {
            userId: request.userId,
            limit: request.limit || 50,
            offset: request.offset || 0,
          },
        },
      );

      this.logger.log('Conversation documents retrieved', {
        conversationId: request.conversationId,
        count: response.data.count,
        total: response.data.total,
      });

      return response.data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to get conversation documents', {
        error: err.message,
        conversationId: request.conversationId,
      });
      throw new Error(
        `Failed to retrieve conversation documents: ${err.message}`,
      );
    }
  }

  /**
   * Get available embedding models
   */
  async getEmbeddingModels(provider?: string): Promise<EmbeddingModelsResult> {
    try {
      this.logger.log('Fetching embedding models', { provider });

      const response = await this.httpClient.get<EmbeddingModelsResult>(
        '/embedders/models',
        {
          params: provider ? { provider } : {},
        },
      );

      this.logger.log('Embedding models retrieved', {
        count: response.data.count,
        provider,
      });

      return response.data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to get embedding models', {
        error: err.message,
        provider,
      });
      throw new Error(`Failed to retrieve embedding models: ${err.message}`);
    }
  }

  /**
   * Check if RAG service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/health', {
        timeout: 5000, // Short timeout for health check
      });
      return response.status === 200;
    } catch (error) {
      this.logger.warn('RAG service health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Sleep utility for retry logic
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
