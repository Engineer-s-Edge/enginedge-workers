import { Injectable, Logger } from '@nestjs/common';
import * as katex from 'katex';
import * as sharp from 'sharp';

/**
 * Math expression with metadata
 */
export interface MathExpression {
  /** The LaTeX math content (without delimiters) */
  content: string;
  /** Whether this is display math (true) or inline math (false) */
  displayMode: boolean;
  /** Original text including delimiters */
  original?: string;
  /** Starting position in source text */
  startIndex?: number;
  /** Ending position in source text */
  endIndex?: number;
}

/**
 * Rendered math result
 */
export interface RenderedMath {
  /** Original LaTeX expression */
  latex: string;
  /** Rendered output (HTML, SVG, or base64 PNG) */
  output: string;
  /** Output format */
  format: 'html' | 'svg' | 'png';
  /** Whether this is display or inline math */
  displayMode: boolean;
  /** Rendering time in milliseconds */
  renderTime?: number;
  /** Any errors encountered */
  error?: string;
}

/**
 * Batch rendering result
 */
export interface BatchRenderResult {
  /** Successfully rendered expressions */
  rendered: RenderedMath[];
  /** Total expressions processed */
  total: number;
  /** Number of successful renders */
  successful: number;
  /** Number of failed renders */
  failed: number;
  /** Total rendering time in milliseconds */
  totalTime: number;
}

/**
 * Text with math extracted and annotated
 */
export interface ParsedText {
  /** Original text */
  original: string;
  /** Extracted math expressions */
  expressions: MathExpression[];
  /** Text with math replaced by placeholders */
  textWithPlaceholders: string;
}

/**
 * KaTeX rendering options
 */
export interface RenderOptions {
  /** Display mode (default: false for inline) */
  displayMode?: boolean;
  /** Throw on error (default: false) */
  throwOnError?: boolean;
  /** Error color for invalid LaTeX (default: '#cc0000') */
  errorColor?: string;
  /** Macro definitions */
  macros?: Record<string, string>;
  /** Trust mode for \url, \href commands */
  trust?: boolean;
  /** Strict mode */
  strict?: boolean | 'warn' | 'error';
  /** Output format */
  output?: 'html' | 'mathml' | 'htmlAndMathml';
}

/**
 * PNG rendering options
 */
export interface PngOptions {
  /** Width in pixels (default: auto) */
  width?: number;
  /** Height in pixels (default: auto) */
  height?: number;
  /** Scale factor (default: 2 for retina) */
  scale?: number;
  /** Background color (default: transparent) */
  backgroundColor?: string;
}

/**
 * Math Rendering Service using KaTeX
 * 
 * Ultra-fast math rendering (5-10ms per expression) using KaTeX.
 * Designed to handle LLM outputs with mixed text and math.
 * 
 * Features:
 * - HTML rendering (fastest, ~5ms)
 * - SVG rendering (vector graphics)
 * - PNG rendering (raster images)
 * - Batch rendering for multiple expressions
 * - Math extraction from mixed text
 * - Error handling and validation
 * - Caching for frequent expressions
 */
@Injectable()
export class MathRenderingService {
  private readonly logger = new Logger(MathRenderingService.name);
  private readonly cache = new Map<string, RenderedMath>();
  private readonly MAX_CACHE_SIZE = 1000;

  /**
   * Render a single math expression to HTML
   * 
   * @param latex - LaTeX math expression (without delimiters)
   * @param options - Rendering options
   * @returns Rendered HTML
   */
  async renderToHtml(
    latex: string,
    options?: RenderOptions,
  ): Promise<RenderedMath> {
    const cacheKey = `html:${latex}:${JSON.stringify(options || {})}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      this.logger.debug(`Cache hit for expression: ${latex.substring(0, 50)}...`);
      return this.cache.get(cacheKey)!;
    }

    const startTime = Date.now();
    
    try {
      const html = katex.renderToString(latex, {
        displayMode: options?.displayMode ?? false,
        throwOnError: options?.throwOnError ?? false,
        errorColor: options?.errorColor ?? '#cc0000',
        macros: options?.macros,
        trust: options?.trust ?? false,
        strict: options?.strict ?? 'warn',
        output: options?.output ?? 'htmlAndMathml',
      });

      const result: RenderedMath = {
        latex,
        output: html,
        format: 'html',
        displayMode: options?.displayMode ?? false,
        renderTime: Date.now() - startTime,
      };

      this.updateCache(cacheKey, result);
      
      this.logger.debug(`Rendered to HTML in ${result.renderTime}ms`);
      return result;
    } catch (error) {
      const result: RenderedMath = {
        latex,
        output: '',
        format: 'html',
        displayMode: options?.displayMode ?? false,
        renderTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };

      this.logger.warn(`Failed to render: ${latex.substring(0, 50)}... - ${result.error}`);
      return result;
    }
  }

  /**
   * Render a single math expression to SVG
   * 
   * @param latex - LaTeX math expression
   * @param options - Rendering options
   * @returns Rendered SVG
   */
  async renderToSvg(
    latex: string,
    options?: RenderOptions,
  ): Promise<RenderedMath> {
    const cacheKey = `svg:${latex}:${JSON.stringify(options || {})}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const startTime = Date.now();
    
    try {
      // First render to HTML
      const html = katex.renderToString(latex, {
        displayMode: options?.displayMode ?? false,
        throwOnError: options?.throwOnError ?? false,
        errorColor: options?.errorColor ?? '#cc0000',
        macros: options?.macros,
        trust: options?.trust ?? false,
        strict: options?.strict ?? 'warn',
        output: 'htmlAndMathml',
      });

      // Extract SVG from HTML (KaTeX uses SVG for some glyphs)
      // For full SVG output, we wrap the HTML in an SVG foreignObject
      const svg = this.htmlToSvg(html);

      const result: RenderedMath = {
        latex,
        output: svg,
        format: 'svg',
        displayMode: options?.displayMode ?? false,
        renderTime: Date.now() - startTime,
      };

      this.updateCache(cacheKey, result);
      
      this.logger.debug(`Rendered to SVG in ${result.renderTime}ms`);
      return result;
    } catch (error) {
      const result: RenderedMath = {
        latex,
        output: '',
        format: 'svg',
        displayMode: options?.displayMode ?? false,
        renderTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };

      this.logger.warn(`Failed to render SVG: ${latex.substring(0, 50)}... - ${result.error}`);
      return result;
    }
  }

  /**
   * Render a single math expression to PNG
   * 
   * @param latex - LaTeX math expression
   * @param renderOptions - Rendering options
   * @param pngOptions - PNG output options
   * @returns Rendered PNG (base64 encoded)
   */
  async renderToPng(
    latex: string,
    renderOptions?: RenderOptions,
    pngOptions?: PngOptions,
  ): Promise<RenderedMath> {
    const startTime = Date.now();
    
    try {
      // First render to SVG
      const svgResult = await this.renderToSvg(latex, renderOptions);
      
      if (svgResult.error) {
        return {
          ...svgResult,
          format: 'png',
          renderTime: Date.now() - startTime,
        };
      }

      // Convert SVG to PNG using Sharp
      const scale = pngOptions?.scale ?? 2; // Default 2x for retina
      const svgBuffer = Buffer.from(svgResult.output);
      
      let pipeline = sharp(svgBuffer, { density: 144 * scale });

      if (pngOptions?.width || pngOptions?.height) {
        pipeline = pipeline.resize(pngOptions.width, pngOptions.height);
      }

      if (pngOptions?.backgroundColor) {
        pipeline = pipeline.flatten({ background: pngOptions.backgroundColor });
      }

      const pngBuffer = await pipeline.png().toBuffer();
      const base64 = pngBuffer.toString('base64');

      const result: RenderedMath = {
        latex,
        output: `data:image/png;base64,${base64}`,
        format: 'png',
        displayMode: renderOptions?.displayMode ?? false,
        renderTime: Date.now() - startTime,
      };

      this.logger.debug(`Rendered to PNG in ${result.renderTime}ms`);
      return result;
    } catch (error) {
      const result: RenderedMath = {
        latex,
        output: '',
        format: 'png',
        displayMode: renderOptions?.displayMode ?? false,
        renderTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };

      this.logger.warn(`Failed to render PNG: ${latex.substring(0, 50)}... - ${result.error}`);
      return result;
    }
  }

  /**
   * Render multiple expressions in batch
   * 
   * @param expressions - Array of math expressions
   * @param format - Output format
   * @param options - Rendering options
   * @returns Batch rendering result
   */
  async renderBatch(
    expressions: MathExpression[],
    format: 'html' | 'svg' | 'png' = 'html',
    options?: RenderOptions,
  ): Promise<BatchRenderResult> {
    const startTime = Date.now();
    const rendered: RenderedMath[] = [];
    let successful = 0;
    let failed = 0;

    this.logger.log(`Batch rendering ${expressions.length} expressions to ${format}`);

    // Render all expressions (KaTeX is so fast we don't need parallelization)
    for (const expr of expressions) {
      let result: RenderedMath;
      
      const exprOptions = { ...options, displayMode: expr.displayMode };

      switch (format) {
        case 'svg':
          result = await this.renderToSvg(expr.content, exprOptions);
          break;
        case 'png':
          result = await this.renderToPng(expr.content, exprOptions);
          break;
        default:
          result = await this.renderToHtml(expr.content, exprOptions);
      }

      rendered.push(result);
      
      if (result.error) {
        failed++;
      } else {
        successful++;
      }
    }

    const totalTime = Date.now() - startTime;

    this.logger.log(`Batch rendering complete: ${successful}/${expressions.length} successful in ${totalTime}ms (avg: ${(totalTime / expressions.length).toFixed(2)}ms/expr)`);

    return {
      rendered,
      total: expressions.length,
      successful,
      failed,
      totalTime,
    };
  }

  /**
   * Extract math expressions from text
   * 
   * Supports:
   * - Inline math: $...$
   * - Display math: $$...$$
   * - LaTeX environments: \begin{equation}...\end{equation}
   * 
   * @param text - Input text with embedded math
   * @returns Parsed text with extracted expressions
   */
  extractMath(text: string): ParsedText {
    const expressions: MathExpression[] = [];
    let textWithPlaceholders = text;
    let placeholderIndex = 0;

    // Pattern for display math ($$...$$)
    const displayMathPattern = /\$\$([\s\S]*?)\$\$/g;
    
    // Pattern for inline math ($...$) - must not be preceded/followed by $
    const inlineMathPattern = /(?<!\$)\$(?!\$)((?:\\\$|[^$])+?)\$(?!\$)/g;
    
    // Pattern for LaTeX environments
    const envPattern = /\\begin\{(equation|align|gather|multline|split)\*?\}([\s\S]*?)\\end\{\1\*?\}/g;

    // Extract display math first ($$...$$)
    let match: RegExpExecArray | null;
    while ((match = displayMathPattern.exec(text)) !== null) {
      expressions.push({
        content: match[1].trim(),
        displayMode: true,
        original: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    // Extract LaTeX environments
    while ((match = envPattern.exec(text)) !== null) {
      expressions.push({
        content: match[0], // Include the environment tags
        displayMode: true,
        original: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    // Extract inline math ($...$)
    while ((match = inlineMathPattern.exec(text)) !== null) {
      // Make sure this isn't overlapping with display math or environments
      const overlaps = expressions.some(
        expr => match!.index >= (expr.startIndex ?? 0) && match!.index < (expr.endIndex ?? 0)
      );
      
      if (!overlaps) {
        expressions.push({
          content: match[1].trim(),
          displayMode: false,
          original: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    // Sort by position
    expressions.sort((a, b) => (a.startIndex ?? 0) - (b.startIndex ?? 0));

    // Replace with placeholders
    for (const expr of expressions) {
      const placeholder = `<<MATH_${placeholderIndex++}>>`;
      textWithPlaceholders = textWithPlaceholders.replace(expr.original!, placeholder);
    }

    this.logger.debug(`Extracted ${expressions.length} math expressions (${expressions.filter(e => e.displayMode).length} display, ${expressions.filter(e => !e.displayMode).length} inline)`);

    return {
      original: text,
      expressions,
      textWithPlaceholders,
    };
  }

  /**
   * Validate LaTeX math expression
   * 
   * @param latex - LaTeX expression to validate
   * @returns True if valid, error message if invalid
   */
  validate(latex: string): { valid: boolean; error?: string } {
    try {
      katex.renderToString(latex, { throwOnError: true });
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Clear the rendering cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('Rendering cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
    };
  }

  /**
   * Convert KaTeX HTML output to SVG
   */
  private htmlToSvg(html: string): string {
    // Wrap KaTeX HTML in an SVG foreignObject
    // This allows the HTML to be embedded in SVG contexts
    const width = 1000; // Default width, will be auto-sized
    const height = 200;  // Default height
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-size: 16px;">
      ${html}
    </div>
  </foreignObject>
</svg>`;
  }

  /**
   * Update cache with LRU eviction
   */
  private updateCache(key: string, value: RenderedMath): void {
    // Simple LRU: if cache is full, delete oldest entry
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, value);
  }
}
