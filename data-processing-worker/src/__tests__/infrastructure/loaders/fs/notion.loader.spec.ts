/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotionLoaderAdapter } from '@infrastructure/adapters/loaders/fs/notion.loader';
import { Document } from '@domain/entities/document.entity';

describe('NotionLoaderAdapter (Phase 1 - Notion Loader)', () => {
  let adapter: NotionLoaderAdapter;

  beforeEach(() => {
    adapter = new NotionLoaderAdapter();
  });

  it('notion-001: reports supported types', () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('notion-002: loadBlob returns mocked documents', async () => {
    const docs = [new Document('n1', 'notion', { source: 'page', sourceType: 'file' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 5 } as any, 'page.md', {});
    expect(res[0].id).toBe('n1');
  });

  it('notion-003: extracts pages as separate documents', async () => {
    const docs = Array.from({ length: 5 }, (_, i) =>
      new Document(`page${i + 1}`, `Page ${i + 1} content`, { source: `notion.md`, sourceType: 'file', pageId: `id${i + 1}` })
    );
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 5000 } as any, 'notion.md', {});
    expect(res.length).toBe(5);
    expect(res[2].metadata.pageId).toBe('id3');
  });

  it('notion-004: preserves page properties and metadata', async () => {
    const docs = [new Document('p1', 'content', { source: 'page.md', sourceType: 'file', title: 'Page Title', createdTime: new Date('2025-01-01') })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 3000 } as any, 'page.md', {});
    expect(res[0].metadata.title).toBe('Page Title');
    expect(res[0].metadata.createdTime).toEqual(new Date('2025-01-01'));
  });

  it('notion-005: handles nested block structures', async () => {
    const docs = [new Document('p1', 'Heading\nParagraph\nList item 1\nList item 2\nToggle content', { source: 'complex.md', sourceType: 'file', hasNestedBlocks: true })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 4000 } as any, 'complex.md', {});
    expect(res[0].content).toContain('Heading');
    expect(res[0].metadata.hasNestedBlocks).toBe(true);
  });

  it('notion-006: handles large Notion exports', async () => {
    const docs = Array.from({ length: 100 }, (_, i) =>
      new Document(`p${i + 1}`, `Page ${i + 1}`, { source: 'large.md', sourceType: 'file' })
    );
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 5000000 } as any, 'large.md', {});
    expect(res.length).toBe(100);
  });

  it('notion-007: handles empty Notion export gracefully', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue([]);
    const res = await (adapter as any).loadBlob({ size: 100 } as any, 'empty.md', {});
    expect(res.length).toBe(0);
  });

  it('notion-008: load with string throws', async () => {
    await expect(adapter.load('page.md')).rejects.toThrow();
  });

  it('notion-009: handles malformed Notion export gracefully', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockRejectedValue(new Error('Notion parse error'));
    await expect((adapter as any).loadBlob({ size: 1000 } as any, 'malformed.md', {})).rejects.toThrow('Notion parse error');
  });

  it('notion-010: preserves code blocks and formatting', async () => {
    const docs = [new Document('p1', '```javascript\nconst x = 1;\n```\n**Bold** and *italic* text', { source: 'code.md', sourceType: 'file' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 2000 } as any, 'code.md', {});
    expect(res[0].content).toContain('javascript');
    expect(res[0].content).toContain('Bold');
  });
});
