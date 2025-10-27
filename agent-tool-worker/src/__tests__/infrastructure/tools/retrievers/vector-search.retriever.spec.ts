import { Test, TestingModule } from '@nestjs/testing';
import { VectorSearchRetriever } from '@infrastructure/tools/retrievers/vector-search.retriever';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('VectorSearchRetriever', () => {
  let retriever: VectorSearchRetriever;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VectorSearchRetriever],
    }).compile();

    retriever = module.get<VectorSearchRetriever>(VectorSearchRetriever);
    jest.clearAllMocks();
  });

  describe('Tool Metadata', () => {
    it('vector-search-001: should have correct tool name', () => {
      expect(retriever.metadata.name).toBe('vector-search-retriever');
    });

    it('vector-search-002: should have valid description', () => {
      const description = retriever.metadata.description;
      expect(description).toContain('vector');
      expect(description).toContain('similarity');
    });

    it('vector-search-003: should have correct retrieval type', () => {
      expect(retriever.retrievalType).toBe('database');
    });

    it('vector-search-004: should have caching enabled', () => {
      expect(retriever.caching).toBe(true);
    });

    it('vector-search-005: should have valid input schema', () => {
      const schema = retriever.metadata.inputSchema as { required?: string[]; properties?: Record<string, unknown> };
      expect(schema).toHaveProperty('properties');
      expect(schema.required).toContain('query');
      expect(schema.required).toContain('userId');
    });
  });

  describe('Input Validation', () => {
    it('vector-search-006: should validate missing query', async () => {
      await expect(
        retriever.validateInput({ userId: 'user-123' })
      ).rejects.toThrow('query must be a non-empty string');
    });

    it('vector-search-007: should validate missing userId', async () => {
      await expect(
        retriever.validateInput({ query: 'test query' })
      ).rejects.toThrow('userId must be a non-empty string');
    });

    it('vector-search-008: should validate invalid limit', async () => {
      await expect(
        retriever.validateInput({
          query: 'test',
          userId: 'user-123',
          limit: 0,
        })
      ).rejects.toThrow('limit must be a number between 1 and 100');
    });

    it('vector-search-009: should validate limit > 100', async () => {
      await expect(
        retriever.validateInput({
          query: 'test',
          userId: 'user-123',
          limit: 101,
        })
      ).rejects.toThrow('limit must be a number between 1 and 100');
    });

    it('vector-search-010: should validate invalid similarity metric', async () => {
      await expect(
        retriever.validateInput({
          query: 'test',
          userId: 'user-123',
          similarity: 'invalid' as 'cosine',
        })
      ).rejects.toThrow();
    });

    it('vector-search-011: should accept valid input', async () => {
      await expect(
        retriever.validateInput({
          query: 'machine learning',
          userId: 'user-123',
          limit: 5,
          similarity: 'cosine',
        })
      ).resolves.toBe(true);
    });
  });

  describe('Vector Search Execution', () => {
    it('vector-search-012: should perform basic vector search', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockResults = [
        {
          document: {
            id: 'doc-1',
            content: 'Machine learning is awesome',
            metadata: { sourceType: 'web' },
          },
          score: 0.95,
        },
      ];

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { embedding: mockEmbedding, dimensions: 1536 },
        })
        .mockResolvedValueOnce({
          data: { results: mockResults, count: 1 },
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (retriever as any).retrieve({
        query: 'machine learning',
        userId: 'user-123',
        limit: 5,
        ragConfig: {},
      });

      expect(result.count).toBe(1);
      expect(result.results[0].documentId).toBe('doc-1');
      expect(result.results[0].score).toBe(0.95);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('vector-search-013: should use conversation-scoped search', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockResults = [
        {
          document: {
            id: 'doc-2',
            content: 'Previous conversation context',
            metadata: { conversationId: 'conv-456' },
          },
          score: 0.88,
        },
      ];

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { embedding: mockEmbedding },
        })
        .mockResolvedValueOnce({
          data: { results: mockResults, count: 1 },
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (retriever as any).retrieve({
        query: 'previous discussion',
        userId: 'user-123',
        conversationId: 'conv-456',
        ragConfig: {},
      });

      expect(result.count).toBe(1);
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/vector-store/search-conversations'),
        expect.objectContaining({
          conversationId: 'conv-456',
          userId: 'user-123',
        }),
        expect.any(Object),
      );
    });

    it('vector-search-014: should handle RAG config', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockResults: unknown[] = [];

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { embedding: mockEmbedding },
        })
        .mockResolvedValueOnce({
          data: { results: mockResults, count: 0 },
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (retriever as any).retrieve({
        query: 'test',
        userId: 'user-123',
        ragConfig: {
          topK: 10,
          similarity: 0.8,
          filters: { sourceType: 'github' },
        },
      });

      expect(result.count).toBe(0);
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          limit: 10,
        }),
        expect.any(Object),
      );
    });

    it('vector-search-015: should handle custom filters', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockResults: unknown[] = [];

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { embedding: mockEmbedding },
        })
        .mockResolvedValueOnce({
          data: { results: mockResults, count: 0 },
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (retriever as any).retrieve({
        query: 'python code',
        userId: 'user-123',
        filters: {
          sourceType: 'github',
          language: 'python',
        },
        ragConfig: {},
      });

      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          filter: expect.objectContaining({
            sourceType: 'github',
            language: 'python',
          }),
        }),
        expect.any(Object),
      );
    });

    it('vector-search-016: should handle embedding generation failure', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Embedding service unavailable'));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect((retriever as any).retrieve({
        query: 'test',
        userId: 'user-123',
        ragConfig: {},
      })).rejects.toThrow('Embedding service unavailable');
    });

    it('vector-search-017: should handle vector search failure', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { embedding: mockEmbedding },
        })
        .mockRejectedValueOnce(new Error('Database connection failed'));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect((retriever as any).retrieve({
        query: 'test',
        userId: 'user-123',
        ragConfig: {},
      })).rejects.toThrow();
    });

    it('vector-search-018: should handle axios timeout', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('timeout exceeded'));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect((retriever as any).retrieve({
        query: 'test',
        userId: 'user-123',
        ragConfig: {},
      })).rejects.toThrow();
    });
  });

  describe('Result Formatting', () => {
    it('vector-search-019: should format results correctly', () => {
      const mockResult = {
        results: [
          {
            documentId: 'doc-1',
            content: 'Machine learning content here with lots of text that will be truncated',
            metadata: { sourceType: 'web', url: 'https://example.com' },
            score: 0.95,
          },
        ],
        count: 1,
        processingTime: 250,
      };

      const formatted = retriever.formatResult(mockResult);
      
      expect(formatted).toContain('Found 1 document(s) in 250ms');
      expect(formatted).toContain('Score: 0.9500');
      expect(formatted).toContain('Source: web');
      expect(formatted).toContain('URL: https://example.com');
    });

    it('vector-search-020: should format empty results', () => {
      const mockResult = {
        results: [],
        count: 0,
        processingTime: 100,
      };

      const formatted = retriever.formatResult(mockResult);
      
      expect(formatted).toBe('No matching documents found.');
    });

    it('vector-search-021: should truncate long content', () => {
      const longContent = 'a'.repeat(500);
      const mockResult = {
        results: [
          {
            documentId: 'doc-1',
            content: longContent,
            metadata: {},
            score: 0.9,
          },
        ],
        count: 1,
        processingTime: 150,
      };

      const formatted = retriever.formatResult(mockResult);
      
      expect(formatted).toContain('a'.repeat(200));
      expect(formatted).not.toContain('a'.repeat(201));
    });
  });

  describe('Availability Check', () => {
    it('vector-search-022: should check if Data Processing Worker is available', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });

      const available = await retriever.isAvailable();
      
      expect(available).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.objectContaining({ timeout: 3000 }),
      );
    });

    it('vector-search-023: should return false if worker is unavailable', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Connection refused'));

      const available = await retriever.isAvailable();
      
      expect(available).toBe(false);
    });
  });

  describe('Usage Examples', () => {
    it('vector-search-024: should provide usage examples', () => {
      const examples = retriever.getUsageExamples();
      
      expect(examples).toBeDefined();
      expect(Array.isArray(examples)).toBe(true);
      expect(examples.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('vector-search-025: should handle invalid embedding response', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { embedding: null },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect((retriever as any).retrieve({
        query: 'test',
        userId: 'user-123',
        ragConfig: {},
      })).rejects.toThrow('Failed to generate query embedding');
    });

    it('vector-search-026: should handle non-array embedding', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { embedding: 'not-an-array' },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect((retriever as any).retrieve({
        query: 'test',
        userId: 'user-123',
        ragConfig: {},
      })).rejects.toThrow('Failed to generate query embedding');
    });

    it('vector-search-027: should handle missing results in response', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { embedding: mockEmbedding },
        })
        .mockResolvedValueOnce({
          data: {}, // No results field
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (retriever as any).retrieve({
        query: 'test',
        userId: 'user-123',
        ragConfig: {},
      });

      expect(result.count).toBe(0);
      expect(result.results).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('vector-search-028: should handle very short query', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      const mockResults: unknown[] = [];

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { embedding: mockEmbedding },
        })
        .mockResolvedValueOnce({
          data: { results: mockResults, count: 0 },
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (retriever as any).retrieve({
        query: 'ai',
        userId: 'user-123',
        ragConfig: {},
      });

      expect(result).toBeDefined();
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('vector-search-029: should handle maximum limit', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { embedding: mockEmbedding },
        })
        .mockResolvedValueOnce({
          data: { results: [], count: 0 },
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (retriever as any).retrieve({
        query: 'test',
        userId: 'user-123',
        limit: 100,
        ragConfig: {},
      });

      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          limit: 100,
        }),
        expect.any(Object),
      );
    });

    it('vector-search-030: should use default limit when not specified', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);

      mockedAxios.post
        .mockResolvedValueOnce({
          data: { embedding: mockEmbedding },
        })
        .mockResolvedValueOnce({
          data: { results: [], count: 0 },
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (retriever as any).retrieve({
        query: 'test',
        userId: 'user-123',
        ragConfig: {},
      });

      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          limit: 5, // Default value
        }),
        expect.any(Object),
      );
    });
  });
});
