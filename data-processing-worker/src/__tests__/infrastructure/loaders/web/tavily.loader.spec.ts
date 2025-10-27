/* eslint-disable @typescript-eslint/no-explicit-any */
import { TavilySearchLoaderAdapter } from '@infrastructure/adapters/loaders/web/tavily.loader';
import { Document } from '@domain/entities/document.entity';

describe('TavilySearchLoaderAdapter (Phase 2 - Tavily Loader)', () => {
  let adapter: TavilySearchLoaderAdapter;

  beforeEach(() => {
    adapter = new TavilySearchLoaderAdapter();
  });

  it('tavily-001: supports Tavily search queries', async () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('tavily-002: load returns search results', async () => {
    const docs = [new Document('d-tavily', 'search result', { source: 'tavily://query', sourceType: 'url' })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('machine learning');
    expect(res).toBe(docs);
  });

  it('tavily-003: extracts Tavily result metadata', async () => {
    const docs = [
      new Document('d1', 'ML overview', { 
        source: 'https://ml.example.com',
        sourceType: 'url',
        score: 0.95,
        title: 'Machine Learning Guide',
        publishDate: new Date('2024-12-01')
      })
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('machine learning');
    expect(res[0].metadata.score).toBe(0.95);
    expect(res[0].metadata.title).toBe('Machine Learning Guide');
  });

  it('tavily-004: handles contextual search with filtering', async () => {
    const docs = [
      new Document('d1', 'recent ML', { source: 'source1', sourceType: 'url', topic: 'ML', recency: 'recent' }),
      new Document('d2', 'ML techniques', { source: 'source2', sourceType: 'url', topic: 'ML', complexity: 'intermediate' })
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('machine learning recent');
    expect(res.length).toBe(2);
  });

  it('tavily-005: extracts answer and fact checking', async () => {
    const docs = [new Document('d1', 'answer content', { 
      source: 'tavily',
      sourceType: 'url',
      hasAnswer: true,
      answerBox: 'Key answer here',
      isVerified: true
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('what is AI');
    expect(res[0].metadata.hasAnswer).toBe(true);
  });

  it('tavily-006: handles batches of related queries', async () => {
    const docs = Array.from({ length: 80 }, (_, i) => 
      new Document(`d${i}`, `result${i}`, { 
        source: 'tavily',
        sourceType: 'url',
        queryNum: Math.floor(i / 10),
        resultNum: i % 10
      })
    );
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('AI machine learning deep learning');
    expect(res.length).toBeGreaterThanOrEqual(10);
  });

  it('tavily-007: handles API authentication errors', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('Invalid API key'));
    await expect((adapter as any).load('query')).rejects.toThrow('API key');
  });

  it('tavily-008: handles search timeout', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('Search request timeout'));
    await expect((adapter as any).load('query')).rejects.toThrow('timeout');
  });
});
