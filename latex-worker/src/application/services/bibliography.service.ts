import { Injectable, Logger } from '@nestjs/common';
import { IFileSystem } from '../../domain/ports';
import * as path from 'path';

/**
 * Bibliography entry parsed from .bib file
 */
export interface BibEntry {
  /** Entry type (article, book, inproceedings, etc.) */
  type: string;
  /** Citation key */
  key: string;
  /** Field-value pairs */
  fields: Record<string, string>;
  /** Raw BibTeX string */
  raw: string;
}

/**
 * Bibliography compilation result
 */
export interface BibliographyResult {
  /** Whether compilation succeeded */
  success: boolean;
  /** Compiler used (bibtex or biber) */
  compiler: 'bibtex' | 'biber';
  /** Output from compiler */
  output: string;
  /** Errors from compilation */
  errors: string[];
  /** Warnings from compilation */
  warnings: string[];
  /** Generated .bbl file content */
  bblContent?: string;
  /** Compilation time in ms */
  compilationTime: number;
}

/**
 * Bibliography validation result
 */
export interface BibValidationResult {
  /** Whether .bib file is valid */
  valid: boolean;
  /** Parse errors */
  errors: string[];
  /** Parse warnings */
  warnings: string[];
  /** Number of entries found */
  entryCount: number;
  /** Parsed entries */
  entries: BibEntry[];
}

/**
 * Citation style configuration
 */
export interface CitationStyle {
  /** Style name (e.g., 'plain', 'alpha', 'ieeetr', 'apa') */
  name: string;
  /** Whether to use BibTeX or Biber */
  compiler: 'bibtex' | 'biber';
  /** Package to use (natbib, biblatex, etc.) */
  package?: string;
}

/**
 * Bibliography service for BibTeX/Biber compilation
 * Handles citation management and bibliography generation
 */
@Injectable()
export class BibliographyService {
  private readonly logger = new Logger(BibliographyService.name);

  // Supported citation styles
  private readonly citationStyles: Record<string, CitationStyle> = {
    plain: { name: 'plain', compiler: 'bibtex' },
    alpha: { name: 'alpha', compiler: 'bibtex' },
    ieeetr: { name: 'ieeetr', compiler: 'bibtex' },
    abbrv: { name: 'abbrv', compiler: 'bibtex' },
    acm: { name: 'acm', compiler: 'bibtex' },
    apa: { name: 'apa', compiler: 'biber', package: 'biblatex' },
    chicago: { name: 'chicago', compiler: 'biber', package: 'biblatex' },
    mla: { name: 'mla', compiler: 'biber', package: 'biblatex' },
    ieee: { name: 'ieee', compiler: 'biber', package: 'biblatex' },
  };

  // BibTeX entry type pattern
  private readonly entryPattern = /@(\w+)\{([^,]+),([^@]*?)(?=\n@|\n*$)/gs;

  // BibTeX field pattern
  private readonly fieldPattern = /(\w+)\s*=\s*\{([^}]*)\}|(\w+)\s*=\s*"([^"]*)"/g;

  constructor(private readonly fileSystem: IFileSystem) {}

  /**
   * Validate a .bib file
   */
  async validateBibFile(bibPath: string): Promise<BibValidationResult> {
    this.logger.log(`Validating bibliography file: ${bibPath}`);

    const errors: string[] = [];
    const warnings: string[] = [];
    const entries: BibEntry[] = [];

    try {
      const exists = await this.fileSystem.exists(bibPath);
      if (!exists) {
        return {
          valid: false,
          errors: [`File not found: ${bibPath}`],
          warnings: [],
          entryCount: 0,
          entries: [],
        };
      }

      const contentBuffer = await this.fileSystem.readFile(bibPath);
      const content = contentBuffer.toString('utf-8');

      // Parse BibTeX entries
      let match;
      while ((match = this.entryPattern.exec(content)) !== null) {
        const type = match[1].toLowerCase();
        const key = match[2].trim();
        const fieldsText = match[3];

        // Parse fields
        const fields: Record<string, string> = {};
        let fieldMatch;
        this.fieldPattern.lastIndex = 0; // Reset regex state
        while ((fieldMatch = this.fieldPattern.exec(fieldsText)) !== null) {
          const fieldName = (fieldMatch[1] || fieldMatch[3]).toLowerCase();
          const fieldValue = (fieldMatch[2] || fieldMatch[4]).trim();
          fields[fieldName] = fieldValue;
        }

        // Validate required fields for common entry types
        const requiredFields = this.getRequiredFields(type);
        const missingFields = requiredFields.filter(
          (field) => !fields[field],
        );

        if (missingFields.length > 0) {
          warnings.push(
            `Entry '${key}' (${type}) missing required fields: ${missingFields.join(', ')}`,
          );
        }

        entries.push({
          type,
          key,
          fields,
          raw: match[0],
        });
      }

      // Check for duplicate keys
      const keys = entries.map((e) => e.key);
      const duplicates = keys.filter(
        (key, index) => keys.indexOf(key) !== index,
      );
      if (duplicates.length > 0) {
        errors.push(
          `Duplicate citation keys: ${[...new Set(duplicates)].join(', ')}`,
        );
      }

      // Check for empty file
      if (entries.length === 0) {
        warnings.push('No bibliography entries found');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        entryCount: entries.length,
        entries,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        errors: [`Failed to parse .bib file: ${errorMessage}`],
        warnings,
        entryCount: 0,
        entries: [],
      };
    }
  }

  /**
   * Get required fields for a BibTeX entry type
   */
  private getRequiredFields(type: string): string[] {
    const requiredFieldsMap: Record<string, string[]> = {
      article: ['author', 'title', 'journal', 'year'],
      book: ['author', 'title', 'publisher', 'year'],
      inproceedings: ['author', 'title', 'booktitle', 'year'],
      conference: ['author', 'title', 'booktitle', 'year'],
      proceedings: ['title', 'year'],
      phdthesis: ['author', 'title', 'school', 'year'],
      mastersthesis: ['author', 'title', 'school', 'year'],
      techreport: ['author', 'title', 'institution', 'year'],
      manual: ['title'],
      misc: [],
    };

    return requiredFieldsMap[type] || [];
  }

  /**
   * Compile bibliography (simulated - actual compilation done by LaTeXCompilerService)
   * This method prepares bibliography data and validates the setup
   */
  async compileBibliography(
    texFile: string,
    bibFiles: string[],
    style: string = 'plain',
    workingDir: string,
  ): Promise<BibliographyResult> {
    const startTime = Date.now();
    this.logger.log(
      `Compiling bibliography for ${texFile} with style ${style}`,
    );

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate style
    const citationStyle = this.getCitationStyle(style);
    if (!citationStyle) {
      return {
        success: false,
        compiler: 'bibtex',
        output: '',
        errors: [`Unknown citation style: ${style}`],
        warnings: [],
        compilationTime: Date.now() - startTime,
      };
    }

    // Validate all .bib files
    for (const bibFile of bibFiles) {
      const bibPath = path.join(workingDir, bibFile);
      const validation = await this.validateBibFile(bibPath);

      if (!validation.valid) {
        errors.push(`Invalid .bib file ${bibFile}: ${validation.errors.join(', ')}`);
      }

      warnings.push(...validation.warnings.map((w) => `${bibFile}: ${w}`));
    }

    if (errors.length > 0) {
      return {
        success: false,
        compiler: citationStyle.compiler,
        output: '',
        errors,
        warnings,
        compilationTime: Date.now() - startTime,
      };
    }

    // In a real implementation, this would execute bibtex/biber
    // For now, we simulate success
    return {
      success: true,
      compiler: citationStyle.compiler,
      output: `Bibliography compiled successfully with ${citationStyle.compiler}`,
      errors: [],
      warnings,
      compilationTime: Date.now() - startTime,
    };
  }

  /**
   * Get citation style configuration
   */
  getCitationStyle(styleName: string): CitationStyle | null {
    return this.citationStyles[styleName.toLowerCase()] || null;
  }

  /**
   * Get all supported citation styles
   */
  getSupportedStyles(): CitationStyle[] {
    return Object.values(this.citationStyles);
  }

  /**
   * Detect citation style from .tex file
   */
  async detectCitationStyle(texPath: string): Promise<string | null> {
    try {
      const contentBuffer = await this.fileSystem.readFile(texPath);
      const content = contentBuffer.toString('utf-8');

      // Check for \bibliographystyle{...}
      const styleMatch = content.match(/\\bibliographystyle\{([^}]+)\}/);
      if (styleMatch) {
        return styleMatch[1];
      }

      // Check for biblatex with style option
      const biblatexMatch = content.match(
        /\\usepackage\[.*?style=([^,\]]+).*?\]\{biblatex\}/,
      );
      if (biblatexMatch) {
        return biblatexMatch[1];
      }

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to detect citation style: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Extract citation keys from .tex file
   */
  async extractCitationKeys(texPath: string): Promise<string[]> {
    try {
      const contentBuffer = await this.fileSystem.readFile(texPath);
      const content = contentBuffer.toString('utf-8');

      const keys = new Set<string>();

      // Match \cite{key1,key2,...} with optional arguments like \cite[p.~10]{key} or \cite[see][p.~10]{key}
      const citePattern = /\\cite(?:\[[^\]]*\])?(?:\[[^\]]*\])?\{([^}]+)\}/g;
      let match;
      while ((match = citePattern.exec(content)) !== null) {
        const citationKeys = match[1].split(',').map((k) => k.trim());
        citationKeys.forEach((k) => keys.add(k));
      }

      // Match \citep, \citet (natbib) with optional arguments
      const natbibPattern = /\\cite[pt](?:\[[^\]]*\])?(?:\[[^\]]*\])?\{([^}]+)\}/g;
      while ((match = natbibPattern.exec(content)) !== null) {
        const citationKeys = match[1].split(',').map((k) => k.trim());
        citationKeys.forEach((k) => keys.add(k));
      }

      return Array.from(keys);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to extract citation keys: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Check for missing citations in .bib file
   */
  async checkMissingCitations(
    texPath: string,
    bibPaths: string[],
  ): Promise<string[]> {
    // Extract citation keys from .tex
    const citedKeys = await this.extractCitationKeys(texPath);

    // Get all available keys from .bib files
    const availableKeys = new Set<string>();
    for (const bibPath of bibPaths) {
      const validation = await this.validateBibFile(bibPath);
      validation.entries.forEach((entry) => availableKeys.add(entry.key));
    }

    // Find missing keys
    const missingKeys = citedKeys.filter((key) => !availableKeys.has(key));

    if (missingKeys.length > 0) {
      this.logger.warn(
        `Missing citations in bibliography: ${missingKeys.join(', ')}`,
      );
    }

    return missingKeys;
  }

  /**
   * Merge multiple .bib files into one
   */
  async mergeBibFiles(
    bibPaths: string[],
    outputPath: string,
  ): Promise<void> {
    this.logger.log(`Merging ${bibPaths.length} .bib files into ${outputPath}`);

    const allEntries = new Map<string, BibEntry>();
    const duplicates: string[] = [];

    // Collect all entries
    for (const bibPath of bibPaths) {
      const validation = await this.validateBibFile(bibPath);

      for (const entry of validation.entries) {
        if (allEntries.has(entry.key)) {
          duplicates.push(entry.key);
          this.logger.warn(
            `Duplicate key '${entry.key}' found in ${bibPath}, keeping first occurrence`,
          );
        } else {
          allEntries.set(entry.key, entry);
        }
      }
    }

    // Write merged file
    const mergedContent = Array.from(allEntries.values())
      .map((entry) => entry.raw)
      .join('\n\n');

    await this.fileSystem.writeFile(outputPath, mergedContent);

    this.logger.log(
      `Merged ${allEntries.size} unique entries (${duplicates.length} duplicates removed)`,
    );
  }

  /**
   * Format a .bib file (normalize formatting)
   */
  async formatBibFile(bibPath: string, outputPath?: string): Promise<void> {
    const validation = await this.validateBibFile(bibPath);

    if (!validation.valid) {
      throw new Error(
        `Cannot format invalid .bib file: ${validation.errors.join(', ')}`,
      );
    }

    // Format entries with consistent style
    const formattedEntries = validation.entries.map((entry) => {
      const fields = Object.entries(entry.fields)
        .map(([key, value]) => `  ${key} = {${value}}`)
        .join(',\n');

      return `@${entry.type}{${entry.key},\n${fields}\n}`;
    });

    const formatted = formattedEntries.join('\n\n') + '\n';

    const output = outputPath || bibPath;
    await this.fileSystem.writeFile(output, formatted);

    this.logger.log(`Formatted .bib file written to ${output}`);
  }
}
