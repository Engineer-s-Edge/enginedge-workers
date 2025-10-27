import { Document } from '../entities/document.entity';

/**
 * Base Loader Port - Abstract interface for all document loaders
 * 
 * All loaders (filesystem and web) must implement this interface
 * following the hexagonal architecture pattern.
 */
export abstract class BaseLoaderPort {
  /**
   * Load document(s) from a source
   * @param source - Source identifier (file path, URL, etc.)
   * @param options - Loader-specific options
   * @returns Promise<Document[]> - Array of loaded documents
   */
  abstract load(source: string | Blob, options?: Record<string, unknown>): Promise<Document[]>;

  /**
   * Check if this loader supports the given source
   * @param source - Source to check
   * @returns boolean - True if supported
   */
  abstract supports(source: string | Blob): boolean;

  /**
   * Get supported file extensions or URL patterns
   * @returns string[] - Array of extensions (e.g., ['.pdf', '.docx'])
   */
  abstract getSupportedTypes(): string[];
}

/**
 * Filesystem Loader Port - For file-based document loading
 */
export abstract class FilesystemLoaderPort extends BaseLoaderPort {
  /**
   * Load from a file blob
   */
  abstract loadBlob(
    blob: Blob,
    fileName: string,
    options?: Record<string, unknown>,
  ): Promise<Document[]>;
  
  /**
   * Default implementation - delegates to loadBlob for Blob input
   */
  async load(source: string | Blob, options?: Record<string, unknown>): Promise<Document[]> {
    if (source instanceof Blob) {
      const fileName = (options?.fileName as string) || 'file';
      return this.loadBlob(source, fileName, options);
    }
    throw new Error('Filesystem loaders only support Blob input');
  }
}

/**
 * Web Loader Port - For web-based document loading
 */
export abstract class WebLoaderPort extends BaseLoaderPort {
  /**
   * Load from a URL
   */
  abstract loadUrl(
    url: string,
    options?: Record<string, unknown>,
  ): Promise<Document[]>;
  
  /**
   * Default implementation - delegates to loadUrl for string input
   */
  async load(source: string | Blob, options?: Record<string, unknown>): Promise<Document[]> {
    if (typeof source === 'string') {
      return this.loadUrl(source, options);
    }
    throw new Error('Web loaders only support URL string input');
  }
}

/**
 * OCR Service Port - For optical character recognition
 */
export interface OcrServicePort {
  /**
   * Extract text from an image
   */
  extractText(imageBuffer: Buffer, language?: string): Promise<string>;

  /**
   * Extract text from multiple images
   */
  extractTextBatch(images: Buffer[], language?: string): Promise<string[]>;
}

/**
 * Logger Port - For structured logging
 */
export interface LoggerPort {
  log(message: string, context?: string): void;
  error(message: string, trace?: string, context?: string): void;
  warn(message: string, context?: string): void;
  debug(message: string, context?: string): void;
  verbose(message: string, context?: string): void;
}
