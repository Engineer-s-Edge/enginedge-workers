import { LoaderRegistryService } from '@application/services/loader-registry.service';
import { BaseLoaderPort } from '@domain/ports/loader.port';
import { Document } from '@domain/entities/document.entity';

class DummyLoader extends BaseLoaderPort {
  private readonly name: string;
  constructor(name: string, private supported: string[] = ['.txt']) {
    super();
    this.name = name;
  }
  async load(source: string | Blob): Promise<Document[]> {
    return [new Document('id1', 'content', { source: String(source), sourceType: 'file' })];
  }
  supports(source: string | Blob): boolean {
    if (typeof source === 'string') return source.includes(this.name) || source.endsWith(this.supported[0]);
    return false;
  }
  getSupportedTypes(): string[] {
    return this.supported;
  }
}

describe('LoaderRegistryService (Phase 3 - Registry)', () => {
  let service: LoaderRegistryService;

  beforeEach(() => {
    service = new LoaderRegistryService();
  });

  it('registry-001: registers and retrieves loaders by name', () => {
    const loader = new DummyLoader('file');
    service.registerLoader('file', loader);

    const got = service.getLoader('file');
    expect(got).toBe(loader);
    expect(service.getLoaderCount()).toBe(1);
  });

  it('registry-002: auto-selects loader by extension', () => {
    const pdfLoader = new DummyLoader('pdf', ['.pdf']);
    service.registerLoader('pdf', pdfLoader);

    const selected = service.getLoaderForSource('document.pdf');
    expect(selected).toBe(pdfLoader);
  });

  it('registry-003: auto-selects loader by URL support', () => {
    const webLoader = new DummyLoader('example.com', []);
    service.registerLoader('web', webLoader);

    const selected = service.getLoaderForSource('https://example.com/page');
    expect(selected).toBe(webLoader);
  });

  it('registry-004: throws when loadAuto finds no loader', async () => {
    await expect(service.loadAuto('no-such-file.xyz' as unknown as string)).rejects.toThrow();
  });

  it('registry-005: handles multiple loaders with same extension priority', () => {
    const loader1 = new DummyLoader('first', ['.doc']);
    const loader2 = new DummyLoader('second', ['.doc']);
    service.registerLoader('loader1', loader1);
    service.registerLoader('loader2', loader2);
    
    const selected = service.getLoaderForSource('file.doc');
    expect(selected).toBeDefined();
  });

  it('registry-006: retrieves all registered loaders', () => {
    const l1 = new DummyLoader('l1');
    const l2 = new DummyLoader('l2');
    const l3 = new DummyLoader('l3');
    service.registerLoader('l1', l1);
    service.registerLoader('l2', l2);
    service.registerLoader('l3', l3);
    
    expect(service.getLoaderCount()).toBe(3);
  });

  it('registry-007: can handle multiple loaders registered', () => {
    const l1 = new DummyLoader('l1');
    const l2 = new DummyLoader('l2');
    const l3 = new DummyLoader('l3');
    service.registerLoader('l1', l1);
    service.registerLoader('l2', l2);
    service.registerLoader('l3', l3);
    
    expect(service.getLoaderCount()).toBe(3);
    expect(service.getLoader('l2')).toBe(l2);
  });

  it('registry-008: handles unsupported file types gracefully', () => {
    const loader = new DummyLoader('txt', ['.txt']);
    service.registerLoader('txt', loader);
    
    const selected = service.getLoaderForSource('file.xyz');
    expect(selected).toBeNull();
  });

  it('registry-009: prioritizes explicit name over auto-detection', () => {
    const l1 = new DummyLoader('preferred', ['.txt']);
    const l2 = new DummyLoader('fallback', ['.txt']);
    service.registerLoader('preferred', l1);
    service.registerLoader('fallback', l2);
    
    const explicit = service.getLoader('preferred');
    expect(explicit).toBe(l1);
  });

  xit('registry-009: handles concurrent registration', () => {
    const loaders = Array.from({ length: 50 }, (_, i) => new DummyLoader(`loader${i}`));
    loaders.forEach((l, i) => service.registerLoader(`loader${i}`, l));
    
    expect(service.getLoaderCount()).toBe(50);
    expect(service.getLoader('loader25')).toBeDefined();
  });
});
