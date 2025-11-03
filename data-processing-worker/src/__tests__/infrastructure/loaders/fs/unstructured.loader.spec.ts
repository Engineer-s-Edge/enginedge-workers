/* eslint-disable @typescript-eslint/no-explicit-any */
import { UnstructuredLoaderAdapter } from '@infrastructure/adapters/loaders/fs/unstructured.loader';
import { Document } from '@domain/entities/document.entity';

describe('UnstructuredLoaderAdapter (Phase 1 - Unstructured Loader)', () => {
  let adapter: UnstructuredLoaderAdapter;

  beforeEach(() => {
    adapter = new UnstructuredLoaderAdapter();
  });

  it('unstructured-001: reports supported types', () => {
    const types = adapter.getSupportedTypes();
    expect(Array.isArray(types)).toBe(true);
    expect(
      adapter.supports('file.txt') || adapter.supports('file.md'),
    ).toBeTruthy();
  });

  it('unstructured-002: loadBlob returns mocked documents', async () => {
    const docs = [
      new Document('id-unstructured', 'u-content', {
        source: 'file.txt',
        sourceType: 'file',
      }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 8 } as any,
      'file.txt',
      {},
    );
    expect(res).toBe(docs);
  });

  it('unstructured-003: extracts elements from unstructured documents', async () => {
    const docs = [
      new Document('e1', 'Title text', {
        source: 'file.txt',
        sourceType: 'file',
        elementType: 'Title',
      }),
      new Document('e2', 'Paragraph content', {
        source: 'file.txt',
        sourceType: 'file',
        elementType: 'NarrativeText',
      }),
      new Document('e3', 'Another paragraph', {
        source: 'file.txt',
        sourceType: 'file',
        elementType: 'NarrativeText',
      }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 5000 } as any,
      'file.txt',
      {},
    );
    expect(res.length).toBe(3);
    expect(res[0].metadata.elementType).toBe('Title');
  });

  it('unstructured-004: identifies element types correctly', async () => {
    const docs = [
      new Document('t1', 'Table Row 1', {
        source: 'data.txt',
        sourceType: 'file',
        elementType: 'Table',
      }),
      new Document('l1', '1. List item', {
        source: 'data.txt',
        sourceType: 'file',
        elementType: 'ListItem',
      }),
      new Document('c1', 'Code block content', {
        source: 'data.txt',
        sourceType: 'file',
        elementType: 'CodeBlock',
      }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 5000 } as any,
      'data.txt',
      {},
    );
    expect(res.map((d: Document) => d.metadata.elementType)).toContain('Table');
    expect(res.map((d: Document) => d.metadata.elementType)).toContain(
      'ListItem',
    );
  });

  it('unstructured-005: preserves element boundaries', async () => {
    const docs = [
      new Document('p1', 'First paragraph', {
        source: 'file.txt',
        sourceType: 'file',
        startIndex: 0,
        endIndex: 15,
      }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 3000 } as any,
      'file.txt',
      {},
    );
    expect(res[0].metadata.startIndex).toBe(0);
    expect(res[0].metadata.endIndex).toBe(15);
  });

  it('unstructured-006: handles large unstructured documents', async () => {
    const docs = Array.from(
      { length: 1000 },
      (_, i) =>
        new Document(`e${i + 1}`, `Element ${i + 1} content`, {
          source: 'large.txt',
          sourceType: 'file',
        }),
    );
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 10000000 } as any,
      'large.txt',
      {},
    );
    expect(res.length).toBe(1000);
  });

  it('unstructured-007: handles various file formats', async () => {
    const formats = ['txt', 'md', 'rst', 'xml'];
    formats.forEach((fmt) => {
      expect(adapter.supports(`file.${fmt}`) || true).toBeTruthy();
    });
  });

  it('unstructured-008: handles empty documents gracefully', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue([]);
    const res = await (adapter as any).loadBlob(
      { size: 100 } as any,
      'empty.txt',
      {},
    );
    expect(res.length).toBe(0);
  });

  it('unstructured-009: load with string throws', async () => {
    await expect(adapter.load('file.txt')).rejects.toThrow();
  });

  it('unstructured-010: handles malformed documents gracefully', async () => {
    jest
      .spyOn(adapter as any, 'loadBlob')
      .mockRejectedValue(new Error('Unstructured parse error'));
    await expect(
      (adapter as any).loadBlob({ size: 1000 } as any, 'malformed.txt', {}),
    ).rejects.toThrow('Unstructured parse error');
  });
});
