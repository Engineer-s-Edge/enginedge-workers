import { Injectable, Logger } from '@nestjs/common';
import { IFileSystem } from '../../domain/ports';
import * as path from 'path';

/**
 * Font information
 */
export interface FontInfo {
  /** Font family name */
  family: string;
  /** Font file name */
  fileName: string;
  /** Font format (ttf, otf, etc.) */
  format: 'ttf' | 'otf' | 'pfb' | 'afm' | 'unknown';
  /** Whether font is installed */
  installed: boolean;
  /** Installation path if installed */
  installPath?: string;
}

/**
 * Font detection result from .tex file
 */
export interface FontDetectionResult {
  /** Detected font families */
  fonts: string[];
  /** Main font (from \setmainfont) */
  mainFont?: string;
  /** Sans-serif font (from \setsansfont) */
  sansFont?: string;
  /** Monospace font (from \setmonofont) */
  monoFont?: string;
  /** Whether fontspec package is used */
  usesFontspec: boolean;
  /** Whether XeLaTeX/LuaLaTeX is required */
  requiresUnicode: boolean;
}

/**
 * Font installation result
 */
export interface FontInstallResult {
  /** Whether installation succeeded */
  success: boolean;
  /** Installed font families */
  installedFonts: string[];
  /** Errors during installation */
  errors: string[];
  /** Installation directory */
  installDir?: string;
}

/**
 * Custom font support service for XeLaTeX
 * Handles font detection, installation, and management
 */
@Injectable()
export class FontService {
  private readonly logger = new Logger(FontService.name);

  // Common system fonts that should be available
  private readonly systemFonts = new Set([
    'Arial',
    'Times New Roman',
    'Courier New',
    'Helvetica',
    'Times',
    'Courier',
    'Verdana',
    'Georgia',
    'Comic Sans MS',
    'Trebuchet MS',
    'Impact',
    'Palatino',
    'Garamond',
    'Bookman',
    'Avant Garde',
  ]);

  // Common TeX fonts (always available)
  private readonly texFonts = new Set([
    'Computer Modern',
    'Latin Modern',
    'TeX Gyre Termes',
    'TeX Gyre Pagella',
    'TeX Gyre Heros',
    'TeX Gyre Cursor',
    'DejaVu Sans',
    'DejaVu Serif',
    'DejaVu Sans Mono',
  ]);

  constructor(private readonly fileSystem: IFileSystem) {}

  /**
   * Detect fonts used in a .tex file
   */
  async detectFonts(texPath: string): Promise<FontDetectionResult> {
    this.logger.log(`Detecting fonts in ${texPath}`);

    try {
      const contentBuffer = await this.fileSystem.readFile(texPath);
      const content = contentBuffer.toString('utf-8');

      const fonts = new Set<string>();
      let mainFont: string | undefined;
      let sansFont: string | undefined;
      let monoFont: string | undefined;
      let usesFontspec = false;
      let requiresUnicode = false;

      // Check for fontspec package
      if (content.match(/\\usepackage(?:\[[^\]]*\])?\{fontspec\}/)) {
        usesFontspec = true;
        requiresUnicode = true;
      }

      // Detect \setmainfont
      const mainFontMatch = content.match(/\\setmainfont(?:\[[^\]]*\])?\{([^}]+)\}/);
      if (mainFontMatch) {
        mainFont = mainFontMatch[1];
        fonts.add(mainFont);
        requiresUnicode = true;
      }

      // Detect \setsansfont
      const sansFontMatch = content.match(/\\setsansfont(?:\[[^\]]*\])?\{([^}]+)\}/);
      if (sansFontMatch) {
        sansFont = sansFontMatch[1];
        fonts.add(sansFont);
        requiresUnicode = true;
      }

      // Detect \setmonofont
      const monoFontMatch = content.match(/\\setmonofont(?:\[[^\]]*\])?\{([^}]+)\}/);
      if (monoFontMatch) {
        monoFont = monoFontMatch[1];
        fonts.add(monoFont);
        requiresUnicode = true;
      }

      // Detect \newfontfamily
      const fontFamilyPattern = /\\newfontfamily\\[a-zA-Z]+(?:\[[^\]]*\])?\{([^}]+)\}/g;
      let match;
      while ((match = fontFamilyPattern.exec(content)) !== null) {
        fonts.add(match[1]);
        requiresUnicode = true;
      }

      // Detect \fontspec
      const fontspecPattern = /\\fontspec(?:\[[^\]]*\])?\{([^}]+)\}/g;
      while ((match = fontspecPattern.exec(content)) !== null) {
        fonts.add(match[1]);
        requiresUnicode = true;
      }

      return {
        fonts: Array.from(fonts),
        mainFont,
        sansFont,
        monoFont,
        usesFontspec,
        requiresUnicode,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to detect fonts: ${errorMessage}`);
      return {
        fonts: [],
        usesFontspec: false,
        requiresUnicode: false,
      };
    }
  }

  /**
   * Check if a font is available (system or TeX font)
   */
  isFontAvailable(fontFamily: string): boolean {
    return (
      this.systemFonts.has(fontFamily) ||
      this.texFonts.has(fontFamily)
    );
  }

  /**
   * Get font format from file extension
   */
  getFontFormat(fileName: string): FontInfo['format'] {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
      case '.ttf':
        return 'ttf';
      case '.otf':
        return 'otf';
      case '.pfb':
        return 'pfb';
      case '.afm':
        return 'afm';
      default:
        return 'unknown';
    }
  }

  /**
   * Install custom fonts to project directory
   */
  async installFonts(
    fontFiles: string[],
    sourceDir: string,
    targetDir: string,
  ): Promise<FontInstallResult> {
    this.logger.log(`Installing ${fontFiles.length} font files to ${targetDir}`);

    const installedFonts: string[] = [];
    const errors: string[] = [];

    try {
      // Create fonts directory
      const fontsDir = path.join(targetDir, 'fonts');
      await this.fileSystem.mkdir(fontsDir);

      for (const fontFile of fontFiles) {
        try {
          const sourcePath = path.join(sourceDir, fontFile);
          const targetPath = path.join(fontsDir, path.basename(fontFile));

          // Check if source exists
          const exists = await this.fileSystem.exists(sourcePath);
          if (!exists) {
            errors.push(`Font file not found: ${fontFile}`);
            continue;
          }

          // Copy font file
          const content = await this.fileSystem.readFile(sourcePath);
          await this.fileSystem.writeFile(targetPath, content);

          // Extract font family name (simplified - just use filename without extension)
          const fontFamily = path.basename(fontFile, path.extname(fontFile));
          installedFonts.push(fontFamily);

          this.logger.log(`Installed font: ${fontFamily}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to install ${fontFile}: ${errorMessage}`);
        }
      }

      return {
        success: errors.length === 0,
        installedFonts,
        errors,
        installDir: fontsDir,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        installedFonts: [],
        errors: [`Font installation failed: ${errorMessage}`],
      };
    }
  }

  /**
   * Generate fontspec configuration for custom fonts
   */
  generateFontspecConfig(fonts: FontDetectionResult): string {
    const lines: string[] = [];

    if (!fonts.usesFontspec && fonts.fonts.length > 0) {
      lines.push('% Auto-generated fontspec configuration');
      lines.push('\\usepackage{fontspec}');
      lines.push('');
    }

    if (fonts.mainFont) {
      lines.push(`\\setmainfont{${fonts.mainFont}}`);
    }

    if (fonts.sansFont) {
      lines.push(`\\setsansfont{${fonts.sansFont}}`);
    }

    if (fonts.monoFont) {
      lines.push(`\\setmonofont{${fonts.monoFont}}`);
    }

    return lines.join('\n');
  }

  /**
   * Validate font availability for a document
   */
  async validateFonts(
    texPath: string,
  ): Promise<{ valid: boolean; missingFonts: string[]; warnings: string[] }> {
    const detection = await this.detectFonts(texPath);
    const missingFonts: string[] = [];
    const warnings: string[] = [];

    for (const font of detection.fonts) {
      if (!this.isFontAvailable(font)) {
        missingFonts.push(font);
      }
    }

    if (detection.requiresUnicode) {
      warnings.push(
        'Document requires XeLaTeX or LuaLaTeX for Unicode font support',
      );
    }

    if (missingFonts.length > 0) {
      warnings.push(
        `Missing fonts: ${missingFonts.join(', ')}. Install these fonts or provide font files.`,
      );
    }

    return {
      valid: missingFonts.length === 0,
      missingFonts,
      warnings,
    };
  }

  /**
   * List all system fonts (simulation - actual implementation would query system)
   */
  getSystemFonts(): string[] {
    return Array.from(this.systemFonts).sort();
  }

  /**
   * List all TeX fonts
   */
  getTexFonts(): string[] {
    return Array.from(this.texFonts).sort();
  }

  /**
   * Get font recommendations for a document type
   */
  getFontRecommendations(
    documentType: 'academic' | 'resume' | 'article' | 'book' | 'presentation',
  ): { main: string; sans: string; mono: string } {
    const recommendations = {
      academic: {
        main: 'TeX Gyre Termes',
        sans: 'TeX Gyre Heros',
        mono: 'TeX Gyre Cursor',
      },
      resume: {
        main: 'TeX Gyre Pagella',
        sans: 'TeX Gyre Heros',
        mono: 'DejaVu Sans Mono',
      },
      article: {
        main: 'Latin Modern',
        sans: 'Latin Modern',
        mono: 'Latin Modern',
      },
      book: {
        main: 'TeX Gyre Termes',
        sans: 'TeX Gyre Heros',
        mono: 'TeX Gyre Cursor',
      },
      presentation: {
        main: 'DejaVu Sans',
        sans: 'DejaVu Sans',
        mono: 'DejaVu Sans Mono',
      },
    };

    return recommendations[documentType];
  }

  /**
   * Create a font cache entry (for MongoDB storage)
   */
  createFontCacheEntry(fontInfo: FontInfo): {
    family: string;
    fileName: string;
    format: string;
    cachedAt: Date;
  } {
    return {
      family: fontInfo.family,
      fileName: fontInfo.fileName,
      format: fontInfo.format,
      cachedAt: new Date(),
    };
  }

  /**
   * Extract font files from a project directory
   */
  async findFontFiles(projectDir: string): Promise<string[]> {
    try {
      const fontExtensions = ['.ttf', '.otf', '.pfb', '.afm'];
      const fontFiles: string[] = [];

      // Check for fonts directory
      const fontsDir = path.join(projectDir, 'fonts');
      const exists = await this.fileSystem.exists(fontsDir);

      if (exists) {
        const files = await this.fileSystem.readdir(fontsDir);
        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          if (fontExtensions.includes(ext)) {
            fontFiles.push(path.join('fonts', file));
          }
        }
      }

      return fontFiles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to find font files: ${errorMessage}`);
      return [];
    }
  }
}
