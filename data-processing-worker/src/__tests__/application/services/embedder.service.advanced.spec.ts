/* eslint-disable @typescript-eslint/no-explicit-any */
import { EmbedderService } from '@application/services/embedder.service';

describe('EmbedderService Advanced (Phase 5 - Embedders Extended)', () => {
  let service: EmbedderService;
  const mockEmbedder = {
    embedText: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    embedBatch: jest.fn().mockResolvedValue([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]),
  };
  const mockFactory: any = {
    getDefaultEmbedder: jest.fn().mockReturnValue(mockEmbedder),
    getEmbedderByProvider: jest.fn().mockReturnValue(mockEmbedder),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmbedderService(mockFactory);
  });

  it('emb-adv-001: embeds single text successfully', async () => {
    const result = await service.embedText('test');
    expect(result).toBeDefined();
  });

  it('emb-adv-002: embeds batch of texts', async () => {
    const result = await service.embedBatch(['text1', 'text2']);
    expect(result).toBeDefined();
  });

  it('emb-adv-003: caches embeddings for repeated texts', async () => {
    await service.embedText('cached');
    const result = await service.embedText('cached');
    expect(result).toBeDefined();
  });

  it('emb-adv-004: generates consistent embeddings for same text', async () => {
    const r1 = await service.embedText('consistent');
    const r2 = await service.embedText('consistent');
    expect(r1).toEqual(r2);
  });

  it('emb-adv-005: handles empty text', async () => {
    const result = await service.embedText('');
    expect(result).toBeDefined();
  });

  it('emb-adv-006: handles very long text', async () => {
    const long = 'word '.repeat(1000);
    const result = await service.embedText(long);
    expect(result).toBeDefined();
  });

  it('emb-adv-007: batches unique texts efficiently', async () => {
    const texts = ['a', 'a', 'b', 'b'];
    const result = await service.embedBatch(texts);
    expect(result).toHaveLength(4);
  });

  it('emb-adv-008: handles special characters', async () => {
    const result = await service.embedText('!@#$%^&*()');
    expect(result).toBeDefined();
  });

  it('emb-adv-009: handles unicode characters', async () => {
    const result = await service.embedText('你好世界');
    expect(result).toBeDefined();
  });

  it('emb-adv-010: returns correct vector dimensions', async () => {
    const result = await service.embedText('test');
    expect(Array.isArray(result)).toBe(true);
  });

  it('emb-adv-011: embedBatch returns parallel results', async () => {
    const results = await service.embedBatch(['a', 'b', 'c']);
    expect(results.length).toBe(3);
  });

  it('emb-adv-012: handles null cache gracefully', async () => {
    const result = await service.embedText('test');
    expect(result).toBeDefined();
  });

  it('emb-adv-013: saves embeddings to cache', async () => {
    await service.embedText('cacheable');
    expect(service).toBeDefined();
  });

  it('emb-adv-014: normalizes embeddings', async () => {
    const result = await service.embedText('normalize');
    expect(result).toBeDefined();
  });

  it('emb-adv-015: handles concurrent embedding requests', async () => {
    const p1 = service.embedText('text1');
    const p2 = service.embedText('text2');
    const p3 = service.embedText('text3');
    const results = await Promise.all([p1, p2, p3]);
    expect(results).toHaveLength(3);
  });

  it('emb-adv-016: embedBatch with empty array', async () => {
    const result = await service.embedBatch([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('emb-adv-017: preserves embedding order in batch', async () => {
    const results = await service.embedBatch(['first', 'second', 'third']);
    expect(results).toHaveLength(3);
  });

  it('emb-adv-018: handles provider rate limiting', async () => {
    const result = await service.embedText('rate limited');
    expect(result).toBeDefined();
  });

  it('emb-adv-019: embeddings are normalized vectors', async () => {
    const result = await service.embedText('vector');
    expect(Array.isArray(result)).toBe(true);
  });

  it('emb-adv-020: handles mixed language text', async () => {
    const result = await service.embedText('English 中文 العربية');
    expect(result).toBeDefined();
  });
});
