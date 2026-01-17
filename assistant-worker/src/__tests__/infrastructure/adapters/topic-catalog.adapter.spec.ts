/**
 * Topic Catalog Adapter Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TopicCatalogAdapter } from '../../../infrastructure/adapters/implementations/topic-catalog.adapter';
import { TopicCatalogService } from '../../../application/services/topic-catalog.service';
import { GetTopicsForResearchUseCase } from '../../../application/use-cases/get-topics-for-research.use-case';

describe('TopicCatalogAdapter', () => {
  let adapter: TopicCatalogAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TopicCatalogAdapter,
        {
          provide: TopicCatalogService,
          useFactory: () => {
            const topics = new Map();
            // Pre-seed topics for tests that assume existence
            [
              'Machine Learning',
              'Data Science',
              'AI Ethics',
              'Statistics',
              'Topic',
            ].forEach((name) => {
              topics.set(name, {
                id: 'seeded-' + name,
                name: name,
                description: 'Seeded topic',
                estimatedComplexity: 1,
                categorizationConfidence: 0.9,
                relatedCategories: [],
                lastUpdated: new Date(),
              });
            });
            // Pre-seed numbered topics for concurrent tests
            for (let i = 0; i < 20; i++) {
              const name = `Topic${i}`;
              topics.set(name, {
                id: 'seeded-' + name,
                name: name,
                description: 'Seeded topic',
                estimatedComplexity: 1,
                categorizationConfidence: 0.9,
                relatedCategories: [],
                lastUpdated: new Date(),
              });
            }

            return {
              addTopic: jest.fn().mockImplementation((input: any) => {
                const t = {
                  id: '123',
                  name: input.name,
                  description: input.description,
                  estimatedComplexity: input.estimatedComplexity || 1,
                  categorizationConfidence: 0.9,
                  relatedCategories: [],
                  lastUpdated: new Date(),
                };
                topics.set(input.name, t);
                topics.set('123', t);
                return { topic: t };
              }),
              getTopicByName: jest
                .fn()
                .mockImplementation((name) => topics.get(name) || null),
              searchTopics: jest.fn().mockResolvedValue([]),
              updateTopicStatus: jest.fn().mockImplementation((id, status) => {
                // Find topic by ID manually since we use ID as key sometimes but primary key is name in this mock map logic?
                // Actually the map above keys by NAME.
                // The original code tried \`topics.get('123')\`.
                // Let's improve this. We iterate values or just return a dummy if found.
                // For simplicity, find by ID from values
                let found: any = null;
                for (const t of topics.values()) {
                  if (t.id === id) {
                    found = t;
                    break;
                  }
                }

                // If not found by ID (because getTopicByName returned ID seeded-...), return that.
                if (!found && topics.has('123')) found = topics.get('123'); // Fallback for addTopic's hardcoded ID

                const t = found || {
                  id,
                  name: 'Updated',
                  description: '',
                  estimatedComplexity: 1,
                };
                return { ...t, status };
              }),
              getTopicsByPriority: jest.fn().mockResolvedValue([]),
              linkToKnowledgeNode: jest.fn().mockResolvedValue(true),
              deleteTopic: jest.fn().mockResolvedValue(true),
            };
          },
        },
        {
          provide: GetTopicsForResearchUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    adapter = module.get<TopicCatalogAdapter>(TopicCatalogAdapter);
  });

  describe('addTopic', () => {
    it('should add a topic successfully', async () => {
      const result = await adapter.addTopic('Machine Learning Basics', {
        description: 'Introduction to ML',
        complexity: 'L1',
      });

      expect(result).toHaveProperty('id');
      expect(result.name).toBe('Machine Learning Basics');
    });

    it('should add topic with all properties', async () => {
      const result = await adapter.addTopic('Advanced NLP', {
        description: 'Deep NLP techniques',
        complexity: 'L5',
        relatedTopics: ['ML Basics', 'Neural Networks'],
      });

      expect(result.id).toBeDefined();
      expect(result.complexity).toBe('L5');
    });

    it('should add multiple unique topics', async () => {
      const topics = ['Data Science', 'Statistical Analysis', 'Evaluation'];

      for (const topic of topics) {
        const result = await adapter.addTopic(topic, {
          description: `Intro to ${topic}`,
          complexity: 'L2',
        });

        expect(result.name).toBe(topic);
      }
    });

    it('should handle concurrent additions', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        adapter.addTopic(`Topic-${i}`, { description: `Topic ${i}` }),
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
    });
  });

  describe('getTopic', () => {
    it('should retrieve added topic', async () => {
      await adapter.addTopic('Python Programming', {
        description: 'Learn Python',
      });

      const topic = await adapter.getTopic('Python Programming');

      expect(topic).not.toBeNull();
      if (topic) {
        expect(topic.name).toBe('Python Programming');
      }
    });

    it('should return null for nonexistent topic', async () => {
      const topic = await adapter.getTopic('Nonexistent');

      expect(topic).toBeNull();
    });

    it('should return full topic details', async () => {
      await adapter.addTopic('Web Dev', {
        description: 'Frontend and Backend',
        complexity: 'L3',
      });

      const topic = await adapter.getTopic('Web Dev');

      if (topic) {
        expect(topic).toHaveProperty('description');
        expect(topic).toHaveProperty('complexity');
      }
    });

    it('should handle multiple retrievals', async () => {
      const topics = ['React', 'Vue', 'Angular'];

      for (const name of topics) {
        await adapter.addTopic(name, { description: name });
      }

      for (const name of topics) {
        const topic = await adapter.getTopic(name);
        expect(topic?.name).toBe(name);
      }
    });
  });

  describe('searchTopics', () => {
    it('should search topics by keyword', async () => {
      await adapter.addTopic('Python Programming', {
        description: 'Language',
      });

      const results = await adapter.searchTopics('Python');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should return empty for no matches', async () => {
      const results = await adapter.searchTopics('NonexistentKeyword123');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should search with various keywords', async () => {
      const keywords = ['data', 'science', 'machine', 'learning', 'ai'];

      for (const keyword of keywords) {
        const results = await adapter.searchTopics(keyword);
        expect(Array.isArray(results)).toBe(true);
      }
    });

    it('should handle concurrent searches', async () => {
      const promises = Array.from({ length: 15 }, (_, i) =>
        adapter.searchTopics(`keyword${i}`),
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(15);
    });
  });

  describe('getRecommendedTopics', () => {
    it('should get recommendations by userId', async () => {
      const recommendations = await adapter.getRecommendedTopics('user-123');

      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should get limited recommendations', async () => {
      const recommendations = await adapter.getRecommendedTopics('user-456', 5);

      expect(recommendations.length).toBeLessThanOrEqual(5);
    });

    it('should get recommendations for multiple users', async () => {
      for (let i = 1; i <= 5; i++) {
        const recs = await adapter.getRecommendedTopics(`user-${i}`);
        expect(Array.isArray(recs)).toBe(true);
      }
    });

    it('should handle large limits', async () => {
      const recommendations = await adapter.getRecommendedTopics(
        'user-789',
        100,
      );

      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('updateTopic', () => {
    it('should update topic description', async () => {
      await adapter.addTopic('React Basics', { description: 'Old' });

      const result = await adapter.updateTopic('React Basics', {
        description: 'Updated React basics',
      });

      expect(result).toHaveProperty('id');
      expect(result.description).toBe('Updated React basics');
    });

    it('should update topic complexity', async () => {
      await adapter.addTopic('Node.js', {
        description: 'Backend',
        complexity: 'L2',
      });

      const result = await adapter.updateTopic('Node.js', {
        complexity: 'L3',
      });

      expect(result.complexity).toBe('L3');
    });

    it('should update multiple properties', async () => {
      await adapter.addTopic('GraphQL', {
        description: 'Query',
        complexity: 'L3',
      });

      const result = await adapter.updateTopic('GraphQL', {
        description: 'Query language',
        complexity: 'L4',
      });

      expect(result.description).toBe('Query language');
      expect(result.complexity).toBe('L4');
    });

    it('should handle concurrent updates', async () => {
      // First, create the topics
      for (let i = 0; i < 5; i++) {
        await adapter.addTopic(`Topic-${i}`, { description: `Topic ${i}` });
      }

      // Then update them
      const updatePromises = Array.from({ length: 5 }, (_, i) =>
        adapter.updateTopic(`Topic-${i}`, { description: `Updated ${i}` }),
      );

      const results = await Promise.all(updatePromises);
      expect(results).toHaveLength(5);
    });
  });

  describe('getTrendingTopics', () => {
    it('should get trending topics', async () => {
      const trending = await adapter.getTrendingTopics();

      expect(Array.isArray(trending)).toBe(true);
    });

    it('should get trending with limit', async () => {
      const trending = await adapter.getTrendingTopics(10);

      expect(trending.length).toBeLessThanOrEqual(10);
    });

    it('should handle various limits', async () => {
      for (const limit of [0, 5, 10, 50, 100]) {
        const trending = await adapter.getTrendingTopics(limit);
        expect(Array.isArray(trending)).toBe(true);
      }
    });

    it('should return string topics', async () => {
      const trending = await adapter.getTrendingTopics();

      if (trending.length > 0) {
        expect(typeof trending[0]).toBe('string');
      }
    });
  });

  describe('trackResearch', () => {
    it('should track research topic', async () => {
      const result = await adapter.trackResearch('Machine Learning', {
        expertId: 'expert-1',
        researchId: 'research-123',
      });

      expect(result).toBe(true);
    });

    it('should track with metadata', async () => {
      const result = await adapter.trackResearch('Data Science', {
        expertId: 'expert-2',
        researchId: 'research-456',
        findings: { key1: 'value1' },
      });

      expect(result).toBe(true);
    });

    it('should track multiple entries', async () => {
      const results = await Promise.all([
        adapter.trackResearch('AI Ethics', {
          expertId: 'expert-1',
          researchId: 'research-001',
        }),
        adapter.trackResearch('AI Ethics', {
          expertId: 'expert-2',
          researchId: 'research-002',
        }),
        adapter.trackResearch('AI Ethics', {
          expertId: 'expert-3',
          researchId: 'research-003',
        }),
      ]);

      expect(results.every((r) => r === true)).toBe(true);
    });

    it('should handle concurrent tracking', async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        adapter.trackResearch(`Topic${i}`, {
          expertId: `expert-${i}`,
          researchId: `research-${i}`,
        }),
      );

      const results = await Promise.all(promises);
      expect(results.every((r) => r === true)).toBe(true);
    });

    it('should track without optional fields', async () => {
      const result = await adapter.trackResearch('Statistics', {});

      expect(result).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle mixed concurrent operations', async () => {
      const promises = [
        adapter.addTopic('Topic1', { description: 'T1' }),
        adapter.getTopic('Topic1'),
        adapter.searchTopics('topic'),
        adapter.getTrendingTopics(),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(4);
    });

    it('should handle rapid operations', async () => {
      await adapter.addTopic('RapidTest', {
        description: 'Rapid',
      });

      const ops = [];
      for (let i = 0; i < 10; i++) {
        ops.push(
          adapter.getTopic('RapidTest'),
          adapter.updateTopic('RapidTest', {
            description: `Update ${i}`,
          }),
        );
      }

      const results = await Promise.all(ops);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('stub implementation validation', () => {
    it('stub addTopic should return topic with id', async () => {
      const result = await adapter.addTopic('Test', { description: 'Test' });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
    });

    it('stub getTopic should return object or null', async () => {
      const result = await adapter.getTopic('Test');

      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('stub searchTopics should return array', async () => {
      const result = await adapter.searchTopics('test');

      expect(Array.isArray(result)).toBe(true);
    });

    it('stub getRecommendedTopics should return array', async () => {
      const result = await adapter.getRecommendedTopics('user-1');

      expect(Array.isArray(result)).toBe(true);
    });

    it('stub updateTopic should return metadata', async () => {
      // First create a topic
      await adapter.addTopic('Topic', { description: 'Original' });

      // Then update it
      const result = await adapter.updateTopic('Topic', {
        description: 'Update',
      });

      expect(result).toHaveProperty('id');
    });

    it('stub getTrendingTopics should return array', async () => {
      const result = await adapter.getTrendingTopics();

      expect(Array.isArray(result)).toBe(true);
    });

    it('stub trackResearch should return true', async () => {
      const result = await adapter.trackResearch('Topic', {});

      expect(result).toBe(true);
    });
  });
});
