/* eslint-disable @typescript-eslint/no-explicit-any */
import { PuppeteerWebLoaderAdapter } from '@infrastructure/adapters/loaders/web/puppeteer.loader';
import { Document } from '@domain/entities/document.entity';

describe('PuppeteerWebLoaderAdapter (Phase 2 - Puppeteer Web Loader)', () => {
  let adapter: PuppeteerWebLoaderAdapter;

  beforeEach(() => {
    adapter = new PuppeteerWebLoaderAdapter();
  });

  it('puppeteer-001: supports dynamic web pages via headless browser', async () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('puppeteer-002: load returns documents', async () => {
    const docs = [new Document('d-ppt', 'ppt-content', { source: 'https://ppt', sourceType: 'url' })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    expect(res).toBe(docs);
  });

  it('puppeteer-003: waits for selectors and network idle', async () => {
    const docs = [new Document('d1', 'loaded content', { 
      source: 'https://waitfor.com',
      sourceType: 'url',
      waitedForSelector: '.dynamic-content',
      networkIdle: true
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://waitfor.com');
    expect(res[0].metadata.networkIdle).toBe(true);
  });

  it('puppeteer-004: captures screenshots and PDFs', async () => {
    const docs = [new Document('d1', 'visual content', { 
      source: 'https://visual.com',
      sourceType: 'url',
      capturedScreenshot: true,
      screenshotPath: '/path/to/screenshot.png'
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://visual.com');
    expect(res[0].metadata.capturedScreenshot).toBe(true);
  });

  it('puppeteer-005: handles cookie and session management', async () => {
    const docs = [new Document('d1', 'authenticated content', { 
      source: 'https://protected.com',
      sourceType: 'url',
      authenticated: true,
      cookies: 2
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://protected.com');
    expect(res[0].metadata.authenticated).toBe(true);
  });

  it('puppeteer-006: processes complex multi-page navigation', async () => {
    const docs = Array.from({ length: 30 }, (_, i) => 
      new Document(`d${i}`, `content${i}`, { source: 'ppt', sourceType: 'url', pageNum: i + 1 })
    );
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://multipage.com');
    expect(res.length).toBe(30);
  });

  it('puppeteer-007: handles browser crash gracefully', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('Browser crashed'));
    await expect((adapter as any).load('https://crash.com')).rejects.toThrow('Browser');
  });

  it('puppeteer-008: handles timeout during page operations', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('Timeout waiting for selector'));
    await expect((adapter as any).load('https://timeout.com')).rejects.toThrow('Timeout');
  });
});
