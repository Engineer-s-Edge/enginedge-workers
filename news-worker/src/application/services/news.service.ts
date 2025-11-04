/**
 * News Service
 *
 * Application service for news aggregation and feed management.
 */

import { Injectable, Inject } from '@nestjs/common';
import { NewsArticle } from '@domain/entities/news-article.entity';
import { NewsFeed, NewsFilter, NewsMetadata } from '@domain/entities/news-feed.entity';
import { ILogger } from '../ports/logger.port';
import { INewsRepository } from '../ports/news.repository.port';
import { RedisCacheAdapter } from '@infrastructure/adapters/cache/redis-cache.adapter';

@Injectable()
export class NewsService {
  constructor(
    @Inject('ILogger') private readonly logger: ILogger,
    @Inject('INewsRepository') private readonly newsRepository: INewsRepository,
    private readonly cache: RedisCacheAdapter,
  ) {}

  /**
   * Get news feed with pagination and filtering
   */
  async getNewsFeed(
    page: number = 1,
    pageSize: number = 20,
    filters: NewsFilter = {},
  ): Promise<NewsFeed> {
    const cacheKey = this.buildCacheKey('feed', { page, pageSize, filters });

    // Try cache first
    const cached = await this.cache.get<NewsFeed>(cacheKey);
    if (cached) {
      this.logger.debug('NewsService: Cache hit for news feed', { page, pageSize });
      return cached;
    }

    // Load from repository
    const allArticles = await this.newsRepository.findAll();

    // Apply filters
    const filteredArticles = this.applyFilters(allArticles, filters);

    // Sort by published date (newest first)
    const sortedArticles = filteredArticles.sort(
      (a, b) => b.publishedDate.getTime() - a.publishedDate.getTime(),
    );

    // Paginate
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedArticles = sortedArticles.slice(startIndex, endIndex);

    // Extract metadata
    const metadata = this.extractMetadata(allArticles);

    // Create feed
    const feed = NewsFeed.create(
      paginatedArticles,
      filteredArticles.length,
      page,
      pageSize,
      metadata,
    );

    // Cache result (15 minutes)
    await this.cache.set(cacheKey, feed, { ttl: 900 });

    return feed;
  }

  /**
   * Search articles by query
   */
  async searchArticles(
    query: string,
    page: number = 1,
    pageSize: number = 20,
    filters: NewsFilter = {},
  ): Promise<NewsFeed> {
    const cacheKey = this.buildCacheKey('search', { query, page, pageSize, filters });

    // Try cache first
    const cached = await this.cache.get<NewsFeed>(cacheKey);
    if (cached) {
      this.logger.debug('NewsService: Cache hit for search', { query });
      return cached;
    }

    // Load and filter
    const allArticles = await this.newsRepository.findAll();
    const searchFilters = { ...filters, searchQuery: query };
    const filteredArticles = this.applyFilters(allArticles, searchFilters);

    // Sort by relevance (simple: title/description match first)
    const sortedArticles = filteredArticles.sort((a, b) => {
      const aScore = this.getRelevanceScore(a, query);
      const bScore = this.getRelevanceScore(b, query);
      return bScore - aScore;
    });

    // Paginate
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedArticles = sortedArticles.slice(startIndex, endIndex);

    // Extract metadata
    const metadata = this.extractMetadata(allArticles);

    // Create feed
    const feed = NewsFeed.create(
      paginatedArticles,
      filteredArticles.length,
      page,
      pageSize,
      metadata,
    );

    // Cache result (10 minutes)
    await this.cache.set(cacheKey, feed, { ttl: 600 });

    return feed;
  }

  /**
   * Get trending articles
   */
  async getTrendingArticles(limit: number = 10, category?: string): Promise<NewsArticle[]> {
    const cacheKey = this.buildCacheKey('trending', { limit, category });

    // Try cache first (5 minutes)
    const cached = await this.cache.get<NewsArticle[]>(cacheKey);
    if (cached) {
      this.logger.debug('NewsService: Cache hit for trending', { limit, category });
      return cached;
    }

    // Load articles
    const allArticles = await this.newsRepository.findAll();

    // Filter by category if provided
    let filteredArticles = allArticles;
    if (category) {
      filteredArticles = allArticles.filter((article) => article.category === category);
    }

    // Sort by recency (newest first)
    const sortedArticles = filteredArticles
      .sort((a, b) => b.publishedDate.getTime() - a.publishedDate.getTime())
      .slice(0, limit);

    // Cache result
    await this.cache.set(cacheKey, sortedArticles, { ttl: 300 });

    return sortedArticles;
  }

  /**
   * Apply filters to articles
   */
  private applyFilters(articles: NewsArticle[], filters: NewsFilter): NewsArticle[] {
    return articles.filter((article) => {
      const filter: {
        category?: string;
        source?: string;
        dateFrom?: Date;
        dateTo?: Date;
        searchQuery?: string;
        tags?: string[];
      } = {};

      if (filters.category) filter.category = filters.category;
      if (filters.source) filter.source = filters.source;
      if (filters.dateFrom) filter.dateFrom = new Date(filters.dateFrom);
      if (filters.dateTo) filter.dateTo = new Date(filters.dateTo);
      if (filters.searchQuery) filter.searchQuery = filters.searchQuery;
      if (filters.tags) filter.tags = filters.tags;

      return article.matchesFilter(filter);
    });
  }

  /**
   * Extract metadata from articles
   */
  private extractMetadata(articles: NewsArticle[]): NewsMetadata {
    const categories = new Set<string>();
    const sources = new Set<string>();
    const tags = new Set<string>();

    articles.forEach((article) => {
      if (article.category) categories.add(article.category);
      if (article.source) sources.add(article.source);
      article.tags.forEach((tag) => tags.add(tag));
    });

    return {
      availableCategories: Array.from(categories).sort(),
      availableSources: Array.from(sources).sort(),
      availableTags: Array.from(tags).sort(),
    };
  }

  /**
   * Get relevance score for search
   */
  private getRelevanceScore(article: NewsArticle, query: string): number {
    const lowerQuery = query.toLowerCase();
    let score = 0;

    if (article.title.toLowerCase().includes(lowerQuery)) score += 10;
    if (article.description.toLowerCase().includes(lowerQuery)) score += 5;
    if (article.content.toLowerCase().includes(lowerQuery)) score += 1;

    return score;
  }

  /**
   * Build cache key
   */
  private buildCacheKey(prefix: string, params: Record<string, any>): string {
    const keyParts = [prefix, ...Object.entries(params).map(([k, v]) => `${k}:${v}`)];
    return keyParts.join(':');
  }
}
