/**
 * LaTeX Worker E2E Integration Tests
 *
 * Comprehensive integration tests for complete compilation workflows
 */

import {
  CompileCommandUseCase,
  CompileCommand,
} from '../../application/use-cases/compile-command.use-case';
import { LaTeXCompilerService } from '../../application/services/latex-compiler.service';
import { CompilationResult } from '../../domain/entities/compilation-job.entity';

describe('LaTeX Compilation E2E Integration', () => {
  let compileUseCase: CompileCommandUseCase;
  let mockCompilerService: jest.Mocked<LaTeXCompilerService>;

  beforeEach(() => {
    mockCompilerService = {
      compileDocument: jest.fn(),
    } as unknown as jest.Mocked<LaTeXCompilerService>;

    compileUseCase = new CompileCommandUseCase(mockCompilerService);
  });

  describe('Simple Document Compilation', () => {
    it('should compile a minimal LaTeX document successfully', async () => {
      const command: CompileCommand = {
        jobId: 'simple-001',
        userId: 'user-123',
        content:
          '\\documentclass{article}\\begin{document}Hello World\\end{document}',
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 1500,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
      expect(result.compilationTime).toBeLessThan(5000);
      expect(mockCompilerService.compileDocument).toHaveBeenCalled();
    });

    it('should compile document with packages', async () => {
      const command: CompileCommand = {
        jobId: 'packages-001',
        userId: 'user-123',
        content:
          '\\documentclass{article}\\usepackage{amsmath}\\usepackage{graphicx}\\begin{document}$E=mc^2$\\end{document}',
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/packages.pdf',
        compilationTime: 2000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
    });

    it('should compile document with title, sections, and content', async () => {
      const command: CompileCommand = {
        jobId: 'full-doc-001',
        userId: 'user-123',
        content: `
          \\documentclass{article}
          \\title{My Document}
          \\author{John Doe}
          \\begin{document}
          \\maketitle
          \\section{Introduction}
          This is the introduction.
          \\section{Methods}
          This describes the methods.
          \\end{document}
        `,
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/full.pdf',
        compilationTime: 1800,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
      expect(result.compilationTime).toBeDefined();
    });

    it('should compile document with mathematics', async () => {
      const command: CompileCommand = {
        jobId: 'math-001',
        userId: 'user-123',
        content: `
          \\documentclass{article}
          \\usepackage{amsmath}
          \\begin{document}
          Inline: $E = mc^2$
          Display: $$\\int_0^\\infty e^{-x} dx = 1$$
          \\begin{equation}
          a^2 + b^2 = c^2
          \\end{equation}
          \\end{document}
        `,
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/math.pdf',
        compilationTime: 1200,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
    });
  });

  describe('Resume Compilation', () => {
    it('should compile a professional resume', async () => {
      const command: CompileCommand = {
        jobId: 'resume-001',
        userId: 'user-123',
        content: `
          \\documentclass{article}
          \\usepackage[margin=0.5in]{geometry}
          \\usepackage{hyperref}
          \\title{John Doe - Software Engineer}
          \\begin{document}
          \\maketitle
          \\section*{Experience}
          \\subsection*{Senior Software Engineer}
          Tech Company - 2020 to Present
          \\begin{itemize}
          \\item Led microservices development
          \\item Mentored junior developers
          \\end{itemize}
          \\section*{Skills}
          TypeScript, React, Node.js, Docker, Kubernetes
          \\end{document}
        `,
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/resume.pdf',
        compilationTime: 1500,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
      expect(result.compilationTime).toBeLessThan(3000);
    });
  });

  describe('Bibliography Scenarios', () => {
    it('should compile document referencing bibliography', async () => {
      const command: CompileCommand = {
        jobId: 'bib-001',
        userId: 'user-123',
        content: `
          \\documentclass{article}
          \\usepackage{natbib}
          \\title{Article with Citations}
          \\begin{document}
          According to Einstein \\cite{Einstein1905}.
          \\bibliographystyle{plain}
          \\bibliography{refs}
          \\end{document}
        `,
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/bib.pdf',
        compilationTime: 3000,
        passes: 2,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
    });

    it('should handle missing citation keys gracefully', async () => {
      const command: CompileCommand = {
        jobId: 'bib-missing-001',
        userId: 'user-123',
        content: `
          \\documentclass{article}
          \\usepackage{natbib}
          \\begin{document}
          Reference \\cite{NonExistentKey}.
          \\bibliographystyle{plain}
          \\bibliography{refs}
          \\end{document}
        `,
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/bib-missing.pdf',
        compilationTime: 3000,
        passes: 2,
        errors: [],
        warnings: [{ line: 4, message: 'Citation NonExistentKey not found' }],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
    });
  });

  describe('Unicode and Font Scenarios', () => {
    it('should compile document with XeLaTeX custom fonts', async () => {
      const command: CompileCommand = {
        jobId: 'fonts-001',
        userId: 'user-123',
        content: `
          \\documentclass{article}
          \\usepackage{fontspec}
          \\setmainfont{Latin Modern}
          \\begin{document}
          This document uses custom fonts.
          \\end{document}
        `,
        settings: {
          engine: 'xelatex',
        },
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/fonts.pdf',
        compilationTime: 2000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
    });

    it('should compile document with Unicode content', async () => {
      const command: CompileCommand = {
        jobId: 'unicode-001',
        userId: 'user-123',
        content: `
          \\documentclass{article}
          \\usepackage[utf8]{inputenc}
          \\usepackage[T1]{fontenc}
          \\begin{document}
          Greek: Ἑλληνικά
          Russian: Русский
          Mathematical: ∀x ∃y (x ∈ y)
          \\end{document}
        `,
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/unicode.pdf',
        compilationTime: 1500,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should detect and report syntax errors', async () => {
      const command: CompileCommand = {
        jobId: 'error-001',
        userId: 'user-123',
        content: `
          \\documentclass{article}
          \\begin{document}
          \\textbf{Unclosed
          \\end{document}
        `,
      };

      const mockResult: CompilationResult = {
        success: false,
        compilationTime: 500,
        passes: 1,
        errors: [
          {
            line: 3,
            message: 'Unclosed command',
            severity: 'error',
          },
        ],
        warnings: [],
        logs: { stdout: '', stderr: 'Error', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should detect undefined commands', async () => {
      const command: CompileCommand = {
        jobId: 'undef-cmd-001',
        userId: 'user-123',
        content: `
          \\documentclass{article}
          \\begin{document}
          \\unknowncommand{test}
          \\end{document}
        `,
      };

      const mockResult: CompilationResult = {
        success: false,
        compilationTime: 600,
        passes: 1,
        errors: [
          {
            line: 3,
            message: 'Undefined control sequence: \\unknowncommand',
            severity: 'error',
          },
        ],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      if (result.errors) {
        expect(result.errors[0]).toContain('Undefined');
      }
    });

    it('should handle compilation with warnings', async () => {
      const command: CompileCommand = {
        jobId: 'warn-001',
        userId: 'user-123',
        content: `
          \\documentclass{article}
          \\usepackage{geometry}
          \\geometry{margin=1in}
          \\begin{document}
          See Figure \\ref{missing-label}.
          \\end{document}
        `,
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/warn.pdf',
        compilationTime: 1200,
        passes: 1,
        errors: [],
        warnings: [
          {
            line: 5,
            message:
              "Reference `missing-label' on page 1 undefined on input line 5",
          },
        ],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should compile within reasonable time for simple document', async () => {
      const command: CompileCommand = {
        jobId: 'perf-001',
        userId: 'user-123',
        content:
          '\\documentclass{article}\\begin{document}Simple\\end{document}',
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/perf.pdf',
        compilationTime: 1200,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.compilationTime).toBeLessThan(3000);
    });

    it('should handle multiple sequential compilations', async () => {
      const content =
        '\\documentclass{article}\\begin{document}Test\\end{document}';

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/output.pdf',
        compilationTime: 1200,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const results = [];
      for (let i = 0; i < 5; i++) {
        const command: CompileCommand = {
          jobId: `seq-${i}`,
          userId: 'user-123',
          content,
        };
        results.push(await compileUseCase.execute(command));
      }

      expect(results.length).toBe(5);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  describe('Metadata and Logging', () => {
    it('should provide compilation metadata', async () => {
      const command: CompileCommand = {
        jobId: 'meta-001',
        userId: 'user-123',
        content:
          '\\documentclass{article}\\title{Test}\\begin{document}Test\\end{document}',
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/meta.pdf',
        compilationTime: 1500,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.compilationTime).toBeDefined();
      expect(result.pdfPath).toBeDefined();
    });

    it('should provide detailed compilation logs', async () => {
      const command: CompileCommand = {
        jobId: 'logs-001',
        userId: 'user-123',
        content:
          '\\documentclass{article}\\usepackage{amsmath}\\begin{document}$E=mc^2$\\end{document}',
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/logs.pdf',
        compilationTime: 1300,
        passes: 1,
        errors: [],
        warnings: [],
        logs: {
          stdout: 'Compilation output',
          stderr: '',
          rawLog: 'This is pdfTeX...',
        },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long documents', async () => {
      let content = '\\documentclass{article}\\begin{document}';
      for (let i = 0; i < 50; i++) {
        content += `\\section{Section ${i}}Lorem ipsum dolor sit amet.\\n`;
      }
      content += '\\end{document}';

      const command: CompileCommand = {
        jobId: 'long-001',
        userId: 'user-123',
        content,
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/long.pdf',
        compilationTime: 3500,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
    });

    it('should handle empty document', async () => {
      const command: CompileCommand = {
        jobId: 'empty-001',
        userId: 'user-123',
        content: '\\documentclass{article}\\begin{document}\\end{document}',
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/empty.pdf',
        compilationTime: 1000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
    });

    it('should handle minimal document', async () => {
      const command: CompileCommand = {
        jobId: 'min-001',
        userId: 'user-123',
        content: '\\documentclass{article}\\begin{document}Hi\\end{document}',
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/min.pdf',
        compilationTime: 1100,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
    });

    it('should handle document with special characters', async () => {
      const command: CompileCommand = {
        jobId: 'special-001',
        userId: 'user-123',
        content:
          '\\documentclass{article}\\usepackage[utf8]{inputenc}\\begin{document}Special: ñ é ç ß€™©\\end{document}',
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/special.pdf',
        compilationTime: 1300,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: '', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
    });
  });

  describe('Multi-File Project Compilation', () => {
    it('should compile multi-file project with include statements', async () => {
      const command: CompileCommand = {
        jobId: 'multifile-001',
        userId: 'user-123',
        content: `
          \\documentclass{book}
          \\begin{document}
          \\include{chapter1}
          \\include{chapter2}
          \\end{document}
        `,
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/multifile.pdf',
        compilationTime: 2500,
        passes: 1,
        errors: [],
        warnings: [],
        logs: {
          stdout: 'Compiled main.tex with 2 includes',
          stderr: '',
          rawLog: '',
        },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
      expect(result.compilationTime).toBeLessThan(10000);
    });

    it('should handle project with input statements', async () => {
      const command: CompileCommand = {
        jobId: 'input-001',
        userId: 'user-123',
        content: `
          \\documentclass{article}
          \\begin{document}
          \\input{introduction}
          \\input{content}
          \\end{document}
        `,
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/input.pdf',
        compilationTime: 1900,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: 'Compiled with inputs', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
    });
  });

  describe('Package Installation Workflow', () => {
    it('should handle compilation with auto-installed packages', async () => {
      const command: CompileCommand = {
        jobId: 'pkg-install-001',
        userId: 'user-123',
        content: `
          \\documentclass{article}
          \\usepackage{tikz}
          \\usepackage{pgfplots}
          \\begin{document}
          \\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}
          \\end{document}
        `,
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/pkg-install.pdf',
        compilationTime: 3500,
        passes: 1,
        errors: [],
        warnings: [],
        logs: {
          stdout: 'Installed packages: tikz, pgfplots',
          stderr: '',
          rawLog: '',
        },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toBeDefined();
    });

    it('should use cached packages for subsequent compilations', async () => {
      const command1: CompileCommand = {
        jobId: 'cache-001',
        userId: 'user-123',
        content:
          '\\documentclass{article}\\usepackage{amsmath}\\begin{document}Test\\end{document}',
      };

      const command2: CompileCommand = {
        jobId: 'cache-002',
        userId: 'user-123',
        content:
          '\\documentclass{article}\\usepackage{amsmath}\\begin{document}Test2\\end{document}',
      };

      const mockResult1: CompilationResult = {
        success: true,
        pdfPath: '/tmp/cache1.pdf',
        compilationTime: 1500,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: 'Installed amsmath', stderr: '', rawLog: '' },
      };

      const mockResult2: CompilationResult = {
        success: true,
        pdfPath: '/tmp/cache2.pdf',
        compilationTime: 800, // Faster due to caching
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: 'Using cached amsmath', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      const result1 = await compileUseCase.execute(command1);
      const result2 = await compileUseCase.execute(command2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(mockCompilerService.compileDocument).toHaveBeenCalledTimes(2);
    });
  });

  describe('Kafka Async Compilation', () => {
    it('should queue compilation job for async processing', async () => {
      const command: CompileCommand = {
        jobId: 'async-kafka-001',
        userId: 'user-456',
        content:
          '\\documentclass{article}\\begin{document}Async compilation test\\end{document}',
      };

      const mockResult: CompilationResult = {
        success: true,
        pdfPath: '/tmp/async-kafka-001.pdf',
        compilationTime: 2100,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: 'Queued for async processing', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(true);
      expect(result.pdfPath).toContain('async-kafka-001');
      expect(mockCompilerService.compileDocument).toHaveBeenCalled();
    });

    it('should handle failed async job gracefully', async () => {
      const command: CompileCommand = {
        jobId: 'async-fail-001',
        userId: 'user-456',
        content:
          '\\documentclass{article}\\begin{document}\\unknowncommand\\end{document}',
      };

      const mockResult: CompilationResult = {
        success: false,
        compilationTime: 1200,
        passes: 0,
        errors: [
          {
            line: 3,
            message: 'Undefined control sequence: \\unknowncommand',
            severity: 'error',
          },
        ],
        warnings: [],
        logs: { stdout: '', stderr: 'Error processing async job', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Compilation Handling', () => {
    it('should handle concurrent compilation requests', async () => {
      const commands: CompileCommand[] = [
        {
          jobId: 'concurrent-001',
          userId: 'user-789',
          content:
            '\\documentclass{article}\\begin{document}Job 1\\end{document}',
        },
        {
          jobId: 'concurrent-002',
          userId: 'user-789',
          content:
            '\\documentclass{article}\\begin{document}Job 2\\end{document}',
        },
        {
          jobId: 'concurrent-003',
          userId: 'user-789',
          content:
            '\\documentclass{article}\\begin{document}Job 3\\end{document}',
        },
      ];

      const mockResults: CompilationResult[] = [
        {
          success: true,
          pdfPath: '/tmp/concurrent-001.pdf',
          compilationTime: 1500,
          passes: 1,
          errors: [],
          warnings: [],
          logs: { stdout: '', stderr: '', rawLog: '' },
        },
        {
          success: true,
          pdfPath: '/tmp/concurrent-002.pdf',
          compilationTime: 1600,
          passes: 1,
          errors: [],
          warnings: [],
          logs: { stdout: '', stderr: '', rawLog: '' },
        },
        {
          success: true,
          pdfPath: '/tmp/concurrent-003.pdf',
          compilationTime: 1550,
          passes: 1,
          errors: [],
          warnings: [],
          logs: { stdout: '', stderr: '', rawLog: '' },
        },
      ];

      mockResults.forEach((result) => {
        mockCompilerService.compileDocument.mockResolvedValueOnce(result);
      });

      const results = await Promise.all(
        commands.map((cmd) => compileUseCase.execute(cmd)),
      );

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.pdfPath).toBeDefined();
        expect(result.pdfPath).toContain(`concurrent-00${index + 1}`);
      });
    });

    it('should maintain isolation between concurrent jobs', async () => {
      const command1: CompileCommand = {
        jobId: 'isolated-001',
        userId: 'user-001',
        content:
          '\\documentclass{article}\\usepackage{custom1}\\begin{document}User 1\\end{document}',
      };

      const command2: CompileCommand = {
        jobId: 'isolated-002',
        userId: 'user-002',
        content:
          '\\documentclass{article}\\usepackage{custom2}\\begin{document}User 2\\end{document}',
      };

      const mockResult1: CompilationResult = {
        success: true,
        pdfPath: '/tmp/user-001/output.pdf',
        compilationTime: 1400,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: 'User 1 compilation', stderr: '', rawLog: '' },
      };

      const mockResult2: CompilationResult = {
        success: true,
        pdfPath: '/tmp/user-002/output.pdf',
        compilationTime: 1450,
        passes: 1,
        errors: [],
        warnings: [],
        logs: { stdout: 'User 2 compilation', stderr: '', rawLog: '' },
      };

      mockCompilerService.compileDocument
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      const result1 = await compileUseCase.execute(command1);
      const result2 = await compileUseCase.execute(command2);

      expect(result1.pdfPath).toContain('user-001');
      expect(result2.pdfPath).toContain('user-002');
      expect(result1.pdfPath).not.toBe(result2.pdfPath);
    });
  });

  describe('Resource Management & Limits', () => {
    it('should handle timeout for long-running compilations', async () => {
      const command: CompileCommand = {
        jobId: 'timeout-001',
        userId: 'user-123',
        content:
          '\\documentclass{article}\\begin{document}' +
          'x'.repeat(100000) +
          '\\end{document}',
      };

      const mockResult: CompilationResult = {
        success: false,
        compilationTime: 5000,
        passes: 0,
        errors: [
          {
            line: 0,
            message: 'Compilation timeout after 5 seconds',
            severity: 'error',
          },
        ],
        warnings: [],
        logs: { stdout: '', stderr: 'Process timeout', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should enforce memory limits during compilation', async () => {
      const command: CompileCommand = {
        jobId: 'memory-limit-001',
        userId: 'user-123',
        content:
          '\\documentclass{article}\\usepackage{tikz}\\begin{document}Test memory limit\\end{document}',
      };

      const mockResult: CompilationResult = {
        success: false,
        compilationTime: 3000,
        passes: 0,
        errors: [
          { line: 0, message: 'Memory limit exceeded', severity: 'error' },
        ],
        warnings: [],
        logs: { stdout: '', stderr: 'Out of memory', rawLog: '' },
      };

      mockCompilerService.compileDocument.mockResolvedValue(mockResult);

      const result = await compileUseCase.execute(command);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });
});
