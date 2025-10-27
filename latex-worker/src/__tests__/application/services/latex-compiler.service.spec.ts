import { LaTeXCompilerService } from '../../../application/services/latex-compiler.service';
import {
  ILaTeXCompiler,
  ILogger,
  IFileSystem,
  IPackageManager,
} from '../../../domain/ports';
import {
  LaTeXDocument,
  LaTeXProject,
} from '../../../domain/entities';

describe('LaTeXCompilerService', () => {
  let service: LaTeXCompilerService;
  let mockCompiler: jest.Mocked<ILaTeXCompiler>;
  let mockLogger: jest.Mocked<ILogger>;
  let mockFileSystem: jest.Mocked<IFileSystem>;
  let mockPackageManager: jest.Mocked<IPackageManager>;

  beforeEach(() => {
    mockCompiler = {
      compile: jest.fn(),
      compileProject: jest.fn(),
      abort: jest.fn(),
      isAvailable: jest.fn(),
      getVersion: jest.fn(),
    } as jest.Mocked<ILaTeXCompiler>;

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

    mockPackageManager = {
      install: jest.fn(),
      isInstalled: jest.fn(),
      prewarmCache: jest.fn(),
      getPackageInfo: jest.fn(),
      search: jest.fn(),
      updateCache: jest.fn(),
    } as jest.Mocked<IPackageManager>;

    service = new LaTeXCompilerService(
      mockCompiler,
      mockLogger,
      mockFileSystem,
      mockPackageManager,
    );
  });

  describe('compileDocument', () => {
    it('should compile a simple document successfully', async () => {
      const document = LaTeXDocument.create(
        '1',
        '\\documentclass{article}\\begin{document}Hello\\end{document}',
        { title: 'Simple' },
      );

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('PDF content'));
      mockCompiler.compile.mockResolvedValue({
        success: true,
        pdfPath: '/tmp/latex-123/output.pdf',
        compilationTime: 1000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      });
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      const result = await service.compileDocument(document);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBe('/tmp/latex-123/output.pdf');
      expect(mockFileSystem.mkdir).toHaveBeenCalled();
      expect(mockFileSystem.writeFile).toHaveBeenCalled();
      expect(mockCompiler.compile).toHaveBeenCalled();
      expect(mockFileSystem.rmdir).toHaveBeenCalled();
    });

    it('should write LaTeX content to a file', async () => {
      const document = LaTeXDocument.create(
        '2',
        '\\documentclass{article}\\begin{document}Test\\end{document}',
        { title: 'Test' },
      );

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('PDF'));
      mockCompiler.compile.mockResolvedValue({
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 500,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      });
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      await service.compileDocument(document);

      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.tex'),
        document.content,
      );
    });

    it('should handle validation errors for empty content', async () => {
      const document = LaTeXDocument.create('3', '', { title: 'Empty' });

      const result = await service.compileDocument(document);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle validation errors for unclosed braces', async () => {
      const invalidContent = '\\documentclass{article}\\begin{document}Unclosed brace {';
      const document = LaTeXDocument.create('4', invalidContent, { title: 'Invalid' });

      const result = await service.compileDocument(document);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle compilation failures from the compiler', async () => {
      const document = LaTeXDocument.create(
        '5',
        '\\documentclass{article}\\begin{document}Test\\end{document}',
        { title: 'Test' },
      );

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockCompiler.compile.mockResolvedValue({
        success: false,
        compilationTime: 500,
        passes: 1,
        errors: [
          { message: 'Undefined control sequence', severity: 'error' },
          { message: 'Missing $ inserted', severity: 'error' },
        ],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      });
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      const result = await service.compileDocument(document);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(2);
    });

    it('should clean up temporary directory on success', async () => {
      const document = LaTeXDocument.create(
        '6',
        '\\documentclass{article}\\begin{document}Test\\end{document}',
        { title: 'Test' },
      );

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('PDF'));
      mockCompiler.compile.mockResolvedValue({
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 1000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      });
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      await service.compileDocument(document);

      expect(mockFileSystem.rmdir).toHaveBeenCalledWith(
        expect.stringContaining('latex-'),
      );
    });

    it('should clean up temporary directory on failure', async () => {
      const document = LaTeXDocument.create(
        '7',
        '\\documentclass{article}\\begin{document}Test\\end{document}',
        { title: 'Test' },
      );

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockCompiler.compile.mockResolvedValue({
        success: false,
        compilationTime: 300,
        passes: 1,
        errors: [{ message: 'Error', severity: 'error' }],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      });
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      await service.compileDocument(document);

      expect(mockFileSystem.rmdir).toHaveBeenCalled();
    });

    it('should include warnings in compilation result', async () => {
      const document = LaTeXDocument.create(
        '8',
        '\\documentclass{article}\\begin{document}Test\\end{document}',
        { title: 'Test' },
      );

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('PDF'));
      mockCompiler.compile.mockResolvedValue({
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 1200,
        passes: 1,
        errors: [],
        warnings: [
          { message: 'Overfull hbox' },
          { message: 'Underfull vbox' },
        ],
        logs: { stdout: '', stderr: '', rawLog: '' },
      });
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      const result = await service.compileDocument(document);

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBe(2);
    });

    it('should log compilation start', async () => {
      const document = LaTeXDocument.create(
        '9',
        '\\documentclass{article}\\begin{document}Test\\end{document}',
        { title: 'Test' },
      );

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('PDF'));
      mockCompiler.compile.mockResolvedValue({
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 900,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      });
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      await service.compileDocument(document);

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Starting compilation'),
        'LaTeXCompilerService',
      );
    });

    it('should detect documents requiring bibliography', async () => {
      const content = `
\\documentclass{article}
\\begin{document}
Text with citation \\cite{smith2020}.
\\bibliography{references}
\\end{document}
      `;
      const document = LaTeXDocument.create('10', content, { title: 'With Bib' });

      expect(document.requiresBibliography()).toBe(true);
    });

    it('should handle compiler errors gracefully', async () => {
      const document = LaTeXDocument.create(
        '13',
        '\\documentclass{article}\\begin{document}Test\\end{document}',
        { title: 'Test' },
      );

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockCompiler.compile.mockRejectedValue(new Error('XeLaTeX not found'));
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      const result = await service.compileDocument(document);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should attempt cleanup even if compilation throws', async () => {
      const document = LaTeXDocument.create(
        '14',
        '\\documentclass{article}\\begin{document}Test\\end{document}',
        { title: 'Test' },
      );

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockCompiler.compile.mockRejectedValue(new Error('Fatal error'));
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      await service.compileDocument(document);

      expect(mockFileSystem.rmdir).toHaveBeenCalled();
    });

    it('should log errors appropriately', async () => {
      const document = LaTeXDocument.create(
        '15',
        '\\documentclass{article}\\begin{document}Test\\end{document}',
        { title: 'Test' },
      );

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockCompiler.compile.mockRejectedValue(new Error('Test error'));
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      await service.compileDocument(document);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle very long document content', async () => {
      const longContent =
        '\\documentclass{article}\\begin{document}' +
        'Lorem ipsum '.repeat(10000) +
        '\\end{document}';
      const document = LaTeXDocument.create('16', longContent, { title: 'Long Doc' });

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('PDF'));
      mockCompiler.compile.mockResolvedValue({
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 5000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      });
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      const result = await service.compileDocument(document);

      expect(result.success).toBe(true);
    });

    it('should handle concurrent compilation requests', async () => {
      const doc1 = LaTeXDocument.create(
        '17',
        '\\documentclass{article}\\begin{document}Doc1\\end{document}',
        { title: 'Doc1' },
      );
      const doc2 = LaTeXDocument.create(
        '18',
        '\\documentclass{article}\\begin{document}Doc2\\end{document}',
        { title: 'Doc2' },
      );

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('PDF'));
      mockCompiler.compile.mockResolvedValue({
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 1000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      });
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      const [result1, result2] = await Promise.all([
        service.compileDocument(doc1),
        service.compileDocument(doc2),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('compileProject', () => {
    it('should compile a multi-file project successfully', async () => {
      const mainContent = `
\\documentclass{article}
\\begin{document}
\\include{chapter1}
\\end{document}
      `;
      const project = LaTeXProject.create('proj1', 'Multi-file Project', 'main.tex', mainContent).addFile({
        path: 'chapter1.tex',
        content: '\\chapter{First Chapter}Content 1',
        type: 'tex',
      });

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('PDF'));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPackageManager.install.mockResolvedValue({} as any); // Mock successful package install
      mockCompiler.compileProject.mockResolvedValue({
        success: true,
        pdfPath: '/tmp/latex-proj/main.pdf',
        compilationTime: 3000,
        passes: 2,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      });
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      const result = await service.compileProject(project);

      expect(result.success).toBe(true);
      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(2); // main + chapter1
    });

    it('should detect missing referenced files', async () => {
      const mainContent = `
\\documentclass{article}
\\begin{document}
\\include{missing-chapter}
\\end{document}
      `;
      const project = LaTeXProject.create('proj2', 'Incomplete Project', 'main.tex', mainContent);

      const validationResult = project.validateReferences();
      expect(validationResult.valid).toBe(false);
      expect(validationResult.missingFiles.length).toBeGreaterThan(0);
    });

    it('should handle project compilation failures', async () => {
      const project = LaTeXProject.create(
        'proj3',
        'Failing',
        'main.tex',
        '\\documentclass{article}\\begin{document}\\end{document}',
      );

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockCompiler.compileProject.mockResolvedValue({
        success: false,
        compilationTime: 500,
        passes: 1,
        errors: [{ message: 'Compilation error in project', severity: 'error' }],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      });
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      const result = await service.compileProject(project);

      expect(result.success).toBe(false);
    });

    it('should clean up temporary directory after project compilation', async () => {
      const project = LaTeXProject.create(
        'proj4',
        'Cleanup Test',
        'main.tex',
        '\\documentclass{article}\\begin{document}\\end{document}',
      );

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('PDF'));
      mockCompiler.compileProject.mockResolvedValue({
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 1200,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      });
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      await service.compileProject(project);

      expect(mockFileSystem.rmdir).toHaveBeenCalled();
    });

    it('should write all project files to temporary directory', async () => {
      const project = LaTeXProject.create(
        'proj5',
        'Test',
        'main.tex',
        '\\documentclass{article}\\begin{document}\\include{ch1}\\end{document}',
      ).addFile({ path: 'ch1.tex', content: 'Chapter content', type: 'tex' });

      mockFileSystem.mkdir.mockResolvedValue(undefined);
      mockFileSystem.writeFile.mockResolvedValue(undefined);
      mockFileSystem.readFile.mockResolvedValue(Buffer.from('PDF'));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPackageManager.install.mockResolvedValue({} as any);
      mockCompiler.compileProject.mockResolvedValue({
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 2000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      });
      mockFileSystem.rmdir.mockResolvedValue(undefined);

      await service.compileProject(project);

      expect(mockFileSystem.writeFile).toHaveBeenCalledTimes(2);
    });
  });
});
