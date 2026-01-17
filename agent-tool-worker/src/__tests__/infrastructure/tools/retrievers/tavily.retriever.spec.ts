/**
 * Tavily Retriever - Unit Tests
 *
 * Tests the Tavily retriever implementation for web search functionality.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  TavilyRetriever,
  TavilyArgs,
} from '@infrastructure/tools/retrievers/tavily.retriever';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TavilyRetriever', () => {
  let retriever: TavilyRetriever;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TavilyRetriever],
    }).compile();

    retriever = module.get<TavilyRetriever>(TavilyRetriever);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(retriever.name).toBe('tavily-retriever');
      expect(retriever.description).toContain('Tavily API');
    });

    it('should have metadata configured', () => {
      expect(retriever.metadata).toBeDefined();
      expect(retriever.metadata.name).toBe('tavily-retriever');
    });

    it('should have error events configured', () => {
      expect(retriever.errorEvents).toBeDefined();
      expect(retriever.errorEvents.length).toBeGreaterThan(0);
    });

    it('should have correct retrieval type and caching settings', () => {
      expect(retriever.retrievalType).toBe('WEB_SEARCH');
      expect(retriever.caching).toBe(false);
    });
  });

  describe('Basic Operations', () => {
    it('should handle service unavailable for basic search query', async () => {
      // Mock axios to reject with connection error (service unavailable)
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const args: TavilyArgs = {
        query: 'latest news about AI',
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Tavily service is not available');
    });

    it('should handle service unavailable for advanced search', async () => {
      // Mock axios to reject with connection error (service unavailable)
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const args: TavilyArgs = {
        query: 'machine learning tutorials',
        search_depth: 'advanced',
        max_results: 15,
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Tavily service is not available');
    });

    it('should handle service unavailable for search with images', async () => {
      // Mock axios to reject with connection error (service unavailable)
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const args: TavilyArgs = {
        query: 'beautiful landscapes',
        include_images: true,
        max_results: 5,
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Tavily service is not available');
    });
  });

  describe('Input Validation', () => {
    it('should reject empty query', async () => {
      const args: TavilyArgs = {
        query: '',
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Search query cannot be empty');
    });

    it('should reject query that is only whitespace', async () => {
      const args: TavilyArgs = {
        query: '   ',
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Search query cannot be empty');
    });

    it('should reject query longer than 500 characters', async () => {
      const longQuery = 'a'.repeat(501);
      const args: TavilyArgs = {
        query: longQuery,
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain(
        'Search query too long (max 500 characters)',
      );
    });
  });

  describe('Search Configuration', () => {
    it('should handle service unavailable with basic search depth', async () => {
      // Mock axios to reject with connection error (service unavailable)
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const args: TavilyArgs = {
        query: 'JavaScript frameworks',
        search_depth: 'basic',
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Tavily service is not available');
    });

    it('should handle service unavailable with advanced search depth', async () => {
      // Mock axios to reject with connection error (service unavailable)
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const args: TavilyArgs = {
        query: 'quantum computing research',
        search_depth: 'advanced',
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Tavily service is not available');
    });

    it('should handle service unavailable with custom result count', async () => {
      // Mock axios to reject with connection error (service unavailable)
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const args: TavilyArgs = {
        query: 'TypeScript best practices',
        max_results: 20,
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Tavily service is not available');
    });

    it('should handle service unavailable with domain filtering', async () => {
      // Mock axios to reject with connection error (service unavailable)
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const args: TavilyArgs = {
        query: 'web development',
        include_domains: ['developer.mozilla.org', 'stackoverflow.com'],
        exclude_domains: ['wikipedia.org'],
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Tavily service is not available');
    });
  });

  describe('Answer and Content Options', () => {
    it('should handle service unavailable with answer generation', async () => {
      // Mock axios to reject with connection error (service unavailable)
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const args: TavilyArgs = {
        query: 'What is machine learning?',
        include_answer: true,
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Tavily service is not available');
    });

    it('should handle service unavailable with raw content', async () => {
      // Mock axios to reject with connection error (service unavailable)
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const args: TavilyArgs = {
        query: 'climate change effects',
        include_raw_content: true,
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Tavily service is not available');
    });

    it('should handle service unavailable with all options enabled', async () => {
      // Mock axios to reject with connection error (service unavailable)
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const args: TavilyArgs = {
        query: 'artificial intelligence trends',
        search_depth: 'advanced',
        include_images: true,
        include_answer: true,
        include_raw_content: true,
        max_results: 15,
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Tavily service is not available');
    });
  });

  describe('RAG Configuration', () => {
    it('should handle service unavailable with RAG configuration parameters', async () => {
      // Mock axios to reject with connection error (service unavailable)
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const args: TavilyArgs = {
        query: 'data science libraries',
      };

      const ragConfig = {
        similarity: 0.8,
        topK: 50,
        includeMetadata: false,
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args: { ...args, ragConfig },
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Tavily service is not available');
    });
  });

  describe('Error Handling', () => {
    it('should handle service unavailable error', async () => {
      // Mock axios to reject with connection error (service unavailable)
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const args: TavilyArgs = {
        query: 'test query',
      };

      const result = await retriever.execute({
        name: 'tavily-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Tavily service is not available');
    });
  });
});
