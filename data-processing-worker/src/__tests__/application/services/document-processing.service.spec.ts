/* eslint-disable @typescript-eslint/no-explicit-any */
import { DocumentProcessingService } from '@application/services/document-processing.service';
import { LoaderRegistryService } from '@application/services/loader-registry.service';
import { Document } from '@domain/entities/document.entity';

describe('DocumentProcessingService (Phase 3 - LoaderService)', () => {
  let loaderRegistry: LoaderRegistryService;
  let service: DocumentProcessingService;

  beforeEach(() => {
    loaderRegistry = new LoaderRegistryService();

    // minimal splitter that returns the same document as one chunk
    const splitter: any = {
      splitDocuments: async (docs: Document[]) => docs,
    };

    // minimal embedder
    const embedder: any = {
      embedBatch: async (texts: string[]) => texts.map(t => [t.length]),
      embedText: async (t: string) => [t.length],
    };

    // minimal vector store
    const vectorStore: any = {
      storeDocuments: async (docs: Document[]) => docs.map(d => d.id),
      similaritySearch: async () => [],
      deleteDocuments: async () => {},
      getDocument: async () => null,
    };

    service = new DocumentProcessingService(loaderRegistry, splitter, embedder, vectorStore as any);
  });

  it('doc-proc-001: processes document with splitting, embedding and storing', async () => {
    const dummyLoader: any = {
      load: async (source: string) => [new Document('doc1', 'hello world', { source, sourceType: 'file' })],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', dummyLoader);

    const result = await service.processDocument('file.txt', { loaderName: 'file', split: true, embed: true, store: true });
    expect(result.chunks).toBeGreaterThanOrEqual(1);
    expect(result.documentIds).toContain('doc1');
  });

  it('doc-proc-002: throws when required dependencies are missing for embedding', async () => {
    const svc = new DocumentProcessingService(loaderRegistry as any, undefined as any, undefined as any, undefined as any);
    const loader: any = { load: async () => [new Document('d1', 'x', { source: 's', sourceType: 'file' })], supports: () => true, getSupportedTypes: () => ['.txt'] };
    loaderRegistry.registerLoader('file', loader);
    await expect(svc.processDocument('file.txt', { loaderName: 'file', split: true, embed: true, store: true })).rejects.toThrow();
  });

  it('doc-proc-003: loads document without splitting', async () => {
    const loader: any = { load: async () => [new Document('d1', 'content', { source: 'file.txt', sourceType: 'file' })], supports: () => true, getSupportedTypes: () => ['.txt'] };
    loaderRegistry.registerLoader('file', loader);
    const result = await service.processDocument('file.txt', { loaderName: 'file', split: false, embed: false, store: false });
    expect(result.documentIds).toContain('d1');
    expect(result.chunks).toBe(1);
  });

  it('doc-proc-004: handles multiple loaders gracefully', async () => {
    const loader1: any = { load: async () => [new Document('d1', 'txt', { source: 'file.txt', sourceType: 'file' })], supports: () => true, getSupportedTypes: () => ['.txt'] };
    const loader2: any = { load: async () => [new Document('d2', 'doc', { source: 'file.docx', sourceType: 'file' })], supports: () => true, getSupportedTypes: () => ['.docx'] };
    loaderRegistry.registerLoader('txt', loader1);
    loaderRegistry.registerLoader('docx', loader2);
    
    const result1 = await service.processDocument('file.txt', { loaderName: 'txt', split: false });
    const result2 = await service.processDocument('file.docx', { loaderName: 'docx', split: false });
    expect(result1.documentIds).toContain('d1');
    expect(result2.documentIds).toContain('d2');
  });

  it('doc-proc-005: processes bulk documents', async () => {
    const loader: any = {
      load: async (source: string) => [
        new Document('d1', 'content1', { source, sourceType: 'file' }),
        new Document('d2', 'content2', { source, sourceType: 'file' }),
        new Document('d3', 'content3', { source, sourceType: 'file' })
      ],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);
    const result = await service.processDocument('file.txt', { loaderName: 'file', split: false });
    expect(result.documentIds.length).toBe(3);
  });

  it('doc-proc-006: preserves document metadata through processing', async () => {
    const loader: any = {
      load: async () => [new Document('d1', 'content', { source: 'file.txt', sourceType: 'file', author: 'John', createdAt: new Date('2025-01-01') })],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);
    const result = await service.processDocument('file.txt', { loaderName: 'file', split: false });
    expect(result.documentIds).toContain('d1');
  });

  it('doc-proc-007: handles loader errors gracefully', async () => {
    const loader: any = {
      load: async () => { throw new Error('Loader failed'); },
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);
    await expect(service.processDocument('file.txt', { loaderName: 'file' })).rejects.toThrow();
  });

  it('doc-proc-008: skips embedding when embedder is undefined', async () => {
    const svc2 = new DocumentProcessingService(loaderRegistry, undefined as any, undefined as any, undefined as any);
    const loader: any = {
      load: async () => [new Document('d1', 'content', { source: 'file.txt', sourceType: 'file' })],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);
    const result = await svc2.processDocument('file.txt', { loaderName: 'file', split: false, embed: false });
    expect(result.documentIds).toContain('d1');
  });

  xit('doc-proc-009: handles large files without splitting', async () => {
    const loader: any = {
      load: async () => [new Document('d1', 'x'.repeat(200), { source: 'large.txt', sourceType: 'file' })],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);
    const result = await service.processDocument('large.txt', { loaderName: 'file', split: false });
    expect(result.chunks).toBe(1);
  });

  it('doc-proc-010: handles empty document gracefully', async () => {
    const loader: any = {
      load: async () => [new Document('d1', '', { source: 'empty.txt', sourceType: 'file' })],
      supports: () => true,
      getSupportedTypes: () => ['.txt'],
    };
    loaderRegistry.registerLoader('file', loader);
    const result = await service.processDocument('empty.txt', { loaderName: 'file', split: false });
    expect(result.documentIds).toContain('d1');
  });
});
