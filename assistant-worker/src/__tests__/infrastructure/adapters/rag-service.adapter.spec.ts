/**
 * RAG Service Adapter Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RAGServiceAdapter } from '../../../infrastructure/adapters/implementations/rag-service.adapter';
import {
  RAGDocument,
  RAGSearchRequest,
  RAGConversationDocsRequest,
} from '../../../infrastructure/adapters/interfaces/rag-service.adapter.interface';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RAGServiceAdapter', () => {
  let adapter: RAGServiceAdapter;

  const mockAxiosInstance = {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      response: {
        use: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock axios.create
    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RAGServiceAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string | number> = {
                DATA_PROCESSING_WORKER_URL: 'http://data-processing-worker:3003',
                RAG_SERVICE_TIMEOUT: 30000,
                RAG_SERVICE_RETRIES: 3,
                RAG_SERVICE_RETRY_DELAY: 1000,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get<RAGServiceAdapter>(RAGServiceAdapter);
  });

  describe('Initialization', () => {
    it('rag-service-001: should initialize with correct configuration', () => {
      expect(adapter).toBeDefined();
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://data-processing-worker:3003',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('rag-service-002: should use default configuration if env vars not set', async () => {
      jest.clearAllMocks();

      const emptyConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RAGServiceAdapter,
          {
            provide: ConfigService,
            useValue: emptyConfigService,
          },
        ],
      }).compile();

      const adapterWithDefaults = module.get<RAGServiceAdapter>(RAGServiceAdapter);

      expect(adapterWithDefaults).toBeDefined();
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://data-processing-worker:3003',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('rag-service-003: should set up retry interceptor', () => {
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('processDocument', () => {
    const mockDocument: RAGDocument = {
      content: 'This is a test document about quantum computing.',
      userId: 'user-123',
      conversationId: 'conv-456',
      metadata: {
        fileName: 'quantum.pdf',
        mimeType: 'application/pdf',
        title: 'Quantum Computing Basics',
      },
      chunkingStrategy: {
        method: 'semantic',
        chunkSize: 1000,
        overlap: 200,
      },
    };

    const mockResponse = {
      success: true,
      documentId: 'doc-789',
      chunks: 15,
      embeddings: 15,
      stored: true,
      metadata: {
        processingTime: 1234.56,
        embeddingModel: 'text-embedding-3-small',
        chunkingMethod: 'semantic',
      },
    };

    it('rag-service-004: should successfully process document', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await adapter.processDocument(mockDocument);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/documents/process-for-rag',
        mockDocument,
      );
      expect(result).toEqual(mockResponse);
      expect(result.documentId).toBe('doc-789');
      expect(result.chunks).toBe(15);
    });

    it('rag-service-005: should process document without optional fields', async () => {
      const minimalDoc: RAGDocument = {
        content: 'Minimal document',
        userId: 'user-123',
      };

      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await adapter.processDocument(minimalDoc);

      expect(result.success).toBe(true);
    });

    it('rag-service-006: should handle processing failure', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Processing failed'));

      await expect(adapter.processDocument(mockDocument)).rejects.toThrow(
        'RAG document processing failed',
      );
    });

    it('rag-service-007: should handle large documents', async () => {
      const largeDoc: RAGDocument = {
        content: 'x'.repeat(100000),
        userId: 'user-123',
      };

      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await adapter.processDocument(largeDoc);

      expect(result.success).toBe(true);
    });

    it('rag-service-008: should process with custom chunking strategy', async () => {
      const customDoc: RAGDocument = {
        content: 'Document content',
        userId: 'user-123',
        chunkingStrategy: {
          method: 'fixed',
          chunkSize: 500,
          overlap: 100,
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResponse });

      await adapter.processDocument(customDoc);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/documents/process-for-rag',
        customDoc,
      );
    });
  });

  describe('searchConversation', () => {
    const mockSearchRequest: RAGSearchRequest = {
      query: 'What is quantum computing?',
      userId: 'user-123',
      conversationId: 'conv-456',
      limit: 5,
      similarityThreshold: 0.7,
      includeMetadata: true,
    };

    const mockEmbeddingResponse = {
      embedding: Array(1536).fill(0.1),
      dimensions: 1536,
    };

    const mockSearchResponse = {
      success: true,
      conversationId: 'conv-456',
      query: {
        userId: 'user-123',
        limit: 5,
        similarityThreshold: 0.7,
      },
      results: [
        {
          id: 'chunk-1',
          content: 'Quantum computing uses quantum mechanics...',
          score: 0.92,
          metadata: { source: 'doc-789' },
          documentId: 'doc-789',
          chunkIndex: 0,
          conversationId: 'conv-456',
        },
      ],
      count: 1,
      totalMatches: 3,
    };

    it('rag-service-009: should successfully search conversation', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: mockEmbeddingResponse })
        .mockResolvedValueOnce({ data: mockSearchResponse });

      const result = await adapter.searchConversation(mockSearchRequest);

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(1, '/embedders/embed', {
        text: mockSearchRequest.query,
      });
      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(
        2,
        '/vector-store/search-conversations',
        expect.objectContaining({
          userId: 'user-123',
          conversationId: 'conv-456',
          limit: 5,
        }),
      );
      expect(result).toEqual(mockSearchResponse);
    });

    it('rag-service-010: should use default values for optional params', async () => {
      const minimalRequest: RAGSearchRequest = {
        query: 'test query',
        userId: 'user-123',
        conversationId: 'conv-456',
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: mockEmbeddingResponse })
        .mockResolvedValueOnce({ data: mockSearchResponse });

      await adapter.searchConversation(minimalRequest);

      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(
        2,
        '/vector-store/search-conversations',
        expect.objectContaining({
          limit: 5,
          similarityThreshold: 0.7,
          includeMetadata: true,
        }),
      );
    });

    it('rag-service-011: should handle embedding generation failure', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Embedding failed'));

      await expect(adapter.searchConversation(mockSearchRequest)).rejects.toThrow(
        'RAG conversation search failed',
      );
    });

    it('rag-service-012: should handle search failure', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: mockEmbeddingResponse })
        .mockRejectedValueOnce(new Error('Search failed'));

      await expect(adapter.searchConversation(mockSearchRequest)).rejects.toThrow(
        'RAG conversation search failed',
      );
    });

    it('rag-service-013: should handle empty search results', async () => {
      const emptyResponse = {
        ...mockSearchResponse,
        results: [],
        count: 0,
        totalMatches: 0,
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: mockEmbeddingResponse })
        .mockResolvedValueOnce({ data: emptyResponse });

      const result = await adapter.searchConversation(mockSearchRequest);

      expect(result.count).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('rag-service-014: should apply custom filters', async () => {
      const requestWithFilters: RAGSearchRequest = {
        ...mockSearchRequest,
        filters: {
          documentType: 'pdf',
          tags: ['technical'],
        },
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: mockEmbeddingResponse })
        .mockResolvedValueOnce({ data: mockSearchResponse });

      await adapter.searchConversation(requestWithFilters);

      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(
        2,
        '/vector-store/search-conversations',
        expect.objectContaining({
          filters: {
            documentType: 'pdf',
            tags: ['technical'],
          },
        }),
      );
    });
  });

  describe('getConversationDocuments', () => {
    const mockRequest: RAGConversationDocsRequest = {
      conversationId: 'conv-456',
      userId: 'user-123',
      limit: 50,
      offset: 0,
    };

    const mockResponse = {
      success: true,
      conversationId: 'conv-456',
      count: 5,
      total: 12,
      documents: [
        {
          id: 'doc-1',
          content: 'Document content',
          metadata: {},
          createdAt: '2025-10-27T10:00:00Z',
          updatedAt: '2025-10-27T10:00:00Z',
          chunkCount: 8,
        },
      ],
    };

    it('rag-service-015: should retrieve conversation documents', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await adapter.getConversationDocuments(mockRequest);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/documents/by-conversation/conv-456',
        {
          params: {
            userId: 'user-123',
            limit: 50,
            offset: 0,
          },
        },
      );
      expect(result).toEqual(mockResponse);
    });

    it('rag-service-016: should use default pagination values', async () => {
      const minimalRequest: RAGConversationDocsRequest = {
        conversationId: 'conv-456',
        userId: 'user-123',
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResponse });

      await adapter.getConversationDocuments(minimalRequest);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/documents/by-conversation/conv-456',
        {
          params: {
            userId: 'user-123',
            limit: 50,
            offset: 0,
          },
        },
      );
    });

    it('rag-service-017: should handle pagination', async () => {
      const paginatedRequest: RAGConversationDocsRequest = {
        conversationId: 'conv-456',
        userId: 'user-123',
        limit: 10,
        offset: 20,
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResponse });

      await adapter.getConversationDocuments(paginatedRequest);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/documents/by-conversation/conv-456',
        expect.objectContaining({
          params: expect.objectContaining({
            limit: 10,
            offset: 20,
          }),
        }),
      );
    });

    it('rag-service-018: should handle empty conversation', async () => {
      const emptyResponse = {
        ...mockResponse,
        count: 0,
        total: 0,
        documents: [],
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: emptyResponse });

      const result = await adapter.getConversationDocuments(mockRequest);

      expect(result.count).toBe(0);
      expect(result.documents).toEqual([]);
    });

    it('rag-service-019: should handle retrieval failure', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Not found'));

      await expect(adapter.getConversationDocuments(mockRequest)).rejects.toThrow(
        'Failed to retrieve conversation documents',
      );
    });
  });

  describe('getEmbeddingModels', () => {
    const mockModelsResponse = {
      count: 3,
      models: [
        {
          id: 'text-embedding-3-small',
          provider: 'openai',
          displayName: 'OpenAI Text Embedding 3 Small',
          dimensions: 1536,
          maxTokens: 8192,
          maxBatchSize: 100,
          costPer1kTokens: 0.00002,
          capabilities: ['semantic-search', 'clustering'],
          performance: {
            avgLatency: 150.5,
            throughput: 5000,
          },
          recommended: true,
        },
      ],
    };

    it('rag-service-020: should retrieve all embedding models', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockModelsResponse });

      const result = await adapter.getEmbeddingModels();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/embedders/models', {
        params: {},
      });
      expect(result).toEqual(mockModelsResponse);
      expect(result.count).toBe(3);
    });

    it('rag-service-021: should filter by provider', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockModelsResponse });

      await adapter.getEmbeddingModels('openai');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/embedders/models', {
        params: { provider: 'openai' },
      });
    });

    it('rag-service-022: should handle retrieval failure', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Service unavailable'));

      await expect(adapter.getEmbeddingModels()).rejects.toThrow(
        'Failed to retrieve embedding models',
      );
    });

    it('rag-service-023: should handle empty models list', async () => {
      const emptyResponse = {
        count: 0,
        models: [],
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: emptyResponse });

      const result = await adapter.getEmbeddingModels();

      expect(result.count).toBe(0);
      expect(result.models).toEqual([]);
    });
  });

  describe('isAvailable', () => {
    it('rag-service-024: should return true when service is healthy', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ status: 200 });

      const result = await adapter.isAvailable();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health', {
        timeout: 5000,
      });
      expect(result).toBe(true);
    });

    it('rag-service-025: should return false when service is unavailable', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await adapter.isAvailable();

      expect(result).toBe(false);
    });

    it('rag-service-026: should return false on timeout', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Timeout'));

      const result = await adapter.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('rag-service-027: should provide descriptive error messages', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Network error'));

      const document: RAGDocument = {
        content: 'test',
        userId: 'user-123',
      };

      await expect(adapter.processDocument(document)).rejects.toThrow(
        /RAG document processing failed/,
      );
    });

    it('rag-service-028: should handle non-Error exceptions', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce('String error');

      const document: RAGDocument = {
        content: 'test',
        userId: 'user-123',
      };

      await expect(adapter.processDocument(document)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('rag-service-029: should handle special characters in queries', async () => {
      const specialQuery: RAGSearchRequest = {
        query: 'What is "quantum computing" & how does it work?',
        userId: 'user-123',
        conversationId: 'conv-456',
      };

      const mockEmbedding = {
        embedding: Array(1536).fill(0.1),
        dimensions: 1536,
      };

      const mockSearch = {
        success: true,
        conversationId: 'conv-456',
        query: {},
        results: [],
        count: 0,
        totalMatches: 0,
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: mockEmbedding })
        .mockResolvedValueOnce({ data: mockSearch });

      const result = await adapter.searchConversation(specialQuery);

      expect(result.success).toBe(true);
    });

    it('rag-service-030: should handle maximum limit values', async () => {
      const maxLimitRequest: RAGSearchRequest = {
        query: 'test',
        userId: 'user-123',
        conversationId: 'conv-456',
        limit: 100,
      };

      const mockEmbedding = {
        embedding: Array(1536).fill(0.1),
        dimensions: 1536,
      };

      const mockSearch = {
        success: true,
        conversationId: 'conv-456',
        query: {},
        results: [],
        count: 0,
        totalMatches: 0,
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: mockEmbedding })
        .mockResolvedValueOnce({ data: mockSearch });

      await adapter.searchConversation(maxLimitRequest);

      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(
        2,
        '/vector-store/search-conversations',
        expect.objectContaining({
          limit: 100,
        }),
      );
    });
  });
});
