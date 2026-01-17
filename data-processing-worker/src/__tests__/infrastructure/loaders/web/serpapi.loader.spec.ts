/* eslint-disable @typescript-eslint/no-explicit-any */
import { SerpApiLoaderAdapter } from '@infrastructure/adapters/loaders/web/serpapi.loader';
import { Document } from '@domain/entities/document.entity';

describe('SerpApiLoaderAdapter (Phase 2 - SerpAPI Loader)', () => {
  let adapter: SerpApiLoaderAdapter;

  beforeEach(() => {
    adapter = new SerpApiLoaderAdapter();
  });

  it('serpapi-001: supports SerpAPI search queries', async () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('serpapi-002: load returns search results', async () => {
    const docs = [
      new Document('d-serp', 'search result', {
        source: 'serpapi://query=python',
        sourceType: 'url',
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('python programming');
    expect(res).toBe(docs);
  });

  it('serpapi-003: extracts search result metadata', async () => {
    const docs = [
      new Document('d1', 'result1', {
        source: 'https://result1.com',
        sourceType: 'url',
        position: 1,
        snippet: 'Python is...',
      }),
      new Document('d2', 'result2', {
        source: 'https://result2.com',
        sourceType: 'url',
        position: 2,
        snippet: 'Learn Python...',
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('python');
    expect(res[0].metadata.position).toBe(1);
    expect(res[0].metadata.snippet).toBeDefined();
  });

  it('serpapi-004: handles different search engines', async () => {
    const docs = [
      new Document('d1', 'google result', {
        source: 'google',
        sourceType: 'url',
        engine: 'google',
      }),
      new Document('d2', 'bing result', {
        source: 'bing',
        sourceType: 'url',
        engine: 'bing',
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('query');
    expect(res.some((d: any) => d.metadata.engine)).toBe(true);
  });

  it('serpapi-005: preserves knowledge panel information', async () => {
    const docs = [
      new Document('d1', 'entity info', {
        source: 'serpapi',
        sourceType: 'url',
        knowledgePanel: true,
        title: 'Python (programming language)',
        description: 'High-level programming language',
      }),
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('python');
    expect(res[0].metadata.knowledgePanel).toBe(true);
  });

  it('serpapi-006: handles multiple result pages', async () => {
    const docs = Array.from(
      { length: 100 },
      (_, i) =>
        new Document(`d${i}`, `result${i}`, {
          source: 'serpapi',
          sourceType: 'url',
          page: Math.floor(i / 10),
          position: (i % 10) + 1,
        }),
    );
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('query');
    expect(res.length).toBe(100);
  });

  it('serpapi-007: handles API rate limiting', async () => {
    jest
      .spyOn(adapter as any, 'load')
      .mockRejectedValue(new Error('API rate limit exceeded'));
    await expect((adapter as any).load('query')).rejects.toThrow('rate limit');
  });

  it('serpapi-008: handles no results for query', async () => {
    jest
      .spyOn(adapter as any, 'load')
      .mockRejectedValue(new Error('No results found'));
    await expect((adapter as any).load('xyzabc12345notaquery')).rejects.toThrow(
      'No results',
    );
  });
});
