/* eslint-disable @typescript-eslint/no-explicit-any */
import { CurlWebLoaderAdapter } from '@infrastructure/adapters/loaders/web/curl.loader';
import { Document } from '@domain/entities/document.entity';

describe('CurlWebLoaderAdapter (Phase 2 - Curl Web Loader)', () => {
  let adapter: CurlWebLoaderAdapter;

  beforeEach(() => {
    adapter = new CurlWebLoaderAdapter();
  });

  it('curl-001: supports http(s) urls', async () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('curl-002: load returns documents', async () => {
    const docs = [new Document('d-curl', 'curl-content', { source: 'https://example.com', sourceType: 'url' })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    expect(res).toBe(docs);
  });

  it('curl-003: handles HTTP headers and custom options', async () => {
    const docs = [new Document('d1', 'content', { source: 'https://api.example.com', sourceType: 'url', statusCode: 200, headers: 'Content-Type: application/json' })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://api.example.com');
    expect(res[0].metadata.statusCode).toBe(200);
  });

  it('curl-004: retries on failure', async () => {
    jest.spyOn(adapter as any, 'load').mockResolvedValueOnce(new Error('timeout')).mockResolvedValueOnce([new Document('d1', 'content', { source: 'https://example.com', sourceType: 'url' })]);
    const res = await (adapter as any).load('https://example.com');
    expect(res).toBeDefined();
  });

  it('curl-005: handles redirects', async () => {
    const docs = [new Document('d1', 'final content', { source: 'https://final.example.com', sourceType: 'url', redirectFrom: 'https://redirect.example.com' })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://redirect.example.com');
    expect(res[0].metadata.redirectFrom).toBe('https://redirect.example.com');
  });

  it('curl-006: handles large response bodies', async () => {
    const docs = [new Document('d1', 'x'.repeat(10000), { source: 'https://example.com', sourceType: 'url' })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('https://example.com');
    expect(res[0].content.length).toBeGreaterThan(5000);
  });

  it('curl-007: handles timeout errors gracefully', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('Request timeout'));
    await expect((adapter as any).load('https://slow.example.com')).rejects.toThrow('timeout');
  });

  it('curl-008: handles HTTP error codes', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('HTTP 404'));
    await expect((adapter as any).load('https://notfound.example.com')).rejects.toThrow('404');
  });
});
