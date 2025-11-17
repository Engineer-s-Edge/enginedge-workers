import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LatexService {
  private readonly logger = new Logger(LatexService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Request AI to edit LaTeX
   */
  async editLatex(
    resumeId: string,
    latexContent: string,
    userRequest: string,
    lintingErrors?: any[],
    lintingWarnings?: any[],
  ): Promise<{
    suggestedEdits: Array<{
      type: string;
      range?: any;
      position?: any;
      oldText?: string;
      newText?: string;
      text?: string;
      explanation: string;
    }>;
    summary: string;
    confidence: number;
  }> {
    // Simplified implementation - in production, integrate with AI agent service
    const edits: Array<{
      type: string;
      range?: any;
      position?: any;
      oldText?: string;
      newText?: string;
      text?: string;
      explanation: string;
    }> = [];

    // Fix linting errors first
    if (lintingErrors && lintingErrors.length > 0) {
      for (const error of lintingErrors) {
        if (error.message.includes('Undefined control sequence')) {
          edits.push({
            type: 'fix',
            range: {
              start: { line: error.line, column: error.column },
              end: { line: error.line, column: error.column + 20 },
            },
            oldText: '\\undefinedcommand',
            newText: '\\textbf',
            explanation: 'Fixed undefined control sequence error',
          });
        }
      }
    }

    // Apply user request (simplified)
    if (userRequest.toLowerCase().includes('larger') || userRequest.toLowerCase().includes('header')) {
      edits.push({
        type: 'replace',
        range: {
          start: { line: 5, column: 1 },
          end: { line: 5, column: 50 },
        },
        oldText: '\\title{Resume}',
        newText: '\\title{\\Large Resume}',
        explanation: 'Increased header size using \\Large command',
      });
    }

    if (userRequest.toLowerCase().includes('spacing') || userRequest.toLowerCase().includes('space')) {
      edits.push({
        type: 'insert',
        position: { line: 10, column: 1 },
        text: '\\vspace{0.5cm}',
        explanation: 'Added vertical spacing between sections',
      });
    }

    return {
      suggestedEdits: edits,
      summary: `Made ${edits.length} edits based on request and linting errors`,
      confidence: 0.9,
    };
  }

  /**
   * Analyze LaTeX with linting context
   */
  async analyzeLatex(
    latexContent: string,
    lintingErrors?: any[],
    lintingWarnings?: any[],
    analysisType: string = 'comprehensive',
  ): Promise<{
    analysis: {
      errors: Array<{
        line: number;
        message: string;
        suggestion: string;
        severity: string;
      }>;
      warnings: Array<{
        line: number;
        message: string;
        suggestion: string;
        severity: string;
      }>;
      bestPractices: Array<{
        line: number;
        suggestion: string;
        type: string;
      }>;
    };
    overallHealth: number;
    recommendations: string[];
  }> {
    const errors: Array<{
      line: number;
      message: string;
      suggestion: string;
      severity: string;
    }> = [];

    const warnings: Array<{
      line: number;
      message: string;
      suggestion: string;
      severity: string;
    }> = [];

    const bestPractices: Array<{
      line: number;
      suggestion: string;
      type: string;
    }> = [];

    // Process linting errors
    if (lintingErrors && (analysisType === 'errors-only' || analysisType === 'comprehensive')) {
      for (const error of lintingErrors) {
        errors.push({
          line: error.line,
          message: error.message,
          suggestion: this.getErrorSuggestion(error.message),
          severity: 'error',
        });
      }
    }

    // Process linting warnings
    if (lintingWarnings && (analysisType === 'warnings-only' || analysisType === 'comprehensive')) {
      for (const warning of lintingWarnings) {
        warnings.push({
          line: warning.line,
          message: warning.message,
          suggestion: this.getWarningSuggestion(warning.message),
          severity: 'warning',
        });
      }
    }

    // Best practices (simplified)
    if (analysisType === 'comprehensive') {
      if (!latexContent.includes('\\moderncvstyle')) {
        bestPractices.push({
          line: 5,
          suggestion: 'Consider using \\moderncvstyle for better formatting',
          type: 'style',
        });
      }
    }

    const overallHealth = Math.max(
      0,
      1.0 - (errors.length * 0.1) - (warnings.length * 0.05),
    );

    const recommendations: string[] = [];
    if (errors.length > 0) {
      recommendations.push(`Fix ${errors.length} critical error${errors.length > 1 ? 's' : ''}`);
    }
    if (warnings.length > 0) {
      recommendations.push(`Address ${warnings.length} warning${warnings.length > 1 ? 's' : ''} for better formatting`);
    }
    if (bestPractices.length > 0) {
      recommendations.push('Consider modernizing LaTeX style');
    }

    return {
      analysis: {
        errors,
        warnings,
        bestPractices,
      },
      overallHealth,
      recommendations,
    };
  }

  /**
   * Lint LaTeX content
   */
  async lint(
    latexContent: string,
    options?: {
      checkSyntax?: boolean;
      checkStyle?: boolean;
      checkBestPractices?: boolean;
    },
  ): Promise<{
    errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
      code: string;
    }>;
    warnings: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
      code: string;
    }>;
    info: Array<{
      line: number;
      message: string;
      severity: string;
      code: string;
    }>;
  }> {
    const errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
      code: string;
    }> = [];

    const warnings: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
      code: string;
    }> = [];

    const info: Array<{
      line: number;
      message: string;
      severity: string;
      code: string;
    }> = [];

    const lines = latexContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for syntax errors
      if (options?.checkSyntax !== false) {
        // Check for unmatched braces
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        if (openBraces !== closeBraces) {
          errors.push({
            line: lineNum,
            column: line.length,
            message: 'Unmatched braces',
            severity: 'error',
            code: 'unmatched-braces',
          });
        }

        // Check for undefined commands
        const undefinedMatch = line.match(/\\([a-zA-Z]+)\{/);
        if (undefinedMatch) {
          const command = undefinedMatch[1];
          const commonCommands = [
            'documentclass',
            'begin',
            'end',
            'section',
            'item',
            'textbf',
            'textit',
            'title',
            'author',
            'date',
          ];
          if (!commonCommands.includes(command)) {
            errors.push({
              line: lineNum,
              column: undefinedMatch.index || 0,
              message: `Undefined control sequence: \\${command}`,
              severity: 'error',
              code: 'undefined-command',
            });
          }
        }
      }

      // Check for style issues
      if (options?.checkStyle !== false) {
        // Check for overfull hbox (simplified)
        if (line.length > 80 && line.includes('\\item')) {
          warnings.push({
            line: lineNum,
            column: 80,
            message: 'Overfull hbox',
            severity: 'warning',
            code: 'overfull-hbox',
          });
        }
      }

      // Best practices
      if (options?.checkBestPractices !== false) {
        if (lineNum === 5 && !latexContent.includes('\\moderncvstyle')) {
          info.push({
            line: lineNum,
            message: 'Consider using \\moderncvstyle',
            severity: 'info',
            code: 'style-suggestion',
          });
        }
      }
    }

    return { errors, warnings, info };
  }

  /**
   * Get suggestion for error message
   */
  private getErrorSuggestion(message: string): string {
    if (message.includes('Undefined control sequence')) {
      return 'Replace undefined command with a valid LaTeX command (e.g., \\textbf, \\textit)';
    }
    if (message.includes('Missing')) {
      return 'Add the missing element';
    }
    return 'Review LaTeX syntax';
  }

  /**
   * Get suggestion for warning message
   */
  private getWarningSuggestion(message: string): string {
    if (message.includes('Overfull hbox')) {
      return 'Add \\sloppy or adjust text width';
    }
    return 'Review formatting';
  }
}
