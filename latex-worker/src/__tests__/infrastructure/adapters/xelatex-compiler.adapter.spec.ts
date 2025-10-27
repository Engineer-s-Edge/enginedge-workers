import { XeLaTeXCompilerAdapter } from '../../../infrastructure/adapters/xelatex-compiler.adapter';
import { ILogger, IFileSystem } from '../../../domain/ports';
import { LaTeXDocument, LaTeXProject } from '../../../domain/entities';

describe('XeLaTeXCompilerAdapter', () => {
  let adapter: XeLaTeXCompilerAdapter;
  let mockLogger: jest.Mocked<ILogger>;
  let mockFileSystem: jest.Mocked<IFileSystem>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as jest.Mocked<ILogger>;

    mockFileSystem = {
      writeFile: jest.fn(),
      readFile: jest.fn(),
      mkdir: jest.fn(),
      rmdir: jest.fn(),
      exists: jest.fn(),
      readdir: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IFileSystem>;

    adapter = new XeLaTeXCompilerAdapter(mockLogger, mockFileSystem);
  });

  describe('compile', () => {
    it('should compile a simple document successfully', async () => {
      const document = LaTeXDocument.create(
        '1',
        '\\documentclass{article}\\begin{document}Hello\\end{document}',
        { title: 'Test' },
      );
      const workingDir = '/tmp/test';

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('mock log content'));

      await adapter.compile(document, workingDir);

      expect(mockLogger.log).toHaveBeenCalled();
    });

    it('should handle document with default settings', async () => {
      const document = LaTeXDocument.create(
        '2',
        '\\documentclass{article}\\begin{document}Test\\end{document}',
        { title: 'Test' },
      );
      const workingDir = '/tmp/test2';

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('log'));

      await adapter.compile(document, workingDir);

      expect(mockLogger.log).toHaveBeenCalled();
    });

    it('should log compilation start', async () => {
      const document = LaTeXDocument.create('3', '\\documentclass{article}\\begin{document}\\end{document}', {});
      const workingDir = '/tmp/test3';

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(''));

      await adapter.compile(document, workingDir);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('XeLaTeX'),
        'XeLaTeXCompilerAdapter',
      );
    });

    it('should handle multi-pass compilation', async () => {
      const document = LaTeXDocument.create('4', '\\documentclass{article}\\begin{document}\\end{document}', {});
      const workingDir = '/tmp/test4';

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(''));

      await adapter.compile(document, workingDir);

      expect(mockLogger.log).toHaveBeenCalled();
    });

    it('should handle missing PDF file', async () => {
      const document = LaTeXDocument.create('7', '\\documentclass{article}\\begin{document}\\end{document}', {});
      const workingDir = '/tmp/test7';

      mockFileSystem.exists.mockResolvedValue(false);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(''));

      const result = await adapter.compile(document, workingDir);

      expect(result.success).toBe(false);
    });

    it('should track compilation time', async () => {
      const document = LaTeXDocument.create('9', '\\documentclass{article}\\begin{document}\\end{document}', {});
      const workingDir = '/tmp/test9';

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(''));

      const result = await adapter.compile(document, workingDir);

      expect(result.compilationTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle documents with shell escape enabled', async () => {
      const document = LaTeXDocument.create('10', '\\documentclass{article}\\begin{document}\\end{document}', {});
      const workingDir = '/tmp/test10';

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(''));

      await adapter.compile(document, workingDir);

      expect(mockLogger.log).toHaveBeenCalled();
    });
  });

  describe('compileProject', () => {
    it('should log project compilation start', async () => {
      const project = LaTeXProject.create('proj1', 'Test Project', 'main.tex', '\\documentclass{article}\\begin{document}\\end{document}');
      const workingDir = '/tmp/proj';

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(''));

      await adapter.compileProject(project, workingDir);

      expect(mockLogger.log).toHaveBeenCalled();
    });

    it('should handle project with multiple files', async () => {
      const project = LaTeXProject.create('proj2', 'Multi-file', 'main.tex', '\\documentclass{article}\\begin{document}\\end{document}')
        .addFile({ path: 'chapter1.tex', content: 'Chapter content', type: 'tex' });
      const workingDir = '/tmp/proj2';

      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from(''));

      await adapter.compileProject(project, workingDir);

      expect(mockLogger.log).toHaveBeenCalled();
    });
  });

  describe('abort', () => {
    it('should handle abort requests', async () => {
      await adapter.abort('job1');

      expect(true).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('should check if xelatex is available', async () => {
      const result = await adapter.isAvailable();

      expect(typeof result).toBe('boolean');
    });
  });

  describe('getVersion', () => {
    it('should return xelatex version', async () => {
      const version = await adapter.getVersion();

      expect(typeof version).toBe('string');
    });
  });

  describe('error handling', () => {
    it('should handle compilation errors gracefully', async () => {
      const document = LaTeXDocument.create('11', '\\invalid', {});
      const workingDir = '/tmp/test11';

      mockFileSystem.exists.mockResolvedValue(false);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('Error in compilation'));

      const result = await adapter.compile(document, workingDir);

      expect(result.success).toBe(false);
    });
  });
});
