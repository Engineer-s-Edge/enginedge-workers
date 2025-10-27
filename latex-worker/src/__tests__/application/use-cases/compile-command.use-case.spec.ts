import { CompileCommandUseCase, CompileCommand } from '../../../application/use-cases/compile-command.use-case';
import { LaTeXCompilerService } from '../../../application/services/latex-compiler.service';
import { LaTeXDocument } from '../../../domain/entities/latex-document.entity';
import { CompilationResult } from '../../../domain/entities/compilation-job.entity';

describe('CompileCommandUseCase', () => {
  let useCase: CompileCommandUseCase;
  let mockCompilerService: jest.Mocked<LaTeXCompilerService>;

  beforeEach(() => {
    mockCompilerService = {
      compileDocument: jest.fn(),
    } as unknown as jest.Mocked<LaTeXCompilerService>;

    useCase = new CompileCommandUseCase(mockCompilerService);
  });

  describe('execute', () => {
    it('should compile document and return success result', async () => {
      const command: CompileCommand = {
        jobId: 'job-123',
        userId: 'user-456',
        content: '\\documentclass{article}\\begin{document}Hello\\end{document}',
      };

      const compilationResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 1500,
        passes: 1,
        errors: [],
        warnings: [],
        logs: {
          stdout: '',
          stderr: '',
          rawLog: '',
        },
      };

      mockCompilerService.compileDocument.mockResolvedValue(compilationResult);

      const result = await useCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBe('/tmp/output.pdf');
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.compilationTime).toBeDefined();
      expect(mockCompilerService.compileDocument).toHaveBeenCalledWith(
        expect.any(LaTeXDocument),
      );
    });

    it('should handle compilation failure', async () => {
      const command: CompileCommand = {
        jobId: 'job-789',
        userId: 'user-456',
        content: '\\documentclass{article}\\begin{document}\\invalidcommand\\end{document}',
      };

      const compilationResult: CompilationResult = {
        success: false,
        compilationTime: 500,
        passes: 1,
        errors: [
          {
            line: 1,
            message: 'Undefined control sequence: \\invalidcommand',
            severity: 'error',
          },
        ],
        warnings: [],
        logs: {
          stdout: '',
          stderr: 'Error',
          rawLog: '',
        },
      };

      mockCompilerService.compileDocument.mockResolvedValue(compilationResult);

      const result = await useCase.execute(command);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Undefined control sequence: \\invalidcommand');
      expect(result.pdfPath).toBeUndefined();
    });

    it('should include warnings in result', async () => {
      const command: CompileCommand = {
        jobId: 'job-warn',
        userId: 'user-456',
        content: '\\documentclass{article}\\begin{document}Test\\end{document}',
      };

      const compilationResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 1200,
        passes: 1,
        errors: [],
        warnings: [
          {
            line: 5,
            message: 'Overfull hbox',
          },
        ],
        logs: {
          stdout: '',
          stderr: '',
          rawLog: '',
        },
      };

      mockCompilerService.compileDocument.mockResolvedValue(compilationResult);

      const result = await useCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Overfull hbox');
    });

    it('should override compilation settings', async () => {
      const command: CompileCommand = {
        jobId: 'job-custom',
        userId: 'user-456',
        content: '\\documentclass{article}\\begin{document}Test\\end{document}',
        settings: {
          maxPasses: 5,
          timeout: 60000,
          shellEscape: true,
        },
      };

      const compilationResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 2000,
        passes: 3,
        errors: [],
        warnings: [],
        logs: {
          stdout: '',
          stderr: '',
          rawLog: '',
        },
      };

      mockCompilerService.compileDocument.mockResolvedValue(compilationResult);

      const result = await useCase.execute(command);

      expect(result.success).toBe(true);
      
      // Verify document was created with settings
      const documentArg = mockCompilerService.compileDocument.mock.calls[0][0];
      expect(documentArg.settings.maxPasses).toBe(5);
      expect(documentArg.settings.timeout).toBe(60000);
      expect(documentArg.settings.shell).toBe(true);
    });

    it('should include metadata in result', async () => {
      const command: CompileCommand = {
        jobId: 'job-metadata',
        userId: 'user-456',
        content: '\\documentclass{article}\\begin{document}Test\\end{document}',
        metadata: {
          requestId: 'req-123',
          source: 'web',
        },
      };

      const compilationResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 1000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: {
          stdout: '',
          stderr: '',
          rawLog: '',
        },
      };

      mockCompilerService.compileDocument.mockResolvedValue(compilationResult);

      const result = await useCase.execute(command);

      expect(result.metadata).toEqual({
        requestId: 'req-123',
        source: 'web',
      });
    });

    it('should handle missing PDF path', async () => {
      const command: CompileCommand = {
        jobId: 'job-no-pdf',
        userId: 'user-456',
        content: '\\documentclass{article}\\begin{document}Test\\end{document}',
      };

      const compilationResult: CompilationResult = {
        success: true,
        pdfPath: undefined,
        compilationTime: 1000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: {
          stdout: '',
          stderr: '',
          rawLog: '',
        },
      };

      mockCompilerService.compileDocument.mockResolvedValue(compilationResult);

      const result = await useCase.execute(command);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('PDF generation failed - path is empty');
    });

    it('should handle compiler service exceptions', async () => {
      const command: CompileCommand = {
        jobId: 'job-exception',
        userId: 'user-456',
        content: '\\documentclass{article}\\begin{document}Test\\end{document}',
      };

      mockCompilerService.compileDocument.mockRejectedValue(
        new Error('XeLaTeX not found'),
      );

      const result = await useCase.execute(command);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('XeLaTeX not found');
      expect(result.warnings).toEqual([]);
    });

    it('should handle non-Error exceptions', async () => {
      const command: CompileCommand = {
        jobId: 'job-unknown',
        userId: 'user-456',
        content: '\\documentclass{article}\\begin{document}Test\\end{document}',
      };

      mockCompilerService.compileDocument.mockRejectedValue('Unknown error');

      const result = await useCase.execute(command);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unknown compilation error');
    });

    it('should track compilation time', async () => {
      const command: CompileCommand = {
        jobId: 'job-time',
        userId: 'user-456',
        content: '\\documentclass{article}\\begin{document}Test\\end{document}',
      };

      const compilationResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 1000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: {
          stdout: '',
          stderr: '',
          rawLog: '',
        },
      };

      mockCompilerService.compileDocument.mockImplementation(async () => {
        // Simulate compilation taking 50ms
        await new Promise(resolve => setTimeout(resolve, 50));
        return compilationResult;
      });

      const result = await useCase.execute(command);

      expect(result.compilationTime).toBeGreaterThanOrEqual(50);
    });

    it('should handle multiple errors', async () => {
      const command: CompileCommand = {
        jobId: 'job-multi-error',
        userId: 'user-456',
        content: '\\documentclass{article}\\begin{document}\\badcommand\\anotherbad\\end{document}',
      };

      const compilationResult: CompilationResult = {
        success: false,
        compilationTime: 800,
        passes: 1,
        errors: [
          {
            line: 1,
            message: 'Undefined control sequence: \\badcommand',
            severity: 'error',
          },
          {
            line: 1,
            message: 'Undefined control sequence: \\anotherbad',
            severity: 'error',
          },
        ],
        warnings: [],
        logs: {
          stdout: '',
          stderr: 'Multiple errors',
          rawLog: '',
        },
      };

      mockCompilerService.compileDocument.mockResolvedValue(compilationResult);

      const result = await useCase.execute(command);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Undefined control sequence: \\badcommand');
      expect(result.errors).toContain('Undefined control sequence: \\anotherbad');
    });

    it('should handle multiple warnings', async () => {
      const command: CompileCommand = {
        jobId: 'job-multi-warn',
        userId: 'user-456',
        content: '\\documentclass{article}\\begin{document}Test\\end{document}',
      };

      const compilationResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 1100,
        passes: 2,
        errors: [],
        warnings: [
          {
            line: 3,
            message: 'Overfull hbox',
          },
          {
            line: 5,
            message: 'Underfull vbox',
          },
        ],
        logs: {
          stdout: '',
          stderr: '',
          rawLog: '',
        },
      };

      mockCompilerService.compileDocument.mockResolvedValue(compilationResult);

      const result = await useCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings).toContain('Overfull hbox');
      expect(result.warnings).toContain('Underfull vbox');
    });

    it('should create document with correct content', async () => {
      const command: CompileCommand = {
        jobId: 'job-content',
        userId: 'user-789',
        content: '\\documentclass{article}\\begin{document}Hello LaTeX\\end{document}',
      };

      const compilationResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 900,
        passes: 1,
        errors: [],
        warnings: [],
        logs: {
          stdout: '',
          stderr: '',
          rawLog: '',
        },
      };

      mockCompilerService.compileDocument.mockResolvedValue(compilationResult);

      await useCase.execute(command);

      const documentArg = mockCompilerService.compileDocument.mock.calls[0][0];
      expect(documentArg.content).toBe('\\documentclass{article}\\begin{document}Hello LaTeX\\end{document}');
      expect(documentArg.id).toBe('job-content');
    });

    it('should use default settings when none provided', async () => {
      const command: CompileCommand = {
        jobId: 'job-defaults',
        userId: 'user-456',
        content: '\\documentclass{article}\\begin{document}Test\\end{document}',
      };

      const compilationResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 1000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: {
          stdout: '',
          stderr: '',
          rawLog: '',
        },
      };

      mockCompilerService.compileDocument.mockResolvedValue(compilationResult);

      await useCase.execute(command);

      const documentArg = mockCompilerService.compileDocument.mock.calls[0][0];
      // Default settings from LaTeXDocument.create()
      expect(documentArg.settings.engine).toBe('xelatex');
      expect(documentArg.settings.maxPasses).toBe(3);
      expect(documentArg.settings.shell).toBe(false);
    });
  });
});
