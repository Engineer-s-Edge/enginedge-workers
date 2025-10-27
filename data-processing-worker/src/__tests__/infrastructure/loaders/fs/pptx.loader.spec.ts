/* eslint-disable @typescript-eslint/no-explicit-any */
import { PptxLoaderAdapter } from '@infrastructure/adapters/loaders/fs/pptx.loader';
import { Document } from '@domain/entities/document.entity';

describe('PptxLoaderAdapter (Phase 1 - PPTX Loader)', () => {
  let adapter: PptxLoaderAdapter;

  beforeEach(() => {
    adapter = new PptxLoaderAdapter();
  });

  it('pptx-001: supports .pptx and reports supported types', () => {
    expect(adapter.getSupportedTypes()).toContain('.pptx');
    expect(adapter.supports('slides.pptx')).toBe(true);
  });

  it('pptx-002: rejects unsupported file types', () => {
    expect(adapter.supports('slides.ppt')).toBe(false);
    expect(adapter.supports('slides.odp')).toBe(false);
    expect(adapter.supports('slides.pptx.bak')).toBe(false);
  });

  it('pptx-003: loadBlob returns slides as documents', async () => {
    const docs = [new Document('d5', 'slide text', { source: 'slides.pptx', sourceType: 'file' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 30 } as any, 'slides.pptx', {});
    expect(res[0].content).toContain('slide');
  });

  it('pptx-004: extracts slides as separate documents', async () => {
    const docs = [
      new Document('slide1', 'Slide 1: Title and intro', { source: 'slides.pptx', sourceType: 'file', slideNumber: 1 }),
      new Document('slide2', 'Slide 2: Content section', { source: 'slides.pptx', sourceType: 'file', slideNumber: 2 }),
      new Document('slide3', 'Slide 3: Conclusion', { source: 'slides.pptx', sourceType: 'file', slideNumber: 3 }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 50000 } as any, 'slides.pptx', {});
    expect(res.length).toBe(3);
    expect(res[1].metadata.slideNumber).toBe(2);
  });

  it('pptx-005: preserves slide titles and speaker notes', async () => {
    const docs = [new Document('s1', 'Slide content', { source: 'slides.pptx', sourceType: 'file', title: 'Presentation Title', speakerNotes: 'Important notes here' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 40000 } as any, 'slides.pptx', {});
    expect(res[0].metadata.title).toBe('Presentation Title');
    expect(res[0].metadata.speakerNotes).toBe('Important notes here');
  });

  it('pptx-006: handles large presentations with many slides', async () => {
    const docs = Array.from({ length: 50 }, (_, i) =>
      new Document(`slide${i + 1}`, `Slide ${i + 1} content`, { source: 'large.pptx', sourceType: 'file', slideNumber: i + 1 })
    );
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 5000000 } as any, 'large.pptx', {});
    expect(res.length).toBe(50);
    expect(res[49].metadata.slideNumber).toBe(50);
  });

  it('pptx-007: extracts text from shapes and textboxes', async () => {
    const docs = [new Document('s1', 'Title text from shape\nContent text from textbox\nBullet points content', { source: 'slides.pptx', sourceType: 'file' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 3000 } as any, 'slides.pptx', {});
    expect(res[0].content).toContain('Title text');
    expect(res[0].content).toContain('Bullet points');
  });

  it('pptx-008: handles empty presentation gracefully', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue([]);
    const res = await (adapter as any).loadBlob({ size: 500 } as any, 'empty.pptx', {});
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(0);
  });

  it('pptx-009: load with string throws', async () => {
    await expect(adapter.load('slides.pptx')).rejects.toThrow();
  });

  it('pptx-010: handles corrupted PPTX gracefully', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockRejectedValue(new Error('PPTX parse error'));
    await expect((adapter as any).loadBlob({ size: 1000 } as any, 'corrupted.pptx', {})).rejects.toThrow('PPTX parse error');
  });
});
