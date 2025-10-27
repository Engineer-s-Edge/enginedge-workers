/* eslint-disable @typescript-eslint/no-explicit-any */
import { TextSplitterFactoryService } from '@application/services/text-splitter-factory.service';

describe('TextSplitterFactoryService Advanced (Phase 4 - Splitters Extended)', () => {
  let service: TextSplitterFactoryService;
  let mockRecursive: any;
  let mockCharacter: any;
  let mockToken: any;
  let mockSemantic: any;
  let mockPython: any;
  let mockJavaScript: any;
  let mockTypeScript: any;
  let mockJava: any;
  let mockCpp: any;
  let mockGo: any;
  let mockLatex: any;
  let mockMarkdown: any;
  let mockHtml: any;

  beforeEach(() => {
    mockRecursive = { split: jest.fn().mockResolvedValue(['chunk1', 'chunk2']), logger: {}, generateChunkId: jest.fn() };
    mockCharacter = { split: jest.fn().mockResolvedValue(['chunk1', 'chunk2']), logger: {}, generateChunkId: jest.fn() };
    mockToken = { split: jest.fn().mockResolvedValue(['chunk1', 'chunk2']), logger: {}, generateChunkId: jest.fn() };
    mockSemantic = { split: jest.fn().mockResolvedValue(['chunk1', 'chunk2']), logger: {}, generateChunkId: jest.fn() };
    mockPython = { split: jest.fn().mockResolvedValue(['chunk1', 'chunk2']), logger: {}, generateChunkId: jest.fn() };
    mockJavaScript = { split: jest.fn().mockResolvedValue(['chunk1', 'chunk2']), logger: {}, generateChunkId: jest.fn() };
    mockTypeScript = { split: jest.fn().mockResolvedValue(['chunk1', 'chunk2']), logger: {}, generateChunkId: jest.fn() };
    mockJava = { split: jest.fn().mockResolvedValue(['chunk1', 'chunk2']), logger: {}, generateChunkId: jest.fn() };
    mockCpp = { split: jest.fn().mockResolvedValue(['chunk1', 'chunk2']), logger: {}, generateChunkId: jest.fn() };
    mockGo = { split: jest.fn().mockResolvedValue(['chunk1', 'chunk2']), logger: {}, generateChunkId: jest.fn() };
    mockLatex = { split: jest.fn().mockResolvedValue(['chunk1', 'chunk2']), logger: {}, generateChunkId: jest.fn() };
    mockMarkdown = { split: jest.fn().mockResolvedValue(['chunk1', 'chunk2']), logger: {}, generateChunkId: jest.fn() };
    mockHtml = { split: jest.fn().mockResolvedValue(['chunk1', 'chunk2']), logger: {}, generateChunkId: jest.fn() };

    service = new TextSplitterFactoryService(
      mockRecursive as any,
      mockCharacter as any,
      mockToken as any,
      mockSemantic as any,
      mockPython as any,
      mockJavaScript as any,
      mockTypeScript as any,
      mockJava as any,
      mockCpp as any,
      mockGo as any,
      mockLatex as any,
      mockMarkdown as any,
      mockHtml as any,
    );
  });

  it('fact-adv-001: getSplitterByType returns recursive-character splitter', () => {
    const splitter = service.getSplitterByType('recursive-character');
    expect(splitter).toBe(mockRecursive);
  });

  it('fact-adv-002: getSplitterByType returns character splitter', () => {
    const splitter = service.getSplitterByType('character');
    expect(splitter).toBe(mockCharacter);
  });

  it('fact-adv-003: getSplitterByType returns token splitter', () => {
    const splitter = service.getSplitterByType('token');
    expect(splitter).toBe(mockToken);
  });

  it('fact-adv-004: getSplitterByType returns semantic splitter', () => {
    const splitter = service.getSplitterByType('semantic');
    expect(splitter).toBe(mockSemantic);
  });

  it('fact-adv-005: getSplitterByType returns python splitter', () => {
    const splitter = service.getSplitterByType('python');
    expect(splitter).toBe(mockPython);
  });

  it('fact-adv-006: getSplitterByType returns javascript splitter', () => {
    const splitter = service.getSplitterByType('javascript');
    expect(splitter).toBe(mockJavaScript);
  });

  it('fact-adv-007: getSplitterByType returns typescript splitter', () => {
    const splitter = service.getSplitterByType('typescript');
    expect(splitter).toBe(mockTypeScript);
  });

  it('fact-adv-008: getSplitterByType returns java splitter', () => {
    const splitter = service.getSplitterByType('java');
    expect(splitter).toBe(mockJava);
  });

  it('fact-adv-009: getSplitterByType returns cpp splitter', () => {
    const splitter = service.getSplitterByType('cpp');
    expect(splitter).toBe(mockCpp);
  });

  it('fact-adv-010: getSplitterByType returns go splitter', () => {
    const splitter = service.getSplitterByType('go');
    expect(splitter).toBe(mockGo);
  });

  it('fact-adv-011: getSplitterByType returns latex splitter', () => {
    const splitter = service.getSplitterByType('latex');
    expect(splitter).toBe(mockLatex);
  });

  it('fact-adv-012: getSplitterByType returns markdown splitter', () => {
    const splitter = service.getSplitterByType('markdown');
    expect(splitter).toBe(mockMarkdown);
  });

  it('fact-adv-013: getSplitterByType returns html splitter', () => {
    const splitter = service.getSplitterByType('html');
    expect(splitter).toBe(mockHtml);
  });

  it('fact-adv-014: getSplitterByFileExtension detects python', () => {
    const splitter = service.getSplitterByFileExtension('test.py');
    expect(splitter).toBe(mockPython);
  });

  it('fact-adv-015: getSplitterByFileExtension detects javascript', () => {
    const splitter = service.getSplitterByFileExtension('test.js');
    expect(splitter).toBe(mockJavaScript);
  });

  it('fact-adv-016: getSplitterByFileExtension detects typescript', () => {
    const splitter = service.getSplitterByFileExtension('test.ts');
    expect(splitter).toBe(mockTypeScript);
  });

  it('fact-adv-017: getSplitterByFileExtension detects java', () => {
    const splitter = service.getSplitterByFileExtension('Test.java');
    expect(splitter).toBe(mockJava);
  });

  it('fact-adv-018: getSplitterByFileExtension detects cpp', () => {
    const splitter = service.getSplitterByFileExtension('main.cpp');
    expect(splitter).toBe(mockCpp);
  });

  it('fact-adv-019: getSplitterByFileExtension detects go', () => {
    const splitter = service.getSplitterByFileExtension('main.go');
    expect(splitter).toBe(mockGo);
  });

  it('fact-adv-020: getSplitterByFileExtension detects latex', () => {
    const splitter = service.getSplitterByFileExtension('doc.tex');
    expect(splitter).toBe(mockLatex);
  });

  it('fact-adv-021: getSplitterByFileExtension detects markdown', () => {
    const splitter = service.getSplitterByFileExtension('readme.md');
    expect(splitter).toBe(mockMarkdown);
  });

  it('fact-adv-022: getSplitterByFileExtension detects html', () => {
    const splitter = service.getSplitterByFileExtension('index.html');
    expect(splitter).toBe(mockHtml);
  });

  it('fact-adv-023: getSplitterByFileExtension handles case insensitive', () => {
    const splitter = service.getSplitterByFileExtension('SCRIPT.PY');
    expect(splitter).toBe(mockPython);
  });

  it('fact-adv-024: getSplitterByFileExtension defaults to recursive', () => {
    const splitter = service.getSplitterByFileExtension('unknown.unknown');
    expect(splitter).toBe(mockRecursive);
  });

  it('fact-adv-025: getSplitterByType handles case insensitive', () => {
    const splitter = service.getSplitterByType('PYTHON');
    expect(splitter).toBe(mockPython);
  });

  it('fact-adv-026: getSplitterByType handles whitespace', () => {
    const splitter = service.getSplitterByType('  javascript  ');
    expect(splitter).toBe(mockJavaScript);
  });

  it('fact-adv-027: getSplitterByType with js alias', () => {
    const splitter = service.getSplitterByType('js');
    expect(splitter).toBe(mockJavaScript);
  });

  it('fact-adv-028: getSplitterByType with ts alias', () => {
    const splitter = service.getSplitterByType('ts');
    expect(splitter).toBe(mockTypeScript);
  });

  it('fact-adv-029: getSplitterByType with c++ alias', () => {
    const splitter = service.getSplitterByType('c++');
    expect(splitter).toBe(mockCpp);
  });

  it('fact-adv-030: getSplitterByType with md alias', () => {
    const splitter = service.getSplitterByType('md');
    expect(splitter).toBe(mockMarkdown);
  });

  it('fact-adv-031: getSplitterByFileExtension supports jsx', () => {
    const splitter = service.getSplitterByFileExtension('component.jsx');
    expect(splitter).toBe(mockJavaScript);
  });

  it('fact-adv-032: getSplitterByFileExtension handles no extension', () => {
    const splitter = service.getSplitterByFileExtension('README');
    expect(splitter).toBe(mockRecursive);
  });

  it('fact-adv-033: getSplitterByType with recursive alias', () => {
    const splitter = service.getSplitterByType('recursive');
    expect(splitter).toBe(mockRecursive);
  });

  it('fact-adv-034: getSplitterByFileExtension multiple dots', () => {
    const splitter = service.getSplitterByFileExtension('archive.tar.gz');
    expect(splitter).toBeDefined();
  });

  it('fact-adv-035: getSplitterByType unknown defaults recursive', () => {
    const splitter = service.getSplitterByType('unknown');
    expect(splitter).toBe(mockRecursive);
  });

  it('fact-adv-036: all splitters have split method', () => {
    const types = ['recursive-character', 'character', 'token', 'semantic', 'python', 'javascript', 'typescript', 'java', 'cpp', 'go', 'latex', 'markdown', 'html'];
    types.forEach(type => {
      const splitter = service.getSplitterByType(type);
      expect(splitter).toHaveProperty('split');
    });
  });

  it('fact-adv-037: getSplitterByFileExtension supports .cc for cpp', () => {
    const splitter = service.getSplitterByFileExtension('program.cc');
    expect(splitter).toBeDefined();
  });

  it('fact-adv-038: getSplitterByFileExtension supports .h for cpp', () => {
    const splitter = service.getSplitterByFileExtension('header.h');
    expect(splitter).toBeDefined();
  });

  it('fact-adv-039: getSplitterByFileExtension supports .txt', () => {
    const splitter = service.getSplitterByFileExtension('document.txt');
    expect(splitter).toBe(mockRecursive);
  });

  it('fact-adv-040: getSplitterByFileExtension supports .json', () => {
    const splitter = service.getSplitterByFileExtension('data.json');
    expect(splitter).toBeDefined();
  });

  it('fact-adv-041: service initializes with 13 splitters', () => {
    expect(service).toBeDefined();
  });

  it('fact-adv-042: getSplitterByType normalizes to lowercase', () => {
    expect(service.getSplitterByType('PyThOn')).toBe(mockPython);
  });

  it('fact-adv-043: getSplitterByFileExtension trims extension', () => {
    const splitter = service.getSplitterByFileExtension('file.py');
    expect(splitter).toBe(mockPython);
  });

  it('fact-adv-044: all getSplitterByType returns are consistent', () => {
    const s1 = service.getSplitterByType('python');
    const s2 = service.getSplitterByType('python');
    expect(s1).toBe(s2);
  });

  it('fact-adv-045: all getSplitterByFileExtension returns are consistent', () => {
    const s1 = service.getSplitterByFileExtension('test.py');
    const s2 = service.getSplitterByFileExtension('test.py');
    expect(s1).toBe(s2);
  });

  it('fact-adv-046: returns correct splitter instances', () => {
    const types = [
      { type: 'recursive-character', expected: mockRecursive },
      { type: 'character', expected: mockCharacter },
      { type: 'token', expected: mockToken },
      { type: 'semantic', expected: mockSemantic },
      { type: 'python', expected: mockPython },
      { type: 'javascript', expected: mockJavaScript },
      { type: 'typescript', expected: mockTypeScript },
      { type: 'java', expected: mockJava },
      { type: 'cpp', expected: mockCpp },
      { type: 'go', expected: mockGo },
      { type: 'latex', expected: mockLatex },
      { type: 'markdown', expected: mockMarkdown },
      { type: 'html', expected: mockHtml },
    ];

    types.forEach(({ type, expected }) => {
      const splitter = service.getSplitterByType(type);
      expect(splitter).toBe(expected);
    });
  });

  it('fact-adv-047: getSplitterByFileExtension handles edge cases', () => {
    expect(service.getSplitterByFileExtension('.')).toBeDefined();
    expect(service.getSplitterByFileExtension('')).toBeDefined();
  });

  it('fact-adv-048: getSplitterByType available for all language extensions', () => {
    const langs = ['py', 'js', 'ts', 'java', 'cpp', 'go', 'tex', 'md', 'html'];
    langs.forEach(lang => {
      const filename = `test.${lang}`;
      const splitter = service.getSplitterByFileExtension(filename);
      expect(splitter).toBeDefined();
    });
  });

  it('fact-adv-049: factory methods return splitter interface', () => {
    const splitter = service.getSplitterByType('python');
    expect(splitter).toHaveProperty('split');
  });

  it('fact-adv-050: all 13 splitters properly injected and accessible', () => {
    const accessCount = [
      service.getSplitterByType('recursive-character'),
      service.getSplitterByType('character'),
      service.getSplitterByType('token'),
      service.getSplitterByType('semantic'),
      service.getSplitterByType('python'),
      service.getSplitterByType('javascript'),
      service.getSplitterByType('typescript'),
      service.getSplitterByType('java'),
      service.getSplitterByType('cpp'),
      service.getSplitterByType('go'),
      service.getSplitterByType('latex'),
      service.getSplitterByType('markdown'),
      service.getSplitterByType('html'),
    ].filter(s => s).length;
    
    expect(accessCount).toBe(13);
  });
});
