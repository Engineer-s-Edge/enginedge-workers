/**
 * XeLaTeX Compiler Adapter
 *
 * Infrastructure adapter that executes XeLaTeX compilation.
 * Implements the ILaTeXCompiler port from the domain layer.
 */

import { Injectable, Inject } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import { ILaTeXCompiler, ILogger, IFileSystem } from '../../domain/ports';
import {
  LaTeXDocument,
  LaTeXProject,
  CompilationResult,
  CompilationError,
  CompilationWarning,
} from '../../domain/entities';

@Injectable()
export class XeLaTeXCompilerAdapter implements ILaTeXCompiler {
  private readonly compilerPath = 'xelatex';

  constructor(
    @Inject('ILogger') private readonly logger: ILogger,
    @Inject('IFileSystem') private readonly fs: IFileSystem,
  ) {}

  private runningProcesses: Map<string, ReturnType<typeof spawn>> = new Map();

  /**
   * Compile a single LaTeX document
   */
  async compile(
    document: LaTeXDocument,
    workingDir: string,
    jobId?: string,
  ): Promise<CompilationResult> {
    const startTime = Date.now();
    const texFile = path.join(workingDir, 'main.tex');
    const currentJobId = jobId || `job-${Date.now()}`;

    try {
      // Write document content to file
      await this.fs.writeFile(texFile, document.content);

      // Determine number of passes needed
      const passes = document.requiresMultiplePasses()
        ? Math.min(document.settings.maxPasses, 3)
        : 1;

      let lastResult: { stdout: string; stderr: string; exitCode: number } = {
        stdout: '',
        stderr: '',
        exitCode: 0,
      };

      // Run compilation passes
      for (let pass = 1; pass <= passes; pass++) {
        this.logger.log(
          `Running XeLaTeX pass ${pass}/${passes}`,
          'XeLaTeXCompilerAdapter',
        );

        lastResult = await this.runXeLaTeX(
          workingDir,
          'main.tex',
          {
            shell: document.settings.shell,
            draft: document.settings.draft && pass < passes,
            interaction: 'nonstopmode',
          },
          `${currentJobId}-pass-${pass}`,
        );

        // If compilation failed, stop
        if (lastResult.exitCode !== 0) {
          break;
        }

        // Run bibliography if needed (between passes)
        if (document.requiresBibliography() && pass === 1) {
          await this.runBibTeX(workingDir, 'main');
        }
      }

      const compilationTime = Date.now() - startTime;

      // Parse errors and warnings from log
      const logFile = path.join(workingDir, 'main.log');
      const logContent = await this.readLogFile(logFile);
      const { errors, warnings } = this.parseLog(logContent);

      // Check if PDF was generated
      const pdfFile = path.join(workingDir, 'main.pdf');
      const pdfExists = await this.fs.exists(pdfFile);

      const success =
        lastResult.exitCode === 0 && pdfExists && errors.length === 0;

      return {
        success,
        pdfPath: pdfExists ? pdfFile : undefined,
        compilationTime,
        passes,
        errors,
        warnings,
        logs: {
          stdout: lastResult.stdout,
          stderr: lastResult.stderr,
          rawLog: logContent,
        },
      };
    } catch (error) {
      const compilationTime = Date.now() - startTime;

      return {
        success: false,
        compilationTime,
        passes: 0,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            severity: 'error',
          },
        ],
        warnings: [],
        logs: {
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
          rawLog: '',
        },
      };
    }
  }

  /**
   * Compile a multi-file LaTeX project
   */
  async compileProject(
    project: LaTeXProject,
    workingDir: string,
  ): Promise<CompilationResult> {
    const startTime = Date.now();

    try {
      // All files should already be written to workingDir by the service
      const mainTexFile = path.join(workingDir, project.mainFile);

      // Read main file to create temporary document for settings
      const mainContent = await this.fs.readFile(mainTexFile);
      const tempDoc = LaTeXDocument.create(
        project.id,
        mainContent.toString('utf-8'),
      );

      // Determine number of passes
      const passes = tempDoc.requiresMultiplePasses() ? 3 : 1;

      let lastResult: { stdout: string; stderr: string; exitCode: number } = {
        stdout: '',
        stderr: '',
        exitCode: 0,
      };

      // Run compilation passes
      for (let pass = 1; pass <= passes; pass++) {
        this.logger.log(
          `Running XeLaTeX pass ${pass}/${passes} for project ${project.id}`,
          'XeLaTeXCompilerAdapter',
        );

        lastResult = await this.runXeLaTeX(workingDir, project.mainFile, {
          shell: false,
          draft: pass < passes,
          interaction: 'nonstopmode',
        });

        if (lastResult.exitCode !== 0) {
          break;
        }

        // Run bibliography if needed
        if (tempDoc.requiresBibliography() && pass === 1) {
          const mainBasename = path.basename(
            project.mainFile,
            path.extname(project.mainFile),
          );
          await this.runBibTeX(workingDir, mainBasename);
        }
      }

      const compilationTime = Date.now() - startTime;

      // Parse log file
      const mainBasename = path.basename(
        project.mainFile,
        path.extname(project.mainFile),
      );
      const logFile = path.join(workingDir, `${mainBasename}.log`);
      const logContent = await this.readLogFile(logFile);
      const { errors, warnings } = this.parseLog(logContent);

      // Check for PDF
      const pdfFile = path.join(workingDir, `${mainBasename}.pdf`);
      const pdfExists = await this.fs.exists(pdfFile);

      const success =
        lastResult.exitCode === 0 && pdfExists && errors.length === 0;

      return {
        success,
        pdfPath: pdfExists ? pdfFile : undefined,
        compilationTime,
        passes,
        errors,
        warnings,
        logs: {
          stdout: lastResult.stdout,
          stderr: lastResult.stderr,
          rawLog: logContent,
        },
      };
    } catch (error) {
      const compilationTime = Date.now() - startTime;

      return {
        success: false,
        compilationTime,
        passes: 0,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            severity: 'error',
          },
        ],
        warnings: [],
        logs: {
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
          rawLog: '',
        },
      };
    }
  }

  /**
   * Abort a running compilation
   */
  async abort(jobId: string): Promise<void> {
    this.logger.log(
      `Abort requested for job ${jobId}`,
      'XeLaTeXCompilerAdapter',
    );

    const process = this.runningProcesses.get(jobId);
    if (process) {
      try {
        process.kill('SIGTERM');
        // Wait a bit, then force kill if still running
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
        this.runningProcesses.delete(jobId);
        this.logger.log(
          `Successfully aborted compilation job ${jobId}`,
          'XeLaTeXCompilerAdapter',
        );
      } catch (error) {
        this.logger.error(
          `Failed to abort job ${jobId}: ${error instanceof Error ? error.message : String(error)}`,
          'XeLaTeXCompilerAdapter',
        );
        throw error;
      }
    } else {
      this.logger.warn(
        `No running process found for job ${jobId}`,
        'XeLaTeXCompilerAdapter',
      );
    }
  }

  /**
   * Check if XeLaTeX is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.executeCommand('xelatex', ['--version']);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get XeLaTeX version
   */
  async getVersion(): Promise<string> {
    try {
      const result = await this.executeCommand('xelatex', ['--version']);
      const firstLine = result.stdout.split('\n')[0];
      return firstLine || 'Unknown version';
    } catch {
      return 'XeLaTeX not available';
    }
  }

  /**
   * Run XeLaTeX compiler
   */
  private async runXeLaTeX(
    workingDir: string,
    texFile: string,
    options: {
      shell: boolean;
      draft: boolean;
      interaction: string;
    },
    jobId?: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const args = [
      `-interaction=${options.interaction}`,
      '-halt-on-error',
      '-file-line-error',
    ];

    if (options.shell) {
      args.push('-shell-escape');
    }

    if (options.draft) {
      args.push('-draftmode');
    }

    args.push(texFile);

    return await this.executeCommand(
      this.compilerPath,
      args,
      workingDir,
      jobId,
    );
  }

  /**
   * Run BibTeX for bibliography
   */
  private async runBibTeX(workingDir: string, basename: string): Promise<void> {
    try {
      this.logger.log(
        `Running BibTeX for ${basename}`,
        'XeLaTeXCompilerAdapter',
      );

      await this.executeCommand('bibtex', [basename], workingDir);
    } catch (error) {
      this.logger.warn(
        `BibTeX failed: ${error instanceof Error ? error.message : String(error)}`,
        'XeLaTeXCompilerAdapter',
      );
      // Don't throw - continue compilation
    }
  }

  /**
   * Execute a shell command
   */
  private async executeCommand(
    command: string,
    args: string[],
    cwd?: string,
    jobId?: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        cwd,
        shell: true,
      });

      // Track process if jobId is provided
      if (jobId) {
        this.runningProcesses.set(jobId, process);
      }

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        // Clean up process tracking
        if (jobId) {
          this.runningProcesses.delete(jobId);
        }
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      process.on('error', (error) => {
        // Clean up process tracking on error
        if (jobId) {
          this.runningProcesses.delete(jobId);
        }
        reject(error);
      });
    });
  }

  /**
   * Read log file
   */
  private async readLogFile(logPath: string): Promise<string> {
    try {
      const buffer = await this.fs.readFile(logPath);
      return buffer.toString('utf-8');
    } catch {
      return '';
    }
  }

  /**
   * Parse LaTeX log file for errors and warnings
   */
  private parseLog(logContent: string): {
    errors: CompilationError[];
    warnings: CompilationWarning[];
  } {
    const errors: CompilationError[] = [];
    const warnings: CompilationWarning[] = [];

    const lines = logContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Error pattern: ./file.tex:123: Error message
      const errorMatch = line.match(/^(.+?):(\d+):\s*(.+)/);
      if (errorMatch) {
        const [, file, lineNum, message] = errorMatch;

        // Check if it's an error or warning
        if (message.toLowerCase().includes('error') || line.startsWith('!')) {
          errors.push({
            file: path.basename(file),
            line: parseInt(lineNum, 10),
            message: message.trim(),
            severity: 'error',
          });
        } else if (
          message.toLowerCase().includes('warning') ||
          line.toLowerCase().includes('warning')
        ) {
          warnings.push({
            file: path.basename(file),
            line: parseInt(lineNum, 10),
            message: message.trim(),
          });
        }
      }

      // LaTeX Error pattern
      if (line.startsWith('! ')) {
        const errorMessage = line.substring(2).trim();
        errors.push({
          message: errorMessage,
          severity: 'error',
        });
      }

      // LaTeX Warning pattern
      if (
        line.includes('LaTeX Warning:') ||
        line.includes('Package Warning:')
      ) {
        const warningMatch = line.match(/Warning:\s*(.+)/);
        if (warningMatch) {
          warnings.push({
            message: warningMatch[1].trim(),
          });
        }
      }
    }

    return { errors, warnings };
  }
}
