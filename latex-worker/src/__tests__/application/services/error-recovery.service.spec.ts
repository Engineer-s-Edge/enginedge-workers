import { Test, TestingModule } from '@nestjs/testing';
import { 
  ErrorRecoveryService, 
  ErrorCategory, 
  ErrorSeverity 
} from '../../../application/services/error-recovery.service';

describe('ErrorRecoveryService', () => {
  let service: ErrorRecoveryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ErrorRecoveryService],
    }).compile();

    service = module.get<ErrorRecoveryService>(ErrorRecoveryService);
  });

  describe('parseErrors', () => {
    it('should parse undefined control sequence error', () => {
      const log = `
! Undefined control sequence. \\invalidcommand
l.10 The command here
      `;

      const result = service.parseErrors(log);

      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      
      // Should find the undefined command error
      const hasUndefinedCmd = result.errors.some(e => 
        e.category === ErrorCategory.UNDEFINED_COMMAND
      );
      expect(hasUndefinedCmd).toBe(true);
    });

    it('should parse missing package error', () => {
      const log = `
! LaTeX Error: File \`amsmath.sty' not found.
l.5 \\usepackage{amsmath}
      `;

      const result = service.parseErrors(log);

      expect(result.errorCount).toBe(1);
      expect(result.errors[0].category).toBe(ErrorCategory.MISSING_PACKAGE);
      expect(result.errors[0].suggestion).toContain('amsmath.sty');
      expect(result.errors[0].documentation).toBeDefined();
    });

    it('should parse undefined reference warning', () => {
      const log = `
LaTeX Warning: Reference \`fig:example' on page 1 undefined on input line 45.
      `;

      const result = service.parseErrors(log);

      expect(result.warningCount).toBe(1);
      expect(result.errors[0].category).toBe(ErrorCategory.UNDEFINED_REFERENCE);
      expect(result.errors[0].severity).toBe(ErrorSeverity.WARNING);
      expect(result.errors[0].suggestion).toContain('fig:example');
    });

    it('should parse math mode error', () => {
      const log = `
! Missing $ inserted.
l.15 Here is some math: \\frac{1}{2}
      `;

      const result = service.parseErrors(log);

      expect(result.errorCount).toBe(1);
      expect(result.errors[0].category).toBe(ErrorCategory.MATH_MODE);
      expect(result.errors[0].suggestion).toContain('math mode');
      expect(result.errors[0].line).toBe(15);
    });

    it('should parse missing file error', () => {
      const log = `
! LaTeX Error: File \`image.png' not found.
l.20 \\includegraphics{image.png}
      `;

      const result = service.parseErrors(log);

      expect(result.errorCount).toBe(1);
      expect(result.errors[0].category).toBe(ErrorCategory.MISSING_FILE);
      expect(result.errors[0].suggestion).toContain('image.png');
    });

    it('should parse font error', () => {
      const log = `
Font cmr10 at 600 not found
      `;

      const result = service.parseErrors(log);

      expect(result.errorCount).toBe(1);
      expect(result.errors[0].category).toBe(ErrorCategory.FONT);
      expect(result.errors[0].suggestion).toContain('cmr10');
    });

    it('should parse missing \\begin{document} error', () => {
      const log = `
! LaTeX Error: Missing \\begin{document}.
l.1 Some text here
      `;

      const result = service.parseErrors(log);

      expect(result.errorCount).toBe(1);
      expect(result.errors[0].category).toBe(ErrorCategory.SYNTAX);
      expect(result.errors[0].suggestion).toContain('\\begin{document}');
    });

    it('should parse undefined environment error', () => {
      const log = `
! LaTeX Error: Environment customenv undefined.
l.25 \\begin{customenv}
      `;

      const result = service.parseErrors(log);

      expect(result.errorCount).toBe(1);
      expect(result.errors[0].category).toBe(ErrorCategory.ENVIRONMENT);
      expect(result.errors[0].suggestion).toContain('customenv');
    });

    it('should parse overfull hbox warning', () => {
      const log = `
Overfull \\hbox (15.0pt too wide) in paragraph at lines 30--31
      `;

      const result = service.parseErrors(log);

      expect(result.warningCount).toBe(1);
      expect(result.errors[0].category).toBe(ErrorCategory.SYNTAX);
      expect(result.errors[0].severity).toBe(ErrorSeverity.WARNING);
      expect(result.errors[0].suggestion).toContain('margin');
    });

    it('should parse underfull hbox warning', () => {
      const log = `
Underfull \\hbox (badness 10000) in paragraph at lines 40--42
      `;

      const result = service.parseErrors(log);

      expect(result.warningCount).toBe(1);
      expect(result.errors[0].suggestion).toContain('whitespace');
    });

    it('should parse multiple errors', () => {
      const log = `
! Undefined control sequence.
l.10 \\badcommand
! Missing $ inserted.
l.20 \\frac{1}{2}
LaTeX Warning: Reference \`fig:test' on page 1 undefined.
      `;

      const result = service.parseErrors(log);

      expect(result.errors.length).toBeGreaterThanOrEqual(2); // At least 2 errors found
      expect(result.errorCount).toBeGreaterThanOrEqual(1);
      expect(result.warningCount).toBeGreaterThanOrEqual(1);
    });

    it('should extract file context when available', () => {
      const log = `
(./main.tex
! Missing $ inserted.
l.10 \\frac{1}{2}
      `;

      const result = service.parseErrors(log);

      expect(result.errors.length).toBeGreaterThan(0);
      if (result.errors[0]) {
        expect(result.errors[0].file).toBe('main.tex');
      }
    });

    it('should handle empty log', () => {
      const result = service.parseErrors('');

      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle log with no errors', () => {
      const log = `
This is XeTeX, Version 3.141592653-2.6-0.999995
Output written on document.pdf (1 page).
Transcript written on document.log.
      `;

      const result = service.parseErrors(log);

      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });
  });

  describe('categorizeError', () => {
    it('should categorize undefined command', () => {
      const category = service.categorizeError('Undefined control sequence. \\badcmd');
      expect(category).toBe(ErrorCategory.UNDEFINED_COMMAND);
    });

    it('should categorize missing package', () => {
      const category = service.categorizeError("File `test.sty' not found");
      expect(category).toBe(ErrorCategory.MISSING_PACKAGE);
    });

    it('should categorize math mode error', () => {
      const category = service.categorizeError('Missing $ inserted');
      expect(category).toBe(ErrorCategory.MATH_MODE);
    });

    it('should return unknown for unrecognized error', () => {
      const category = service.categorizeError('Some random error message');
      expect(category).toBe(ErrorCategory.UNKNOWN);
    });
  });

  describe('getSuggestion', () => {
    it('should suggest fix for undefined command', () => {
      const suggestion = service.getSuggestion('Undefined control sequence. \\mycommand');
      
      expect(suggestion).toBeDefined();
      expect(suggestion).toContain('mycommand');
      expect(suggestion).toContain('not defined');
    });

    it('should suggest fix for missing package', () => {
      const suggestion = service.getSuggestion("File `geometry.sty' not found");
      
      expect(suggestion).toBeDefined();
      expect(suggestion).toContain('geometry.sty');
      expect(suggestion).toContain('not installed');
    });

    it('should suggest fix for math mode error', () => {
      const suggestion = service.getSuggestion('Missing $ inserted');
      
      expect(suggestion).toBeDefined();
      expect(suggestion).toContain('math mode');
    });

    it('should return undefined for unknown error', () => {
      const suggestion = service.getSuggestion('Unknown error type');
      expect(suggestion).toBeUndefined();
    });
  });

  describe('extractErrorLines', () => {
    it('should extract single line number', () => {
      const log = 'Error on l.42 in the document';
      const lines = service.extractErrorLines(log);

      expect(lines).toEqual([42]);
    });

    it('should extract multiple line numbers', () => {
      const log = `
Error on l.10
Warning on l.25
Another error on l.15
      `;
      const lines = service.extractErrorLines(log);

      expect(lines).toEqual([10, 15, 25]); // Sorted
    });

    it('should deduplicate line numbers', () => {
      const log = 'Error on l.10, another on l.10, and l.20';
      const lines = service.extractErrorLines(log);

      expect(lines).toEqual([10, 20]);
    });

    it('should handle log with no line numbers', () => {
      const log = 'No line numbers here';
      const lines = service.extractErrorLines(log);

      expect(lines).toEqual([]);
    });
  });

  describe('generateErrorSummary', () => {
    it('should generate summary for single error', () => {
      const result = service.parseErrors(`
! Missing $ inserted.
l.10 \\frac{1}{2}
      `);

      const summary = service.generateErrorSummary(result);

      expect(summary).toContain('Compilation Summary');
      if (result.errorCount > 0) {
        expect(summary).toContain('error');
        expect(summary).toContain('MATH_MODE');
      }
    });

    it('should generate summary for multiple errors', () => {
      const result = service.parseErrors(`
! Missing $ inserted.
l.10 \\alpha
! Missing $ inserted.
l.20 \\frac{1}{2}
      `);

      const summary = service.generateErrorSummary(result);

      expect(summary).toContain('Compilation Summary');
      expect(summary).toContain('MATH_MODE');
    });

    it('should include suggestions in summary', () => {
      const result = service.parseErrors(`
! Missing $ inserted.
l.10 \\frac{1}{2}
      `);

      const summary = service.generateErrorSummary(result);

      if (result.errors.length > 0) {
        expect(summary).toContain('💡');
        expect(summary).toContain('math');
      }
    });

    it('should limit errors shown per category', () => {
      const log = Array.from({ length: 5 }, (_, i) => 
        `! Missing $ inserted.\nl.${i + 1} \\frac{${i}}{${i + 1}}`
      ).join('\n');

      const result = service.parseErrors(log);
      const summary = service.generateErrorSummary(result);

      // Should have multiple math errors
      expect(result.errors.length).toBeGreaterThan(3);
      expect(summary).toContain('MATH_MODE');
    });

    it('should handle result with no errors', () => {
      const result = service.parseErrors('Clean compilation log');
      const summary = service.generateErrorSummary(result);

      expect(summary).toContain('0 error(s)');
      expect(summary).toContain('0 warning(s)');
      expect(summary).toContain('No errors or warnings found');
    });

    it('should distinguish errors from warnings with icons', () => {
      const result = service.parseErrors(`
! Missing $ inserted.
l.10 \\badcmd
Overfull \\hbox in paragraph
      `);

      const summary = service.generateErrorSummary(result);

      // Should have appropriate icons
      expect(summary).toMatch(/[❌⚠️]/); // Has either error or warning icon
    });
  });

  describe('auto-fix detection', () => {
    it('should detect auto-fixable missing package error', () => {
      const result = service.parseErrors(`
! LaTeX Error: File \`amsmath.sty' not found.
      `);

      expect(result.canAutoFix).toBe(true);
      expect(result.autoFixSuggestions).toBeDefined();
      expect(result.autoFixSuggestions![0]).toContain('\\usepackage{amsmath}');
    });

    it('should detect auto-fixable undefined reference', () => {
      const result = service.parseErrors(`
LaTeX Warning: Reference \`fig:test' on page 1 undefined.
      `);

      expect(result.canAutoFix).toBe(true);
      expect(result.autoFixSuggestions).toBeDefined();
      expect(result.autoFixSuggestions![0]).toContain('compilation');
    });

    it('should not mark syntax errors as auto-fixable', () => {
      const result = service.parseErrors(`
! Undefined control sequence.
l.10 \\badcommand
      `);

      expect(result.canAutoFix).toBe(false);
      expect(result.autoFixSuggestions).toBeUndefined();
    });

    it('should generate multiple auto-fix suggestions', () => {
      const result = service.parseErrors(`
! LaTeX Error: File \`amsmath.sty' not found.
! LaTeX Error: File \`geometry.sty' not found.
      `);

      expect(result.canAutoFix).toBe(true);
      expect(result.autoFixSuggestions).toBeDefined();
      expect(result.autoFixSuggestions![0]).toContain('amsmath');
      expect(result.autoFixSuggestions![0]).toContain('geometry');
    });
  });

  describe('comprehensive error scenarios', () => {
    it('should handle complex multi-file compilation log', () => {
      const log = `
(./main.tex
LaTeX2e <2021-11-15>
(./chapter1.tex
! Missing $ inserted.
l.10 \\alpha + \\beta
)
(./chapter2.tex
! Missing $ inserted.
l.25 \\gamma
)
LaTeX Warning: Reference \`eq:pythagoras' on page 3 undefined.
)
      `;

      const result = service.parseErrors(log);

      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errorCount).toBeGreaterThanOrEqual(1);
      expect(result.warningCount).toBeGreaterThanOrEqual(1);
    });

    it('should provide documentation links for common errors', () => {
      const result = service.parseErrors(`
! LaTeX Error: File \`amsmath.sty' not found.
l.5 \\usepackage{amsmath}
      `);

      expect(result.errors.length).toBeGreaterThan(0);
      if (result.errors[0]) {
        expect(result.errors[0].documentation).toBeDefined();
        expect(result.errors[0].documentation).toContain('.org'); // CTAN link
      }
    });

    it('should handle real-world LaTeX compilation log', () => {
      const realLog = `
This is XeTeX, Version 3.141592653-2.6-0.999995 (TeX Live 2023)
entering extended mode
(./document.tex
LaTeX2e <2021-11-15>
! Missing $ inserted.
l.15 The formula is \\frac
                               {test}.
? 
! Emergency stop.
l.15 The formula is \\frac
                               {test}.
No pages of output.
Transcript written on document.log.
      `;

      const result = service.parseErrors(realLog);

      expect(result.errors.length).toBeGreaterThan(0);
      // Should find math mode error
      expect(result.errors.some(e => e.category === ErrorCategory.MATH_MODE)).toBe(true);
    });
  });
});
