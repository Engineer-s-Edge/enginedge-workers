/**
 * News Repository Port
 *
 * Port interface for news article storage and retrieval.
 */

import { NewsArticle } from '@domain/entities/news-article.entity';

export interface INewsRepository {
  findAll(): Promise<NewsArticle[]>;
  findById(id: string): Promise<NewsArticle | null>;
  findBySource(source: string): Promise<NewsArticle[]>;
  findByCategory(category: string): Promise<NewsArticle[]>;
  save(article: NewsArticle): Promise<void>;
  delete(id: string): Promise<void>;
}
