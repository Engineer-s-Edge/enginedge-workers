import { MultiFileService } from '../../../application/services/multi-file.service';
import { IFileSystem } from '../../../domain/ports';

describe('MultiFileService', () => {
  let service: MultiFileService;
  let mockFileSystem: jest.Mocked<IFileSystem>;

  beforeEach(() => {
    mockFileSystem = {
      writeFile: jest.fn(),
      readFile: jest.fn(),
      exists: jest.fn(),
      delete: jest.fn(),
      mkdir: jest.fn(),
      rmdir: jest.fn(),
      readdir: jest.fn(),
    };

    service = new MultiFileService(mockFileSystem);
  });

  describe('analyzeDependencies', () => {
    it('should analyze single file with no dependencies', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(
        Buffer.from('\\documentclass{article}\n\\begin{document}\nHello\\end{document}'),
      );

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.mainFile).toBe('main.tex');
      expect(graph.allFiles).toEqual(['main.tex']);
      expect(graph.dependencies).toHaveLength(0);
      expect(graph.missingFiles).toHaveLength(0);
      expect(graph.compilationOrder).toEqual(['main.tex']);
    });

    it('should detect \\include dependencies', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile
        .mockResolvedValueOnce(
          Buffer.from('\\documentclass{article}\n\\include{chapter1}\n\\begin{document}\\end{document}'),
        )
        .mockResolvedValueOnce(
          Buffer.from('\\section{Chapter 1}\nContent'),
        );

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.mainFile).toBe('main.tex');
      expect(graph.allFiles).toContain('main.tex');
      expect(graph.allFiles).toContain('chapter1.tex');
      expect(graph.dependencies).toHaveLength(1);
      expect(graph.dependencies[0]).toMatchObject({
        sourceFile: 'main.tex',
        targetFile: 'chapter1.tex',
        type: 'include',
      });
    });

    it('should detect \\input dependencies', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile
        .mockResolvedValueOnce(
          Buffer.from('\\documentclass{article}\n\\input{preamble.tex}\n\\begin{document}\\end{document}'),
        )
        .mockResolvedValueOnce(
          Buffer.from('\\usepackage{amsmath}'),
        );

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.allFiles).toContain('preamble.tex');
      expect(graph.dependencies).toHaveLength(1);
      expect(graph.dependencies[0]).toMatchObject({
        sourceFile: 'main.tex',
        targetFile: 'preamble.tex',
        type: 'input',
      });
    });

    it('should detect multiple dependencies in one file', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile
        .mockResolvedValueOnce(
          Buffer.from(
            '\\documentclass{article}\n' +
            '\\input{preamble}\n' +
            '\\include{chapter1}\n' +
            '\\include{chapter2}\n' +
            '\\begin{document}\\end{document}',
          ),
        )
        .mockResolvedValueOnce(Buffer.from('% preamble'))
        .mockResolvedValueOnce(Buffer.from('% chapter1'))
        .mockResolvedValueOnce(Buffer.from('% chapter2'));

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.dependencies).toHaveLength(3);
      expect(graph.allFiles).toHaveLength(4); // main + 3 deps
    });

    it('should detect nested dependencies (recursive)', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile
        .mockResolvedValueOnce(
          Buffer.from('\\include{chapter1}'),
        )
        .mockResolvedValueOnce(
          Buffer.from('\\input{section1}'),
        )
        .mockResolvedValueOnce(
          Buffer.from('Deep nested content'),
        );

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.allFiles).toContain('chapter1.tex');
      expect(graph.allFiles).toContain('section1.tex');
      expect(graph.dependencies).toHaveLength(2);
    });

    it('should detect bibliography files', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(
        Buffer.from('\\documentclass{article}\n\\bibliography{references}\n\\begin{document}\\end{document}'),
      );

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.allFiles).toContain('references.bib');
      expect(graph.dependencies).toHaveLength(1);
      expect(graph.dependencies[0]).toMatchObject({
        targetFile: 'references.bib',
        type: 'bibliography',
      });
    });

    it('should detect multiple bibliography files', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(
        Buffer.from('\\bibliography{refs1, refs2, refs3}'),
      );

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.allFiles).toContain('refs1.bib');
      expect(graph.allFiles).toContain('refs2.bib');
      expect(graph.allFiles).toContain('refs3.bib');
      expect(graph.dependencies).toHaveLength(3);
    });

    it('should detect image files', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(
        Buffer.from('\\includegraphics{figure1.png}\n\\includegraphics[width=5cm]{figure2.jpg}'),
      );

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.allFiles).toContain('figure1.png');
      expect(graph.allFiles).toContain('figure2.jpg');
      expect(graph.dependencies).toHaveLength(2);
      expect(graph.dependencies[0].type).toBe('image');
    });

    it('should skip commented lines', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(
        Buffer.from('% \\include{commented}\n\\include{active}'),
      );

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.allFiles).not.toContain('commented.tex');
      expect(graph.allFiles).toContain('active.tex');
    });

    it('should handle missing files', async () => {
      mockFileSystem.exists
        .mockResolvedValueOnce(true) // main.tex exists
        .mockResolvedValueOnce(false); // chapter1.tex missing

      mockFileSystem.readFile.mockResolvedValue(
        Buffer.from('\\include{chapter1}'),
      );

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.missingFiles).toContain('chapter1.tex');
    });

    it('should handle circular dependencies gracefully', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile
        .mockResolvedValueOnce(Buffer.from('\\input{file2}')) // file1
        .mockResolvedValueOnce(Buffer.from('\\input{file1}')); // file2

      const graph = await service.analyzeDependencies('file1.tex', '/project');

      // Should not hang, circular dependency should be detected
      expect(graph.allFiles).toContain('file1.tex');
      expect(graph.allFiles).toContain('file2.tex');
    });

    it('should extract line numbers for dependencies', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile
        .mockResolvedValueOnce(
          Buffer.from(
            'Line 1\nLine 2\n\\include{chapter1}\nLine 4',
          ),
        )
        .mockResolvedValueOnce(Buffer.from('% chapter'));

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.dependencies[0].lineNumber).toBe(3);
    });
  });

  describe('topological sort (compilationOrder)', () => {
    it('should put main file last (dependent on all others)', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile
        .mockResolvedValueOnce(
          Buffer.from('\\input{a}\n\\input{b}'),
        )
        .mockResolvedValueOnce(Buffer.from('% a'))
        .mockResolvedValueOnce(Buffer.from('% b'));

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.compilationOrder[graph.compilationOrder.length - 1]).toBe('main.tex');
    });

    it('should order nested dependencies correctly', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile
        .mockResolvedValueOnce(Buffer.from('\\input{b}')) // main
        .mockResolvedValueOnce(Buffer.from('\\input{c}')) // b
        .mockResolvedValueOnce(Buffer.from('% leaf'));   // c

      const graph = await service.analyzeDependencies('main.tex', '/project');

      const order = graph.compilationOrder;
      expect(order.indexOf('c.tex')).toBeLessThan(order.indexOf('b.tex'));
      expect(order.indexOf('b.tex')).toBeLessThan(order.indexOf('main.tex'));
    });
  });

  describe('validateDependencies', () => {
    it('should return valid=true when all files exist', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(
        Buffer.from('\\include{chapter1}'),
      );

      const graph = await service.analyzeDependencies('main.tex', '/project');
      const validation = service.validateDependencies(graph);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should return valid=false when files are missing', async () => {
      const graph = {
        mainFile: 'main.tex',
        allFiles: ['main.tex', 'chapter1.tex'],
        dependencies: [
          {
            sourceFile: 'main.tex',
            targetFile: 'chapter1.tex',
            type: 'include' as const,
            lineNumber: 5,
          },
        ],
        missingFiles: ['chapter1.tex'],
        compilationOrder: ['chapter1.tex', 'main.tex'],
      };

      const validation = service.validateDependencies(graph);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing files: chapter1.tex');
    });

    it('should detect broken dependencies', async () => {
      const graph = {
        mainFile: 'main.tex',
        allFiles: ['main.tex'], // chapter1.tex not in allFiles
        dependencies: [
          {
            sourceFile: 'main.tex',
            targetFile: 'chapter1.tex',
            type: 'include' as const,
            lineNumber: 5,
          },
        ],
        missingFiles: [],
        compilationOrder: ['main.tex'],
      };

      const validation = service.validateDependencies(graph);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('Broken dependency');
    });
  });

  describe('getResourceFiles', () => {
    it('should return only image and resource files', async () => {
      const graph = {
        mainFile: 'main.tex',
        allFiles: ['main.tex', 'chapter.tex', 'fig.png', 'refs.bib'],
        dependencies: [
          { sourceFile: 'main.tex', targetFile: 'chapter.tex', type: 'include' as const },
          { sourceFile: 'main.tex', targetFile: 'fig.png', type: 'image' as const },
          { sourceFile: 'main.tex', targetFile: 'refs.bib', type: 'bibliography' as const },
        ],
        missingFiles: [],
        compilationOrder: [],
      };

      const resources = service.getResourceFiles(graph);

      expect(resources).toContain('fig.png');
      expect(resources).not.toContain('chapter.tex');
      expect(resources).not.toContain('refs.bib');
    });
  });

  describe('getBibliographyFiles', () => {
    it('should return only bibliography files', async () => {
      const graph = {
        mainFile: 'main.tex',
        allFiles: ['main.tex', 'refs.bib', 'fig.png'],
        dependencies: [
          { sourceFile: 'main.tex', targetFile: 'refs.bib', type: 'bibliography' as const },
          { sourceFile: 'main.tex', targetFile: 'fig.png', type: 'image' as const },
        ],
        missingFiles: [],
        compilationOrder: [],
      };

      const bibFiles = service.getBibliographyFiles(graph);

      expect(bibFiles).toContain('refs.bib');
      expect(bibFiles).not.toContain('fig.png');
    });
  });

  describe('resolveRelativePath', () => {
    it('should resolve relative paths correctly', () => {
      const resolved = service.resolveRelativePath(
        'chapters/chapter1.tex',
        '../images/fig.png',
        '/project',
      );

      // Normalize path separators for cross-platform testing
      const normalizedPath = resolved.replace(/\\/g, '/');
      expect(normalizedPath).toBe('images/fig.png');
    });

    it('should handle same directory paths', () => {
      const resolved = service.resolveRelativePath(
        'main.tex',
        'chapter.tex',
        '/project',
      );

      expect(resolved).toBe('chapter.tex');
    });
  });

  describe('copyProjectFiles', () => {
    it('should copy all files from source to target', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('content'));

      const graph = {
        mainFile: 'main.tex',
        allFiles: ['main.tex', 'chapter1.tex'],
        dependencies: [],
        missingFiles: [],
        compilationOrder: [],
      };

      await service.copyProjectFiles(graph, '/source', '/target');

      expect(mockFileSystem.mkdir).toHaveBeenCalledWith('/target');
      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should create subdirectories for nested files', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('content'));

      const graph = {
        mainFile: 'main.tex',
        allFiles: ['chapters/chapter1.tex'],
        dependencies: [],
        missingFiles: [],
        compilationOrder: [],
      };

      await service.copyProjectFiles(graph, '/source', '/target');

      // Should create /target/chapters directory
      expect(mockFileSystem.mkdir).toHaveBeenCalled();
    });

    it('should skip missing files', async () => {
      mockFileSystem.exists
        .mockResolvedValueOnce(true) // main.tex
        .mockResolvedValueOnce(false); // missing.tex

      mockFileSystem.readFile.mockResolvedValue(Buffer.from('content'));

      const graph = {
        mainFile: 'main.tex',
        allFiles: ['main.tex', 'missing.tex'],
        dependencies: [],
        missingFiles: [],
        compilationOrder: [],
      };

      await service.copyProjectFiles(graph, '/source', '/target');

      // Should only write main.tex (1 file)
      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty project directory', async () => {
      mockFileSystem.exists.mockResolvedValue(false);

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.missingFiles).toContain('main.tex');
    });

    it('should handle .tex files with explicit extension', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile
        .mockResolvedValueOnce(
          Buffer.from('\\include{chapter1.tex}'),
        )
        .mockResolvedValueOnce(Buffer.from('% chapter'));

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.allFiles).toContain('chapter1.tex');
    });

    it('should handle whitespace in bibliography lists', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(
        Buffer.from('\\bibliography{refs1  ,  refs2  ,  refs3}'),
      );

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.allFiles).toContain('refs1.bib');
      expect(graph.allFiles).toContain('refs2.bib');
      expect(graph.allFiles).toContain('refs3.bib');
    });

    it('should handle complex project structure', async () => {
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile
        .mockResolvedValueOnce(
          Buffer.from(
            '\\input{preamble}\n' +
            '\\include{chapters/ch1}\n' +
            '\\include{chapters/ch2}\n' +
            '\\bibliography{refs/main}\n' +
            '\\includegraphics{images/logo.png}',
          ),
        )
        .mockResolvedValueOnce(Buffer.from('% preamble'))
        .mockResolvedValueOnce(Buffer.from('\\includegraphics{images/fig1.png}'))
        .mockResolvedValueOnce(Buffer.from('% ch2'));

      const graph = await service.analyzeDependencies('main.tex', '/project');

      expect(graph.allFiles).toContain('preamble.tex');
      expect(graph.allFiles).toContain('chapters/ch1.tex');
      expect(graph.allFiles).toContain('chapters/ch2.tex');
      expect(graph.allFiles).toContain('refs/main.bib');
      expect(graph.allFiles).toContain('images/logo.png');
      expect(graph.allFiles).toContain('images/fig1.png'); // from ch1
    });
  });
});
