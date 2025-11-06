import { Injectable, Logger, Inject } from '@nestjs/common';
import { IFileSystem } from '../../domain/ports';
import * as path from 'path';

/**
 * File dependency in a LaTeX project
 */
export interface FileDependency {
  /** Source file that includes/inputs this file */
  sourceFile: string;
  /** Target file being included/input */
  targetFile: string;
  /** Type of dependency */
  type: 'include' | 'input' | 'bibliography' | 'image' | 'resource';
  /** Line number where dependency is declared */
  lineNumber?: number;
}

/**
 * Result of dependency resolution
 */
export interface DependencyGraph {
  /** Main file (entry point) */
  mainFile: string;
  /** All files in project (including main) */
  allFiles: string[];
  /** Dependency relationships */
  dependencies: FileDependency[];
  /** Files that couldn't be resolved */
  missingFiles: string[];
  /** Compilation order (topological sort) */
  compilationOrder: string[];
}

/**
 * Multi-file LaTeX project support service
 * Handles \include, \input, \bibliography, and resource files
 */
@Injectable()
export class MultiFileService {
  private readonly logger = new Logger(MultiFileService.name);

  // Regex patterns for LaTeX commands
  private readonly includePattern = /\\include\{([^}]+)\}/g;
  private readonly inputPattern = /\\input\{([^}]+)\}/g;
  private readonly bibliographyPattern = /\\bibliography\{([^}]+)\}/g;
  private readonly graphicsPattern =
    /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;

  constructor(
    @Inject('IFileSystem') private readonly fileSystem: IFileSystem,
  ) {}

  /**
   * Analyze a multi-file LaTeX project and build dependency graph
   */
  async analyzeDependencies(
    mainFile: string,
    projectDir: string,
  ): Promise<DependencyGraph> {
    this.logger.log(`Analyzing dependencies for ${mainFile} in ${projectDir}`);

    const dependencies: FileDependency[] = [];
    const allFiles = new Set<string>();
    const missingFiles = new Set<string>();
    const visited = new Set<string>();

    allFiles.add(mainFile);

    // Recursive dependency extraction
    await this.extractDependenciesRecursive(
      mainFile,
      projectDir,
      dependencies,
      allFiles,
      missingFiles,
      visited,
    );

    const compilationOrder = this.topologicalSort(
      mainFile,
      Array.from(allFiles),
      dependencies,
    );

    return {
      mainFile,
      allFiles: Array.from(allFiles),
      dependencies,
      missingFiles: Array.from(missingFiles),
      compilationOrder,
    };
  }

  /**
   * Recursively extract dependencies from a file
   */
  private async extractDependenciesRecursive(
    sourceFile: string,
    projectDir: string,
    dependencies: FileDependency[],
    allFiles: Set<string>,
    missingFiles: Set<string>,
    visited: Set<string>,
  ): Promise<void> {
    // Prevent circular dependencies
    if (visited.has(sourceFile)) {
      return;
    }
    visited.add(sourceFile);

    const filePath = path.join(projectDir, sourceFile);
    const exists = await this.fileSystem.exists(filePath);

    if (!exists) {
      this.logger.warn(`File not found: ${sourceFile}`);
      missingFiles.add(sourceFile);
      return;
    }

    const contentBuffer = await this.fileSystem.readFile(filePath);
    const content = contentBuffer.toString('utf-8');
    const lines = content.split('\n');

    // Extract \include dependencies
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Skip comments
      if (line.trim().startsWith('%')) {
        continue;
      }

      // Extract \include{file}
      for (const match of line.matchAll(this.includePattern)) {
        const targetFile = this.normalizeTexPath(match[1]);
        dependencies.push({
          sourceFile,
          targetFile,
          type: 'include',
          lineNumber,
        });
        allFiles.add(targetFile);

        // Recursively process included file
        await this.extractDependenciesRecursive(
          targetFile,
          projectDir,
          dependencies,
          allFiles,
          missingFiles,
          visited,
        );
      }

      // Extract \input{file}
      for (const match of line.matchAll(this.inputPattern)) {
        const targetFile = this.normalizeTexPath(match[1]);
        dependencies.push({
          sourceFile,
          targetFile,
          type: 'input',
          lineNumber,
        });
        allFiles.add(targetFile);

        // Recursively process input file
        await this.extractDependenciesRecursive(
          targetFile,
          projectDir,
          dependencies,
          allFiles,
          missingFiles,
          visited,
        );
      }

      // Extract \bibliography{file}
      for (const match of line.matchAll(this.bibliographyPattern)) {
        const bibFiles = match[1].split(',').map((f: string) => f.trim());
        for (const bibFile of bibFiles) {
          const targetFile = this.normalizeBibPath(bibFile);
          dependencies.push({
            sourceFile,
            targetFile,
            type: 'bibliography',
            lineNumber,
          });
          allFiles.add(targetFile);
        }
      }

      // Extract \includegraphics{file}
      for (const match of line.matchAll(this.graphicsPattern)) {
        const targetFile = match[1];
        dependencies.push({
          sourceFile,
          targetFile,
          type: 'image',
          lineNumber,
        });
        allFiles.add(targetFile);
      }
    }
  }

  /**
   * Normalize .tex file path (add .tex extension if missing)
   */
  private normalizeTexPath(filePath: string): string {
    if (filePath.endsWith('.tex')) {
      return filePath;
    }
    return `${filePath}.tex`;
  }

  /**
   * Normalize .bib file path (add .bib extension if missing)
   */
  private normalizeBibPath(filePath: string): string {
    if (filePath.endsWith('.bib')) {
      return filePath;
    }
    return `${filePath}.bib`;
  }

  /**
   * Topological sort for compilation order
   * Files with no dependencies compile first
   */
  private topologicalSort(
    mainFile: string,
    allFiles: string[],
    dependencies: FileDependency[],
  ): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (file: string): void => {
      if (visited.has(file)) {
        return;
      }

      if (visiting.has(file)) {
        // Circular dependency detected
        this.logger.warn(`Circular dependency detected for ${file}`);
        return;
      }

      visiting.add(file);

      // Visit dependencies first
      const fileDeps = dependencies.filter((d) => d.sourceFile === file);
      for (const dep of fileDeps) {
        if (allFiles.includes(dep.targetFile)) {
          visit(dep.targetFile);
        }
      }

      visiting.delete(file);
      visited.add(file);
      order.push(file);
    };

    // Start with main file
    visit(mainFile);

    // Visit any remaining files (disconnected components)
    for (const file of allFiles) {
      if (!visited.has(file)) {
        visit(file);
      }
    }

    return order;
  }

  /**
   * Validate that all dependencies exist
   */
  validateDependencies(graph: DependencyGraph): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (graph.missingFiles.length > 0) {
      errors.push(`Missing files: ${graph.missingFiles.join(', ')}`);
    }

    // Check for broken dependencies
    for (const dep of graph.dependencies) {
      if (!graph.allFiles.includes(dep.targetFile)) {
        errors.push(
          `Broken dependency in ${dep.sourceFile} line ${dep.lineNumber}: ${dep.targetFile} not found`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get all resource files (images, etc.) for copying to compilation directory
   */
  getResourceFiles(graph: DependencyGraph): string[] {
    return graph.dependencies
      .filter((d) => d.type === 'image' || d.type === 'resource')
      .map((d) => d.targetFile);
  }

  /**
   * Get all bibliography files for BibTeX/Biber compilation
   */
  getBibliographyFiles(graph: DependencyGraph): string[] {
    return graph.dependencies
      .filter((d) => d.type === 'bibliography')
      .map((d) => d.targetFile);
  }

  /**
   * Resolve relative paths in multi-file projects
   */
  resolveRelativePath(
    sourceFile: string,
    targetPath: string,
    projectDir: string,
  ): string {
    const sourceDir = path.dirname(path.join(projectDir, sourceFile));
    return path.relative(projectDir, path.join(sourceDir, targetPath));
  }

  /**
   * Copy all project files to compilation directory
   */
  async copyProjectFiles(
    graph: DependencyGraph,
    sourceDir: string,
    targetDir: string,
  ): Promise<void> {
    this.logger.log(
      `Copying ${graph.allFiles.length} files from ${sourceDir} to ${targetDir}`,
    );

    await this.fileSystem.mkdir(targetDir);

    for (const file of graph.allFiles) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);

      const exists = await this.fileSystem.exists(sourcePath);
      if (!exists) {
        this.logger.warn(`Skipping missing file: ${file}`);
        continue;
      }

      // Create subdirectories if needed
      const targetFileDir = path.dirname(targetPath);
      await this.fileSystem.mkdir(targetFileDir);

      // Copy file
      const content = await this.fileSystem.readFile(sourcePath);
      await this.fileSystem.writeFile(targetPath, content);
    }

    this.logger.log(`Successfully copied ${graph.allFiles.length} files`);
  }
}
