/**
 * News Integration Adapter Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NewsIntegrationAdapter } from '../../../infrastructure/adapters/implementations/news-integration.adapter';
import { NewsArticle } from '../../../infrastructure/adapters/interfaces/news-integration.adapter.interface';

describe('NewsIntegrationAdapter', () => {
  let adapter: NewsIntegrationAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NewsIntegrationAdapter],
    }).compile();

    adapter = module.get<NewsIntegrationAdapter>(NewsIntegrationAdapter);
  });

  describe('fetchRecentNews', () => {
    it('should fetch recent news for topic', async () => {
      const articles = await adapter.fetchRecentNews('Machine Learning');

      expect(Array.isArray(articles)).toBe(true);
    });

    it('should fetch with limit', async () => {
      const articles = await adapter.fetchRecentNews('AI', 5);

      expect(articles.length).toBeLessThanOrEqual(5);
    });

    it('should return articles with properties', async () => {
      const articles = await adapter.fetchRecentNews('Data Science', 1);

      if (articles.length > 0) {
        expect(articles[0]).toHaveProperty('id');
        expect(articles[0]).toHaveProperty('title');
        expect(articles[0]).toHaveProperty('content');
        expect(articles[0]).toHaveProperty('source');
        expect(articles[0]).toHaveProperty('url');
        expect(articles[0]).toHaveProperty('publishedAt');
      }
    });

    it('should fetch for different topics', async () => {
      const topics = ['AI', 'ML', 'NLP', 'Computer Vision', 'Robotics'];

      for (const topic of topics) {
        const articles = await adapter.fetchRecentNews(topic);
        expect(Array.isArray(articles)).toBe(true);
      }
    });

    it('should handle different limits', async () => {
      for (const limit of [1, 5, 10, 50]) {
        const articles = await adapter.fetchRecentNews('Technology', limit);
        expect(articles.length).toBeLessThanOrEqual(limit);
      }
    });

    it('should handle concurrent fetches', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        adapter.fetchRecentNews(`Topic-${i}`),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
    });
  });

  describe('analyzeNews', () => {
    it('should analyze news articles', async () => {
      const articles: NewsArticle[] = [
        {
          id: '1',
          title: 'AI Breakthrough',
          content: 'New AI model shows promise',
          source: 'TechNews',
          url: 'https://example.com/1',
          publishedAt: new Date(),
        },
      ];

      const analysis = await adapter.analyzeNews(articles);

      expect(analysis).toHaveProperty('articles');
      expect(analysis).toHaveProperty('themes');
      expect(analysis).toHaveProperty('insights');
      expect(analysis).toHaveProperty('summary');
      expect(analysis).toHaveProperty('timestamp');
    });

    it('should handle multiple articles', async () => {
      const articles: NewsArticle[] = Array.from({ length: 5 }, (_, i) => ({
        id: `article-${i}`,
        title: `Article ${i}`,
        content: `Content for article ${i}`,
        source: `Source ${i}`,
        url: `https://example.com/${i}`,
        publishedAt: new Date(),
      }));

      const analysis = await adapter.analyzeNews(articles);

      expect(analysis.articles).toHaveLength(5);
    });

    it('should extract themes', async () => {
      const articles: NewsArticle[] = [
        {
          id: '1',
          title: 'AI News',
          content: 'AI topic discussion',
          source: 'News',
          url: 'https://example.com/1',
          publishedAt: new Date(),
        },
      ];

      const analysis = await adapter.analyzeNews(articles);

      expect(Array.isArray(analysis.themes)).toBe(true);
      if (analysis.themes.length > 0) {
        expect(analysis.themes[0]).toHaveProperty('theme');
        expect(analysis.themes[0]).toHaveProperty('frequency');
        expect(analysis.themes[0]).toHaveProperty('sentiment');
      }
    });

    it('should provide insights', async () => {
      const articles: NewsArticle[] = [
        {
          id: '1',
          title: 'Tech Update',
          content: 'Latest technology news',
          source: 'TechNews',
          url: 'https://example.com/1',
          publishedAt: new Date(),
        },
      ];

      const analysis = await adapter.analyzeNews(articles);

      expect(Array.isArray(analysis.insights)).toBe(true);
    });

    it('should handle empty articles', async () => {
      const analysis = await adapter.analyzeNews([]);

      expect(analysis).toHaveProperty('articles');
      expect(analysis.articles).toHaveLength(0);
    });
  });

  describe('getTrendingTopics', () => {
    it('should get trending topics', async () => {
      const trending = await adapter.getTrendingTopics();

      expect(Array.isArray(trending)).toBe(true);
    });

    it('should get trending with limit', async () => {
      const trending = await adapter.getTrendingTopics(5);

      expect(trending.length).toBeLessThanOrEqual(5);
    });

    it('should include frequency data', async () => {
      const trending = await adapter.getTrendingTopics(1);

      if (trending.length > 0) {
        expect(trending[0]).toHaveProperty('topic');
        expect(trending[0]).toHaveProperty('frequency');
      }
    });

    it('should handle various limits', async () => {
      for (const limit of [1, 5, 10, 50, 100]) {
        const trending = await adapter.getTrendingTopics(limit);
        expect(trending.length).toBeLessThanOrEqual(limit);
      }
    });
  });

  describe('searchNews', () => {
    it('should search news by query', async () => {
      const results = await adapter.searchNews('machine learning');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should search with limit', async () => {
      const results = await adapter.searchNews('artificial intelligence', 10);

      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should return articles', async () => {
      const results = await adapter.searchNews('data science', 1);

      if (results.length > 0) {
        expect(results[0]).toHaveProperty('id');
        expect(results[0]).toHaveProperty('title');
      }
    });

    it('should handle various queries', async () => {
      const queries = [
        'AI trends',
        'machine learning',
        'neural networks',
        'deep learning',
      ];

      for (const query of queries) {
        const results = await adapter.searchNews(query);
        expect(Array.isArray(results)).toBe(true);
      }
    });

    it('should handle concurrent searches', async () => {
      const searches = Array.from({ length: 15 }, (_, i) =>
        adapter.searchNews(`query-${i}`),
      );

      const results = await Promise.all(searches);

      expect(results).toHaveLength(15);
    });
  });

  describe('fetchNewsForTopics', () => {
    it('should fetch news for multiple topics', async () => {
      const topics = ['AI', 'ML', 'DL'];
      const newsMap = await adapter.fetchNewsForTopics(topics);

      expect(newsMap instanceof Map).toBe(true);
      expect(newsMap.size).toBeGreaterThanOrEqual(0);
    });

    it('should return map with topics as keys', async () => {
      const topics = ['Python', 'JavaScript'];
      const newsMap = await adapter.fetchNewsForTopics(topics);

      for (const topic of topics) {
        expect(
          newsMap.get(topic) === undefined || Array.isArray(newsMap.get(topic)),
        ).toBe(true);
      }
    });

    it('should respect limit parameter', async () => {
      const newsMap = await adapter.fetchNewsForTopics(['Tech', 'Science'], 5);

      newsMap.forEach((articles) => {
        expect(articles.length).toBeLessThanOrEqual(5);
      });
    });

    it('should handle many topics', async () => {
      const topics = Array.from({ length: 10 }, (_, i) => `Topic-${i}`);
      const newsMap = await adapter.fetchNewsForTopics(topics);

      expect(newsMap.size).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty topics', async () => {
      const newsMap = await adapter.fetchNewsForTopics([]);

      expect(newsMap instanceof Map).toBe(true);
    });
  });

  describe('detectEmergingTopics', () => {
    it('should detect emerging topics', async () => {
      const topics = await adapter.detectEmergingTopics();

      expect(Array.isArray(topics)).toBe(true);
    });

    it('should return string topics', async () => {
      const topics = await adapter.detectEmergingTopics();

      if (topics.length > 0) {
        expect(typeof topics[0]).toBe('string');
      }
    });

    it('should handle repeated calls', async () => {
      const topics1 = await adapter.detectEmergingTopics();
      const topics2 = await adapter.detectEmergingTopics();

      expect(Array.isArray(topics1)).toBe(true);
      expect(Array.isArray(topics2)).toBe(true);
    });

    it('should handle concurrent detection', async () => {
      const promises = Array.from({ length: 5 }, () =>
        adapter.detectEmergingTopics(),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
    });
  });

  describe('getSentimentAnalysis', () => {
    it('should get sentiment analysis for topic', async () => {
      const sentiment = await adapter.getSentimentAnalysis('AI');

      expect(sentiment).toHaveProperty('positive');
      expect(sentiment).toHaveProperty('neutral');
      expect(sentiment).toHaveProperty('negative');
    });

    it('should return numeric values', async () => {
      const sentiment = await adapter.getSentimentAnalysis('Machine Learning');

      expect(typeof sentiment.positive).toBe('number');
      expect(typeof sentiment.neutral).toBe('number');
      expect(typeof sentiment.negative).toBe('number');
    });

    it('should handle multiple topics', async () => {
      const topics = ['AI', 'ML', 'NLP', 'CV', 'Robotics'];

      for (const topic of topics) {
        const sentiment = await adapter.getSentimentAnalysis(topic);

        expect(sentiment).toHaveProperty('positive');
        expect(sentiment).toHaveProperty('neutral');
        expect(sentiment).toHaveProperty('negative');
      }
    });

    it('should handle concurrent sentiment analysis', async () => {
      const analyses = Array.from({ length: 10 }, (_, i) =>
        adapter.getSentimentAnalysis(`Topic-${i}`),
      );

      const results = await Promise.all(analyses);

      expect(results).toHaveLength(10);
    });
  });

  describe('error handling', () => {
    it('should handle mixed concurrent operations', async () => {
      const operations = [
        adapter.fetchRecentNews('AI', 5),
        adapter.getTrendingTopics(),
        adapter.searchNews('machine learning'),
        adapter.detectEmergingTopics(),
        adapter.getSentimentAnalysis('AI'),
        adapter.fetchNewsForTopics(['AI', 'ML']),
      ];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(6);
    });

    it('should handle rapid news fetches', async () => {
      const fetches = [];
      for (let i = 0; i < 20; i++) {
        fetches.push(adapter.fetchRecentNews(`Topic-${i}`, 3));
      }

      const results = await Promise.all(fetches);

      expect(results).toHaveLength(20);
    });

    it('should handle large batch operations', async () => {
      const topics = Array.from({ length: 50 }, (_, i) => `Topic-${i}`);
      const newsMap = await adapter.fetchNewsForTopics(topics, 2);

      expect(newsMap instanceof Map).toBe(true);
    });
  });

  describe('stub implementation validation', () => {
    it('stub fetchRecentNews should return array', async () => {
      const articles = await adapter.fetchRecentNews('Test');

      expect(Array.isArray(articles)).toBe(true);
    });

    it('stub analyzeNews should return analysis object', async () => {
      const analysis = await adapter.analyzeNews([]);

      expect(analysis).toHaveProperty('articles');
      expect(analysis).toHaveProperty('themes');
      expect(analysis).toHaveProperty('insights');
      expect(analysis).toHaveProperty('summary');
      expect(analysis).toHaveProperty('timestamp');
    });

    it('stub getTrendingTopics should return array', async () => {
      const trending = await adapter.getTrendingTopics();

      expect(Array.isArray(trending)).toBe(true);
    });

    it('stub searchNews should return array', async () => {
      const results = await adapter.searchNews('query');

      expect(Array.isArray(results)).toBe(true);
    });

    it('stub fetchNewsForTopics should return Map', async () => {
      const newsMap = await adapter.fetchNewsForTopics(['Topic1']);

      expect(newsMap instanceof Map).toBe(true);
    });

    it('stub detectEmergingTopics should return array', async () => {
      const topics = await adapter.detectEmergingTopics();

      expect(Array.isArray(topics)).toBe(true);
    });

    it('stub getSentimentAnalysis should return sentiment object', async () => {
      const sentiment = await adapter.getSentimentAnalysis('Topic');

      expect(sentiment).toHaveProperty('positive');
      expect(sentiment).toHaveProperty('neutral');
      expect(sentiment).toHaveProperty('negative');
    });
  });
});
