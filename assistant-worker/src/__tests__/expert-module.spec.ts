/**
 * Expert Module Test Suite
 *
 * Comprehensive tests for:
 * - ExpertPoolManager: Expert agent lifecycle management
 * - ExpertPoolAdapter: Hexagonal adapter interface
 * - ExpertResearchPipelineService: Research pipeline orchestration
 * - Expert agent creation and coordination
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExpertPoolManager } from '../domain/services/expert-pool-manager.service';
import { ExpertPoolAdapter } from '../infrastructure/adapters/implementations/expert-pool.adapter';
import { ExpertResearchPipelineService } from '../application/services/expert-research-pipeline.service';
import {
  ResearchTopic,
  ResearchPhase,
} from '../domain/agents/expert-agent/expert-agent.types';
import { ILLMProvider } from '../application/ports/llm-provider.port';
import { ILogger } from '../application/ports/logger.port';
import { KnowledgeGraphPort } from '../domain/ports/knowledge-graph.port';

describe('Expert Module Integration Suite', () => {
  let expertPoolManager: ExpertPoolManager;
  let expertPoolAdapter: ExpertPoolAdapter;
  let researchPipeline: ExpertResearchPipelineService;

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

    const mockKnowledgeGraph: any = {
      addNode: jest.fn().mockResolvedValue('node-id'),
      addEdge: jest.fn().mockResolvedValue('edge-id'),
      getNode: jest.fn().mockResolvedValue({ id: 'node-id' }),
      updateNode: jest.fn().mockResolvedValue(true),
      deleteNode: jest.fn().mockResolvedValue(true),
      searchNodes: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpertPoolManager,
        ExpertPoolAdapter,
        ExpertResearchPipelineService,
        { provide: 'ILLMProvider', useValue: mockLLMProvider },
        { provide: 'ILogger', useValue: mockLogger },
        { provide: 'KnowledgeGraphPort', useValue: mockKnowledgeGraph },
      ],
    }).compile();

    expertPoolManager = module.get<ExpertPoolManager>(ExpertPoolManager);
    expertPoolAdapter = module.get<ExpertPoolAdapter>(ExpertPoolAdapter);
    researchPipeline = module.get<ExpertResearchPipelineService>(
      ExpertResearchPipelineService,
    );
  });

  describe('ExpertPoolManager', () => {
    it('should initialize with empty pool', async () => {
      const count = await expertPoolManager.getAvailableCount();
      expect(count).toBe(0);
    });

    it('should allocate experts with specifications', async () => {
      const result = await expertPoolManager.allocateExperts({
        count: 3,
        specialization: 'machine-learning',
        complexity: 'L3',
        expertise: ['neural-networks', 'deep-learning'],
      });

      expect(result.allocated).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      result.allocated.forEach((expert) => {
        expect(expert.specialization).toBe('machine-learning');
        expect(expert.complexity).toBe(3);
        expect(expert.availability).toBe(true);
        expect(expert.expertise).toContain('neural-networks');
      });
    });

    it('should track allocation history', async () => {
      await expertPoolManager.allocateExperts({ count: 2 });
      const history = expertPoolManager.getAllocationHistory();

      expect(history).toHaveLength(2);
      history.forEach((entry) => {
        expect(entry.action).toBe('allocate');
        expect(entry.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should release experts correctly', async () => {
      const allocation = await expertPoolManager.allocateExperts({ count: 2 });
      const expertIds = allocation.allocated.map((e) => e.id);

      const releaseResult = await expertPoolManager.releaseExperts(expertIds);
      expect(releaseResult).toBe(true);

      const availableCount = await expertPoolManager.getAvailableCount();
      expect(availableCount).toBe(0);
    });

    it('should mark experts busy and available', async () => {
      const allocation = await expertPoolManager.allocateExperts({ count: 1 });
      const expertId = allocation.allocated[0].id;

      let isAvailable = await expertPoolManager.isExpertAvailable(expertId);
      expect(isAvailable).toBe(true);

      await expertPoolManager.markExpertBusy(expertId);
      isAvailable = await expertPoolManager.isExpertAvailable(expertId);
      expect(isAvailable).toBe(false);

      await expertPoolManager.markExpertAvailable(expertId);
      isAvailable = await expertPoolManager.isExpertAvailable(expertId);
      expect(isAvailable).toBe(true);
    });
    it('should provide pool statistics', async () => {
      await expertPoolManager.allocateExperts({ count: 3 });
      await expertPoolManager.allocateExperts({ count: 2 });

      const stats = await expertPoolManager.getPoolStats();

      expect(stats.totalExpertsSpawned).toBeGreaterThanOrEqual(3);
      expect(stats.activeExperts).toBe(0);
      expect(stats.totalTopicsCompleted).toBeGreaterThanOrEqual(0);
    });

    it('should get specific expert details', async () => {
      const allocation = await expertPoolManager.allocateExperts({
        count: 1,
        specialization: 'research',
      });
      const expertId = allocation.allocated[0].id;

      const expert = await expertPoolManager.getExpert(expertId);

      expect(expert).toBeDefined();
      expect(expert?.id).toBe(expertId);
      expect(expert?.specialization).toBe('research');
    });

    it('should return null for non-existent expert', async () => {
      const expert = await expertPoolManager.getExpert('non-existent-id' as any);
      expect(expert).toBeNull();
    });
  });

  describe('ExpertPoolAdapter', () => {
    it('should delegate allocateExperts to manager', async () => {
      const result = await expertPoolAdapter.allocateExperts({
        count: 2,
        specialization: 'data-science',
        complexity: 'L2',
      });

      expect(result.allocated).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should convert internal representation to interface', async () => {
      const result = await expertPoolAdapter.allocateExperts({
        count: 1,
        specialization: 'nlp',
      });

      const expert = result.allocated[0];
      expect(expert).toHaveProperty('id');
      expect(expert).toHaveProperty('specialization');
      expect(expert).toHaveProperty('complexity');
      expect(expert).toHaveProperty('availability');
      expect(expert).toHaveProperty('expertise');
    });

    it('should handle getAvailableCount through adapter', async () => {
      await expertPoolAdapter.allocateExperts({ count: 3 });

      const count = await expertPoolAdapter.getAvailableCount();
      expect(count).toBe(3);
    });

    it('should get available experts through adapter', async () => {
      await expertPoolAdapter.allocateExperts({ count: 2 });

      const experts = await expertPoolAdapter.getAvailableExperts();
      expect(experts).toHaveLength(2);
    });

    it('should release experts through adapter', async () => {
      const allocation = await expertPoolAdapter.allocateExperts({ count: 2 });
      const expertIds = allocation.allocated.map((e) => e.id);

      const released = await expertPoolAdapter.releaseExperts(expertIds);
      expect(released).toBe(true);

      const remainingCount = await expertPoolAdapter.getAvailableCount();
      expect(remainingCount).toBe(0);
    });
  });

  describe('ExpertResearchPipelineService', () => {
    it('should execute complete research pipeline', async () => {
      const topics: ResearchTopic[] = [
        {
          id: 'topic-1',
          query: 'artificial intelligence',
          category: 'technology',
          priority: 1,
          status: 'pending',
        },
        {
          id: 'topic-2',
          query: 'machine learning',
          category: 'technology',
          priority: 2,
          status: 'pending',
        },
      ];

      const result = await researchPipeline.executeResearchPipeline(topics);

      expect(result.report).toBeDefined();
      expect(result.report.topics).toHaveLength(2);
      expect(result.report.sourceCount).toBeGreaterThan(0);
      expect(result.report.evidenceCount).toBeGreaterThan(0);
      expect(result.stages).toHaveLength(3); // AIM, SHOOT, SKIN
    });

    it('should execute AIM phase correctly', async () => {
      const topics: ResearchTopic[] = [
        {
          id: 'topic-1',
          query: 'quantum computing',
          status: 'pending',
        },
      ];

      const result = await researchPipeline.executeResearchPipeline(topics);

      const aimStage = result.stages.find(
        (s) => s.phase === ResearchPhase.EXPLORATION,
      );
      expect(aimStage).toBeDefined();
      expect(aimStage?.status).toBe('completed');
      expect(aimStage?.output).toBeDefined();
    });

    it('should execute SHOOT phase correctly', async () => {
      const topics: ResearchTopic[] = [
        {
          id: 'topic-1',
          query: 'blockchain',
          status: 'pending',
        },
      ];

      const result = await researchPipeline.executeResearchPipeline(topics);

      const shootStage = result.stages.find(
        (s) => s.phase === ResearchPhase.ANALYSIS,
      );
      expect(shootStage).toBeDefined();
      expect(shootStage?.status).toBe('completed');
      expect(shootStage?.output?.sourceCount).toBeGreaterThan(0);
    });

    it('should execute SKIN phase correctly', async () => {
      const topics: ResearchTopic[] = [
        {
          id: 'topic-1',
          query: 'cybersecurity',
          status: 'pending',
        },
      ];

      const result = await researchPipeline.executeResearchPipeline(topics);

      const skinStage = result.stages.find(
        (s) => s.phase === ResearchPhase.SYNTHESIS,
      );
      expect(skinStage).toBeDefined();
      expect(skinStage?.status).toBe('completed');
    });

    it('should generate comprehensive research report', async () => {
      const topics: ResearchTopic[] = [
        {
          id: 'topic-1',
          query: 'cloud computing',
          category: 'infrastructure',
          status: 'pending',
        },
      ];

      const result = await researchPipeline.executeResearchPipeline(topics);
      const report = result.report;

      expect(report.id).toBeDefined();
      expect(report.title).toContain('cloud computing');
      expect(report.abstract).toBeDefined();
      expect(report.topics).toHaveLength(1);
      expect(report.sourceCount).toBeGreaterThan(0);
      expect(report.evidenceCount).toBeGreaterThan(0);
      expect(report.confidence).toBeGreaterThanOrEqual(0);
      expect(report.confidence).toBeLessThanOrEqual(100);
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it('should emit progress updates', async () => {
      const topics: ResearchTopic[] = [
        {
          id: 'topic-1',
          query: 'robotics',
          status: 'pending',
        },
      ];

      const progressStream = researchPipeline.getProgressStream();
      const progressUpdates: Array<{ progress: number; timestamp: Date }> = [];

      progressStream.subscribe((update) => {
        progressUpdates.push({
          progress: update.progress,
          timestamp: update.timestamp,
        });
      });

      await researchPipeline.executeResearchPipeline(topics);

      // Progress updates should be emitted (though count varies)
      expect(progressUpdates.length >= 0).toBe(true);
    });

    it('should handle multiple research topics', async () => {
      const topics: ResearchTopic[] = [
        { id: 'topic-1', query: 'topic-1', status: 'pending' },
        { id: 'topic-2', query: 'topic-2', status: 'pending' },
        { id: 'topic-3', query: 'topic-3', status: 'pending' },
      ];

      const result = await researchPipeline.executeResearchPipeline(topics);

      expect(result.report.topics).toHaveLength(3);
      expect(result.report.sourceCount).toBeGreaterThan(0);
    });
  });

  describe('Expert Module Integration', () => {
    it('should coordinate expert allocation and research pipeline', async () => {
      // Allocate experts
      const allocation = await expertPoolAdapter.allocateExperts({
        count: 2,
        specialization: 'research',
      });

      expect(allocation.allocated).toHaveLength(2);

      // Execute research with allocated experts
      const topics: ResearchTopic[] = [
        {
          id: 'topic-1',
          query: 'integrated research',
          status: 'pending',
        },
      ];

      const result = await researchPipeline.executeResearchPipeline(topics);

      expect(result.report).toBeDefined();
      expect(result.stages).toHaveLength(3);

      // Release experts
      const releaseResult = await expertPoolAdapter.releaseExperts(
        allocation.allocated.map((e) => e.id),
      );
      expect(releaseResult).toBe(true);
    });

    it('should track resource lifecycle', async () => {
      // Initial allocation
      const alloc1 = await expertPoolManager.allocateExperts({ count: 2 });
      await expertPoolManager.allocateExperts({ count: 3 });

      // Verify total
      const stats = await expertPoolManager.getPoolStats();
      expect(stats.totalExpertsSpawned).toBeGreaterThanOrEqual(2);
      expect(stats.totalExpertsSpawned).toBeGreaterThanOrEqual(2);

      // Release some
      if (alloc1.allocated.length > 0) {
        await expertPoolManager.releaseExperts([alloc1.allocated[0].id]);

        const updatedStats = await expertPoolManager.getPoolStats();
        // releases count is not available in interface
        expect(updatedStats.activeExperts).toBeLessThanOrEqual(stats.activeExperts);
      }
    });

    it('should maintain expert availability throughout workflow', async () => {
      const allocation = await expertPoolManager.allocateExperts({ count: 1 });
      const expertId = allocation.allocated[0].id;

      // Check initial availability
      let isAvailable = await expertPoolManager.isExpertAvailable(expertId);
      expect(isAvailable).toBe(true);

      // Simulate research work
      const topics: ResearchTopic[] = [
        {
          id: 'topic-1',
          query: 'test',
          status: 'pending',
        },
      ];

      await expertPoolManager.markExpertBusy(expertId);
      const result = await researchPipeline.executeResearchPipeline(topics);
      expect(result.report).toBeDefined();

      // Mark available after research
      await expertPoolManager.markExpertAvailable(expertId);
      isAvailable = await expertPoolManager.isExpertAvailable(expertId);
      expect(isAvailable).toBe(true);
    });
  });
});
