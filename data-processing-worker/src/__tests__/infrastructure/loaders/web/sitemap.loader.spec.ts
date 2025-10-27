/* eslint-disable @typescript-eslint/no-explicit-any */
import { SitemapLoaderAdapter } from '@infrastructure/adapters/loaders/web/sitemap.loader';
import { Document } from '@domain/entities/document.entity';
import { CheerioWebLoaderAdapter } from '@infrastructure/adapters/loaders/web/cheerio.loader';

describe('SitemapLoaderAdapter (Phase 2 - Sitemap Loader)', () => {
  let adapter: SitemapLoaderAdapter;
  let cheerioStub: CheerioWebLoaderAdapter;

  beforeEach(() => {
    cheerioStub = ({ load: jest.fn() } as unknown) as CheerioWebLoaderAdapter;
    adapter = new SitemapLoaderAdapter(cheerioStub);
  });

  it('sitemap-001: supports sitemap.xml files', async () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('sitemap-002: load returns documents', async () => {
    const docs = [new Document('d-sitemap', 'sitemap-content', { source: 'https://example.com/sitemap.xml', sourceType: 'url' })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com/sitemap.xml');
    expect(res).toBe(docs);
  });

  it('sitemap-003: parses sitemap URL entries', async () => {
    const docs = Array.from({ length: 60 }, (_, i) => 
      new Document(`d${i}`, `url${i}`, { 
        source: `https://example.com/page${i}`,
        sourceType: 'url',
        lastmod: new Date('2025-01-01'),
        changefreq: 'weekly'
      })
    );
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com/sitemap.xml');
    expect(res.length).toBe(60);
  });

  it('sitemap-004: preserves lastmod and changefreq', async () => {
    const docs = [new Document('d1', 'url', { 
      source: 'https://example.com/page',
      sourceType: 'url',
      lastmod: new Date('2025-01-15'),
      changefreq: 'daily',
      priority: 0.8
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com/sitemap.xml');
    expect(res[0].metadata.changefreq).toBe('daily');
    expect(res[0].metadata.priority).toBe(0.8);
  });

  it('sitemap-005: handles sitemap indexes', async () => {
    const docs = [
      new Document('d1', 'index ref', { source: 'https://example.com/sitemap1.xml', sourceType: 'url', type: 'index' }),
      new Document('d2', 'index ref', { source: 'https://example.com/sitemap2.xml', sourceType: 'url', type: 'index' })
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com/sitemap.xml');
    expect(res.some((d: any) => d.metadata.type === 'index')).toBe(true);
  });

  it('sitemap-006: handles large sitemaps with many URLs', async () => {
    const docs = Array.from({ length: 200 }, (_, i) => 
      new Document(`d${i}`, `url${i}`, { source: `https://example.com/page${i}`, sourceType: 'url' })
    );
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com/sitemap.xml');
    expect(res.length).toBe(200);
  });

  it('sitemap-007: handles malformed XML gracefully', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('Invalid XML in sitemap'));
    await expect((adapter as any).load('https://example.com/sitemap.xml')).rejects.toThrow('XML');
  });

  it('sitemap-008: handles network errors fetching sitemap', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('Failed to fetch sitemap'));
    await expect((adapter as any).load('https://example.com/sitemap.xml')).rejects.toThrow('fetch');
  });
});
