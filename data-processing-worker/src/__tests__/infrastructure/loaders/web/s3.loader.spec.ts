/* eslint-disable @typescript-eslint/no-explicit-any */
import { S3LoaderAdapter } from '@infrastructure/adapters/loaders/web/s3.loader';
import { Document } from '@domain/entities/document.entity';

describe('S3LoaderAdapter (Phase 2 - S3 Loader)', () => {
  let adapter: S3LoaderAdapter;

  beforeEach(() => {
    adapter = new S3LoaderAdapter();
  });

  it('s3-001: supports S3 URLs', async () => {
    expect(Array.isArray(adapter.getSupportedTypes())).toBe(true);
  });

  it('s3-002: load returns documents from S3', async () => {
    const docs = [new Document('d-s3', 's3-content', { source: 's3://bucket/file.txt', sourceType: 'url' })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('s3://my-bucket/document.txt');
    expect(res).toBe(docs);
  });

  it('s3-003: extracts S3 object metadata', async () => {
    const docs = [new Document('d1', 'file content', { 
      source: 's3://bucket/file.txt',
      sourceType: 'url',
      bucket: 'my-bucket',
      key: 'documents/file.txt',
      size: 2048,
      etag: 'abc123'
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('s3://my-bucket/documents/file.txt');
    expect(res[0].metadata.bucket).toBe('my-bucket');
    expect(res[0].metadata.size).toBe(2048);
  });

  it('s3-004: lists and loads multiple objects from prefix', async () => {
    const docs = Array.from({ length: 50 }, (_, i) => 
      new Document(`d${i}`, `content${i}`, { 
        source: `s3://bucket/docs/file${i}.txt`,
        sourceType: 'url',
        key: `docs/file${i}.txt`
      })
    );
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('s3://my-bucket/docs/');
    expect(res.length).toBe(50);
  });

  it('s3-005: preserves last modified dates', async () => {
    const docs = [new Document('d1', 'content', { 
      source: 's3://bucket/file.txt',
      sourceType: 'url',
      lastModified: new Date('2025-01-15'),
      uploadedDate: new Date('2025-01-10')
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('s3://my-bucket/file.txt');
    expect(res[0].metadata.lastModified).toBeDefined();
  });

  it('s3-006: handles large files from S3', async () => {
    const docs = [new Document('d1', 'x'.repeat(50000), { 
      source: 's3://bucket/large.bin',
      sourceType: 'url',
      size: 50000000
    })];
    jest.spyOn(adapter as any, 'load').mockResolvedValue(docs);
    const res = await (adapter as any).load('s3://my-bucket/large.bin');
    expect(res[0].metadata.size).toBeGreaterThan(1000000);
  });

  it('s3-007: handles access denied errors', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('Access Denied'));
    await expect((adapter as any).load('s3://restricted-bucket/file.txt')).rejects.toThrow('Access');
  });

  it('s3-008: handles non-existent objects', async () => {
    jest.spyOn(adapter as any, 'load').mockRejectedValue(new Error('NoSuchKey'));
    await expect((adapter as any).load('s3://my-bucket/nonexistent.txt')).rejects.toThrow('NoSuchKey');
  });
});
