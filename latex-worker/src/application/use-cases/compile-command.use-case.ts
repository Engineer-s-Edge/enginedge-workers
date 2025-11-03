import { Injectable, Logger } from '@nestjs/common';
import { LaTeXCompilerService } from '../services/latex-compiler.service';
import { LaTeXDocument } from '../../domain/entities/latex-document.entity';

export interface CompileCommand {
  jobId: string;
  userId: string;
  content: string;
  settings?: {
    engine?: 'xelatex';
    shellEscape?: boolean;
    maxPasses?: number;
    timeout?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface CompileResult {
  success: boolean;
  pdfPath?: string;
  errors?: string[];
  warnings?: string[];
  compilationTime?: number;
  metadata?: Record<string, unknown>;
}

/**
 * CompileCommandUseCase
 *
 * Application layer use case for handling compilation commands.
 * Orchestrates LaTeXCompilerService and returns structured results.
 */
@Injectable()
export class CompileCommandUseCase {
  private readonly logger = new Logger(CompileCommandUseCase.name);

  constructor(private readonly compilerService: LaTeXCompilerService) {}

  async execute(command: CompileCommand): Promise<CompileResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`Executing compilation for job ${command.jobId}`);

      // Create LaTeXDocument entity
      let document = LaTeXDocument.create(command.jobId, command.content, {
        title: command.metadata?.title as string,
        author: command.metadata?.author as string,
      });

      // Override settings if provided
      if (command.settings) {
        document = document.updateSettings({
          engine: 'xelatex',
          maxPasses: command.settings.maxPasses || 3,
          timeout: command.settings.timeout || 30000,
          shell: command.settings.shellEscape || false,
          draft: false,
        });
      }

      // Compile document
      const result = await this.compilerService.compileDocument(document);

      const compilationTime = Date.now() - startTime;

      // Check success
      if (!result.success) {
        this.logger.warn(
          `Compilation failed for job ${command.jobId}: ${result.errors.map((e) => e.message).join(', ')}`,
        );

        return {
          success: false,
          errors: result.errors.map((e) => e.message),
          warnings: result.warnings.map((w) => w.message),
          compilationTime,
          metadata: command.metadata,
        };
      }

      // Success - get PDF path
      const pdfPath = result.pdfPath;
      if (!pdfPath) {
        this.logger.error(
          `Compilation succeeded but PDF path is missing for job ${command.jobId}`,
        );
        return {
          success: false,
          errors: ['PDF generation failed - path is empty'],
          warnings: result.warnings.map((w) => w.message),
          compilationTime,
          metadata: command.metadata,
        };
      }

      this.logger.log(
        `Compilation succeeded for job ${command.jobId} in ${compilationTime}ms`,
      );

      return {
        success: true,
        pdfPath,
        errors: [],
        warnings: result.warnings.map((w) => w.message),
        compilationTime,
        metadata: command.metadata,
      };
    } catch (error) {
      const compilationTime = Date.now() - startTime;
      this.logger.error(`Compilation error for job ${command.jobId}`, error);

      return {
        success: false,
        errors: [
          error instanceof Error ? error.message : 'Unknown compilation error',
        ],
        warnings: [],
        compilationTime,
        metadata: command.metadata,
      };
    }
  }
}
