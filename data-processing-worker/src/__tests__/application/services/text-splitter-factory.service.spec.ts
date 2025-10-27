import { TextSplitterFactoryService } from '@application/services/text-splitter-factory.service';

// Create minimal splitter adapters with required method
class DummySplitter {
  constructor(public name: string) {}
  async splitDocuments(docs: any[]): Promise<any[]> {
    return docs.map((d, i) => ({ ...d, content: d.content + `-chunk-${this.name}-${i}` }));
  }
}

describe('TextSplitterFactoryService', () => {
  let factory: TextSplitterFactoryService;

  beforeEach(() => {
    // Instantiate factory with dummy splitters
    factory = new TextSplitterFactoryService(
      new DummySplitter('recursive') as any,
      new DummySplitter('character') as any,
      new DummySplitter('token') as any,
      new DummySplitter('semantic') as any,
      new DummySplitter('python') as any,
      new DummySplitter('javascript') as any,
      new DummySplitter('typescript') as any,
      new DummySplitter('java') as any,
      new DummySplitter('cpp') as any,
      new DummySplitter('go') as any,
      new DummySplitter('latex') as any,
      new DummySplitter('markdown') as any,
      new DummySplitter('html') as any,
    );
  });

  it('returns specific splitter by type', () => {
    const spl = factory.getSplitterByType('python');
    expect((spl as any).name).toBe('python');
  });

  it('falls back to recursive for unknown type', () => {
    const spl = factory.getSplitterByType('unknown-type');
    expect((spl as any).name).toBe('recursive');
  });

  it('chooses splitter by file extension', () => {
    const spl = factory.getSplitterByFileExtension('example.ts');
    expect((spl as any).name).toBe('typescript');
  });

  it('detects splitter by content', () => {
    const content = 'function hello() { console.log("hi") }';
    const spl = factory.getSplitterByContentDetection(content);
    expect((spl as any).name).toBe('javascript');
  });
});
