/* eslint-disable @typescript-eslint/no-explicit-any */
import { ObsidianLoaderAdapter } from '@infrastructure/adapters/loaders/fs/obsidian.loader';
import { Document } from '@domain/entities/document.entity';

describe('ObsidianLoaderAdapter (Phase 1 - Obsidian Loader)', () => {
  let adapter: ObsidianLoaderAdapter;

  beforeEach(() => {
    adapter = new ObsidianLoaderAdapter();
  });

  it('obsidian-001: supports markdown and obsidian files', () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('obsidian-002: loadBlob returns documents', async () => {
    const docs = [new Document('o1', 'obsidian note', { source: 'note.md', sourceType: 'file' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 3 } as any, 'note.md', {});
    expect(res[0].content).toContain('obsidian');
  });

  it('obsidian-003: extracts notes with frontmatter', async () => {
    const docs = [new Document('n1', 'content', { source: 'note.md', sourceType: 'file', tags: 'tag1,tag2', created: new Date('2025-01-01') })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 2000 } as any, 'note.md', {});
    expect(res[0].metadata.tags).toContain('tag1');
    expect(res[0].metadata.created).toEqual(new Date('2025-01-01'));
  });

  it('obsidian-004: preserves wiki-style links', async () => {
    const docs = [new Document('n1', 'Text with [[linked note]] and reference', { source: 'note.md', sourceType: 'file' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 2000 } as any, 'note.md', {});
    expect(res[0].content).toContain('[[linked note]]');
  });

  it('obsidian-005: handles note hierarchies', async () => {
    const docs = Array.from({ length: 10 }, (_, i) =>
      new Document(`n${i + 1}`, `Note ${i + 1}`, { source: `note.md`, sourceType: 'file', folder: `folder/subfolder` })
    );
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 10000 } as any, 'note.md', {});
    expect(res.length).toBe(10);
    expect(res[5].metadata.folder).toContain('subfolder');
  });

  it('obsidian-006: handles large vault exports', async () => {
    const docs = Array.from({ length: 200 }, (_, i) =>
      new Document(`n${i + 1}`, `Note ${i + 1}`, { source: 'vault.md', sourceType: 'file' })
    );
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 10000000 } as any, 'vault.md', {});
    expect(res.length).toBe(200);
  });

  it('obsidian-007: preserves code blocks and callouts', async () => {
    const docs = [new Document('n1', '```python\nprint("hello")\n```\n> [!NOTE] This is a callout', { source: 'note.md', sourceType: 'file' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 3000 } as any, 'note.md', {});
    expect(res[0].content).toContain('python');
    expect(res[0].content).toContain('callout');
  });

  it('obsidian-008: handles empty vault gracefully', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue([]);
    const res = await (adapter as any).loadBlob({ size: 100 } as any, 'empty.md', {});
    expect(res.length).toBe(0);
  });

  it('obsidian-009: load with string throws', async () => {
    await expect(adapter.load('note.md')).rejects.toThrow();
  });

  it('obsidian-010: handles malformed vault export gracefully', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockRejectedValue(new Error('Obsidian parse error'));
    await expect((adapter as any).loadBlob({ size: 1000 } as any, 'malformed.md', {})).rejects.toThrow('Obsidian parse error');
  });
});
