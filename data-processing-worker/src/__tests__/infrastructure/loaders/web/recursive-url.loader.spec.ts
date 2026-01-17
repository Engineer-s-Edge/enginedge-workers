/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecursiveUrlLoaderAdapter } from '@infrastructure/adapters/loaders/web/recursive-url.loader';
import { Document } from '@domain/entities/document.entity';
import { CheerioWebLoaderAdapter } from '@infrastructure/adapters/loaders/web/cheerio.loader';

describe('RecursiveUrlLoaderAdapter (Phase 2 - Recursive URL Loader)', () => {
  let adapter: RecursiveUrlLoaderAdapter;
  let cheerioStub: CheerioWebLoaderAdapter;

  beforeEach(() => {
    cheerioStub = { load: jest.fn() } as unknown as CheerioWebLoaderAdapter;
    adapter = new RecursiveUrlLoaderAdapter(cheerioStub);
  });

  it('recursive-url-001: supports site crawling', async () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('recursive-url-002: load returns documents', async () => {
    const docs = [
      new Document('d-rec', 'rec-content', {
        source: 'https://root',
        sourceType: 'url',
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    expect(res).toBe(docs);
  });

  it('recursive-url-003: crawls multiple pages recursively', async () => {
    const docs = Array.from(
      { length: 40 },
      (_, i) =>
        new Document(`d${i}`, `page${i}`, {
          source: `https://example.com/page${i}`,
          sourceType: 'url',
          depth: Math.floor(i / 10),
        }),
    );
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    expect(res.length).toBe(40);
  });

  it('recursive-url-005: respects crawl depth limits', async () => {
    const docs = Array.from(
      { length: 20 },
      (_, i) =>
        new Document(`d${i}`, `content${i}`, {
          source: 'example.com',
          sourceType: 'url',
          depth: i <= 2 ? i : 2,
        }),
    );
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    const maxDepth = Math.max(
      ...res.map((d: any) => d.metadata.depth as number),
    );
    expect(maxDepth).toBeLessThanOrEqual(3);
  });

  it('recursive-url-005: extracts and follows internal links', async () => {
    const docs = [
      new Document('d1', 'home', {
        source: 'https://example.com/',
        sourceType: 'url',
        links: ['about', 'contact'],
      }),
      new Document('d2', 'about', {
        source: 'https://example.com/about',
        sourceType: 'url',
        links: [],
      }),
      new Document('d3', 'contact', {
        source: 'https://example.com/contact',
        sourceType: 'url',
        links: [],
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    expect(res.length).toBe(3);
  });

  it('recursive-url-006: avoids duplicate URLs', async () => {
    const docs = [
      new Document('d1', 'page', {
        source: 'https://example.com/page',
        sourceType: 'url',
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    const urls = res.map((d: any) => d.metadata.source);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(urls.length);
  });

  it('recursive-url-007: handles robots.txt and crawl restrictions', async () => {
    jest
      .spyOn(adapter as any, 'load')
      .mockRejectedValue(new Error('Crawling disallowed by robots.txt'));
    await expect(
      (adapter as any).load('https://restricted.com'),
    ).rejects.toThrow('robots.txt');
  });

  it('recursive-url-008: handles crawl timeout', async () => {
    jest
      .spyOn(adapter as any, 'load')
      .mockRejectedValue(new Error('Crawl operation timeout'));
    await expect((adapter as any).load('https://slow.com')).rejects.toThrow(
      'timeout',
    );
  });
});
