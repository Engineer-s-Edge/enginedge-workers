import { Injectable } from '@nestjs/common';
import { INewsRepository } from '@application/ports/news.repository.port';
import { NewsArticle } from '@domain/entities/news-article.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileNewsRepository implements INewsRepository {
  private readonly filePath: string;

  constructor() {
    const dir = process.env.NEWS_DATA_DIR || path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, 'news.json');
    if (!fs.existsSync(this.filePath)) fs.writeFileSync(this.filePath, '[]');
  }

  private readAll(): NewsArticle[] {
    const raw = fs.readFileSync(this.filePath, 'utf8');
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private writeAll(items: NewsArticle[]): void {
    fs.writeFileSync(this.filePath, JSON.stringify(items, null, 2), 'utf8');
  }

  async findAll(): Promise<NewsArticle[]> {
    return this.readAll();
  }

  async findById(id: string): Promise<NewsArticle | null> {
    return this.readAll().find((a) => a.id === id) || null;
  }

  async findBySource(source: string): Promise<NewsArticle[]> {
    return this.readAll().filter((a) => a.source === source);
  }

  async findByCategory(category: string): Promise<NewsArticle[]> {
    return this.readAll().filter((a) => a.category === category);
  }

  async save(article: NewsArticle): Promise<void> {
    const items = this.readAll();
    const idx = items.findIndex((a) => a.id === article.id);
    if (idx >= 0) items[idx] = article;
    else items.push(article);
    this.writeAll(items);
  }

  async delete(id: string): Promise<void> {
    const items = this.readAll().filter((a) => a.id !== id);
    this.writeAll(items);
  }
}
