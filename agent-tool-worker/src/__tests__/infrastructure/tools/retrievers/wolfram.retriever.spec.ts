/**
 * Wolfram Retriever - Unit Tests
 *
 * Tests the Wolfram retriever implementation that sends computational requests
 * to the Wolfram worker node via Kafka messaging.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  WolframRetriever,
  WolframArgs,
} from '@infrastructure/tools/retrievers/wolfram.retriever';

describe('WolframRetriever', () => {
  let retriever: WolframRetriever;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WolframRetriever],
    }).compile();

    retriever = module.get<WolframRetriever>(WolframRetriever);
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(retriever.name).toBe('wolfram-retriever');
      expect(retriever.description).toContain('Wolfram Alpha');
    });

    it('should have metadata configured', () => {
      expect(retriever.metadata).toBeDefined();
      expect(retriever.metadata.name).toBe('wolfram-retriever');
    });

    it('should have error events configured', () => {
      expect(retriever.errorEvents).toBeDefined();
      expect(retriever.errorEvents.length).toBeGreaterThan(0);
    });

    it('should have correct retrieval type and caching settings', () => {
      expect(retriever.retrievalType).toBe('mathematical-computation');
      expect(retriever.caching).toBe(false);
    });
  });

  describe('Basic Operations', () => {
    it('should handle service unavailable for basic computational query', async () => {
      const args: WolframArgs = {
        query: '2 + 2',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      // Service is not running yet, so expect service unavailable error
      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });

    it('should handle service unavailable for solve operation', async () => {
      const args: WolframArgs = {
        query: 'solve x^2 - 4 = 0',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });

    it('should handle service unavailable for integral operation', async () => {
      const args: WolframArgs = {
        query: 'integrate x^2 dx',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });

    it('should handle service unavailable for plot operation', async () => {
      const args: WolframArgs = {
        query: 'plot sin(x)',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });
  });

  describe('Format Support', () => {
    it('should handle service unavailable for plaintext format', async () => {
      const args: WolframArgs = {
        query: 'pi to 10 digits',
        format: 'plaintext',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });

    it('should handle service unavailable for image format', async () => {
      const args: WolframArgs = {
        query: 'plot x^2',
        format: 'image',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });

    it('should handle service unavailable for mathml format', async () => {
      const args: WolframArgs = {
        query: 'integral of e^x',
        format: 'mathml',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });

    it('should handle service unavailable for json format', async () => {
      const args: WolframArgs = {
        query: 'factor 15',
        format: 'json',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty query', async () => {
      const args: WolframArgs = {
        query: '',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe(
        'Query parameter is required and must be a non-empty string',
      );
    });

    it('should handle whitespace-only query', async () => {
      const args: WolframArgs = {
        query: '   ',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe(
        'Query parameter is required and must be a non-empty string',
      );
    });

    it('should handle invalid format', async () => {
      const args = {
        query: '2 + 2',
        format: 'invalid' as unknown as WolframArgs['format'],
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe(
        'Invalid format. Must be one of: plaintext, image, mathml, json',
      );
    });
  });

  describe('RAG Configuration', () => {
    it('should handle service unavailable with RAG configuration', async () => {
      const args: WolframArgs = {
        query: 'solve x + 1 = 0',
      };

      const ragConfig = {
        similarity: 0.8,
        topK: 50,
        includeMetadata: false,
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args: { ...args, ragConfig },
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });
  });

  describe('Assumptions Support', () => {
    it('should handle service unavailable with assumptions', async () => {
      const args: WolframArgs = {
        query: 'solve x^2 = -1',
        assumptions: ['x is complex'],
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });

    it('should handle service unavailable with empty assumptions', async () => {
      const args: WolframArgs = {
        query: '2 * 3',
        assumptions: [],
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });
  });

  describe('Timeout Configuration', () => {
    it('should handle service unavailable with custom timeout', async () => {
      const args: WolframArgs = {
        query: 'factorial 5',
        timeout: 60000,
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });

    it('should handle service unavailable with default timeout', async () => {
      const args: WolframArgs = {
        query: 'gcd(12, 18)',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });
  });

  describe('Output Structure', () => {
    it('should handle service unavailable for pods structure', async () => {
      const args: WolframArgs = {
        query: 'differentiate x^3',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });

    it('should handle service unavailable for sources', async () => {
      const args: WolframArgs = {
        query: 'what is the speed of light',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });

    it('should handle service unavailable for processing time', async () => {
      const args: WolframArgs = {
        query: 'sqrt(16)',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });
  });

  describe('Complex Queries', () => {
    it('should handle service unavailable for complex expressions', async () => {
      const args: WolframArgs = {
        query: 'solve (x^2 + 3x + 2) / (x + 1) = 0 for x',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });

    it('should handle service unavailable for calculus operations', async () => {
      const args: WolframArgs = {
        query: 'limit as x approaches 0 of sin(x)/x',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });

    it('should handle service unavailable for statistical queries', async () => {
      const args: WolframArgs = {
        query: 'mean of {1, 2, 3, 4, 5}',
      };

      const result = await retriever.execute({
        name: 'wolfram-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('Wolfram service is not available');
    });
  });
});
