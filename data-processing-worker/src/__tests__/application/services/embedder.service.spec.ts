import { EmbedderService } from '@application/services/embedder.service';

// Minimal mock embedder factory
class DummyEmbedder {
  constructor(private name: string) {}
  async embedText(text: string): Promise<number[]> {
    return [text.length, this.name.length];
  }
  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => [t.length, this.name.length]);
  }
  getDimensions(): number {
    return 2;
  }
  getModelName(): string {
    return this.name;
  }
}

class DummyFactory {
  constructor(public defaultEmbedder: any) {}
  getDefaultEmbedder() {
    return this.defaultEmbedder;
  }
  getEmbedderByProvider(p: string) {
    return this.defaultEmbedder;
  }
  getAvailableEmbedders() {
    return [{ provider: 'dummy' }];
  }
}

describe('EmbedderService', () => {
  let service: EmbedderService;

  beforeEach(() => {
    const embedder = new DummyEmbedder('dummy');
    const mockSimilarityHelper = {
      calculateSimilarity: jest.fn(),
      findMostSimilar: jest.fn()
    };
    service = new EmbedderService(new DummyFactory(embedder) as any, mockSimilarityHelper as any);
  });

  it('embeds single text and caches result', async () => {
    const res1 = await service.embedText('hello');
    const res2 = await service.embedText('hello');
    expect(res1).toEqual(res2);
    expect(service.getStats().cacheSize).toBeGreaterThanOrEqual(1);
  });

  it('embeds a batch with deduplication', async () => {
    const texts = ['a', 'b', 'a'];
    const res = await service.embedBatch(texts);
    expect(res.length).toBe(3);
    // unique embeddings should be less than inputs
    // internal logs are not asserted here, just ensure output shapes
    expect(res[0]).toHaveLength(2);
  });

  it('embedWithFallback tries providers and returns result', async () => {
    const out = await service.embedWithFallback('text', 'dummy', ['other']);
    expect(out).toBeDefined();
    expect(out.length).toBeGreaterThan(0);
  });
});
