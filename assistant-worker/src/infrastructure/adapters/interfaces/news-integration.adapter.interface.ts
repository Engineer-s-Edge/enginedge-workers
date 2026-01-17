/**
 * News Integration Adapter Interface
 *
 * Port interface for external news/data integration
 * Abstracts external NewsIntegrationService implementation
 */

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  source: string;
  url: string;
  publishedAt: Date;
  relevanceScore?: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

export interface NewsAnalysis {
  articles: NewsArticle[];
  themes: Array<{ theme: string; frequency: number; sentiment: string }>;
  insights: string[];
  summary: string;
  timestamp: Date;
}

export interface INewsIntegrationAdapter {
  /**
   * Fetch recent news for topic
   */
  fetchRecentNews(topic: string, limit?: number): Promise<NewsArticle[]>;

  /**
   * Analyze news articles
   */
  analyzeNews(articles: NewsArticle[]): Promise<NewsAnalysis>;

  /**
   * Get trending topics in news
   */
  getTrendingTopics(
    limit?: number,
  ): Promise<Array<{ topic: string; frequency: number }>>;

  /**
   * Search news by query
   */
  searchNews(query: string, limit?: number): Promise<NewsArticle[]>;

  /**
   * Get news for multiple topics
   */
  fetchNewsForTopics(
    topics: string[],
    limit?: number,
  ): Promise<Map<string, NewsArticle[]>>;

  /**
   * Detect emerging topics from news
   */
  detectEmergingTopics(): Promise<string[]>;

  /**
   * Get sentiment analysis
   */
  getSentimentAnalysis(topic: string): Promise<{
    positive: number;
    neutral: number;
    negative: number;
  }>;
}
