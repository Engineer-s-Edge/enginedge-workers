/**
 * In-Memory News Repository
 *
 * In-memory implementation of news repository for development/testing.
 * In production, this would be replaced with a database adapter.
 */

import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { NewsArticle } from '@domain/entities/news-article.entity';
import { INewsRepository } from '@application/ports/news.repository.port';
import { ILogger } from '@application/ports/logger.port';

@Injectable()
export class InMemoryNewsRepository implements INewsRepository, OnModuleInit {
  private articles: Map<string, NewsArticle> = new Map();

  constructor(@Inject('ILogger') private readonly logger: ILogger) {}

  async onModuleInit() {
    // Load sample articles for development
    this.logger.info('InMemoryNewsRepository: Initialized with sample data');
    this.loadSampleData();
  }

  async findAll(): Promise<NewsArticle[]> {
    return Array.from(this.articles.values());
  }

  async findById(id: string): Promise<NewsArticle | null> {
    return this.articles.get(id) || null;
  }

  async findBySource(source: string): Promise<NewsArticle[]> {
    return Array.from(this.articles.values()).filter(
      (article) => article.source === source,
    );
  }

  async findByCategory(category: string): Promise<NewsArticle[]> {
    return Array.from(this.articles.values()).filter(
      (article) => article.category === category,
    );
  }

  async save(article: NewsArticle): Promise<void> {
    this.articles.set(article.id, article);
    this.logger.debug('InMemoryNewsRepository: Article saved', { id: article.id });
  }

  async delete(id: string): Promise<void> {
    this.articles.delete(id);
    this.logger.debug('InMemoryNewsRepository: Article deleted', { id });
  }

  private loadSampleData(): void {
    // Sample articles for development
    const sampleArticles = [
      {
        id: '1',
        title: 'Sample Technology News',
        description: 'A sample technology article',
        content: 'This is sample content for development purposes.',
        url: 'https://example.com/article1',
        published_date: new Date().toISOString(),
        author: 'Sample Author',
        source: 'Tech News',
        category: 'Technology',
        tags: ['tech', 'sample'],
        ingestion_timestamp: new Date().toISOString(),
        source_type: 'rss' as const,
      },
      {
        id: '2',
        title: 'Sample Business News',
        description: 'A sample business article',
        content: 'This is sample content for development purposes.',
        url: 'https://example.com/article2',
        published_date: new Date(Date.now() - 86400000).toISOString(),
        author: 'Sample Author',
        source: 'Business Daily',
        category: 'Business',
        tags: ['business', 'sample'],
        ingestion_timestamp: new Date().toISOString(),
        source_type: 'api' as const,
      },
    ];

    sampleArticles.forEach((data) => {
      const article = NewsArticle.create(data);
      this.articles.set(article.id, article);
    });

    this.logger.info(`InMemoryNewsRepository: Loaded ${this.articles.size} sample articles`);
  }
}
