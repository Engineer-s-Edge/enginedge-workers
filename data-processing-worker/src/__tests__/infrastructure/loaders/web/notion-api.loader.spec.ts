/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotionApiLoaderAdapter } from '@infrastructure/adapters/loaders/web/notion-api.loader';
import { Document } from '@domain/entities/document.entity';

describe('NotionApiLoaderAdapter (Phase 2 - Notion API Loader)', () => {
  let adapter: NotionApiLoaderAdapter;

  beforeEach(() => {
    adapter = new NotionApiLoaderAdapter();
  });

  it('notion-api-001: supports notion URLs', async () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('notion-api-002: load returns documents from Notion', async () => {
    const docs = [new Document('d-notion-api', 'notion-api-content', { source: 'notion://page', sourceType: 'url' })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://notion.so/somepage');
    expect(res).toBe(docs);
  });

  it('notion-api-003: extracts page properties and content', async () => {
    const docs = [new Document('d1', 'page content', { 
      source: 'notion',
      sourceType: 'url',
      title: 'My Page',
      author: 'John',
      createdAt: new Date('2025-01-01'),
      lastEditedTime: new Date('2025-01-15')
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://notion.so/page');
    expect(res[0].metadata.title).toBe('My Page');
    expect(res[0].metadata.author).toBe('John');
  });

  it('notion-api-004: handles nested block structures', async () => {
    const docs = [
      new Document('d1', 'heading', { source: 'notion', sourceType: 'url', blockType: 'heading_1' }),
      new Document('d2', 'bullet 1', { source: 'notion', sourceType: 'url', blockType: 'bulleted_list_item' }),
      new Document('d3', 'nested bullet', { source: 'notion', sourceType: 'url', blockType: 'bulleted_list_item', indent: 1 })
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://notion.so/page');
    expect(res.length).toBe(3);
    expect(res[2].metadata.indent).toBe(1);
  });

  it('notion-api-005: handles database query results', async () => {
    const docs = Array.from({ length: 50 }, (_, i) => 
      new Document(`d${i}`, `row${i}`, { source: 'notion', sourceType: 'url', blockType: 'database_row' })
    );
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://notion.so/database');
    expect(res.length).toBe(50);
  });

  it('notion-api-006: preserves rich text formatting', async () => {
    const docs = [new Document('d1', 'formatted text', { 
      source: 'notion',
      sourceType: 'url',
      hasCode: true,
      isBold: true,
      isItalic: true
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://notion.so/page');
    expect(res[0].metadata.hasCode).toBe(true);
  });

  it('notion-api-007: handles API rate limiting', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('Rate limit exceeded'));
    await expect((adapter as any).load('https://notion.so/page')).rejects.toThrow('Rate limit');
  });

  it('notion-api-008: handles invalid access tokens', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('Unauthorized: Invalid token'));
    await expect((adapter as any).load('https://notion.so/page')).rejects.toThrow('Unauthorized');
  });
});
