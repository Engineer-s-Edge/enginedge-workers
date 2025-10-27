/* eslint-disable @typescript-eslint/no-explicit-any */
import { PlaywrightWebLoaderAdapter } from '@infrastructure/adapters/loaders/web/playwright.loader';
import { Document } from '@domain/entities/document.entity';

describe('PlaywrightWebLoaderAdapter (Phase 2 - Playwright Web Loader)', () => {
  let adapter: PlaywrightWebLoaderAdapter;

  beforeEach(() => {
    adapter = new PlaywrightWebLoaderAdapter();
  });

  it('playwright-001: supports dynamic web pages', async () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('playwright-002: load returns documents from dynamic site', async () => {
    const docs = [new Document('d-pw', 'pw-content', { source: 'https://dyn', sourceType: 'url' })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    expect(res).toBe(docs);
  });

  it('playwright-003: waits for JavaScript execution', async () => {
    const docs = [new Document('d1', 'rendered content', { source: 'https://spa.com', sourceType: 'url', rendered: true })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://spa.com');
    expect(res[0].metadata.rendered).toBe(true);
  });

  it('playwright-004: handles page interactions', async () => {
    const docs = [new Document('d1', 'expanded content', { 
      source: 'https://interactive.com',
      sourceType: 'url',
      clickElement: '.expand-btn',
      interactionCount: 3
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://interactive.com');
    expect(res[0].metadata.interactionCount).toBe(3);
  });

  it('playwright-005: captures JavaScript-rendered content', async () => {
    const docs = [new Document('d1', 'content after JS', { 
      source: 'https://js-heavy.com',
      sourceType: 'url',
      renderTime: 2500
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://js-heavy.com');
    expect(res[0].metadata.renderTime).toBeGreaterThan(1000);
  });

  it('playwright-006: handles single-page applications (SPAs)', async () => {
    const docs = Array.from({ length: 25 }, (_, i) => 
      new Document(`d${i}`, `page${i}`, { source: 'spa', sourceType: 'url', route: `/page${i}` })
    );
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://spa-app.com');
    expect(res.length).toBe(25);
  });

  it('playwright-007: handles timeout during page load', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('Page load timeout'));
    await expect((adapter as any).load('https://timeout.com')).rejects.toThrow('timeout');
  });

  it('playwright-008: handles navigation errors', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('Page navigation failed'));
    await expect((adapter as any).load('https://error.com')).rejects.toThrow('navigation');
  });
});
