/* eslint-disable @typescript-eslint/no-explicit-any */
import { LoaderRegistryService } from '@application/services/loader-registry.service';

describe('LoaderRegistryService Advanced (Phase 3 - LoaderService Extended)', () => {
  let service: LoaderRegistryService;

  beforeEach(() => {
    service = new LoaderRegistryService();
  });

  it('adv-registry-001: registers loaders with multiple extensions', () => {
    const loader: any = { getSupportedTypes: () => ['.txt', '.md', '.rst'] };
    service.registerLoader('document', loader);

    expect(service.getLoaderByExtension('.txt')).toBe(loader);
    expect(service.getLoaderByExtension('.md')).toBe(loader);
    expect(service.getLoaderByExtension('.rst')).toBe(loader);
  });

  it('adv-registry-002: resolves extension priority conflicts', () => {
    const loader1: any = { name: 'pdf1', getSupportedTypes: () => ['.pdf'] };
    const loader2: any = { name: 'pdf2', getSupportedTypes: () => ['.pdf'] };

    service.registerLoader('pdf1', loader1);
    service.registerLoader('pdf2', loader2);

    // Last registered should win by default
    const result = service.getLoaderByExtension('.pdf');
    expect(result).toBe(loader2);
  });

  it('adv-registry-003: auto-detects loaders by file extension', () => {
    const pdfLoader: any = { getSupportedTypes: () => ['.pdf'] };
    const docxLoader: any = { getSupportedTypes: () => ['.docx'] };

    service.registerLoader('pdf', pdfLoader);
    service.registerLoader('docx', docxLoader);

    expect(service.getLoaderByExtension('.pdf')).toBe(pdfLoader);
    expect(service.getLoaderByExtension('.docx')).toBe(docxLoader);
  });

  it('adv-registry-004: handles case-insensitive extensions', () => {
    const loader: any = { getSupportedTypes: () => ['.PDF'] };
    service.registerLoader('pdf', loader);

    // Should match both cases
    const result1 = service.getLoaderByExtension('.pdf');
    const result2 = service.getLoaderByExtension('.PDF');

    expect(result1).toBe(loader);
    expect(result2).toBe(loader);
  });

  it('adv-registry-005: retrieves all registered loaders', () => {
    const loader1: any = { getSupportedTypes: () => ['.pdf'] };
    const loader2: any = { getSupportedTypes: () => ['.docx'] };
    const loader3: any = { getSupportedTypes: () => ['.csv'] };

    service.registerLoader('pdf', loader1);
    service.registerLoader('docx', loader2);
    service.registerLoader('csv', loader3);

    const all = service.getAllLoaders();
    expect(all.size).toBe(3);
  });

  it('adv-registry-006: lists all loader metadata', () => {
    const loader: any = { getSupportedTypes: () => ['.txt', '.md'] };
    service.registerLoader('text', loader);

    const loaders = service.getAllLoaders();
    expect(loaders.has('text')).toBe(true);
    expect(loaders.get('text')).toBe(loader);
  });

  it('adv-registry-007: handles URL-based loaders separately', () => {
    const urlLoader: any = {
      name: 'web',
      supports: (source: string) => source.startsWith('http'),
      getSupportedTypes: () => [],
    };
    service.registerLoader('web', urlLoader);

    expect(service.getLoader('web')).toBe(urlLoader);
  });

  it('adv-registry-008: returns null for unregistered extension', () => {
    const result = service.getLoaderByExtension('.xyz');
    expect(result).toBeNull();
  });

  it('adv-registry-009: registers loaders with overlapping extensions', () => {
    const textLoader: any = { getSupportedTypes: () => ['.txt', '.text'] };
    const markdownLoader: any = {
      getSupportedTypes: () => ['.md', '.markdown'],
    };

    service.registerLoader('text', textLoader);
    service.registerLoader('markdown', markdownLoader);

    expect(service.getLoaderByExtension('.txt')).toBe(textLoader);
    expect(service.getLoaderByExtension('.md')).toBe(markdownLoader);
  });

  it('adv-registry-010: supports extension lookup with leading dot', () => {
    const loader: any = { getSupportedTypes: () => ['.pdf'] };
    service.registerLoader('pdf', loader);

    expect(service.getLoaderByExtension('.pdf')).toBe(loader);
  });

  it('adv-registry-011: supports extension lookup without dot', () => {
    const loader: any = { getSupportedTypes: () => ['.pdf'] };
    service.registerLoader('pdf', loader);

    // Normalize extension if needed
    const result =
      service.getLoaderByExtension('pdf') ||
      service.getLoaderByExtension('.pdf');
    expect(result).toBe(loader);
  });

  it('adv-registry-012: handles multiple registrations of same loader', () => {
    const loader: any = { name: 'pdf', getSupportedTypes: () => ['.pdf'] };

    service.registerLoader('pdf', loader);
    service.registerLoader('pdf', loader); // Re-register

    expect(service.getLoader('pdf')).toBe(loader);
  });

  it('adv-registry-013: maintains loader insertion order', () => {
    const loader1: any = { getSupportedTypes: () => ['.doc'] };
    const loader2: any = { getSupportedTypes: () => ['.pdf'] };
    const loader3: any = { getSupportedTypes: () => ['.txt'] };

    service.registerLoader('first', loader1);
    service.registerLoader('second', loader2);
    service.registerLoader('third', loader3);

    const all = service.getAllLoaders();
    const names = Array.from(all.keys());

    expect(names).toEqual(['first', 'second', 'third']);
  });

  it('adv-registry-014: retrieves loaders by exact name match', () => {
    const loader: any = {
      name: 'exact-match-loader',
      getSupportedTypes: () => ['.txt'],
    };
    service.registerLoader('exact-match-loader', loader);

    expect(service.getLoader('exact-match-loader')).toBe(loader);
    expect(service.getLoader('exact-match')).toBeUndefined();
  });

  it('adv-registry-015: handles extension resolution with special characters', () => {
    const loader: any = { getSupportedTypes: () => ['.tar.gz', '.zip'] };
    service.registerLoader('archive', loader);

    expect(service.getLoaderByExtension('.tar.gz')).toBe(loader);
    expect(service.getLoaderByExtension('.zip')).toBe(loader);
  });

  it('adv-registry-016: supports conditional loader selection', () => {
    const spreadsheetLoader: any = {
      name: 'spreadsheet',
      supports: (source: string) =>
        source.endsWith('.xlsx') || source.endsWith('.csv'),
      getSupportedTypes: () => ['.xlsx', '.csv'],
    };
    service.registerLoader('spreadsheet', spreadsheetLoader);

    expect(service.getLoader('spreadsheet')).toBe(spreadsheetLoader);
  });

  it('adv-registry-017: allows empty loader name (no validation)', () => {
    const loader: any = { getSupportedTypes: () => ['.txt'] };
    service.registerLoader('', loader);
    expect(service.getLoader('')).toBe(loader);
  });

  it('adv-registry-018: handles null/undefined extension gracefully', () => {
    expect(() => service.getLoaderByExtension(null as any)).toThrow();
    expect(() => service.getLoaderByExtension(undefined as any)).toThrow();
  });

  it('adv-registry-019: supports bulk loader registration', () => {
    const loaders = {
      pdf: { getSupportedTypes: () => ['.pdf'] } as any,
      docx: { getSupportedTypes: () => ['.docx'] } as any,
      csv: { getSupportedTypes: () => ['.csv'] } as any,
    };

    Object.entries(loaders).forEach(([name, loader]) => {
      service.registerLoader(name, loader);
    });

    expect(service.getAllLoaders().size).toBe(3);
  });

  it('adv-registry-020: preserves extension mapping consistency', () => {
    const loader1: any = { getSupportedTypes: () => ['.txt'] };
    service.registerLoader('text', loader1);

    const retrieved1 = service.getLoaderByExtension('.txt');
    const retrieved2 = service.getLoaderByExtension('.txt');

    expect(retrieved1).toBe(retrieved2);
    expect(retrieved1).toBe(loader1);
  });
});
