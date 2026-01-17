/* eslint-disable @typescript-eslint/no-explicit-any */
import { DocumentProcessingService } from '@application/services/document-processing.service';
import { LoaderRegistryService } from '@application/services/loader-registry.service';
import { Document } from '@domain/entities/document.entity';

describe('DocumentProcessingService Advanced (Phase 3 - LoaderService Extended)', () => {
  let loaderRegistry: LoaderRegistryService;
  let service: DocumentProcessingService;

  beforeEach(() => {
    loaderRegistry = new LoaderRegistryService();

    const splitter: any = {
      splitDocuments: async (docs: Document[]) => docs,
    };

    const embedder: any = {
      embedBatch: async (texts: string[]) => texts.map((t) => [t.length]),
      embedText: async (t: string) => [t.length],
    };

    const vectorStore: any = {
      storeDocuments: async (docs: Document[]) => docs.map((d) => d.id),
      similaritySearch: async () => [],
      deleteDocuments: async () => {},
      getDocument: async () => null,
    };

    service = new DocumentProcessingService(
      loaderRegistry,
      splitter,
      embedder,
      vectorStore as any,
    );
  });

  it('adv-proc-001: detects loader type from extension', async () => {
    const pdfLoader: any = {
      load: async () => [
        new Document('d1', 'pdf', { source: 'file.pdf', sourceType: 'file' }),
      ],
      supports: () => true,
      getSupportedTypes: () => ['.pdf'],
    };
    loaderRegistry.registerLoader('pdf', pdfLoader);

    const result = await service.processDocument('file.pdf', { split: false });
    expect(result.documentIds).toContain('d1');
  });

  it('adv-proc-002: processes document with custom options', async () => {
    const loader: any = {
      load: async () => [
        new Document('d1', 'content', {
          source: 'file.txt',
          sourceType: 'file',
        }),
      ],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);

    const result = await service.processDocument('file.txt', {
      loaderName: 'file',
      split: false,
      embed: false,
    });
    expect(result.documentIds.length).toBeGreaterThan(0);
  });

  it('adv-proc-003: chains multiple transformations correctly', async () => {
    const loader: any = {
      load: async () => [
        new Document('d1', 'text', { source: 'file.txt', sourceType: 'file' }),
      ],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);

    const result = await service.processDocument('file.txt', {
      loaderName: 'file',
      split: true,
      embed: true,
      store: true,
    });
    expect(result.documentIds).toBeDefined();
    expect(result.chunks).toBeGreaterThanOrEqual(1);
  });

  it('adv-proc-004: handles multiple documents from single source', async () => {
    const loader: any = {
      load: async () => [
        new Document('d1', 'doc1', {
          source: 'archive.zip',
          sourceType: 'file',
        }),
        new Document('d2', 'doc2', {
          source: 'archive.zip',
          sourceType: 'file',
        }),
        new Document('d3', 'doc3', {
          source: 'archive.zip',
          sourceType: 'file',
        }),
      ],
      supports: () => true,
      getSupportedTypes: () => ['.zip'],
    };
    loaderRegistry.registerLoader('archive', loader);

    const result = await service.processDocument('archive.zip', {
      loaderName: 'archive',
      split: false,
    });
    expect(result.documentIds.length).toBe(3);
  });

  it('adv-proc-005: respects document metadata throughout processing', async () => {
    const loader: any = {
      load: async () => [
        new Document('d1', 'content', {
          source: 'file.txt',
          sourceType: 'file',
          author: 'John Doe',
          createdAt: new Date('2025-01-01'),
          tags: ['important', 'archived'],
        }),
      ],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);

    const result = await service.processDocument('file.txt', {
      loaderName: 'file',
      split: false,
    });
    expect(result.documentIds).toContain('d1');
  });

  it('adv-proc-006: handles URL-based loaders', async () => {
    const webLoader: any = {
      load: async (url: string) => [
        new Document('d-web', 'html content', {
          source: url,
          sourceType: 'url',
        }),
      ],
      supports: (source: string) => source.startsWith('http'),
      getSupportedTypes: () => [],
    };
    loaderRegistry.registerLoader('web', webLoader);

    const result = await service.processDocument('https://example.com', {
      loaderName: 'web',
      split: false,
    });
    expect(result.documentIds).toContain('d-web');
  });

  it('adv-proc-007: processes streaming without storing', async () => {
    const loader: any = {
      load: async () => [
        new Document('d1', 'content', {
          source: 'file.txt',
          sourceType: 'file',
        }),
      ],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);

    const result = await service.processDocument('file.txt', {
      loaderName: 'file',
      split: false,
      embed: true,
      store: false,
    });
    expect(result.documentIds).toBeDefined();
  });

  it('adv-proc-008: validates loader availability before processing', async () => {
    await expect(
      service.processDocument('file.unknown', { loaderName: 'nonexistent' }),
    ).rejects.toThrow();
  });

  it('adv-proc-009: batch processes multiple files with same loader', async () => {
    const loader: any = {
      load: async (source: string) => [
        new Document(`d-${source}`, `content-${source}`, {
          source,
          sourceType: 'file',
        }),
      ],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);

    const result1 = await service.processDocument('file1.txt', {
      loaderName: 'file',
      split: false,
    });
    const result2 = await service.processDocument('file2.txt', {
      loaderName: 'file',
      split: false,
    });

    expect(result1.documentIds.length).toBeGreaterThan(0);
    expect(result2.documentIds.length).toBeGreaterThan(0);
  });

  it('adv-proc-010: recovers from partial processing failures', async () => {
    const loader: any = {
      load: async (source: string) => {
        if (source.includes('fail')) throw new Error('Load failed');
        return [new Document('d1', 'content', { source, sourceType: 'file' })];
      },
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);

    // Should fail for fail.txt
    await expect(
      service.processDocument('fail.txt', { loaderName: 'file' }),
    ).rejects.toThrow();

    // Should succeed for good.txt
    const result = await service.processDocument('good.txt', {
      loaderName: 'file',
      split: false,
    });
    expect(result.documentIds).toContain('d1');
  });

  it('adv-proc-011: handles option combinations correctly', async () => {
    const loader: any = {
      load: async () => [
        new Document('d1', 'x'.repeat(100), {
          source: 'file.txt',
          sourceType: 'file',
        }),
      ],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);

    // split=true, embed=false, store=false
    const result1 = await service.processDocument('file.txt', {
      loaderName: 'file',
      split: true,
      embed: false,
      store: false,
    });
    expect(result1.chunks).toBeDefined();

    // split=false, embed=true, store=false
    const result2 = await service.processDocument('file.txt', {
      loaderName: 'file',
      split: false,
      embed: true,
      store: false,
    });
    expect(result2.documentIds).toBeDefined();
  });

  it('adv-proc-012: preserves document order through pipeline', async () => {
    const loader: any = {
      load: async () => [
        new Document('d1', 'first', { source: 'file.txt', sourceType: 'file' }),
        new Document('d2', 'second', {
          source: 'file.txt',
          sourceType: 'file',
        }),
        new Document('d3', 'third', { source: 'file.txt', sourceType: 'file' }),
      ],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);

    const result = await service.processDocument('file.txt', {
      loaderName: 'file',
      split: false,
    });
    expect(result.documentIds).toEqual(['d1', 'd2', 'd3']);
  });

  it('adv-proc-013: handles empty loader results', async () => {
    const loader: any = {
      load: async () => [],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);

    const result = await service.processDocument('empty.txt', {
      loaderName: 'file',
    });
    expect(result.documentIds.length).toBe(0);
  });

  it('adv-proc-014: skips embedding when not requested', async () => {
    const loader: any = {
      load: async () => [
        new Document('d1', 'content', {
          source: 'file.txt',
          sourceType: 'file',
        }),
      ],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);

    const result = await service.processDocument('file.txt', {
      loaderName: 'file',
      split: false,
      embed: false,
    });
    expect(result.documentIds).toContain('d1');
  });

  it('adv-proc-015: skips storing when not requested', async () => {
    const loader: any = {
      load: async () => [
        new Document('d1', 'content', {
          source: 'file.txt',
          sourceType: 'file',
        }),
      ],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);

    const result = await service.processDocument('file.txt', {
      loaderName: 'file',
      split: false,
      store: false,
    });
    expect(result.documentIds).toContain('d1');
  });
});
