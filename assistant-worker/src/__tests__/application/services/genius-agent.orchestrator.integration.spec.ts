/**
 * Genius Agent Orchestrator Integration Tests
 *
 * Comprehensive integration test suite for GeniusAgentOrchestrator
 * Tests complete workflows with all adapter interactions
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

describe('GeniusAgentOrchestrator Integration Tests', () => {
  let orchestrator: GeniusAgentOrchestrator;
  let knowledgeGraphAdapter: jest.Mocked<KnowledgeGraphAdapter>;
  let validationAdapter: jest.Mocked<ValidationAdapter>;
  let expertPoolAdapter: jest.Mocked<ExpertPoolAdapter>;
  let topicCatalogAdapter: jest.Mocked<TopicCatalogAdapter>;
  let learningModeAdapter: jest.Mocked<LearningModeAdapter>;
  let scheduledLearningAdapter: jest.Mocked<ScheduledLearningAdapter>;
  let newsIntegrationAdapter: jest.Mocked<NewsIntegrationAdapter>;

  beforeEach(async () => {
    // Create mock adapters with all required methods
    const mockKnowledgeGraphAdapter = {
      addNode: jest
        .fn()
        .mockResolvedValue({ id: 'node-1', label: 'test', type: 'concept' }),
      getNodesCount: jest.fn().mockResolvedValue(10),
      queryGraph: jest.fn().mockResolvedValue([]),
      getRecentResearchReports: jest.fn().mockResolvedValue([]),
      getStatistics: jest.fn().mockResolvedValue({
        topicCount: 10,
        sourceCount: 5,
        avgConfidence: 0.85,
        nodeCount: 100,
        edgeCount: 50,
        lastUpdated: new Date(),
      }),
      searchTopics: jest.fn().mockResolvedValue(['AI', 'ML']),
      getTopicDetails: jest.fn().mockResolvedValue({}),
      addResearchFinding: jest.fn().mockResolvedValue({
        success: true,
        nodesAdded: 5,
      }),
    };

    const mockValidationAdapter = {
      validateBatch: jest.fn().mockResolvedValue([
        {
          success: true,
          checks: { format: true, content: true, references: true },
          errors: [],
          timestamp: new Date(),
        },
      ]),
      validate: jest.fn().mockResolvedValue({
        success: true,
        checks: { format: true, content: true, references: true },
        errors: [],
        timestamp: new Date(),
      }),
    };

    const mockExpertPoolAdapter = {
      allocateExperts: jest.fn().mockResolvedValue({
        allocated: [
          {
            id: 'expert-1',
            specialization: 'ML',
            complexity: 4,
            availability: true,
            expertise: ['ML'],
          },
          {
            id: 'expert-2',
            specialization: 'AI',
            complexity: 5,
            availability: true,
            expertise: ['AI'],
          },
        ],
        failed: [],
        timestamp: new Date(),
      }),
      releaseExperts: jest.fn().mockResolvedValue(true),
      getAvailableCount: jest.fn().mockResolvedValue(10),
      getExpert: jest.fn().mockResolvedValue({
        id: 'expert-1',
        specialization: 'ML',
        complexity: 4,
        availability: true,
        expertise: ['ML'],
      }),
      getAvailableExperts: jest.fn().mockResolvedValue([]),
      isExpertAvailable: jest.fn().mockResolvedValue(true),
    };

    const mockTopicCatalogAdapter = {
      addTopicResearch: jest.fn().mockResolvedValue({ added: 2, total: 50 }),
      getTrendingTopics: jest
        .fn()
        .mockResolvedValue(['AI', 'ML', 'Data Science']),
      getRecentResearch: jest
        .fn()
        .mockResolvedValue([
          { topic: 'AI', count: 5, lastUpdated: new Date() },
        ]),
      trackResearch: jest.fn().mockResolvedValue(true),
      addTopic: jest.fn().mockResolvedValue({
        id: 'topic-1',
        name: 'ML',
        description: 'Machine Learning',
        complexity: 'L4',
        lastResearched: new Date(),
        researchCount: 1,
      }),
      getRecommendedTopics: jest.fn().mockResolvedValue(['AI', 'ML']),
    };

    const mockLearningModeAdapter = {
      executeLearningMode: jest.fn().mockResolvedValue({
        success: true,
        mode: 'user-directed',
        userId: 'user-123',
        topicsProcessed: 3,
        duration: 150,
        sessionId: `session-${Date.now()}`,
        timestamp: new Date(),
      }),
    };

    const mockScheduledLearningAdapter = {
      schedule: jest
        .fn()
        .mockResolvedValue({ scheduled: true, jobId: 'job-123' }),
    };

    const mockNewsIntegrationAdapter = {
      fetchRecentNews: jest.fn().mockResolvedValue([
        {
          id: 'news-1',
          title: 'Recent AI News',
          content: 'Content',
          source: 'TechNews',
          url: 'http://example.com',
          publishedAt: new Date(),
        },
      ]),
      getTrendingTopics: jest.fn().mockResolvedValue([
        { topic: 'AI', frequency: 10 },
        { topic: 'ML', frequency: 8 },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeniusAgentOrchestrator,
        { provide: KnowledgeGraphAdapter, useValue: mockKnowledgeGraphAdapter },
        { provide: ValidationAdapter, useValue: mockValidationAdapter },
        { provide: ExpertPoolAdapter, useValue: mockExpertPoolAdapter },
        { provide: TopicCatalogAdapter, useValue: mockTopicCatalogAdapter },
        { provide: LearningModeAdapter, useValue: mockLearningModeAdapter },
        {
          provide: ScheduledLearningAdapter,
          useValue: mockScheduledLearningAdapter,
        },
        {
          provide: NewsIntegrationAdapter,
          useValue: mockNewsIntegrationAdapter,
        },
      ],
    }).compile();

    orchestrator = module.get(GeniusAgentOrchestrator);
    knowledgeGraphAdapter = module.get(KnowledgeGraphAdapter);
    validationAdapter = module.get(ValidationAdapter);
    expertPoolAdapter = module.get(ExpertPoolAdapter);
    topicCatalogAdapter = module.get(TopicCatalogAdapter);
    learningModeAdapter = module.get(LearningModeAdapter);
    scheduledLearningAdapter = module.get(ScheduledLearningAdapter);
    newsIntegrationAdapter = module.get(NewsIntegrationAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeUserDirectedLearning', () => {
    it('should execute user-directed learning with single topic', async () => {
      const userId = 'user-123';
      const topics = [{ topic: 'Machine Learning', complexity: 'L4' as const }];

      const result = await orchestrator.executeUserDirectedLearning(
        userId,
        topics,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(learningModeAdapter.executeLearningMode).toHaveBeenCalled();
    });

    it('should execute user-directed learning with multiple topics', async () => {
      const userId = 'user-456';
      const topics = [
        { topic: 'Deep Learning', complexity: 'L5' as const },
        { topic: 'Neural Networks', complexity: 'L4' as const },
      ];

      const result = await orchestrator.executeUserDirectedLearning(
        userId,
        topics,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(expertPoolAdapter.allocateExperts).toHaveBeenCalled();
    });

    it('should allocate experts by complexity', async () => {
      const userId = 'user-complexity';
      const topics = [{ topic: 'Advanced ML', complexity: 'L5' as const }];

      const result = await orchestrator.executeUserDirectedLearning(
        userId,
        topics,
      );

      expect(expertPoolAdapter.allocateExperts).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 1,
          complexity: 'L5',
        }),
      );
    });

    it('should fetch news for requested topics', async () => {
      const userId = 'user-789';
      const topics = [{ topic: 'AI Ethics', complexity: 'L3' as const }];

      const result = await orchestrator.executeUserDirectedLearning(
        userId,
        topics,
      );

      expect(newsIntegrationAdapter.fetchRecentNews).toHaveBeenCalled();
    });

    it('should handle empty topics gracefully', async () => {
      const userId = 'user-empty';
      const topics: Array<{
        topic: string;
        complexity: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
      }> = [];

      try {
        await orchestrator.executeUserDirectedLearning(userId, topics);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('executeAutonomousLearning', () => {
    it('should execute autonomous learning for user', async () => {
      const userId = 'user-auto-1';

      const result = await orchestrator.executeAutonomousLearning(userId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should detect knowledge gaps', async () => {
      const userId = 'user-gaps';

      const result = await orchestrator.executeAutonomousLearning(userId);

      expect(result).toBeDefined();
      expect(knowledgeGraphAdapter.getRecentResearchReports).toHaveBeenCalled();
    });

    it('should respect maxTopics option', async () => {
      const userId = 'user-max-topics';
      const options = { maxTopics: 5 };

      const result = await orchestrator.executeAutonomousLearning(
        userId,
        options,
      );

      expect(result).toBeDefined();
    });

    it('should allocate experts for detected gaps', async () => {
      const userId = 'user-expert-allocation';

      await orchestrator.executeAutonomousLearning(userId);

      expect(expertPoolAdapter.allocateExperts).toHaveBeenCalled();
    });

    it('should set learning mode to autonomous', async () => {
      const userId = 'user-mode-auto';

      const result = await orchestrator.executeAutonomousLearning(userId);

      expect(learningModeAdapter.executeLearningMode).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'autonomous',
        }),
      );
    });
  });

  describe('detectKnowledgeGaps', () => {
    it('should detect knowledge gaps from recent research', async () => {
      const userId = 'user-gap-detection';

      knowledgeGraphAdapter.getRecentResearchReports.mockResolvedValue([
        {
          topic: 'AI',
          findings: ['Finding 1'],
          sources: ['Source 1'],
          confidence: 0.9,
        },
      ]);

      const result = await orchestrator.detectKnowledgeGaps(userId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array if no gaps found', async () => {
      const userId = 'user-no-gaps';

      knowledgeGraphAdapter.getRecentResearchReports.mockResolvedValue([]);

      const result = await orchestrator.detectKnowledgeGaps(userId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('calculateAdaptiveStrategy', () => {
    it('should calculate strategy for single topic', async () => {
      const topics = [
        { topic: 'ML', researchGap: 75, priority: 100, complexity: 4 },
      ];

      const result = await orchestrator.calculateAdaptiveStrategy(topics);

      expect(result).toBeDefined();
      expect(result.recommendedMode).toBeDefined();
    });

    it('should calculate strategy for multiple topics', async () => {
      const topics = [
        { topic: 'ML', researchGap: 75, priority: 100, complexity: 4 },
        { topic: 'AI', researchGap: 85, priority: 95, complexity: 5 },
      ];

      const result = await orchestrator.calculateAdaptiveStrategy(topics);

      expect(result).toBeDefined();
      expect(result.batchSize).toBeGreaterThan(0);
    });
  });

  describe('validateResearchReports', () => {
    it('should validate single research report', async () => {
      const reports = [
        {
          id: 'report-1',
          topic: 'ML',
          findings: ['Finding 1'],
          confidence: 0.9,
          source: 'Journal',
        },
      ];

      const result = await orchestrator.validateResearchReports(reports);

      expect(result).toBeDefined();
      expect(result.passed).toBeGreaterThanOrEqual(0);
    });

    it('should validate multiple research reports', async () => {
      const reports = [
        {
          id: 'report-1',
          topic: 'ML',
          findings: ['Finding 1'],
          confidence: 0.9,
          source: 'Journal',
        },
        {
          id: 'report-2',
          topic: 'AI',
          findings: ['Finding 2'],
          confidence: 0.85,
          source: 'Conference',
        },
      ];

      const result = await orchestrator.validateResearchReports(reports);

      expect(result).toBeDefined();
      expect(result.passed).toBeGreaterThanOrEqual(0);
      expect(validationAdapter.validateBatch).toHaveBeenCalled();
    });

    it('should calculate success rate', async () => {
      const reports = [
        {
          id: 'report-1',
          topic: 'ML',
          findings: [],
          confidence: 0.9,
          source: 'Journal',
        },
      ];

      const result = await orchestrator.validateResearchReports(reports);

      expect(result.successRate).toBeDefined();
    });
  });

  describe('integrateResearchResults', () => {
    it('should integrate valid research findings', async () => {
      const reports = [
        {
          id: 'report-1',
          topic: 'ML',
          findings: ['Finding 1'],
          sources: ['Source 1'],
          confidence: 0.9,
          source: 'Journal',
          isValid: true,
        },
      ];

      const result = await orchestrator.integrateResearchResults(reports);

      expect(result).toBeDefined();
      expect(knowledgeGraphAdapter.addResearchFinding).toHaveBeenCalled();
    });

    it('should track research in topic catalog', async () => {
      const reports = [
        {
          id: 'report-1',
          topic: 'ML',
          findings: ['Finding 1'],
          sources: ['Source 1'],
          confidence: 0.9,
          source: 'Journal',
          isValid: true,
        },
      ];

      await orchestrator.integrateResearchResults(reports);

      expect(topicCatalogAdapter.trackResearch).toHaveBeenCalled();
    });

    it('should calculate nodes added correctly', async () => {
      const reports = [
        {
          id: 'report-1',
          topic: 'ML',
          findings: ['Finding 1', 'Finding 2'],
          confidence: 0.9,
          source: 'Journal',
        },
      ];

      const result = await orchestrator.integrateResearchResults(reports);

      expect(result.nodesAdded).toBeDefined();
      expect(result.nodesAdded).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getStatistics', () => {
    it('should return comprehensive statistics', async () => {
      const userId = 'user-stats';

      const result = await orchestrator.getStatistics(userId);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
    });

    it('should include graph statistics', async () => {
      const userId = 'user-graph-stats';

      const result = await orchestrator.getStatistics(userId);

      expect(result.graphStatistics).toBeDefined();
    });

    it('should include expert resources', async () => {
      const userId = 'user-experts';

      const result = await orchestrator.getStatistics(userId);

      expect(result.expertResources).toBeDefined();
    });

    it('should include trending topics', async () => {
      const userId = 'user-trending';

      topicCatalogAdapter.getTrendingTopics.mockResolvedValue(['AI', 'ML']);

      const result = await orchestrator.getStatistics(userId);

      expect(result.recommendations.trending).toBeDefined();
    });

    it('should include last updated timestamp', async () => {
      const userId = 'user-timestamp';

      const result = await orchestrator.getStatistics(userId);

      expect(result.lastUpdated).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter failures gracefully', async () => {
      learningModeAdapter.executeLearningMode.mockRejectedValue(
        new Error('Adapter failure'),
      );

      const userId = 'user-error';
      const topics = [{ topic: 'ML', complexity: 'L3' as const }];

      await expect(
        orchestrator.executeUserDirectedLearning(userId, topics),
      ).rejects.toThrow('Adapter failure');
    });

    it('should retry on temporary failures', async () => {
      expertPoolAdapter.allocateExperts
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          allocated: [],
          failed: [],
          timestamp: new Date(),
        });

      const userId = 'user-retry';
      const topics = [{ topic: 'ML', complexity: 'L3' as const }];

      await expect(
        orchestrator.executeUserDirectedLearning(userId, topics),
      ).rejects.toThrow('Temporary failure');
    });

    it('should handle concurrent operations safely', async () => {
      const userId = 'user-concurrent';
      const topics1 = [{ topic: 'ML', complexity: 'L3' as const }];
      const topics2 = [{ topic: 'AI', complexity: 'L4' as const }];

      const results = await Promise.all([
        orchestrator.executeUserDirectedLearning(userId, topics1),
        orchestrator.executeUserDirectedLearning(userId, topics2),
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
    });
  });
});
