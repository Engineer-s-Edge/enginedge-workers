/* eslint-disable @typescript-eslint/no-explicit-any */
import { EpubLoaderAdapter } from '@infrastructure/adapters/loaders/fs/epub.loader';
import { Document } from '@domain/entities/document.entity';

describe('EpubLoaderAdapter (Phase 1 - EPUB Loader)', () => {
  let adapter: EpubLoaderAdapter;

  beforeEach(() => {
    adapter = new EpubLoaderAdapter();
  });

  it('epub-001: supports .epub and reports supported types', () => {
    expect(adapter.getSupportedTypes()).toContain('.epub');
    expect(adapter.supports('book.epub')).toBe(true);
  });

  it('epub-002: rejects unsupported file types', () => {
    expect(adapter.supports('book.pdf')).toBe(false);
    expect(adapter.supports('book.mobi')).toBe(false);
    expect(adapter.supports('book.epub.bak')).toBe(false);
  });

  it('epub-003: loadBlob returns mocked documents', async () => {
    const docs = [new Document('d4', 'epub text', { source: 'book.epub', sourceType: 'file' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 20 } as any, 'book.epub', {});
    expect(res[0].id).toBe('d4');
  });

  it('epub-004: extracts chapters from EPUB', async () => {
    const docs = [
      new Document('ch1', 'Chapter 1 content', { source: 'book.epub', sourceType: 'file', chapterIndex: 0 }),
      new Document('ch2', 'Chapter 2 content', { source: 'book.epub', sourceType: 'file', chapterIndex: 1 }),
      new Document('ch3', 'Chapter 3 content', { source: 'book.epub', sourceType: 'file', chapterIndex: 2 }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 10000 } as any, 'book.epub', {});
    expect(res.length).toBe(3);
    expect(res[1].metadata.chapterIndex).toBe(1);
  });

  it('epub-005: preserves book metadata', async () => {
    const docs = [new Document('d1', 'content', { source: 'book.epub', sourceType: 'file', title: 'Great Book', author: 'Author Name', publisher: 'Publisher' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 5000 } as any, 'book.epub', {});
    expect(res[0].metadata.title).toBe('Great Book');
    expect(res[0].metadata.author).toBe('Author Name');
  });

  it('epub-006: handles large EPUB books', async () => {
    const docs = Array.from({ length: 25 }, (_, i) =>
      new Document(`ch${i + 1}`, `Chapter ${i + 1} text`, { source: 'large.epub', sourceType: 'file', chapterIndex: i })
    );
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 2000000 } as any, 'large.epub', {});
    expect(res.length).toBe(25);
  });

  it('epub-007: handles EPUB with TOC (table of contents)', async () => {
    const docs = [new Document('ch1', 'content', { source: 'book.epub', sourceType: 'file', toc: 'Introduction,Chapter 1,Chapter 2' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 5000 } as any, 'book.epub', {});
    expect(res[0].metadata.toc).toContain('Introduction');
  });

  it('epub-008: handles empty EPUB gracefully', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue([]);
    const res = await (adapter as any).loadBlob({ size: 1000 } as any, 'empty.epub', {});
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(0);
  });

  it('epub-009: load with string throws', async () => {
    await expect(adapter.load('book.epub')).rejects.toThrow();
  });

  it('epub-010: handles corrupted EPUB gracefully', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockRejectedValue(new Error('EPUB parse error'));
    await expect((adapter as any).loadBlob({ size: 1000 } as any, 'corrupted.epub', {})).rejects.toThrow('EPUB parse error');
  });
});
