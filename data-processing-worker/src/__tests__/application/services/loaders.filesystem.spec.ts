import { LoaderRegistryService } from '@application/services/loader-registry.service';
import { BaseLoaderPort } from '@domain/ports/loader.port';
import { Document } from '@domain/entities/document.entity';

class FakeLoader extends BaseLoaderPort {
  constructor(private readonly name: string, private readonly exts: string[] = ['.txt']) {
    super();
  }

  async load(source: string | Blob): Promise<Document[]> {
    return [new Document(`${this.name}-id`, `content-from-${this.name}`, { source: String(source), sourceType: 'file' })];
  }

  supports(source: string | Blob): boolean {
    if (typeof source !== 'string') return false;
    return this.exts.some((e) => source.endsWith(e) || source.includes(this.name));
  }

  getSupportedTypes(): string[] {
    return this.exts;
  }
}

describe('Filesystem loaders (registry integration)', () => {
  let registry: LoaderRegistryService;

  beforeEach(() => {
    registry = new LoaderRegistryService();
  });

  const cases: Array<{ ext: string; fileName: string; loaderName: string }> = [
    { ext: '.pdf', fileName: 'document.pdf', loaderName: 'pdf' },
    { ext: '.docx', fileName: 'doc.docx', loaderName: 'docx' },
    { ext: '.csv', fileName: 'table.csv', loaderName: 'csv' },
    { ext: '.epub', fileName: 'book.epub', loaderName: 'epub' },
    { ext: '.pptx', fileName: 'slides.pptx', loaderName: 'pptx' },
    { ext: '.srt', fileName: 'captions.srt', loaderName: 'srt' },
    { ext: '.md', fileName: 'notes.md', loaderName: 'notion' },
    { ext: '.txt', fileName: 'dump.txt', loaderName: 'unstructured' },
    { ext: '.wav', fileName: 'audio.wav', loaderName: 'whisper' },
  ];

  for (const c of cases) {
    it(`selects and loads with the ${c.loaderName} loader for ${c.ext}`, async () => {
      const fake = new FakeLoader(c.loaderName, [c.ext]);
      const spyLoad = jest.spyOn(fake, 'load');

      registry.registerLoader(c.loaderName, fake);

      const selected = registry.getLoaderForSource(c.fileName);
      expect(selected).toBe(fake);

      const docs = await registry.loadAuto(c.fileName as unknown as string);
      expect(spyLoad).toHaveBeenCalled();
      expect(docs).toBeInstanceOf(Array);
      expect(docs[0].id).toContain(c.loaderName);
    });
  }
});
