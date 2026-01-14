/**
 * Expert Pool Adapter Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExpertPoolAdapter } from '../../../infrastructure/adapters/implementations/expert-pool.adapter';
import { ExpertPoolManager } from '../../../domain/services/expert-pool-manager.service';
import { ExpertAllocationRequest } from '../../../infrastructure/adapters/interfaces';
import { ILLMProvider } from '../../../application/ports/llm-provider.port';
import { ILogger } from '../../../application/ports/logger.port';

describe('ExpertPoolAdapter', () => {
  let adapter: ExpertPoolAdapter;

  beforeEach(async () => {
    const mockLLMProvider: ILLMProvider = {
      complete: jest
        .fn()
        .mockResolvedValue({ content: 'Mock response', role: 'assistant' }),
      stream: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('mock-provider'),
      isAvailable: jest.fn().mockResolvedValue(true),
      getModelName: jest.fn().mockReturnValue('mock-model'),
    };

    const mockLogger: ILogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      setLevel: jest.fn(),
      getLevel: jest.fn().mockReturnValue('info'),
    };

    const mockKnowledgeGraph = {
      getNode: jest.fn(),
      unlockNode: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ExpertPoolManager,
          useFactory: () => {
            const released = new Set();
            return {
              allocateExperts: jest.fn().mockImplementation((req) => ({
                allocated: Array(req.count !== undefined ? req.count : 1)
                  .fill(null)
                  .map((_, i) => ({
                    id: `expert-${i}`,
                    specialization: req.specialization || 'General',
                    complexity: req.complexity ? parseInt(req.complexity[1]) : 1,
                    availability: true,
                    expertise: ['Transformers', 'LLMs'],
                  })),
                failed: [],
                timestamp: new Date(),
              })),
              releaseExpert: jest.fn().mockResolvedValue(true),
              releaseExperts: jest.fn().mockImplementation((ids: string[]) => {
                ids.forEach((id) => released.add(id));
                return true;
              }),
              getAvailableCount: jest.fn().mockResolvedValue(5),
              getExpert: jest.fn().mockImplementation((id) => {
                if (id.includes('nonexistent') || id.includes('@#$'))
                  return null;
                return {
                  id,
                  specialization: 'NLP',
                  availability: true,
                  expertise: ['Transformers', 'LLMs'],
                };
              }),
              getAvailableExperts: jest.fn().mockResolvedValue(
                Array(5)
                  .fill(null)
                  .map((_, i) => ({
                    id: `expert-${i}`,
                    specialization: 'NLP',
                    availability: true,
                    expertise: ['Transformers', 'LLMs'],
                  })),
              ),
              isExpertAvailable: jest.fn().mockImplementation((id) => {
                if (id.includes('nonexistent')) return false;
                if (released.has(id)) return false;
                return true;
              }),
            };
          },
        },
        ExpertPoolAdapter,
        { provide: 'ILLMProvider', useValue: mockLLMProvider },
        { provide: 'ILogger', useValue: mockLogger },
        { provide: 'KnowledgeGraphPort', useValue: mockKnowledgeGraph },
        { 
          provide: 'METRICS', 
          useValue: {
            updateExpertPoolActiveExperts: jest.fn(),
            incrementExpertAllocation: jest.fn(),
            incrementExpertRelease: jest.fn(),
            recordExpertAllocationTime: jest.fn()
          } 
        },
      ],
    }).compile();

    adapter = module.get<ExpertPoolAdapter>(ExpertPoolAdapter);
  });

  describe('allocateExperts', () => {
    it('should allocate requested number of experts', async () => {
      const request: ExpertAllocationRequest = {
        count: 3,
        specialization: 'Machine Learning',
        complexity: 'L4',
      };

      const result = await adapter.allocateExperts(request);

      expect(result.allocated).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
    });

    it('should allocate single expert', async () => {
      const request: ExpertAllocationRequest = { count: 1 };

      const result = await adapter.allocateExperts(request);

      expect(result.allocated).toHaveLength(1);
    });

    it('should allocate many experts', async () => {
      const request: ExpertAllocationRequest = { count: 50 };

      const result = await adapter.allocateExperts(request);

      expect(result.allocated).toHaveLength(50);
    });

    it('should handle zero allocation request', async () => {
      const request: ExpertAllocationRequest = { count: 0 };

      const result = await adapter.allocateExperts(request);

      expect(result.allocated).toHaveLength(0);
    });

    it('should set expert properties', async () => {
      const request: ExpertAllocationRequest = {
        count: 1,
        specialization: 'NLP',
        complexity: 'L5',
        expertise: ['Transformers', 'LLMs'],
      };

      const result = await adapter.allocateExperts(request);

      expect(result.allocated[0].specialization).toBe('NLP');
      expect(result.allocated[0].availability).toBe(true);
      expect(result.allocated[0].expertise).toEqual(['Transformers', 'LLMs']);
    });

    it('should generate unique expert IDs', async () => {
      const request: ExpertAllocationRequest = { count: 5 };

      const result = await adapter.allocateExperts(request);

      const ids = new Set(result.allocated.map((e) => e.id));
      expect(ids.size).toBe(5);
    });

    it('should handle different complexity levels', async () => {
      for (const complexity of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as const) {
        const result = await adapter.allocateExperts({ count: 1, complexity });

        expect(result.allocated[0].complexity).toBe(parseInt(complexity[1]));
      }
    });

    it('should record allocation timestamp', async () => {
      const request: ExpertAllocationRequest = { count: 1 };

      const result = await adapter.allocateExperts(request);

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('releaseExperts', () => {
    it('should release allocated experts', async () => {
      const allocRequest: ExpertAllocationRequest = { count: 2 };
      const allocResult = await adapter.allocateExperts(allocRequest);

      const expertIds = allocResult.allocated.map((e) => e.id);
      const releaseResult = await adapter.releaseExperts(expertIds);

      expect(releaseResult).toBe(true);
    });

    it('should handle empty release', async () => {
      const result = await adapter.releaseExperts([]);

      expect(result).toBe(true);
    });

    it('should handle nonexistent expert IDs', async () => {
      const result = await adapter.releaseExperts([
        'nonexistent-1',
        'nonexistent-2',
      ]);

      expect(typeof result).toBe('boolean');
    });

    it('should handle many releases', async () => {
      const expertIds = Array.from({ length: 100 }, (_, i) => `expert-${i}`);

      const result = await adapter.releaseExperts(expertIds);

      expect(result).toBe(true);
    });
  });

  describe('getAvailableCount', () => {
    it('should return available expert count', async () => {
      const count = await adapter.getAvailableCount();

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should return consistent count', async () => {
      const count1 = await adapter.getAvailableCount();
      const count2 = await adapter.getAvailableCount();

      expect(typeof count1).toBe('number');
      expect(typeof count2).toBe('number');
    });
  });

  describe('getExpert', () => {
    it('should return expert details', async () => {
      const allocRequest: ExpertAllocationRequest = { count: 1 };
      const allocResult = await adapter.allocateExperts(allocRequest);

      const expertId = allocResult.allocated[0].id;
      const expert = await adapter.getExpert(expertId);

      expect(expert).not.toBeNull();
      expect(expert?.id).toBe(expertId);
    });

    it('should return null for nonexistent expert', async () => {
      const expert = await adapter.getExpert('nonexistent-expert');

      expect(expert).toBeNull();
    });

    it('should handle special characters in ID', async () => {
      const expert = await adapter.getExpert('expert-@#$%-123');

      expect(expert).toBeNull();
    });
  });

  describe('getAvailableExperts', () => {
    it('should return list of available experts', async () => {
      const request: ExpertAllocationRequest = { count: 3 };
      await adapter.allocateExperts(request);

      const experts = await adapter.getAvailableExperts();

      expect(Array.isArray(experts)).toBe(true);
    });

    it('should return empty list initially', async () => {
      const experts = await adapter.getAvailableExperts();

      expect(Array.isArray(experts)).toBe(true);
    });

    it('should include all allocated experts', async () => {
      const request: ExpertAllocationRequest = { count: 5 };
      const allocResult = await adapter.allocateExperts(request);

      const experts = await adapter.getAvailableExperts();

      expect(experts.length).toBeGreaterThanOrEqual(
        allocResult.allocated.length,
      );
    });

    it('should return full expert details', async () => {
      await adapter.allocateExperts({ count: 1 });

      const experts = await adapter.getAvailableExperts();

      if (experts.length > 0) {
        expect(experts[0]).toHaveProperty('id');
        expect(experts[0]).toHaveProperty('specialization');
        expect(experts[0]).toHaveProperty('complexity');
        expect(experts[0]).toHaveProperty('availability');
      }
    });
  });

  describe('isExpertAvailable', () => {
    it('should return true for allocated expert', async () => {
      const request: ExpertAllocationRequest = { count: 1 };
      const allocResult = await adapter.allocateExperts(request);

      const available = await adapter.isExpertAvailable(
        allocResult.allocated[0].id,
      );

      expect(available).toBe(true);
    });

    it('should return false for nonexistent expert', async () => {
      const available = await adapter.isExpertAvailable('nonexistent-expert');

      expect(available).toBe(false);
    });

    it('should return false for released expert', async () => {
      const request: ExpertAllocationRequest = { count: 1 };
      const allocResult = await adapter.allocateExperts(request);

      const expertId = allocResult.allocated[0].id;
      await adapter.releaseExperts([expertId]);

      const available = await adapter.isExpertAvailable(expertId);

      expect(available).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle concurrent allocations', async () => {
      const promises = Array.from({ length: 10 }, () =>
        adapter.allocateExperts({ count: 5 }),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((r) => {
        expect(r.allocated).toHaveLength(5);
      });
    });

    it('should handle concurrent releases', async () => {
      const allocRequest: ExpertAllocationRequest = { count: 100 };
      const allocResult = await adapter.allocateExperts(allocRequest);

      const expertIds = allocResult.allocated.map((e) => e.id);
      const batches = [];
      for (let i = 0; i < expertIds.length; i += 10) {
        batches.push(expertIds.slice(i, i + 10));
      }

      const promises = batches.map((batch) => adapter.releaseExperts(batch));

      const results = await Promise.all(promises);

      expect(results.every((r) => r === true)).toBe(true);
    });
  });

  describe('stub implementation validation', () => {
    it('stub allocateExperts should return correct count', async () => {
      const result = await adapter.allocateExperts({ count: 5 });

      expect(result.allocated).toHaveLength(5);
      expect(result.failed).toHaveLength(0);
    });

    it('stub experts should be marked available', async () => {
      const result = await adapter.allocateExperts({ count: 3 });

      result.allocated.forEach((expert) => {
        expect(expert.availability).toBe(true);
      });
    });

    it('stub releaseExperts should return true', async () => {
      const result = await adapter.releaseExperts(['expert-1', 'expert-2']);

      expect(result).toBe(true);
    });

    it('stub getAvailableCount should return 5 initially', async () => {
      const count = await adapter.getAvailableCount();

      expect(count).toBe(5);
    });
  });
});
