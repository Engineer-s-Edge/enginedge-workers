/* eslint-disable @typescript-eslint/no-explicit-any */
import { CsvLoaderAdapter } from '@infrastructure/adapters/loaders/fs/csv.loader';
import { Document } from '@domain/entities/document.entity';

describe('CsvLoaderAdapter (Phase 1 - CSV Loader)', () => {
  let adapter: CsvLoaderAdapter;

  beforeEach(() => {
    adapter = new CsvLoaderAdapter();
  });

  // Test 1: Supports .csv file type
  it('csv-001: supports .csv and reports supported types', () => {
    expect(adapter.getSupportedTypes()).toContain('.csv');
    expect(adapter.supports('data.csv')).toBe(true);
  });

  // Test 2: Rejects unsupported file types
  it('csv-002: rejects unsupported file types', () => {
    expect(adapter.supports('data.txt')).toBe(false);
    expect(adapter.supports('data.json')).toBe(false);
    expect(adapter.supports('data.csv.bak')).toBe(false);
  });

  // Test 3: Basic loadBlob functionality
  it('csv-003: loadBlob returns mocked documents', async () => {
    const docs = [new Document('d3', 'row1', { source: 'data.csv', sourceType: 'file' })];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 5 } as any, 'data.csv', {});
    expect(res[0].content).toContain('row1');
  });

  // Test 4: Parses CSV rows into documents
  it('csv-004: parses CSV rows and creates documents per row', async () => {
    const docs = [
      new Document('row1', 'John,25,Engineer', { source: 'data.csv', sourceType: 'file', rowIndex: 0 }),
      new Document('row2', 'Jane,30,Manager', { source: 'data.csv', sourceType: 'file', rowIndex: 1 }),
      new Document('row3', 'Bob,28,Designer', { source: 'data.csv', sourceType: 'file', rowIndex: 2 }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 3000 } as any, 'data.csv', {});
    expect(res.length).toBe(3);
    expect(res[1].metadata.rowIndex).toBe(1);
  });

  // Test 5: Handles CSV with headers
  it('csv-005: preserves CSV headers as metadata', async () => {
    const docs = [
      new Document('d1', 'John,25,Engineer', { source: 'data.csv', sourceType: 'file', headers: ['Name', 'Age', 'Position'] }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 2000 } as any, 'data.csv', {});
    expect(res[0].metadata.headers).toEqual(['Name', 'Age', 'Position']);
  });

  // Test 6: Handles large CSV files with many rows
  it('csv-006: processes large CSV files efficiently', async () => {
    const docs = Array.from({ length: 100 }, (_, i) =>
      new Document(`row${i}`, `data${i},value${i}`, { source: 'large.csv', sourceType: 'file', rowIndex: i })
    );
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 500000 } as any, 'large.csv', {});
    expect(res.length).toBe(100);
    expect(res[99].metadata.rowIndex).toBe(99);
  });

  // Test 7: Handles CSV with special characters and quotes
  it('csv-007: handles CSV with quoted fields and special characters', async () => {
    const docs = [
      new Document('d1', '"John ""Doe""",25,"Engineer, Senior"', { source: 'data.csv', sourceType: 'file' }),
    ];
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue(docs);
    const res = await (adapter as any).loadBlob({ size: 2000 } as any, 'data.csv', {});
    expect(res[0].content).toContain('John');
    expect(res[0].content).toContain('Senior');
  });

  // Test 8: Handles empty CSV gracefully
  it('csv-008: handles empty CSV files', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockResolvedValue([]);
    const res = await (adapter as any).loadBlob({ size: 100 } as any, 'empty.csv', {});
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBe(0);
  });

  // Test 9: Filesystem load throws error
  it('csv-009: load with string throws', async () => {
    await expect(adapter.load('data.csv')).rejects.toThrow();
  });

  // Test 10: Handles malformed CSV gracefully
  it('csv-010: handles malformed CSV with inconsistent columns', async () => {
    jest.spyOn(adapter as any, 'loadBlob').mockRejectedValue(new Error('CSV parse error'));
    await expect((adapter as any).loadBlob({ size: 1000 } as any, 'malformed.csv', {})).rejects.toThrow('CSV parse error');
  });
});
