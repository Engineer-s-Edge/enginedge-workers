/**
 * LaTeXDocument Entity
 *
 * Represents a LaTeX document with all necessary metadata for compilation.
 * This is the core domain entity for single-file LaTeX documents.
 */

export interface LaTeXDocumentMetadata {
  title?: string;
  author?: string;
  date?: string;
  documentClass?: string;
  packages?: string[];
  customCommands?: string[];
}

export interface LaTeXCompilationSettings {
  engine: 'xelatex'; // We only use XeLaTeX
  maxPasses: number; // Maximum compilation passes
  timeout: number; // Timeout in milliseconds
  shell: boolean; // Allow shell escape (for certain packages)
  draft: boolean; // Draft mode compilation
}

export class LaTeXDocument {
  constructor(
    public readonly id: string,
    public readonly content: string,
    public readonly metadata: LaTeXDocumentMetadata,
    public readonly settings: LaTeXCompilationSettings,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /**
   * Create a new LaTeX document with default settings
   */
  static create(
    id: string,
    content: string,
    metadata: Partial<LaTeXDocumentMetadata> = {},
  ): LaTeXDocument {
    const now = new Date();
    return new LaTeXDocument(
      id,
      content,
      {
        title: metadata.title,
        author: metadata.author,
        date: metadata.date,
        documentClass: metadata.documentClass || 'article',
        packages: metadata.packages || [],
        customCommands: metadata.customCommands || [],
      },
      {
        engine: 'xelatex',
        maxPasses: 3,
        timeout: 60000, // 60 seconds
        shell: false,
        draft: false,
      },
      now,
      now,
    );
  }

  /**
   * Update the document content
   */
  updateContent(newContent: string): LaTeXDocument {
    return new LaTeXDocument(
      this.id,
      newContent,
      this.metadata,
      this.settings,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Update compilation settings
   */
  updateSettings(settings: Partial<LaTeXCompilationSettings>): LaTeXDocument {
    return new LaTeXDocument(
      this.id,
      this.content,
      this.metadata,
      { ...this.settings, ...settings },
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Extract packages from content
   */
  extractPackages(): string[] {
    const packageRegex = /\\usepackage(?:\[.*?\])?\{([^}]+)\}/g;
    const packages: string[] = [];
    let match;

    while ((match = packageRegex.exec(this.content)) !== null) {
      const packageList = match[1].split(',').map((pkg) => pkg.trim());
      packages.push(...packageList);
    }

    return [...new Set(packages)]; // Remove duplicates
  }

  /**
   * Extract document class from content
   */
  extractDocumentClass(): string | null {
    const classRegex = /\\documentclass(?:\[.*?\])?\{([^}]+)\}/;
    const match = this.content.match(classRegex);
    return match ? match[1] : null;
  }

  /**
   * Check if document requires bibliography compilation
   */
  requiresBibliography(): boolean {
    return (
      this.content.includes('\\bibliography{') ||
      this.content.includes('\\addbibresource{') ||
      this.content.includes('\\cite{') ||
      this.content.includes('\\citep{') ||
      this.content.includes('\\citet{')
    );
  }

  /**
   * Check if document requires multiple passes
   */
  requiresMultiplePasses(): boolean {
    return (
      this.content.includes('\\ref{') ||
      this.content.includes('\\pageref{') ||
      this.content.includes('\\label{') ||
      this.content.includes('\\tableofcontents') ||
      this.requiresBibliography()
    );
  }

  /**
   * Validate LaTeX content (basic syntax check)
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for document class
    if (!this.content.includes('\\documentclass')) {
      errors.push('Missing \\documentclass declaration');
    }

    // Check for begin/end document
    if (!this.content.includes('\\begin{document}')) {
      errors.push('Missing \\begin{document}');
    }
    if (!this.content.includes('\\end{document}')) {
      errors.push('Missing \\end{document}');
    }

    // Check for balanced braces (simple check)
    const openBraces = (this.content.match(/\{/g) || []).length;
    const closeBraces = (this.content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(
        `Unbalanced braces: ${openBraces} opening, ${closeBraces} closing`,
      );
    }

    // Check for balanced begin/end environments
    const begins = (this.content.match(/\\begin\{/g) || []).length;
    const ends = (this.content.match(/\\end\{/g) || []).length;
    if (begins !== ends) {
      errors.push(`Unbalanced environments: ${begins} \\begin, ${ends} \\end`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
