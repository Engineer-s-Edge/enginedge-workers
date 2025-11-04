/**
 * News Feed Entity
 *
 * Domain entity representing a paginated news feed response.
 */

import { NewsArticle } from './news-article.entity';

export interface NewsFilter {
  category?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
  tags?: string[];
}

export interface NewsMetadata {
  availableCategories: string[];
  availableSources: string[];
  availableTags: string[];
}

export class NewsFeed {
  constructor(
    public readonly articles: NewsArticle[],
    public readonly totalCount: number,
    public readonly page: number,
    public readonly pageSize: number,
    public readonly hasMore: boolean,
    public readonly filters: NewsMetadata,
  ) {}

  static create(
    articles: NewsArticle[],
    totalCount: number,
    page: number,
    pageSize: number,
    filters: NewsMetadata,
  ): NewsFeed {
    const hasMore = page * pageSize < totalCount;

    return new NewsFeed(articles, totalCount, page, pageSize, hasMore, filters);
  }

  toJSON() {
    return {
      articles: this.articles.map((article) => article.toJSON()),
      totalCount: this.totalCount,
      page: this.page,
      pageSize: this.pageSize,
      hasMore: this.hasMore,
      filters: this.filters,
    };
  }
}
