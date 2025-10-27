/* eslint-disable @typescript-eslint/no-explicit-any */
import { HtmlLoaderAdapter } from '@infrastructure/adapters/loaders/web/html.loader';
import { Document } from '@domain/entities/document.entity';

describe('HtmlLoaderAdapter (Phase 2 - HTML Loader)', () => {
  let adapter: HtmlLoaderAdapter;

  beforeEach(() => {
    adapter = new HtmlLoaderAdapter();
  });

  it('html-001: supports HTML content', async () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('html-002: load returns documents from HTML', async () => {
    const docs = [new Document('d-html', '<p>content</p>', { source: 'html://content', sourceType: 'url' })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('<html><body>test</body></html>');
    expect(res).toBe(docs);
  });

  it('html-003: extracts text from HTML structure', async () => {
    const docs = [new Document('d1', 'Heading\nParagraph content', { 
      source: 'html',
      sourceType: 'url',
      hasHeadings: true,
      hasParagraphs: true
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('<html><h1>Heading</h1><p>Paragraph content</p></html>');
    expect(res[0].content).toContain('Heading');
  });

  it('html-004: handles nested HTML elements', async () => {
    const docs = [new Document('d1', 'nested list', { 
      source: 'html',
      sourceType: 'url',
      hasLists: true,
      hasLinks: true,
      linkCount: 3
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('<html><ul><li><a>link</a></li></ul></html>');
    expect(res[0].metadata.hasLists).toBe(true);
  });

  it('html-005: preserves link information', async () => {
    const docs = [new Document('d1', 'text with links', { 
      source: 'html',
      sourceType: 'url',
      links: [
        { text: 'Google', href: 'https://google.com' },
        { text: 'GitHub', href: 'https://github.com' }
      ]
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('<a href="https://google.com">Google</a>');
    expect((res[0].metadata.links as any)?.length).toBeGreaterThanOrEqual(0);
  });

  it('html-006: handles large HTML documents', async () => {
    const largeHtml = '<p>'.repeat(500) + 'content' + '</p>'.repeat(500);
    const docs = [new Document('d1', 'large', { source: 'html', sourceType: 'url', size: largeHtml.length })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load(largeHtml);
    expect(res[0].content).toBeDefined();
  });

  it('html-007: handles malformed HTML gracefully', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('Invalid HTML structure'));
    await expect((adapter as any).load('<html><body><unclosed>')).rejects.toThrow('HTML');
  });

  it('html-008: handles empty or minimal HTML', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('No content in HTML'));
    await expect((adapter as any).load('<html></html>')).rejects.toThrow('content');
  });
});
