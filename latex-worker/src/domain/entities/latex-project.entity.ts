/**
 * LaTeXProject Entity
 * 
 * Represents a multi-file LaTeX project with dependencies.
 * Supports complex documents with \include, \input, bibliography, images, etc.
 */

export interface ProjectFile {
  path: string; // Relative path within project
  content: string;
  type: 'tex' | 'bib' | 'image' | 'style' | 'other';
}

export interface ProjectDependency {
  type: 'package' | 'font' | 'style';
  name: string;
  version?: string;
}

export class LaTeXProject {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly mainFile: string, // Path to main .tex file
    public readonly files: ProjectFile[],
    public readonly dependencies: ProjectDependency[],
    public readonly userId?: string,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {}

  /**
   * Create a new project
   */
  static create(
    id: string,
    name: string,
    mainFile: string,
    mainContent: string,
    userId?: string,
  ): LaTeXProject {
    const now = new Date();
    return new LaTeXProject(
      id,
      name,
      mainFile,
      [
        {
          path: mainFile,
          content: mainContent,
          type: 'tex',
        },
      ],
      [],
      userId,
      now,
      now,
    );
  }

  /**
   * Add or update a file in the project
   */
  addFile(file: ProjectFile): LaTeXProject {
    const existingIndex = this.files.findIndex((f) => f.path === file.path);
    const newFiles = [...this.files];

    if (existingIndex >= 0) {
      newFiles[existingIndex] = file;
    } else {
      newFiles.push(file);
    }

    return new LaTeXProject(
      this.id,
      this.name,
      this.mainFile,
      newFiles,
      this.dependencies,
      this.userId,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Remove a file from the project
   */
  removeFile(path: string): LaTeXProject {
    if (path === this.mainFile) {
      throw new Error('Cannot remove main file');
    }

    return new LaTeXProject(
      this.id,
      this.name,
      this.mainFile,
      this.files.filter((f) => f.path !== path),
      this.dependencies,
      this.userId,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Get a file by path
   */
  getFile(path: string): ProjectFile | undefined {
    return this.files.find((f) => f.path === path);
  }

  /**
   * Get the main file content
   */
  getMainFileContent(): string {
    const mainFile = this.getFile(this.mainFile);
    if (!mainFile) {
      throw new Error('Main file not found');
    }
    return mainFile.content;
  }

  /**
   * Add a dependency
   */
  addDependency(dependency: ProjectDependency): LaTeXProject {
    const exists = this.dependencies.some(
      (d) => d.type === dependency.type && d.name === dependency.name,
    );

    if (exists) {
      return this;
    }

    return new LaTeXProject(
      this.id,
      this.name,
      this.mainFile,
      this.files,
      [...this.dependencies, dependency],
      this.userId,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Get all .tex files
   */
  getTexFiles(): ProjectFile[] {
    return this.files.filter((f) => f.type === 'tex');
  }

  /**
   * Get all .bib files
   */
  getBibFiles(): ProjectFile[] {
    return this.files.filter((f) => f.type === 'bib');
  }

  /**
   * Get all image files
   */
  getImageFiles(): ProjectFile[] {
    return this.files.filter((f) => f.type === 'image');
  }

  /**
   * Extract all \include and \input references from main file
   */
  extractIncludes(): string[] {
    const mainContent = this.getMainFileContent();
    const includeRegex = /\\(?:include|input)\{([^}]+)\}/g;
    const includes: string[] = [];
    let match;

    while ((match = includeRegex.exec(mainContent)) !== null) {
      let path = match[1];
      // Add .tex extension if not present
      if (!path.endsWith('.tex')) {
        path += '.tex';
      }
      includes.push(path);
    }

    return includes;
  }

  /**
   * Extract bibliography references
   */
  extractBibliographies(): string[] {
    const mainContent = this.getMainFileContent();
    const bibRegex = /\\(?:bibliography|addbibresource)\{([^}]+)\}/g;
    const bibs: string[] = [];
    let match;

    while ((match = bibRegex.exec(mainContent)) !== null) {
      let path = match[1];
      // Add .bib extension if not present
      if (!path.endsWith('.bib')) {
        path += '.bib';
      }
      bibs.push(path);
    }

    return bibs;
  }

  /**
   * Validate that all referenced files exist
   */
  validateReferences(): { valid: boolean; missingFiles: string[] } {
    const missingFiles: string[] = [];

    // Check includes
    const includes = this.extractIncludes();
    for (const include of includes) {
      if (!this.getFile(include)) {
        missingFiles.push(include);
      }
    }

    // Check bibliographies
    const bibs = this.extractBibliographies();
    for (const bib of bibs) {
      if (!this.getFile(bib)) {
        missingFiles.push(bib);
      }
    }

    return {
      valid: missingFiles.length === 0,
      missingFiles,
    };
  }

  /**
   * Get project size in bytes
   */
  getSize(): number {
    return this.files.reduce(
      (total, file) => total + file.content.length,
      0,
    );
  }
}
