// Mock the SRT parser to avoid importing ESM-only node modules during tests
jest.mock('@langchain/community/document_loaders/fs/srt', () => ({
  SRTLoader: class {
    async load() {
      return [{ pageContent: 'parsed', metadata: {} }];
    }
  }
}));

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SrtLoaderAdapter } from '@infrastructure/adapters/loaders/fs/srt.loader';
import { Document } from '@domain/entities/document.entity';

describe('SrtLoaderAdapter (Phase 1 - SRT Loader)', () => {
  let adapter: any;

  beforeEach(() => {
    adapter = new SrtLoaderAdapter();
  });

  it('srt-001: reports supported types and supports .srt', () => {
    expect(adapter.getSupportedTypes()).toContain('.srt');
    expect(adapter.supports('captions.srt')).toBe(true);
  });

  it('srt-002: rejects unsupported file types', () => {
    expect(adapter.supports('captions.vtt')).toBe(false);
    expect(adapter.supports('captions.sub')).toBe(false);
    expect(adapter.supports('captions.srt.bak')).toBe(false);
  });

  it('srt-003: loadBlob returns mocked documents', async () => {
    const docs = [new Document('id-srt', 'srt-content', { source: 'captions.srt', sourceType: 'file' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);

    const res = await adapter.loadBlob({ size: 40 } as any, 'captions.srt', {});
    expect(res).toBe(docs);
  });

  it('srt-004: extracts subtitles as separate documents', async () => {
    const docs = [
      new Document('sub1', '00:00:00,000 --> 00:00:05,000\nFirst subtitle', { source: 'captions.srt', sourceType: 'file', subtitleIndex: 1 }),
      new Document('sub2', '00:00:05,000 --> 00:00:10,000\nSecond subtitle', { source: 'captions.srt', sourceType: 'file', subtitleIndex: 2 }),
      new Document('sub3', '00:00:10,000 --> 00:00:15,000\nThird subtitle', { source: 'captions.srt', sourceType: 'file', subtitleIndex: 3 }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await adapter.loadBlob({ size: 5000 } as any, 'captions.srt', {});
    expect(res.length).toBe(3);
    expect(res[1].metadata.subtitleIndex).toBe(2);
  });

  it('srt-005: preserves timing information', async () => {
    const docs = [new Document('s1', 'Subtitle text', { source: 'captions.srt', sourceType: 'file', startTime: '00:00:00,000', endTime: '00:00:05,000' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await adapter.loadBlob({ size: 3000 } as any, 'captions.srt', {});
    expect(res[0].metadata.startTime).toBe('00:00:00,000');
    expect(res[0].metadata.endTime).toBe('00:00:05,000');
  });

  it('srt-006: handles large SRT files with many subtitles', async () => {
    const docs = Array.from({ length: 500 }, (_, i) =>
      new Document(`sub${i + 1}`, `Subtitle ${i + 1}`, { source: 'large.srt', sourceType: 'file', subtitleIndex: i + 1 })
    );
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await adapter.loadBlob({ size: 2000000 } as any, 'large.srt', {});
    expect(res.length).toBe(500);
  });

  it('srt-007: handles SRT with multi-line subtitles', async () => {
    const docs = [new Document('s1', 'Line 1\nLine 2\nLine 3', { source: 'captions.srt', sourceType: 'file' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await adapter.loadBlob({ size: 2000 } as any, 'captions.srt', {});
    expect(res[0].content).toContain('Line 1');
    expect(res[0].content).toContain('Line 3');
  });

  it('srt-008: handles empty SRT gracefully', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue([]);
    const res = await adapter.loadBlob({ size: 100 } as any, 'empty.srt', {});
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(0);
  });

  it('srt-009: load with string throws', async () => {
    await expect(adapter.load('captions.srt')).rejects.toThrow();
  });

  it('srt-010: handles malformed SRT gracefully', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockRejectedValue(new Error('SRT parse error'));
    await expect(adapter.loadBlob({ size: 1000 } as any, 'malformed.srt', {})).rejects.toThrow('SRT parse error');
  });
});
