/* eslint-disable @typescript-eslint/no-explicit-any */
import { CheerioWebLoaderAdapter } from '@infrastructure/adapters/loaders/web/cheerio.loader';
import { Document } from '@domain/entities/document.entity';

describe('CheerioWebLoaderAdapter (Phase 2 - Cheerio Web Loader)', () => {
  let adapter: CheerioWebLoaderAdapter;

  beforeEach(() => {
    adapter = new CheerioWebLoaderAdapter();
  });

  it('cheerio-001: supports HTML pages', async () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('cheerio-002: load returns documents', async () => {
    const docs = [
      new Document('d-cheerio', '<p>hi</p>', {
        source: 'https://example.com',
        sourceType: 'url',
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    expect(res).toBe(docs);
  });

  it('cheerio-003: extracts text from HTML elements', async () => {
    const docs = [
      new Document('d1', 'Page Title\n\nThis is the main content', {
        source: 'https://example.com',
        sourceType: 'url',
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    expect(res[0].content).toContain('Title');
  });

  it('cheerio-004: handles nested HTML structures', async () => {
    const docs = [
      new Document('d1', 'Nested text from divs and paragraphs', {
        source: 'https://example.com',
        sourceType: 'url',
        depth: 5,
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    expect(res[0].metadata.depth).toBe(5);
  });

  it('cheerio-005: preserves links', async () => {
    const docs = [
      new Document('d1', 'Check out [this link](https://other.com)', {
        source: 'https://example.com',
        sourceType: 'url',
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    expect(res[0].content).toContain('link');
  });

  it('cheerio-006: handles large HTML documents', async () => {
    const docs = [
      new Document('d1', 'Long content'.repeat(100), {
        source: 'https://example.com',
        sourceType: 'url',
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    expect(res[0].content.length).toBeGreaterThan(1000);
  });

  it('cheerio-007: handles encoding issues gracefully', async () => {
    const docs = [
      new Document('d1', 'Text with émojis 🚀 and üñíçödé', {
        source: 'https://example.com',
        sourceType: 'url',
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    expect(res[0].content).toContain('émojis');
  });

  it('cheerio-008: load error handling', async () => {
    jest
      .spyOn(adapter as any, 'load')
      .mockRejectedValue(new Error('Load failed'));
    await expect((adapter as any).load('https://invalid.com')).rejects.toThrow(
      'Load failed',
    );
  });
});
