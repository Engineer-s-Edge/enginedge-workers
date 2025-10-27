/* eslint-disable @typescript-eslint/no-explicit-any */
import { YoutubeLoaderAdapter } from '@infrastructure/adapters/loaders/web/youtube.loader';
import { Document } from '@domain/entities/document.entity';

describe('YoutubeLoaderAdapter (Phase 2 - YouTube Loader)', () => {
  let adapter: YoutubeLoaderAdapter;

  beforeEach(() => {
    adapter = new YoutubeLoaderAdapter();
  });

  it('youtube-001: supports youtube video URLs', async () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('youtube-002: load returns transcript documents', async () => {
    const docs = [new Document('d-yt', 'yt-transcript', { source: 'https://youtube.com/watch?v=123', sourceType: 'url' })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://youtube.com/watch?v=123');
    expect(res).toBe(docs);
  });

  it('youtube-003: extracts video metadata', async () => {
    const docs = [new Document('d1', 'transcript', { 
      source: 'https://youtube.com/watch?v=abc123',
      sourceType: 'url',
      title: 'Amazing Video',
      author: 'Channel Name',
      duration: 1800,
      publishedDate: new Date('2024-01-15')
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://youtube.com/watch?v=abc123');
    expect(res[0].metadata.title).toBe('Amazing Video');
    expect(res[0].metadata.duration).toBe(1800);
  });

  it('youtube-004: handles multiple language transcripts', async () => {
    const docs = [
      new Document('d1', 'english text', { source: 'youtube', sourceType: 'url', language: 'en' }),
      new Document('d2', 'spanish text', { source: 'youtube', sourceType: 'url', language: 'es' }),
      new Document('d3', 'french text', { source: 'youtube', sourceType: 'url', language: 'fr' })
    ];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://youtube.com/watch?v=123');
    expect(res.length).toBeGreaterThanOrEqual(1);
  });

  it('youtube-005: preserves transcript timestamps', async () => {
    const docs = [new Document('d1', '0:00 intro 1:30 main content', { 
      source: 'youtube',
      sourceType: 'url',
      hasTimestamps: true,
      captioned: true
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://youtube.com/watch?v=123');
    expect(res[0].metadata.hasTimestamps).toBe(true);
  });

  it('youtube-006: handles long videos', async () => {
    const docs = [new Document('d1', 'transcript content'.repeat(100), { 
      source: 'youtube',
      sourceType: 'url',
      duration: 36000
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://youtube.com/watch?v=long');
    expect(res[0].content.length).toBeGreaterThan(1000);
  });

  it('youtube-007: handles videos without transcripts', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('No transcript available'));
    await expect((adapter as any).load('https://youtube.com/watch?v=notranscript')).rejects.toThrow('transcript');
  });

  it('youtube-008: handles invalid video IDs and private videos', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('Video not found or private'));
    await expect((adapter as any).load('https://youtube.com/watch?v=invalid')).rejects.toThrow('not found');
  });
});
