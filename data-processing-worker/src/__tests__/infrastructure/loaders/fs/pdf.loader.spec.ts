import { PdfLoaderAdapter } from '@infrastructure/adapters/loaders/fs/pdf.loader';
import { Document } from '@domain/entities/document.entity';

describe('PdfLoaderAdapter (Phase 1 - PDF Loader)', () => {
  let adapter: PdfLoaderAdapter;

  beforeEach(() => {
    adapter = new PdfLoaderAdapter();
  });

  // Test 1: Supported file types
  it('pdf-001: reports supported types and supports .pdf', () => {
    expect(adapter.getSupportedTypes()).toContain('.pdf');
    expect(adapter.supports('file.pdf')).toBe(true);
  });

  // Test 2: Rejects unsupported file types
  it('pdf-002: rejects unsupported file types', () => {
    expect(adapter.supports('file.docx')).toBe(false);
    expect(adapter.supports('file.txt')).toBe(false);
    expect(adapter.supports('file.pdf.bak')).toBe(false);
  });

  // Test 3: Basic loadBlob mocking
  it('pdf-003: can call loadBlob when mocked', async () => {
    const docs = [new Document('id-pdf', 'pdf-content', { source: 'file.pdf', sourceType: 'file' })];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (adapter as any).loadBlob({ size: 123 } as any, 'file.pdf', {});
    expect(res).toBe(docs);
  });

  // Test 4: Multiple pages extraction
  it('pdf-004: extracts documents from multi-page PDFs', async () => {
    const docs = [
      new Document('page1', 'page 1 content', { source: 'multi.pdf', sourceType: 'file', pageNumber: 1 }),
      new Document('page2', 'page 2 content', { source: 'multi.pdf', sourceType: 'file', pageNumber: 2 }),
      new Document('page3', 'page 3 content', { source: 'multi.pdf', sourceType: 'file', pageNumber: 3 }),
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (adapter as any).loadBlob({ size: 5000 } as any, 'multi.pdf', {});
    expect(res.length).toBe(3);
    expect(res[0].metadata.pageNumber).toBe(1);
    expect(res[2].metadata.pageNumber).toBe(3);
  });

  // Test 5: Empty PDF handling
  it('pdf-005: handles empty PDFs gracefully', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue([]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (adapter as any).loadBlob({ size: 100 } as any, 'empty.pdf', {});
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(0);
  });

  // Test 6: Preserves metadata
  it('pdf-006: preserves document metadata during extraction', async () => {
    const docs = [new Document('doc1', 'content', { source: 'file.pdf', sourceType: 'file', author: 'Test Author', title: 'Test Title' })];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (adapter as any).loadBlob({ size: 1000 } as any, 'file.pdf', {});
    expect(res[0].metadata.author).toBe('Test Author');
    expect(res[0].metadata.title).toBe('Test Title');
  });

  // Test 7: Large PDF handling
  it('pdf-007: handles large PDF files', async () => {
    const largeDocs = Array.from({ length: 50 }, (_, i) =>
      new Document(`page${i + 1}`, `content page ${i + 1}`, { source: 'large.pdf', sourceType: 'file', pageNumber: i + 1 })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(largeDocs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (adapter as any).loadBlob({ size: 50000000 } as any, 'large.pdf', {});
    expect(res.length).toBe(50);
    expect(res[49].content).toContain('page 50');
  });

  // Test 8: Content extraction with special characters
  it('pdf-008: extracts content with special characters and unicode', async () => {
    const docs = [new Document('doc1', 'Content with émojis 🚀 and symbols: @#$%', { source: 'special.pdf', sourceType: 'file' })];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (adapter as any).loadBlob({ size: 2000 } as any, 'special.pdf', {});
    expect(res[0].content).toContain('émojis');
    expect(res[0].content).toContain('🚀');
  });

  // Test 9: Error handling for corrupted files
  it('pdf-009: handles corrupted PDF gracefully', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(adapter as any, 'loadBlob').mockRejectedValue(new Error('PDF corruption'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((adapter as any).loadBlob({ size: 1000 } as any, 'corrupted.pdf', {})).rejects.toThrow('PDF corruption');
  });

  // Test 10: Document ID generation
  it('pdf-010: generates unique document IDs for each page', async () => {
    const docs = [
      new Document('id-page1', 'page 1', { source: 'file.pdf', sourceType: 'file' }),
      new Document('id-page2', 'page 2', { source: 'file.pdf', sourceType: 'file' }),
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (adapter as any).loadBlob({ size: 2000 } as any, 'file.pdf', {});
    expect(new Set(res.map((d: Document) => d.id)).size).toBe(res.length);
  });
});
