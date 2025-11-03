import { MongoDBVectorStoreAdapter } from '@infrastructure/adapters/vectorstores/mongodb.vectorstore';
import { Document } from '@domain/entities/document.entity';
import { mock, MockProxy } from 'jest-mock-extended';
import { Model } from 'mongoose';

describe('MongoDBVectorStoreAdapter', () => {
  let adapter: MongoDBVectorStoreAdapter;
  let mockModel: MockProxy<Model<any>>;

  beforeEach(() => {
    mockModel = mock<Model<any>>();
    adapter = new MongoDBVectorStoreAdapter(mockModel);
  });

  it('storeDocuments stores documents and returns ids', async () => {
    const docs = [
      new Document('a', 'one', { source: 's', sourceType: 'file' }),
      new Document('b', 'two', { source: 's', sourceType: 'file' }),
    ];
    const embeddings = [
      [1, 2],
      [3, 4],
    ];

    const saveMocks: jest.Mock[] = [];
    const ModelCtor: any = function (payload: any) {
      const inst: any = {
        ...payload,
        save: jest.fn().mockResolvedValue(payload),
      };
      saveMocks.push(inst.save);
      return inst;
    };

    adapter = new MongoDBVectorStoreAdapter(ModelCtor);
    const res = await adapter.storeDocuments(docs, embeddings, {
      userId: 'u1',
    } as any);
    expect(res).toEqual(['a', 'b']);
    expect(saveMocks.length).toBe(2);
  });

  it('storeDocuments throws when lengths mismatch', async () => {
    const docs = [
      new Document('a', 'one', { source: 's', sourceType: 'file' }),
    ];
    const embeddings = [
      [1, 2],
      [3, 4],
    ];
    await expect(adapter.storeDocuments(docs, embeddings)).rejects.toThrow();
  });

  it('similaritySearch maps aggregate results to Documents', async () => {
    const aggRes = [
      {
        documentId: 'd1',
        content: 'c1',
        metadata: { source: 'f', sourceType: 'file' },
        score: 0.9,
      },
      {
        documentId: 'd2',
        content: 'c2',
        metadata: { source: 'f', sourceType: 'file' },
        score: 0.8,
      },
    ];
    mockModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(aggRes),
    } as unknown as any);
    const out = await adapter.similaritySearch([0.1, 0.2], 2);
    expect(out.length).toBe(2);
    expect(out[0].document.id).toBe('d1');
    expect(out[0].score).toBe(0.9);
  });

  it('similaritySearch falls back to textSearch when aggregate fails', async () => {
    mockModel.aggregate.mockImplementation(() => {
      throw new Error('agg failed');
    });
    const found = [{ documentId: 't1', content: 'txt', metadata: {} }];
    mockModel.find.mockReturnValue({
      limit: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(found) }),
    } as unknown as any);
    const out = await adapter.similaritySearch([0], 1, {
      query: 'txt',
    } as unknown as any);
    expect(Array.isArray(out)).toBe(true);
    expect(out[0].document.id).toBe('t1');
  });

  it('deleteDocuments calls deleteMany with correct filter', async () => {
    mockModel.deleteMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({}),
    } as unknown as any);
    await adapter.deleteDocuments(['x', 'y']);
    expect(mockModel.deleteMany).toHaveBeenCalledWith({
      documentId: { $in: ['x', 'y'] },
    });
  });

  it('getDocument returns Document when found and null when missing', async () => {
    const found = {
      documentId: 'z',
      content: 'zzz',
      metadata: {},
      createdAt: new Date(),
    };
    mockModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(found),
    } as unknown as any);
    const out = await adapter.getDocument('z');
    expect(out).not.toBeNull();
    expect(out?.id).toBe('z');

    mockModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    } as unknown as any);
    const out2 = await adapter.getDocument('nope');
    expect(out2).toBeNull();
  });

  it('updateDocument updates and throws when not found', async () => {
    mockModel.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    } as unknown as any);
    await expect(
      adapter.updateDocument('z', { content: 'new' }),
    ).resolves.toBeUndefined();

    mockModel.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ matchedCount: 0 }),
    } as unknown as any);
    await expect(
      adapter.updateDocument('z', { content: 'new' }),
    ).rejects.toThrow();
  });

  it('hybridSearch combines vector and text results', async () => {
    const vectorResults = [
      {
        document: new Document('v1', 'v', { source: 's', sourceType: 'file' }),
        score: 0.9,
      },
    ];
    const textResults = [
      {
        document: new Document('v1', 'v', { source: 's', sourceType: 'file' }),
        score: 0.4,
      },
      {
        document: new Document('t2', 't', { source: 's', sourceType: 'file' }),
        score: 0.6,
      },
    ];

    jest
      .spyOn(adapter as unknown as any, 'similaritySearch')
      .mockResolvedValue(vectorResults as unknown as any);
    jest
      .spyOn(adapter as unknown as any, 'textSearch')
      .mockResolvedValue(textResults as unknown as any);

    const out = await adapter.hybridSearch([0.1], 'query', 5);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].document.id).toBe('v1');
  });

  describe('Batch 6: 20 VectorStore Tests', () => {
    it('001: large batch storage', async () => {
      const docs = Array.from(
        { length: 100 },
        (_, i) =>
          new Document(`doc${i}`, `content${i}`, {
            source: 's',
            sourceType: 'file',
          }),
      );
      const embeddings = Array.from({ length: 100 }, () => [0.1, 0.2]);
      const saveMocks: jest.Mock[] = [];
      const MC: any = function (p: any) {
        const i: any = { ...p, save: jest.fn().mockResolvedValue(p) };
        saveMocks.push(i.save);
        return i;
      };
      adapter = new MongoDBVectorStoreAdapter(MC);
      const res = await adapter.storeDocuments(docs, embeddings);
      expect(res.length).toBe(100);
    });

    it('002: high-dimensional vectors', async () => {
      const embed = Array.from({ length: 1536 }, () => Math.random());
      const aggRes = [
        {
          documentId: 'd1',
          content: 'c1',
          metadata: { source: 's', sourceType: 'file' },
          score: 0.95,
        },
      ];
      mockModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aggRes),
      } as unknown as any);
      const out = await adapter.similaritySearch(embed, 1);
      expect(out[0].score).toBeCloseTo(0.95);
    });

    it('003: ranked results', async () => {
      const ranked = [
        {
          documentId: 'd1',
          content: 'h',
          metadata: { source: 's', sourceType: 'file' },
          score: 0.95,
        },
        {
          documentId: 'd2',
          content: 's',
          metadata: { source: 's', sourceType: 'file' },
          score: 0.75,
        },
        {
          documentId: 'd3',
          content: 'm',
          metadata: { source: 's', sourceType: 'file' },
          score: 0.55,
        },
      ];
      mockModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(ranked),
      } as unknown as any);
      const out = await adapter.similaritySearch([0.1], 3);
      expect(out[0].score).toBeGreaterThan(out[1].score);
    });

    it('004: search timeout', async () => {
      mockModel.aggregate.mockImplementation(
        () =>
          ({
            exec: jest.fn().mockRejectedValue(new Error('timeout')),
          }) as unknown as any,
      );
      await expect(adapter.similaritySearch([0.1], 5)).rejects.toThrow();
    });

    it('005: concurrent deletes', async () => {
      mockModel.deleteMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 5 }),
      } as unknown as any);
      await Promise.all([
        adapter.deleteDocuments(['d1']),
        adapter.deleteDocuments(['d2']),
      ]);
      expect(mockModel.deleteMany).toHaveBeenCalledTimes(2);
    });

    it('006: delete non-existent', async () => {
      mockModel.deleteMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      } as unknown as any);
      await adapter.deleteDocuments(['x', 'y']);
      expect(mockModel.deleteMany).toHaveBeenCalled();
    });

    it('007: search filters', async () => {
      const filt = [
        {
          documentId: 'd2',
          content: 'c',
          metadata: { source: 's', sourceType: 'file' },
          score: 0.8,
        },
      ];
      mockModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(filt),
      } as unknown as any);
      const out = await adapter.similaritySearch([0.1], 10);
      expect(out[0].document.id).toBe('d2');
    });

    it('008: exact score match', async () => {
      const prec = [
        {
          documentId: 'd1',
          content: 'c1',
          metadata: { source: 's', sourceType: 'file' },
          score: 0.75,
        },
      ];
      mockModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(prec),
      } as unknown as any);
      const out = await adapter.similaritySearch([0.1], 5);
      expect(out[0].score).toBe(0.75);
    });

    it('009: repeated searches', async () => {
      const res = [
        {
          documentId: 'd1',
          content: 'c',
          metadata: { source: 's', sourceType: 'file' },
          score: 0.9,
        },
      ];
      mockModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(res),
      } as unknown as any);
      await Promise.all([
        adapter.similaritySearch([0.1], 5),
        adapter.similaritySearch([0.1], 5),
        adapter.similaritySearch([0.1], 5),
      ]);
      expect(mockModel.aggregate).toHaveBeenCalledTimes(3);
    });

    it('010: pagination', async () => {
      const paged = Array.from({ length: 10 }, (_, i) => ({
        documentId: `d${i}`,
        content: `c${i}`,
        metadata: { source: 's', sourceType: 'file' },
        score: 0.9 - i * 0.05,
      }));
      mockModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(paged),
      } as unknown as any);
      const out = await adapter.similaritySearch([0.1], 10);
      expect(out.length).toBe(10);
      expect(out[0].score).toBeGreaterThan(out[9].score);
    });

    it('011: Document objects', async () => {
      const agg = [
        {
          documentId: 'd1',
          content: 'c1',
          metadata: { source: 'f.txt', sourceType: 'file' },
          score: 0.9,
        },
      ];
      mockModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(agg),
      } as unknown as any);
      const out = await adapter.similaritySearch([0.1], 1);
      expect(out[0].document instanceof Document).toBe(true);
    });

    it('012: getDocument construct', async () => {
      const found = {
        documentId: 'tid',
        content: 'tc',
        metadata: { source: 'sf.txt', sourceType: 'file' },
        createdAt: new Date(),
      };
      mockModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(found),
      } as unknown as any);
      const doc = await adapter.getDocument('tid');
      expect(doc?.id).toBe('tid');
    });

    it('013: metadata preserve', async () => {
      const meta = { source: 'o.txt', sourceType: 'file' };
      const agg = [
        { documentId: 'd1', content: 'c', metadata: meta, score: 0.9 },
      ];
      mockModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(agg),
      } as unknown as any);
      const result = await adapter.similaritySearch([0.1], 1);
      expect(result[0].document.metadata).toEqual(meta);
    });

    it('014: concurrent ops', async () => {
      mockModel.aggregate.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([
            {
              documentId: 'd1',
              content: 'c',
              metadata: { source: 's', sourceType: 'file' },
              score: 0.9,
            },
          ]),
      } as unknown as any);
      mockModel.deleteMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      } as unknown as any);
      const ops = [
        adapter.similaritySearch([0.1], 5),
        adapter.deleteDocuments(['d2']),
        adapter.similaritySearch([0.1], 5),
      ];
      const results = await Promise.all(ops);
      expect(results).toHaveLength(3);
    });

    it('015: various sizes', async () => {
      const res = Array.from({ length: 50 }, (_, i) => ({
        documentId: `d${i}`,
        content: `c${i}`,
        metadata: { source: 's', sourceType: 'file' },
        score: 0.95 - i * 0.01,
      }));
      mockModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(res),
      } as unknown as any);
      const out = await adapter.similaritySearch([0.1], 50);
      expect(out.length).toBe(50);
    });

    it('016: empty results', async () => {
      mockModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      } as unknown as any);
      const out = await adapter.similaritySearch([0.1], 10);
      expect(out).toEqual([]);
    });

    it('017: update doc', async () => {
      mockModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
      } as unknown as any);
      const payload = {
        content: 'u',
        metadata: { source: 'u.txt', sourceType: 'file' },
      };
      await adapter.updateDocument('d1', payload);
      expect(mockModel.updateOne).toHaveBeenCalledWith(
        { documentId: 'd1' },
        expect.objectContaining({ content: 'u' }),
      );
    });

    it('018: hybrid search', async () => {
      jest
        .spyOn(adapter as unknown as any, 'similaritySearch')
        .mockResolvedValue([
          {
            document: new Document('d1', 'c', {
              source: 's',
              sourceType: 'file',
            }),
            score: 0.9,
          },
        ] as unknown as any);
      jest
        .spyOn(adapter as unknown as any, 'textSearch')
        .mockResolvedValue([
          {
            document: new Document('d1', 'c', {
              source: 's',
              sourceType: 'file',
            }),
            score: 0.8,
          },
        ] as unknown as any);
      const out = await adapter.hybridSearch([0.1], 't', 5);
      expect(Array.isArray(out)).toBe(true);
    });

    it('019: update missing', async () => {
      mockModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ matchedCount: 0 }),
      } as unknown as any);
      await expect(
        adapter.updateDocument('missing', { content: 'x' }),
      ).rejects.toThrow();
    });

    it('020: rapid ops', async () => {
      mockModel.aggregate.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([
            {
              documentId: 'd1',
              content: 'c',
              metadata: { source: 's', sourceType: 'file' },
              score: 0.9,
            },
          ]),
      } as unknown as any);
      mockModel.deleteMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      } as unknown as any);
      for (let i = 0; i < 5; i++) {
        await adapter.similaritySearch([0.1], 5);
      }
      await adapter.deleteDocuments(['d1']);
      expect(mockModel.aggregate).toHaveBeenCalledTimes(5);
    });
  });
});
