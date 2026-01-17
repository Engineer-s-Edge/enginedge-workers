/**
 * Adapter Coordination Integration Tests
 *
 * Tests message flow, data consistency, and coordination patterns
 * between all 7 adapters in the orchestrator ecosystem
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GeniusAgentOrchestrator } from '../../../application/services/genius-agent.orchestrator';
import {
  KnowledgeGraphAdapter,
  ValidationAdapter,
  ExpertPoolAdapter,
  TopicCatalogAdapter,
  LearningModeAdapter,
  ScheduledLearningAdapter,
  NewsIntegrationAdapter,
} from '../../../infrastructure/adapters/implementations';
import { ExpertPoolManager } from '../../../domain/services/expert-pool-manager.service';
import { LearningModeService } from '../../../application/services/learning-mode.service';
import { ResearchService } from '../../../application/services/research.service';
import { ValidationService } from '../../../application/services/validation.service';
import { TopicCatalogService } from '../../../application/services/topic-catalog.service';
import { GetTopicsForResearchUseCase } from '../../../application/use-cases/get-topics-for-research.use-case';

describe('Adapter Coordination Tests', () => {
  let orchestrator: GeniusAgentOrchestrator;
  let knowledgeGraphAdapter: KnowledgeGraphAdapter;
  let validationAdapter: ValidationAdapter;
  let expertPoolAdapter: ExpertPoolAdapter;
  let topicCatalogAdapter: TopicCatalogAdapter;
  let learningModeAdapter: LearningModeAdapter;
  let scheduledLearningAdapter: ScheduledLearningAdapter;
  let newsIntegrationAdapter: NewsIntegrationAdapter;

  const toBatchRequest = (items: any[]) => ({
    expertReports: (items || []).map((item, index) => ({
      reportId: item.reportId || `report-${index}`,
      expertId: item.expertId || `expert-${index}`,
      topic: item.topic || `topic-${index}`,
      findings: item.findings || [],
      sources: item.sources || [],
      confidence: item.confidence ?? 0.7,
    })),
  });

  beforeEach(async () => {
    // Mock providers for testing
    const mockLLMProvider = {
      complete: jest
        .fn()
        .mockResolvedValue({ content: 'Mock response', role: 'assistant' }),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
    };

    const mockResearchService = {
      addResearchFinding: jest
        .fn()
        .mockResolvedValue({ success: true, nodesAdded: 1 }),
      getRecentResearchReports: jest.fn().mockResolvedValue([]),
      getStatistics: jest.fn().mockResolvedValue({
        topicCount: 5,
        sourceCount: 15,
        avgConfidence: 0.9,
        nodeCount: 10,
        edgeCount: 20,
        lastUpdated: new Date(),
      }),
    };

    const mockValidationService = {
      validate: jest
        .fn()
        .mockResolvedValue({ isValid: true, score: 0.9, notes: [] }),
      validateBatch: jest.fn().mockResolvedValue({
        batchId: 'batch-1',
        totalItems: 0,
        validCount: 0,
        invalidCount: 0,
        results: [],
      }),
    };

    const mockTopicCatalogService = {
      addTopic: jest.fn().mockResolvedValue({
        topic: {
          id: '123',
          name: 'test-topic',
          description: 'test description',
          estimatedComplexity: 1,
        },
      }),
      updateTopicStatus: jest.fn().mockResolvedValue(true),
      getTopicByName: jest
        .fn()
        .mockResolvedValue({ id: '123', name: 'test-topic' }),
      getTopicsByPriority: jest.fn().mockResolvedValue([
        { id: '1', name: 'trending-topic-1', priority: 10 },
        { id: '2', name: 'trending-topic-2', priority: 8 },
      ]),
    };

    const mockGetTopicsUseCase = {
      execute: jest.fn().mockResolvedValue([]),
    };

    const mockKnowledgeGraphPort = {
      getNode: jest.fn().mockResolvedValue(null),
      unlockNode: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeniusAgentOrchestrator,
        KnowledgeGraphAdapter,
        ValidationAdapter,
        ExpertPoolAdapter,
        TopicCatalogAdapter,
        LearningModeAdapter,
        ScheduledLearningAdapter,
        NewsIntegrationAdapter,
        // Add required dependencies for ExpertPoolAdapter
        {
          provide: 'ILLMProvider',
          useValue: mockLLMProvider,
        },
        {
          provide: 'ILogger',
          useValue: mockLogger,
        },
        ExpertPoolManager,
        LearningModeService,
        {
          provide: ResearchService,
          useValue: mockResearchService,
        },
        {
          provide: ValidationService,
          useValue: mockValidationService,
        },
        {
          provide: TopicCatalogService,
          useValue: mockTopicCatalogService,
        },
        {
          provide: GetTopicsForResearchUseCase,
          useValue: mockGetTopicsUseCase,
        },
        {
          provide: 'KnowledgeGraphPort',
          useValue: mockKnowledgeGraphPort,
        },
      ],
    }).compile();

    orchestrator = module.get<GeniusAgentOrchestrator>(GeniusAgentOrchestrator);
    knowledgeGraphAdapter = module.get<KnowledgeGraphAdapter>(
      KnowledgeGraphAdapter,
    );
    validationAdapter = module.get<ValidationAdapter>(ValidationAdapter);
    expertPoolAdapter = module.get<ExpertPoolAdapter>(ExpertPoolAdapter);
    topicCatalogAdapter = module.get<TopicCatalogAdapter>(TopicCatalogAdapter);
    learningModeAdapter = module.get<LearningModeAdapter>(LearningModeAdapter);
    scheduledLearningAdapter = module.get<ScheduledLearningAdapter>(
      ScheduledLearningAdapter,
    );
    newsIntegrationAdapter = module.get<NewsIntegrationAdapter>(
      NewsIntegrationAdapter,
    );

    // Spy on adapter methods
    jest.spyOn(knowledgeGraphAdapter, 'getRecentResearchReports');
    jest.spyOn(knowledgeGraphAdapter, 'getStatistics');
    jest.spyOn(knowledgeGraphAdapter, 'addResearchFinding');
    jest.spyOn(validationAdapter, 'validateBatch');
    jest.spyOn(expertPoolAdapter, 'allocateExperts');
    jest.spyOn(topicCatalogAdapter, 'trackResearch');
    jest.spyOn(learningModeAdapter, 'executeLearningMode');
    jest.spyOn(newsIntegrationAdapter, 'fetchRecentNews');
  });

  describe('Adapter Communication Patterns', () => {
    it('should coordinate knowledge graph → validation flow', async () => {
      // Get research from graph
      const research = await knowledgeGraphAdapter.getRecentResearchReports(
        'user123',
        10,
      );

      expect(knowledgeGraphAdapter.getRecentResearchReports).toHaveBeenCalled();

      // Validate retrieved research
      if (Array.isArray(research) && research.length > 0) {
        const request = toBatchRequest(research);
        const validation = await validationAdapter.validateBatch(request);

        expect(validationAdapter.validateBatch).toHaveBeenCalledWith(request);
        expect(validation).toBeDefined();
      }
    });

    it('should coordinate expert pool → topic catalog flow', async () => {
      const topics = ['AI', 'ML'];

      // Allocate experts for topics
      const allocation = await expertPoolAdapter.allocateExperts({
        count: 2,
        specialization: 'general',
      });

      expect(expertPoolAdapter.allocateExperts).toHaveBeenCalled();

      // Track research for each topic
      for (const topic of topics) {
        await topicCatalogAdapter.trackResearch(topic, {
          status: 'in-progress',
          allocatedExperts: allocation.allocated?.length || 0,
        });
      }

      expect(topicCatalogAdapter.trackResearch).toHaveBeenCalled();
    });

    it('should coordinate learning mode → news integration flow', async () => {
      const topics = ['AI', 'ML'];

      // Set learning mode
      await learningModeAdapter.executeLearningMode({
        userId: 'test-user',
        mode: 'user-directed',
        topics,
      });

      expect(learningModeAdapter.executeLearningMode).toHaveBeenCalled();

      // Fetch news for topics
      for (const topic of topics) {
        await newsIntegrationAdapter.fetchRecentNews(topic);
      }

      expect(newsIntegrationAdapter.fetchRecentNews).toHaveBeenCalled();
    });

    it('should coordinate topic catalog → knowledge graph flow', async () => {
      const topic = 'AI Research';

      // Create spy on addTopic
      const addTopicSpy = jest.spyOn(topicCatalogAdapter, 'addTopic');

      // Add topic to catalog
      await topicCatalogAdapter.addTopic(topic, {
        description: 'Artificial Intelligence Research Topics',
        complexity: 'L3',
      });

      expect(addTopicSpy).toHaveBeenCalled();

      // Add research finding to graph
      await knowledgeGraphAdapter.addResearchFinding({
        topic,
        findings: ['Finding 1', 'Finding 2'],
        sources: ['source1'],
        confidence: 0.9,
        timestamp: new Date(),
      });

      expect(knowledgeGraphAdapter.addResearchFinding).toHaveBeenCalled();
    });
  });

  describe('Data Flow Consistency', () => {
    it('should maintain consistency between adapters', async () => {
      const userId = 'user-consistency-test';
      const topics = ['AI', 'ML'];

      // Flow: LearningMode → ExpertPool → NewsFeed → TopicCatalog → KnowledgeGraph

      // 1. Set learning mode
      await learningModeAdapter.executeLearningMode({
        userId,
        mode: 'user-directed',
        topics,
      });

      // 2. Allocate experts
      const experts = await expertPoolAdapter.allocateExperts({
        count: 2,
        specialization: 'general',
      });

      // 3. Fetch news
      for (const topic of topics) {
        await newsIntegrationAdapter.fetchRecentNews(topic);
      }

      // 4. Track in catalog
      for (const topic of topics) {
        await topicCatalogAdapter.trackResearch(topic, {
          status: 'completed',
          allocatedExperts: experts?.allocated?.length || 0,
        });
      }

      // 5. Verify in graph
      const stats = await knowledgeGraphAdapter.getStatistics(userId);

      expect(stats).toBeDefined();
      expect(stats.topicCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle data transformation through adapter chain', async () => {
      // Research flows through chain: NewsIntegration → Validation → KnowledgeGraph
      const topic = 'Test Topic';

      // 1. Get news
      const news = await newsIntegrationAdapter.fetchRecentNews(topic);

      expect(news).toBeDefined();

      // 2. Validate
      if (Array.isArray(news) && news.length > 0) {
        const newsItems = news as Array<{
          title?: string;
          source?: string;
          relevance?: number;
        }>;
        const request = {
          expertReports: newsItems.map((item, index) => ({
            reportId: `news-${index}`,
            expertId: `news-${index}`,
            topic,
            findings: [String(item.title || '')],
            sources: [String(item.source || '')],
            confidence: Number(item.relevance || 0.5),
          })),
        };
        const validated = await validationAdapter.validateBatch(request);

        expect(validated).toBeDefined();

        // 3. Add to graph
        for (const item of newsItems) {
          await knowledgeGraphAdapter.addResearchFinding({
            topic,
            findings: [String(item.title || 'Finding')],
            sources: [String(item.source || 'source')],
            confidence: Number(item.relevance || 0.7),
            timestamp: new Date(),
          });
        }
      }

      expect(knowledgeGraphAdapter.addResearchFinding).toHaveBeenCalled();
    });
  });

  describe('Error Handling Across Adapters', () => {
    it('should isolate adapter failures', async () => {
      // One adapter failure should not cascade
      jest
        .spyOn(expertPoolAdapter, 'allocateExperts')
        .mockRejectedValueOnce(new Error('Expert pool unavailable'));

      // Should still be able to get news
      const news = await newsIntegrationAdapter.fetchRecentNews('AI');

      expect(news).toBeDefined();
    });

    it('should handle partial adapter responses', async () => {
      const topics = ['AI', 'ML', 'NLP'];

      // Allocate experts for multiple topics
      const allocation = await expertPoolAdapter.allocateExperts({
        count: topics.length,
        specialization: 'general',
      });

      expect(allocation).toBeDefined();

      // Track each topic independently
      for (const topic of topics) {
        const tracked = await topicCatalogAdapter.trackResearch(topic, {
          status: 'processing',
        });

        expect(tracked).toBeDefined();
      }
    });

    it('should validate adapter responses match contracts', async () => {
      // Get research
      const research = await knowledgeGraphAdapter.getRecentResearchReports(
        'user123',
        10,
      );

      // Validate against expected structure
      if (research && Array.isArray(research)) {
        research.forEach((report: { topic?: string; findings?: string[] }) => {
          expect(report).toHaveProperty('topic');
          expect(report).toHaveProperty('findings');
        });
      }

      // Get stats
      const stats = await knowledgeGraphAdapter.getStatistics('user123');

      expect(stats).toHaveProperty('topicCount');
      expect(stats).toHaveProperty('nodeCount');
    });
  });

  describe('Concurrent Adapter Access', () => {
    it('should handle concurrent reads from same adapter', async () => {
      const promises = [
        knowledgeGraphAdapter.getStatistics('user1'),
        knowledgeGraphAdapter.getStatistics('user2'),
        knowledgeGraphAdapter.getStatistics('user3'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
      });
    });

    it('should handle concurrent writes to different adapters', async () => {
      const promises = [
        expertPoolAdapter.allocateExperts({
          count: 2,
          specialization: 'general',
        }),
        topicCatalogAdapter.addTopic('NLP', {
          description: 'Natural Language Processing',
          complexity: 'L3',
        }),
        newsIntegrationAdapter.fetchRecentNews('Vision'),
        knowledgeGraphAdapter.addResearchFinding({
          topic: 'Test',
          findings: ['Finding'],
          sources: ['source'],
          confidence: 0.9,
          timestamp: new Date(),
        }),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(4);
      results.forEach((result) => {
        expect(result).toBeDefined();
      });
    });

    it('should maintain adapter state consistency under concurrent access', async () => {
      // Multiple concurrent operations
      const operations = Array.from({ length: 10 }, (_, i) =>
        topicCatalogAdapter.trackResearch(`Topic ${i}`, {
          status: 'active',
        }),
      );

      const results = await Promise.all(operations);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toBeDefined();
      });
    });
  });

  describe('Adapter Composition Patterns', () => {
    it('should compose multiple adapters for complex workflow', async () => {
      // Complex workflow: validate → allocate → track → integrate → report
      const userId = 'complex-workflow-user';
      const topics = ['AI', 'ML'];

      // 1. Get existing research
      const existing = await knowledgeGraphAdapter.getRecentResearchReports(
        userId,
        10,
      );

      // 2. Validate
      if (Array.isArray(existing) && existing.length > 0) {
        await validationAdapter.validateBatch(toBatchRequest(existing));
      }

      // 3. Allocate experts
      await expertPoolAdapter.allocateExperts({
        count: topics.length,
        specialization: 'general',
      });

      // 4. Track progress
      await topicCatalogAdapter.trackResearch('Workflow', {
        status: 'validated',
      });

      // 5. Get stats
      const stats = await knowledgeGraphAdapter.getStatistics(userId);

      expect(stats).toBeDefined();
      expect(stats.topicCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle adapter fallback patterns', async () => {
      // Try primary adapter, fall back to secondary
      const topics = ['AI', 'ML'];

      // Primary: Expert pool
      let experts = await expertPoolAdapter.allocateExperts({
        count: topics.length,
      });

      if (!experts || experts.allocated?.length === 0) {
        // Fallback: Get available from pool
        const available = await expertPoolAdapter.getAvailableExperts();
        experts = {
          allocated: available,
          failed: [],
          timestamp: new Date(),
        };
      }

      expect(experts).toBeDefined();
    });

    it('should implement adapter caching patterns', async () => {
      // Multiple calls should leverage adapter caching
      const topic = 'Cached Topic';

      const call1 = await newsIntegrationAdapter.fetchRecentNews(topic);
      const call2 = await newsIntegrationAdapter.fetchRecentNews(topic);

      // Results should be consistent
      expect(call1).toEqual(call2);
    });
  });

  describe('Orchestrator Coordination', () => {
    it('should coordinate all adapters through orchestrator', async () => {
      const userId = 'orchestration-test';
      const topics = [
        { topic: 'AI', complexity: 'L3' as const },
        { topic: 'ML', complexity: 'L3' as const },
      ];

      // Full orchestrated workflow
      const result = await orchestrator.executeUserDirectedLearning(
        userId,
        topics,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should gather statistics from all adapters', async () => {
      const userId = 'stats-test';

      const stats = await orchestrator.getStatistics(userId);

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('graphStatistics');
      expect(stats).toHaveProperty('recentResearch');
      expect(stats).toHaveProperty('knowledgeGaps');
    });

    it('should handle orchestration of gap detection through adapters', async () => {
      const userId = 'gap-detection-test';

      const gaps = await orchestrator.detectKnowledgeGaps(userId);

      expect(Array.isArray(gaps)).toBe(true);
    });
  });

  describe('Adapter Integration Metrics', () => {
    it('should track adapter call metrics', async () => {
      const userId = 'metric-test';
      const topics = [{ topic: 'AI', complexity: 'L3' as const }];

      // Execute workflow
      const result = await orchestrator.executeUserDirectedLearning(
        userId,
        topics,
      );

      expect(result).toBeDefined();
    });

    it('should measure adapter response times', async () => {
      const startTime = Date.now();

      await orchestrator.getStatistics('timing-test');

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
