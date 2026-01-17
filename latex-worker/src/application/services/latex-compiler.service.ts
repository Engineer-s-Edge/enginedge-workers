/**
 * LaTeXCompilerService (Application Layer)
 *
 * Orchestrates LaTeX compilation with XeLaTeX engine.
 * Uses worker threads for isolated compilation.
 */

import { Injectable, Inject } from '@nestjs/common';
import {
  LaTeXDocument,
  LaTeXProject,
  CompilationResult,
} from '../../domain/entities';
import {
  ILaTeXCompiler,
  ILogger,
  IFileSystem,
  IPackageManager,
} from '../../domain/ports';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class LaTeXCompilerService {
  constructor(
    @Inject('ILaTeXCompiler') private readonly compiler: ILaTeXCompiler,
    @Inject('ILogger') private readonly logger: ILogger,
    @Inject('IFileSystem') private readonly fs: IFileSystem,
    @Inject('IPackageManager') private readonly packageManager: IPackageManager,
  ) {}

  /**
   * Compile a single LaTeX document
   */
  async compileDocument(document: LaTeXDocument): Promise<CompilationResult> {
    this.logger.log(
      `Starting compilation for document ${document.id}`,
      'LaTeXCompilerService',
    );

    // Create temporary working directory
    const workingDir = path.join('/tmp', 'latex-compile', uuidv4());
    await this.fs.mkdir(workingDir);

    try {
      // Extract and install required packages
      const packages = document.extractPackages();
      await this.installPackages(packages);

      // Validate document
      const validation = document.validate();
      if (!validation.valid) {
        return {
          success: false,
          compilationTime: 0,
          passes: 0,
          errors: validation.errors.map((msg) => ({
            message: msg,
            severity: 'error' as const,
          })),
          warnings: [],
          logs: {
            stdout: '',
            stderr: validation.errors.join('\n'),
            rawLog: '',
          },
        };
      }

      // Write document to file
      const texFile = path.join(workingDir, 'main.tex');
      await this.fs.writeFile(texFile, document.content);

      // Compile
      const result = await this.compiler.compile(document, workingDir);

      this.logger.log(
        `Compilation completed for document ${document.id}: ${result.success ? 'SUCCESS' : 'FAILED'}`,
        'LaTeXCompilerService',
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Compilation error for document ${document.id}`,
        error instanceof Error ? error.stack : undefined,
        'LaTeXCompilerService',
      );

      return {
        success: false,
        compilationTime: 0,
        passes: 0,
        errors: [
          {
            message:
              error instanceof Error
                ? error.message
                : 'Unknown compilation error',
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
    } finally {
      // Cleanup working directory
      try {
        await this.fs.rmdir(workingDir);
      } catch {
        this.logger.warn(
          `Failed to cleanup working directory: ${workingDir}`,
          'LaTeXCompilerService',
        );
      }
    }
  }

  /**
   * Compile a multi-file LaTeX project
   */
  async compileProject(project: LaTeXProject): Promise<CompilationResult> {
    this.logger.log(
      `Starting compilation for project ${project.id}`,
      'LaTeXCompilerService',
    );

    // Create temporary working directory
    const workingDir = path.join('/tmp', 'latex-compile', uuidv4());
    await this.fs.mkdir(workingDir);

    try {
      // Validate project references
      const validation = project.validateReferences();
      if (!validation.valid) {
        return {
          success: false,
          compilationTime: 0,
          passes: 0,
          errors: validation.missingFiles.map((file) => ({
            message: `Missing referenced file: ${file}`,
            severity: 'error' as const,
          })),
          warnings: [],
          logs: {
            stdout: '',
            stderr: `Missing files: ${validation.missingFiles.join(', ')}`,
            rawLog: '',
          },
        };
      }

      // Write all project files to working directory
      for (const file of project.files) {
        const filePath = path.join(workingDir, file.path);
        const fileDir = path.dirname(filePath);

        // Create subdirectories if needed
        if (fileDir !== workingDir) {
          await this.fs.mkdir(fileDir);
        }

        await this.fs.writeFile(filePath, file.content);
      }

      // Extract and install packages from main file
      const mainContent = project.getMainFileContent();
      const tempDoc = LaTeXDocument.create(project.id, mainContent);
      const packages = tempDoc.extractPackages();
      await this.installPackages(packages);

      // Compile project
      const result = await this.compiler.compileProject(project, workingDir);

      this.logger.log(
        `Compilation completed for project ${project.id}: ${result.success ? 'SUCCESS' : 'FAILED'}`,
        'LaTeXCompilerService',
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Compilation error for project ${project.id}`,
        error instanceof Error ? error.stack : undefined,
        'LaTeXCompilerService',
      );

      return {
        success: false,
        compilationTime: 0,
        passes: 0,
        errors: [
          {
            message:
              error instanceof Error
                ? error.message
                : 'Unknown compilation error',
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
    } finally {
      // Cleanup working directory
      try {
        await this.fs.rmdir(workingDir);
      } catch {
        this.logger.warn(
          `Failed to cleanup working directory: ${workingDir}`,
          'LaTeXCompilerService',
        );
      }
    }
  }

  /**
   * Install required packages
   */
  private async installPackages(packages: string[]): Promise<void> {
    if (packages.length === 0) return;

    this.logger.log(
      `Checking ${packages.length} packages: ${packages.join(', ')}`,
      'LaTeXCompilerService',
    );

    for (const packageName of packages) {
      const isInstalled = await this.packageManager.isInstalled(packageName);

      if (!isInstalled) {
        this.logger.log(
          `Installing package: ${packageName}`,
          'LaTeXCompilerService',
        );

        try {
          await this.packageManager.install(packageName);
          this.logger.log(
            `Successfully installed: ${packageName}`,
            'LaTeXCompilerService',
          );
        } catch (error) {
          this.logger.warn(
            `Failed to install package ${packageName}: ${error instanceof Error ? error.message : String(error)}`,
            'LaTeXCompilerService',
          );
          // Continue compilation - let LaTeX engine report missing package
        }
      }
    }
  }

  /**
   * Check if compiler is available
   */
  async isAvailable(): Promise<boolean> {
    return await this.compiler.isAvailable();
  }

  /**
   * Get compiler version
   */
  async getVersion(): Promise<string> {
    return await this.compiler.getVersion();
  }
}
