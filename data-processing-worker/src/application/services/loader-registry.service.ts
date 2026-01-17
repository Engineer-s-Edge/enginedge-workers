import { Injectable, Logger } from '@nestjs/common';
import { BaseLoaderPort } from '../../domain/ports/loader.port';
import { Document } from '../../domain/entities/document.entity';

/**
 * Loader Registry Service (Application Layer)
 *
 * Manages registration and discovery of document loaders.
 * Acts as a factory for selecting the appropriate loader.
 */
@Injectable()
export class LoaderRegistryService {
  private readonly logger = new Logger(LoaderRegistryService.name);
  private readonly loaders: Map<string, BaseLoaderPort> = new Map();
  private readonly extensionMap: Map<string, string> = new Map();

  /**
   * Register a loader with a unique name
   */
  registerLoader(name: string, loader: BaseLoaderPort): void {
    this.logger.log(`Registering loader: ${name}`);
    this.loaders.set(name, loader);

    // Map file extensions to loader names
    const supportedTypes = loader.getSupportedTypes();
    supportedTypes.forEach((ext) => {
      this.extensionMap.set(ext.toLowerCase(), name);
      this.logger.debug(`Mapped extension ${ext} to loader ${name}`);
    });
  }

  /**
   * Get a loader by name
   */
  getLoader(name: string): BaseLoaderPort | undefined {
    return this.loaders.get(name);
  }

  /**
   * Get all registered loaders
   */
  getAllLoaders(): Map<string, BaseLoaderPort> {
    return new Map(this.loaders);
  }

  /**
   * Auto-detect and get appropriate loader for a source
   */
  getLoaderForSource(source: string | Blob): BaseLoaderPort | null {
    // For Blob, check file extension if available
    if (source instanceof Blob) {
      // Blobs don't have names, need to be passed separately
      return null;
    }

    // For string, check if it's a URL or file path
    const isUrl = this.isUrl(source);

    if (isUrl) {
      // Try URL loaders
      for (const [name, loader] of this.loaders.entries()) {
        if (loader.supports(source)) {
          this.logger.debug(`Auto-selected loader ${name} for URL: ${source}`);
          return loader;
        }
      }
    } else {
      // Try file extension matching
      const extension = this.getFileExtension(source);
      if (extension) {
        const loaderName = this.extensionMap.get(extension.toLowerCase());
        if (loaderName) {
          const loader = this.loaders.get(loaderName);
          if (loader) {
            this.logger.debug(
              `Auto-selected loader ${loaderName} for extension: ${extension}`,
            );
            return loader;
          }
        }
      }
    }

    this.logger.warn(`No loader found for source: ${source}`);
    return null;
  }

  /**
   * Get loader by file extension
   */
  getLoaderByExtension(extension: string): BaseLoaderPort | null {
    const loaderName = this.extensionMap.get(extension.toLowerCase());
    if (loaderName) {
      return this.loaders.get(loaderName) || null;
    }
    return null;
  }

  /**
   * Load document with auto-detection
   */
  async loadAuto(
    source: string | Blob,
    options?: Record<string, unknown>,
  ): Promise<Document[]> {
    const loader = this.getLoaderForSource(source);
    if (!loader) {
      throw new Error(`No suitable loader found for source: ${source}`);
    }

    this.logger.log(`Loading document with auto-detected loader`);
    return loader.load(source, options);
  }

  /**
   * Check if string is a URL
   */
  private isUrl(str: string): boolean {
    try {
      const url = new URL(str);
      return (
        url.protocol === 'http:' ||
        url.protocol === 'https:' ||
        url.protocol === 'ftp:'
      );
    } catch {
      return false;
    }
  }

  /**
   * Extract file extension from path or filename
   */
  private getFileExtension(path: string): string | null {
    const match = path.match(/\.([^.]+)$/);
    return match ? `.${match[1]}` : null;
  }

  /**
   * List all supported file types
   */
  getSupportedTypes(): string[] {
    const types = new Set<string>();
    this.loaders.forEach((loader) => {
      loader.getSupportedTypes().forEach((type) => types.add(type));
    });
    return Array.from(types).sort();
  }

  /**
   * Get loader count
   */
  getLoaderCount(): number {
    return this.loaders.size;
  }
}
