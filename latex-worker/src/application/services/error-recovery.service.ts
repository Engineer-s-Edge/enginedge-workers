import { Injectable, Logger } from '@nestjs/common';

/**
 * LaTeX error category
 */
export enum ErrorCategory {
  SYNTAX = 'syntax',
  MISSING_PACKAGE = 'missing_package',
  UNDEFINED_COMMAND = 'undefined_command',
  UNDEFINED_REFERENCE = 'undefined_reference',
  MATH_MODE = 'math_mode',
  MISSING_FILE = 'missing_file',
  FONT = 'font',
  ENCODING = 'encoding',
  DIMENSION = 'dimension',
  ENVIRONMENT = 'environment',
  UNKNOWN = 'unknown',
}

/**
 * LaTeX error severity
 */
export enum ErrorSeverity {
  ERROR = 'error',      // Compilation failed
  WARNING = 'warning',  // Compilation succeeded with warnings
  INFO = 'info',        // Informational messages
}

/**
 * Parsed LaTeX error with context
 */
export interface ParsedError {
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Line number where error occurred */
  line?: number;
  /** File where error occurred */
  file?: string;
  /** Error message from LaTeX */
  message: string;
  /** Suggested fix */
  suggestion?: string;
  /** Code snippet causing the error */
  snippet?: string;
  /** Related documentation link */
  documentation?: string;
}

/**
 * Error recovery result
 */
export interface ErrorRecoveryResult {
  /** Original error log */
  originalLog: string;
  /** Parsed errors */
  errors: ParsedError[];
  /** Total errors found */
  errorCount: number;
  /** Total warnings found */
  warningCount: number;
  /** Can compilation be fixed automatically? */
  canAutoFix: boolean;
  /** Auto-fix suggestions */
  autoFixSuggestions?: string[];
}

/**
 * Error pattern for regex matching
 */
interface ErrorPattern {
  pattern: RegExp;
  category: ErrorCategory;
  severity: ErrorSeverity;
  getSuggestion: (match: RegExpMatchArray) => string;
  getDocumentation?: (match: RegExpMatchArray) => string;
}

/**
 * Error Recovery Service
 * 
 * Analyzes LaTeX compilation errors and provides:
 * - Detailed error categorization
 * - Line number extraction
 * - Suggested fixes
 * - Documentation links
 * - Auto-fix capabilities
 */
@Injectable()
export class ErrorRecoveryService {
  private readonly logger = new Logger(ErrorRecoveryService.name);

  /**
   * Error patterns with suggestions
   */
  private readonly errorPatterns: ErrorPattern[] = [
    // Undefined control sequence
    {
      pattern: /Undefined control sequence[.\s]*\\(\w+)/i,
      category: ErrorCategory.UNDEFINED_COMMAND,
      severity: ErrorSeverity.ERROR,
      getSuggestion: (match) => 
        `The command \\${match[1]} is not defined. Check if you need to import a package (e.g., \\usepackage{amsmath} for math commands) or if the command is spelled correctly.`,
      getDocumentation: () => 'https://www.overleaf.com/learn/latex/Errors/Undefined_control_sequence',
    },
    
    // Missing package
    {
      pattern: /File `([^']+\.sty)' not found/,
      category: ErrorCategory.MISSING_PACKAGE,
      severity: ErrorSeverity.ERROR,
      getSuggestion: (match) => 
        `The package '${match[1]}' is not installed. Add it to your package manager configuration or use an alternative package.`,
      getDocumentation: () => 'https://www.ctan.org/',
    },
    
    // Undefined reference
    {
      pattern: /Reference `([^']+)' on page \d+ undefined/,
      category: ErrorCategory.UNDEFINED_REFERENCE,
      severity: ErrorSeverity.WARNING,
      getSuggestion: (match) => 
        `The reference '${match[1]}' is not defined. Add a \\label{${match[1]}} command or check if the label name is correct. You may need to compile twice for references to resolve.`,
    },
    
    // Missing $ inserted
    {
      pattern: /Missing \$ inserted/,
      category: ErrorCategory.MATH_MODE,
      severity: ErrorSeverity.ERROR,
      getSuggestion: () => 
        `You're using a math command outside of math mode. Wrap it in $...$ for inline math or $$...$$ for display math.`,
      getDocumentation: () => 'https://www.overleaf.com/learn/latex/Mathematical_expressions',
    },
    
    // Display math should end with $$
    {
      pattern: /Display math should end with \$\$/,
      category: ErrorCategory.MATH_MODE,
      severity: ErrorSeverity.ERROR,
      getSuggestion: () => 
        `Your display math environment is not properly closed. Make sure every $$ has a matching $$.`,
    },
    
    // File not found
    {
      pattern: /File `([^']+)' not found/,
      category: ErrorCategory.MISSING_FILE,
      severity: ErrorSeverity.ERROR,
      getSuggestion: (match) => 
        `The file '${match[1]}' could not be found. Check the file path and make sure the file exists in your project.`,
    },
    
    // Font not found
    {
      pattern: /Font (\S+) at (\d+) not found/,
      category: ErrorCategory.FONT,
      severity: ErrorSeverity.ERROR,
      getSuggestion: (match) => 
        `The font '${match[1]}' is not available. Install the font or use a different font family.`,
    },
    
    // Missing \begin{document}
    {
      pattern: /Missing \\begin\{document\}/,
      category: ErrorCategory.SYNTAX,
      severity: ErrorSeverity.ERROR,
      getSuggestion: () => 
        `Your document is missing \\begin{document}. Add it after your preamble (package imports and settings).`,
      getDocumentation: () => 'https://www.overleaf.com/learn/latex/Creating_a_document_in_LaTeX',
    },
    
    // Environment undefined
    {
      pattern: /Environment (\w+) undefined/,
      category: ErrorCategory.ENVIRONMENT,
      severity: ErrorSeverity.ERROR,
      getSuggestion: (match) => 
        `The environment '${match[1]}' is not defined. Check if you need to import a package that defines this environment.`,
    },
    
    // Unmatched braces
    {
      pattern: /Missing [{}] inserted/,
      category: ErrorCategory.SYNTAX,
      severity: ErrorSeverity.ERROR,
      getSuggestion: () => 
        `You have unmatched curly braces {}. Make sure every opening brace { has a matching closing brace }.`,
    },
    
    // Runaway argument
    {
      pattern: /Runaway argument/,
      category: ErrorCategory.SYNTAX,
      severity: ErrorSeverity.ERROR,
      getSuggestion: () => 
        `A command argument is not properly closed. Check for missing closing braces } or brackets ].`,
    },
    
    // Dimension too large
    {
      pattern: /Dimension too large/,
      category: ErrorCategory.DIMENSION,
      severity: ErrorSeverity.ERROR,
      getSuggestion: () => 
        `A dimension (length, width, height) exceeds LaTeX limits. Use smaller values or the calc package for complex calculations.`,
    },
    
    // Overfull/Underfull hbox
    {
      pattern: /(Overfull|Underfull) \\hbox/,
      category: ErrorCategory.SYNTAX,
      severity: ErrorSeverity.WARNING,
      getSuggestion: (match) => 
        match[1] === 'Overfull' 
          ? `Text extends beyond the margin. Consider rephrasing, adding hyphenation points (\\-), or adjusting margins.`
          : `Line has too much whitespace. Consider rephrasing or using \\raggedright for left-aligned text.`,
    },
    
    // Package option clash
    {
      pattern: /Option clash for package (\w+)/,
      category: ErrorCategory.MISSING_PACKAGE,
      severity: ErrorSeverity.ERROR,
      getSuggestion: (match) => 
        `Package '${match[1]}' is loaded multiple times with different options. Consolidate all options in the first \\usepackage{${match[1]}} command.`,
    },
  ];

  /**
   * Parse LaTeX compilation log and extract errors
   * 
   * @param log - Raw compilation log from XeLaTeX/pdflatex
   * @returns Parsed errors with suggestions
   */
  parseErrors(log: string): ErrorRecoveryResult {
    const errors: ParsedError[] = [];
    const lines = log.split('\n');
    
    let errorCount = 0;
    let warningCount = 0;

    // Track current file and line for context
    let currentFile: string | undefined;
    let currentLine: number | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Extract file context: (./filename.tex
      const fileMatch = line.match(/\(\.\/([^)]+\.tex)/);
      if (fileMatch) {
        currentFile = fileMatch[1];
      }

      // Extract line number from current or next line: l.123
      const lineMatch = line.match(/l\.(\d+)/);
      if (lineMatch) {
        currentLine = parseInt(lineMatch[1], 10);
      } else if (i + 1 < lines.length) {
        // Check next line for line number
        const nextLineMatch = lines[i + 1].match(/l\.(\d+)/);
        if (nextLineMatch) {
          currentLine = parseInt(nextLineMatch[1], 10);
        }
      }

      // Try to match error patterns
      for (const errorPattern of this.errorPatterns) {
        const match = line.match(errorPattern.pattern);
        if (match) {
          const error: ParsedError = {
            category: errorPattern.category,
            severity: errorPattern.severity,
            message: match[0],
            suggestion: errorPattern.getSuggestion(match),
            line: currentLine,
            file: currentFile,
          };

          if (errorPattern.getDocumentation) {
            error.documentation = errorPattern.getDocumentation(match);
          }

          // Try to extract code snippet from next few lines
          if (i + 1 < lines.length) {
            const snippetLines = lines.slice(i + 1, i + 4).filter(l => l.trim() && !l.startsWith('!') && !l.startsWith('?'));
            if (snippetLines.length > 0) {
              error.snippet = snippetLines.join('\n').substring(0, 200);
            }
          }

          errors.push(error);

          if (errorPattern.severity === ErrorSeverity.ERROR) {
            errorCount++;
          } else if (errorPattern.severity === ErrorSeverity.WARNING) {
            warningCount++;
          }

          break; // Only match one pattern per line
        }
      }
    }

    // Determine if errors can be auto-fixed
    const canAutoFix = this.canAutoFixErrors(errors);
    const autoFixSuggestions = canAutoFix ? this.generateAutoFixSuggestions(errors) : undefined;

    this.logger.log(`Parsed ${errorCount} errors and ${warningCount} warnings from compilation log`);

    return {
      originalLog: log,
      errors,
      errorCount,
      warningCount,
      canAutoFix,
      autoFixSuggestions,
    };
  }

  /**
   * Categorize a single error message
   * 
   * @param message - Error message
   * @returns Error category
   */
  categorizeError(message: string): ErrorCategory {
    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(message)) {
        return pattern.category;
      }
    }
    return ErrorCategory.UNKNOWN;
  }

  /**
   * Get suggested fix for a specific error
   * 
   * @param message - Error message
   * @returns Suggested fix or undefined
   */
  getSuggestion(message: string): string | undefined {
    for (const pattern of this.errorPatterns) {
      const match = message.match(pattern.pattern);
      if (match) {
        return pattern.getSuggestion(match);
      }
    }
    return undefined;
  }

  /**
   * Extract line numbers from error messages
   * 
   * @param log - Compilation log
   * @returns Array of line numbers with errors
   */
  extractErrorLines(log: string): number[] {
    const lines: number[] = [];
    const linePattern = /l\.(\d+)/g;
    
    let match: RegExpExecArray | null;
    while ((match = linePattern.exec(log)) !== null) {
      lines.push(parseInt(match[1], 10));
    }

    return Array.from(new Set(lines)).sort((a, b) => a - b);
  }

  /**
   * Generate human-readable error summary
   * 
   * @param result - Error recovery result
   * @returns Formatted summary
   */
  generateErrorSummary(result: ErrorRecoveryResult): string {
    const { errorCount, warningCount, errors } = result;
    
    let summary = `Compilation Summary:\n`;
    summary += `- ${errorCount} error(s)\n`;
    summary += `- ${warningCount} warning(s)\n\n`;

    if (errors.length === 0) {
      summary += 'No errors or warnings found.\n';
      return summary;
    }

    // Group by category
    const byCategory = new Map<ErrorCategory, ParsedError[]>();
    for (const error of errors) {
      if (!byCategory.has(error.category)) {
        byCategory.set(error.category, []);
      }
      byCategory.get(error.category)!.push(error);
    }

    // Format by category
    for (const [category, categoryErrors] of byCategory) {
      summary += `${category.toUpperCase()} (${categoryErrors.length}):\n`;
      
      for (const error of categoryErrors.slice(0, 3)) { // Show max 3 per category
        summary += `  ${error.severity === ErrorSeverity.ERROR ? '❌' : '⚠️'} `;
        
        if (error.line) {
          summary += `Line ${error.line}: `;
        }
        
        summary += `${error.message.substring(0, 100)}\n`;
        
        if (error.suggestion) {
          summary += `     💡 ${error.suggestion.substring(0, 150)}\n`;
        }
      }
      
      if (categoryErrors.length > 3) {
        summary += `  ... and ${categoryErrors.length - 3} more\n`;
      }
      summary += '\n';
    }

    return summary;
  }

  /**
   * Check if errors can be automatically fixed
   */
  private canAutoFixErrors(errors: ParsedError[]): boolean {
    // Auto-fix is possible for certain error categories (both errors and warnings)
    const autoFixableCategories = [
      ErrorCategory.MISSING_PACKAGE,
      ErrorCategory.UNDEFINED_REFERENCE,
    ];

    return errors.some(e => autoFixableCategories.includes(e.category));
  }

  /**
   * Generate auto-fix suggestions
   */
  private generateAutoFixSuggestions(errors: ParsedError[]): string[] {
    const suggestions: string[] = [];

    // Find missing packages
    const missingPackages = errors
      .filter(e => e.category === ErrorCategory.MISSING_PACKAGE)
      .map(e => {
        const match = e.message.match(/File `([^']+\.sty)'/);
        return match ? match[1].replace('.sty', '') : null;
      })
      .filter(Boolean) as string[];

    if (missingPackages.length > 0) {
      suggestions.push(`Add to preamble: ${missingPackages.map(p => `\\usepackage{${p}}`).join(', ')}`);
    }

    // Find undefined references
    const undefinedRefs = errors
      .filter(e => e.category === ErrorCategory.UNDEFINED_REFERENCE)
      .map(e => {
        const match = e.message.match(/Reference `([^']+)'/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];

    if (undefinedRefs.length > 0) {
      suggestions.push(`Run compilation twice to resolve references, or add missing labels: ${undefinedRefs.map(r => `\\label{${r}}`).join(', ')}`);
    }

    return suggestions;
  }
}
