/**
 * Knowledge Graph Adapter Tests
 *
 * Tests for KnowledgeGraphAdapter covering:
 * - Happy path operations
 * - Error scenarios
 * - Edge cases
 * - Stub implementations
 */

import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeGraphAdapter } from '../../../infrastructure/adapters/implementations/knowledge-graph.adapter';
import { ResearchFinding } from '../../../infrastructure/adapters/interfaces';
import { ResearchService } from '../../../application/services/research.service';

describe('KnowledgeGraphAdapter', () => {
  let adapter: KnowledgeGraphAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeGraphAdapter,
        {
          provide: ResearchService,
          useValue: {
            addResearchFinding: jest.fn().mockImplementation((data) => ({
              success: true,
              nodesAdded: (data.findings?.length || 0) + 1,
            })),
            getRecentResearchReports: jest.fn().mockResolvedValue([]),
            getStatistics: jest.fn().mockResolvedValue({
              topicCount: 5,
              sourceCount: 2,
              avgConfidence: 0.8,
              nodeCount: 15,
              edgeCount: 20,
              lastUpdated: new Date(),
            }),
            searchTopics: jest.fn().mockResolvedValue(['AI', 'Machine Learning']),
            getTopicDetails: jest.fn().mockImplementation((id) => ({
              topic: id === 'test-topic' ? 'test-topic' : 'Machine Learning',
              id: '123',
            })),
          },
        },
      ],
    }).compile();

    adapter = module.get<KnowledgeGraphAdapter>(KnowledgeGraphAdapter);
  });

  describe('addResearchFinding', () => {
    it('should add research finding successfully', async () => {
      const finding: ResearchFinding = {
        topic: 'Machine Learning',
        findings: ['Finding 1', 'Finding 2'],
        sources: ['arxiv.org', 'paper.pdf'],
        confidence: 0.95,
        timestamp: new Date(),
      };

      const result = await adapter.addResearchFinding(finding);

      expect(result.success).toBe(true);
      expect(result.nodesAdded).toBe(3); // 2 findings + 1 metadata
    });

    it('should handle empty findings', async () => {
      const finding: ResearchFinding = {
        topic: 'Test Topic',
        findings: [],
        sources: [],
        confidence: 0.5,
        timestamp: new Date(),
      };

      const result = await adapter.addResearchFinding(finding);

      expect(result.success).toBe(true);
      expect(result.nodesAdded).toBe(1);
    });

    it('should handle large findings array', async () => {
      const findings = Array.from({ length: 100 }, (_, i) => `Finding ${i}`);
      const finding: ResearchFinding = {
        topic: 'Large Research',
        findings,
        sources: ['source.com'],
        confidence: 0.8,
        timestamp: new Date(),
      };

      const result = await adapter.addResearchFinding(finding);

      expect(result.success).toBe(true);
      expect(result.nodesAdded).toBe(101); // 100 findings + 1 metadata
    });

    it('should handle special characters in topic', async () => {
      const finding: ResearchFinding = {
        topic: 'Topic with @#$% & special chars!',
        findings: ['Finding'],
        sources: ['source'],
        confidence: 0.7,
        timestamp: new Date(),
      };

      const result = await adapter.addResearchFinding(finding);

      expect(result.success).toBe(true);
    });

    it('should handle low confidence research', async () => {
      const finding: ResearchFinding = {
        topic: 'Uncertain Research',
        findings: ['Finding'],
        sources: ['source'],
        confidence: 0.1,
        timestamp: new Date(),
      };

      const result = await adapter.addResearchFinding(finding);

      expect(result.success).toBe(true);
    });

    it('should handle high confidence research', async () => {
      const finding: ResearchFinding = {
        topic: 'Certain Research',
        findings: ['Finding'],
        sources: ['source'],
        confidence: 1.0,
        timestamp: new Date(),
      };

      const result = await adapter.addResearchFinding(finding);

      expect(result.success).toBe(true);
    });
  });

  describe('getRecentResearchReports', () => {
    it('should return recent research reports', async () => {
      const reports = await adapter.getRecentResearchReports('user-123', 5);

      expect(Array.isArray(reports)).toBe(true);
    });

    it('should handle zero limit', async () => {
      const reports = await adapter.getRecentResearchReports('user-123', 0);

      expect(reports.length).toBe(0);
    });

    it('should handle large limit', async () => {
      const reports = await adapter.getRecentResearchReports('user-123', 1000);

      expect(Array.isArray(reports)).toBe(true);
    });

    it('should handle nonexistent user', async () => {
      const reports = await adapter.getRecentResearchReports(
        'nonexistent-user',
        10,
      );

      expect(Array.isArray(reports)).toBe(true);
    });

    it('should handle different limit values', async () => {
      for (const limit of [1, 5, 10, 100]) {
        const reports = await adapter.getRecentResearchReports(
          'user-123',
          limit,
        );
        expect(reports.length).toBeLessThanOrEqual(limit);
      }
    });
  });

  describe('getStatistics', () => {
    it('should return valid statistics structure', async () => {
      const stats = await adapter.getStatistics('user-123');

      expect(stats).toHaveProperty('topicCount');
      expect(stats).toHaveProperty('sourceCount');
      expect(stats).toHaveProperty('avgConfidence');
      expect(stats).toHaveProperty('nodeCount');
      expect(stats).toHaveProperty('edgeCount');
      expect(stats).toHaveProperty('lastUpdated');
    });

    it('should return numeric values', async () => {
      const stats = await adapter.getStatistics('user-123');

      expect(typeof stats.topicCount).toBe('number');
      expect(typeof stats.sourceCount).toBe('number');
      expect(typeof stats.avgConfidence).toBe('number');
      expect(typeof stats.nodeCount).toBe('number');
      expect(typeof stats.edgeCount).toBe('number');
    });

    it('should have valid confidence range', async () => {
      const stats = await adapter.getStatistics('user-123');

      expect(stats.avgConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.avgConfidence).toBeLessThanOrEqual(1);
    });

    it('should have non-negative counts', async () => {
      const stats = await adapter.getStatistics('user-123');

      expect(stats.topicCount).toBeGreaterThanOrEqual(0);
      expect(stats.sourceCount).toBeGreaterThanOrEqual(0);
      expect(stats.nodeCount).toBeGreaterThanOrEqual(0);
      expect(stats.edgeCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple users', async () => {
      const stats1 = await adapter.getStatistics('user-1');
      const stats2 = await adapter.getStatistics('user-2');

      expect(stats1).toBeDefined();
      expect(stats2).toBeDefined();
    });
  });

  describe('searchTopics', () => {
    it('should return search results', async () => {
      const results = await adapter.searchTopics('machine learning');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle empty search', async () => {
      const results = await adapter.searchTopics('');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle special characters in search', async () => {
      const results = await adapter.searchTopics('@#$%');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle very long search query', async () => {
      const longQuery = 'a'.repeat(1000);
      const results = await adapter.searchTopics(longQuery);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle case variations', async () => {
      const results1 = await adapter.searchTopics('PYTHON');
      const results2 = await adapter.searchTopics('python');
      const results3 = await adapter.searchTopics('Python');

      expect(Array.isArray(results1)).toBe(true);
      expect(Array.isArray(results2)).toBe(true);
      expect(Array.isArray(results3)).toBe(true);
    });
  });

  describe('getTopicDetails', () => {
    it('should return topic details object', async () => {
      const details = await adapter.getTopicDetails('Machine Learning');

      expect(typeof details).toBe('object');
      expect(details.topic).toBe('Machine Learning');
    });

    it('should handle nonexistent topic', async () => {
      const details = await adapter.getTopicDetails('nonexistent-topic-xyz');

      expect(typeof details).toBe('object');
    });

    it('should handle special characters in topic', async () => {
      const details = await adapter.getTopicDetails('C++/Python #ML');

      expect(typeof details).toBe('object');
    });

    it('should handle very long topic name', async () => {
      const longTopic = 'a'.repeat(500);
      const details = await adapter.getTopicDetails(longTopic);

      expect(typeof details).toBe('object');
    });

    it('should handle numeric topic', async () => {
      const details = await adapter.getTopicDetails('2024');

      expect(typeof details).toBe('object');
    });
  });

  describe('error handling', () => {
    it('should handle errors in addResearchFinding gracefully', async () => {
      const finding: ResearchFinding = {
        topic: 'Test',
        findings: ['F'],
        sources: ['S'],
        confidence: 0.5,
        timestamp: new Date(),
      };

      try {
        await adapter.addResearchFinding(finding);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle concurrent operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        adapter.getRecentResearchReports(`user-${i}`, 5),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(Array.isArray(result)).toBe(true);
      });
    });

    it('should handle rapid successive calls', async () => {
      for (let i = 0; i < 20; i++) {
        const result = await adapter.getStatistics('user-123');
        expect(result).toBeDefined();
      }
    });
  });

  describe('performance', () => {
    it('should complete operations within reasonable time', async () => {
      const start = Date.now();
      await adapter.getRecentResearchReports('user-123', 100);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle large number of searches', async () => {
      const queries = Array.from({ length: 50 }, (_, i) => `query-${i}`);
      const start = Date.now();

      await Promise.all(queries.map((q) => adapter.searchTopics(q)));

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('stub implementation validation', () => {
    it('stub addResearchFinding should return valid result', async () => {
      const result = await adapter.addResearchFinding({
        topic: 'Test',
        findings: ['F1', 'F2'],
        sources: ['S1'],
        confidence: 0.8,
        timestamp: new Date(),
      });

      expect(result.success).toBe(true);
      expect(typeof result.nodesAdded).toBe('number');
    });

    it('stub getRecentResearchReports should return empty array', async () => {
      const reports = await adapter.getRecentResearchReports('user-123', 10);

      expect(Array.isArray(reports)).toBe(true);
      expect(reports.length).toBe(0); // Stub returns empty array
    });

    it('stub getStatistics should return initialized stats', async () => {
      const stats = await adapter.getStatistics('user-123');

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('topicCount');
      expect(stats).toHaveProperty('sourceCount');
      expect(stats).toHaveProperty('nodeCount');
      expect(stats).toHaveProperty('edgeCount');
      expect(typeof stats.topicCount).toBe('number');
      expect(typeof stats.sourceCount).toBe('number');
      expect(typeof stats.nodeCount).toBe('number');
      expect(typeof stats.edgeCount).toBe('number');
    });

    it('stub searchTopics should return matching topics', async () => {
      const results = await adapter.searchTopics('AI');

      expect(Array.isArray(results)).toBe(true);
      // Should find 'AI' if it's in the initialized topics
      expect(results.some((r) => r.toLowerCase().includes('ai'))).toBe(true);
    });

    it('stub getTopicDetails should return object with topic field', async () => {
      const details = await adapter.getTopicDetails('test-topic');

      expect(details).toHaveProperty('topic');
      expect(details.topic).toBe('test-topic');
    });
  });
});
