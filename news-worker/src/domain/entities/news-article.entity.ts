/**
 * News Article Entity
 *
 * Domain entity representing a news article.
 */

export class NewsArticle {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly description: string,
    public readonly content: string,
    public readonly url: string,
    public readonly publishedDate: Date,
    public readonly author: string,
    public readonly source: string,
    public readonly category: string,
    public readonly tags: string[],
    public readonly ingestionTimestamp: Date,
    public readonly sourceType: 'rss' | 'api',
    public readonly imageUrl?: string,
  ) {}

  static create(data: {
    id: string;
    title: string;
    description: string;
    content: string;
    url: string;
    published_date: string;
    author: string;
    source: string;
    category: string;
    tags: string[];
    ingestion_timestamp: string;
    source_type: 'rss' | 'api';
    image_url?: string;
  }): NewsArticle {
    return new NewsArticle(
      data.id,
      data.title,
      data.description,
      data.content,
      data.url,
      new Date(data.published_date),
      data.author,
      data.source,
      data.category,
      data.tags,
      new Date(data.ingestion_timestamp),
      data.source_type,
      data.image_url,
    );
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      content: this.content,
      url: this.url,
      published_date: this.publishedDate.toISOString(),
      author: this.author,
      source: this.source,
      category: this.category,
      tags: this.tags,
      ingestion_timestamp: this.ingestionTimestamp.toISOString(),
      source_type: this.sourceType,
      image_url: this.imageUrl,
    };
  }

  matchesFilter(filter: {
    category?: string;
    source?: string;
    dateFrom?: Date;
    dateTo?: Date;
    searchQuery?: string;
    tags?: string[];
  }): boolean {
    if (filter.category && this.category !== filter.category) {
      return false;
    }

    if (filter.source && this.source !== filter.source) {
      return false;
    }

    if (filter.dateFrom && this.publishedDate < filter.dateFrom) {
      return false;
    }

    if (filter.dateTo && this.publishedDate > filter.dateTo) {
      return false;
    }

    if (filter.tags && filter.tags.length > 0) {
      const hasMatchingTag = filter.tags.some((tag) => this.tags.includes(tag));
      if (!hasMatchingTag) {
        return false;
      }
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const matches =
        this.title.toLowerCase().includes(query) ||
        this.description.toLowerCase().includes(query) ||
        this.content.toLowerCase().includes(query);
      if (!matches) {
        return false;
      }
    }

    return true;
  }
}
