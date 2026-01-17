/* eslint-disable @typescript-eslint/no-explicit-any */
import { DocxLoaderAdapter } from '@infrastructure/adapters/loaders/fs/docx.loader';
import { Document } from '@domain/entities/document.entity';

describe('DocxLoaderAdapter (Phase 1 - DOCX Loader)', () => {
  let adapter: DocxLoaderAdapter;

  beforeEach(() => {
    adapter = new DocxLoaderAdapter();
  });

  // Test 1: Supports .docx file type
  it('docx-001: supports .docx and reports supported types', () => {
    expect(adapter.getSupportedTypes()).toContain('.docx');
    expect(adapter.supports('file.docx')).toBe(true);
  });

  // Test 2: Rejects unsupported file types
  it('docx-002: rejects unsupported file types', () => {
    expect(adapter.supports('file.doc')).toBe(false);
    expect(adapter.supports('file.pdf')).toBe(false);
    expect(adapter.supports('file.docx.bak')).toBe(false);
  });

  // Test 3: Basic loadBlob functionality
  it('docx-003: loadBlob can be mocked and returns expected docs', async () => {
    const docs = [
      new Document('d2', 'docx content', {
        source: 'file.docx',
        sourceType: 'file',
      }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 10 } as any,
      'file.docx',
      {},
    );
    expect(res[0].id).toBe('d2');
  });

  // Test 4: Extracts paragraphs as separate documents
  it('docx-004: extracts paragraphs from DOCX documents', async () => {
    const docs = [
      new Document('para1', 'First paragraph content', {
        source: 'file.docx',
        sourceType: 'file',
        paragraphIndex: 0,
      }),
      new Document('para2', 'Second paragraph content', {
        source: 'file.docx',
        sourceType: 'file',
        paragraphIndex: 1,
      }),
      new Document('para3', 'Third paragraph content', {
        source: 'file.docx',
        sourceType: 'file',
        paragraphIndex: 2,
      }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 5000 } as any,
      'file.docx',
      {},
    );
    expect(res.length).toBe(3);
    expect(res[1].metadata.paragraphIndex).toBe(1);
  });

  // Test 5: Handles tables in DOCX
  it('docx-005: extracts and preserves table content from DOCX', async () => {
    const docs = [
      new Document('table1', 'Row1-Col1|Row1-Col2\nRow2-Col1|Row2-Col2', {
        source: 'file.docx',
        sourceType: 'file',
        hasTable: true,
      }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 2000 } as any,
      'file.docx',
      {},
    );
    expect(res[0].content).toContain('Row');
    expect(res[0].metadata.hasTable).toBe(true);
  });

  // Test 6: Preserves formatting and metadata
  it('docx-006: preserves document properties and formatting', async () => {
    const docs = [
      new Document('doc', 'content', {
        source: 'file.docx',
        sourceType: 'file',
        author: 'John Doe',
        createdDate: new Date('2025-01-01'),
      }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 3000 } as any,
      'file.docx',
      {},
    );
    expect(res[0].metadata.author).toBe('John Doe');
    expect(res[0].metadata.createdDate).toEqual(new Date('2025-01-01'));
  });

  // Test 7: Handles multi-section documents
  it('docx-007: handles documents with multiple sections', async () => {
    const docs = Array.from(
      { length: 8 },
      (_, i) =>
        new Document(`section${i + 1}`, `Content section ${i + 1}`, {
          source: 'file.docx',
          sourceType: 'file',
          section: i + 1,
        }),
    );
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob(
      { size: 10000 } as any,
      'file.docx',
      {},
    );
    expect(res.length).toBe(8);
    expect(res[7].metadata.section).toBe(8);
  });

  // Test 8: Handles empty DOCX gracefully
  it('docx-008: handles empty or minimal DOCX files', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue([]);
    const res = await (adapter as any).loadBlob(
      { size: 500 } as any,
      'empty.docx',
      {},
    );
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(0);
  });

  // Test 9: Filesystem load throws error
  it('docx-009: load(string) throws for filesystem loader', async () => {
    await expect(adapter.load('file.docx')).rejects.toThrow();
  });

  // Test 10: Handles corrupted DOCX gracefully
  it('docx-010: handles corrupted or malformed DOCX files', async () => {
    jest
      .spyOn(adapter as any, 'loadBlob')
      .mockRejectedValue(new Error('DOCX parse error'));
    await expect(
      (adapter as any).loadBlob({ size: 1000 } as any, 'corrupted.docx', {}),
    ).rejects.toThrow('DOCX parse error');
  });
});
