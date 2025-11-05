import * as fs from 'fs';
import * as path from 'path';

/**
 * Utility class for loading resources from the 'res' directory.
 * Singleton pattern with caching for efficient resource loading.
 */
export class ResourceLoader {
  private static instance: ResourceLoader;
  private readonly basePath: string;
  private fileCache: Map<string, any> = new Map();
  public fileIndex: Set<string> = new Set();
  private isIndexed: boolean = false;

  public static getInstance(): ResourceLoader {
    if (!ResourceLoader.instance) {
      ResourceLoader.instance = new ResourceLoader();
    }
    return ResourceLoader.instance;
  }

  private constructor() {
    this.basePath = path.resolve(process.cwd(), 'res');
    this.indexFiles();
  }

  indexFiles(forceReindex: boolean = false): string[] {
    if (this.isIndexed && !forceReindex) {
      return Array.from(this.fileIndex);
    }

    this.fileIndex.clear();

    const indexDirectory = (dirPath: string, relativePath: string = '') => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const entryRelativePath = path.join(relativePath, entry.name);
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            indexDirectory(fullPath, entryRelativePath);
          } else {
            this.fileIndex.add(entryRelativePath);
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
    };

    try {
      if (fs.existsSync(this.basePath)) {
        indexDirectory(this.basePath);
      }
      this.isIndexed = true;
      return Array.from(this.fileIndex);
    } catch (error) {
      throw new Error(`Failed to index resources: ${error}`);
    }
  }

  private getFileFromPath<T>(relativePath: string, loader: () => T): T {
    if (this.fileCache.has(relativePath)) {
      return this.fileCache.get(relativePath) as T;
    }

    const content = loader();
    this.fileCache.set(relativePath, content);
    return content;
  }

  private getFileFromName<T>(fileName: string, loader: () => T): T {
    if (this.fileCache.has(fileName)) {
      return this.fileCache.get(fileName) as T;
    }

    const content = loader();
    this.fileCache.set(fileName, content);
    return content;
  }

  createDefaultLoader<T>(
    fileName: string,
    options: {
      encoding?: BufferEncoding;
      parseJson?: boolean;
      subDir?: string;
    } = {},
  ): () => T {
    const { encoding = 'utf-8', parseJson = false, subDir = '' } = options;

    return () => {
      const filePath = path.join(this.basePath, subDir, fileName);
      try {
        const content = fs.readFileSync(filePath, encoding);
        if (parseJson) {
          return JSON.parse(content as string) as T;
        }
        return content as unknown as T;
      } catch (error) {
        throw new Error(`Failed to load ${fileName}: ${error}`);
      }
    };
  }

  getFile<T>(
    fileName: string,
    options: {
      encoding?: BufferEncoding;
      parseJson?: boolean;
      subDir?: string;
    } = {},
  ): T {
    const loader = this.createDefaultLoader<T>(fileName, options);
    return this.getFileFromName<T>(fileName, loader);
  }

  loadAsString(relativePath: string): string {
    return this.getFileFromPath(relativePath, () => {
      const fullPath = path.join(this.basePath, relativePath);
      try {
        return fs.readFileSync(fullPath, 'utf-8');
      } catch (error) {
        throw new Error(`Failed to load resource at ${relativePath}: ${error}`);
      }
    });
  }

  loadAsBuffer(relativePath: string): Buffer {
    return this.getFileFromPath(relativePath, () => {
      const fullPath = path.join(this.basePath, relativePath);
      try {
        return fs.readFileSync(fullPath);
      } catch (error) {
        throw new Error(`Failed to load resource at ${relativePath}: ${error}`);
      }
    });
  }

  loadAsJson<T>(relativePath: string): T {
    return this.getFileFromPath(relativePath, () => {
      const content = this.loadAsString(relativePath);
      try {
        return JSON.parse(content) as T;
      } catch (error) {
        throw new Error(`Failed to parse JSON from ${relativePath}: ${error}`);
      }
    });
  }

  exists(relativePath: string): boolean {
    const fullPath = path.join(this.basePath, relativePath);
    return fs.existsSync(fullPath);
  }

  clearCache(): void {
    this.fileCache.clear();
  }
}

export const resourceLoader = ResourceLoader.getInstance();
