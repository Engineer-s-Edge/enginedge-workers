/**
 * Filesystem Retriever - Infrastructure Layer
 *
 * Retrieves files and content from the filesystem with search and filtering capabilities.
 * Provides safe, sandboxed access to file operations for agents.
 */

import { Injectable } from '@nestjs/common';
import { BaseRetriever } from '@domain/tools/base/base-retriever';
import {
  RetrieverConfig,
  ErrorEvent,
} from '@domain/value-objects/tool-config.value-objects';
import {
  ToolOutput,
  RAGConfig,
  RetrievalType,
} from '@domain/entities/tool.entities';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface FilesystemArgs {
  operation: 'search' | 'read' | 'list';
  pattern?: string;
  filepath?: string;
  directory?: string;
  encoding?: BufferEncoding;
  maxResults?: number;
  includeContent?: boolean;
  [key: string]: unknown; // Index signature for compatibility
}

export interface FilesystemOutput extends ToolOutput {
  success: boolean;
  operation: string;
  files?: Array<{
    path: string;
    name: string;
    size?: number;
    modified?: Date;
    content?: string;
  }>;
  content?: string;
  totalFiles?: number;
  message?: string;
}

@Injectable()
export class FilesystemRetriever extends BaseRetriever<
  FilesystemArgs,
  FilesystemOutput
> {
  readonly name = 'filesystem-retriever';
  readonly description =
    'Search and retrieve files from the filesystem with filtering and content access';

  readonly metadata: RetrieverConfig;

  readonly errorEvents: ErrorEvent[];

  // Security: blocked paths and patterns
  private readonly blockedPaths = [
    '/etc',
    '/proc',
    '/sys',
    '/dev',
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
    'C:\\System32',
    '/usr/bin',
    '/usr/sbin',
    '/bin',
    '/sbin',
  ];

  private readonly blockedPatterns = [
    /\.env$/,
    /password/i,
    /secret/i,
    /\.key$/,
    /\.pem$/,
    /config\.json$/,
    /settings\.json$/,
  ];

  constructor() {
    const errorEvents = [
      new ErrorEvent(
        'filesystem-access-denied',
        'Access denied to requested file or directory - check permissions',
        false,
      ),
      new ErrorEvent(
        'filesystem-not-found',
        'File or directory not found - verify path exists',
        false,
      ),
      new ErrorEvent(
        'filesystem-search-timeout',
        'File search timed out - consider narrowing search criteria',
        true,
      ),
    ];

    const metadata = new RetrieverConfig(
      'filesystem-retriever',
      'Search and retrieve files from the filesystem with filtering and content access',
      'Find, list, and read files from the local filesystem with pattern matching and content retrieval',
      {
        type: 'object',
        additionalProperties: false,
        required: ['operation'],
        properties: {
          operation: {
            type: 'string',
            enum: ['search', 'read', 'list'],
            description: 'The filesystem operation to perform',
          },
          pattern: {
            type: 'string',
            description:
              'Glob pattern for file search (used with search operation)',
            examples: ['*.txt', 'src/**/*.ts', 'docs/**/*.md'],
          },
          filepath: {
            type: 'string',
            description:
              'Specific file path to read (used with read operation)',
          },
          directory: {
            type: 'string',
            description:
              'Directory to list files from (used with list operation)',
            default: '.',
          },
          encoding: {
            type: 'string',
            enum: ['utf8', 'utf-8', 'ascii', 'base64'],
            description: 'Text encoding for file content',
            default: 'utf8',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 10,
            minimum: 1,
            maximum: 100,
          },
          includeContent: {
            type: 'boolean',
            description: 'Whether to include file content in search results',
            default: false,
          },
        },
      },
      {
        type: 'object',
        required: ['success', 'operation'],
        properties: {
          success: { type: 'boolean' },
          operation: { type: 'string' },
          files: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                name: { type: 'string' },
                size: { type: 'number' },
                modified: { type: 'string', format: 'date-time' },
                content: { type: 'string' },
              },
            },
          },
          content: { type: 'string' },
          totalFiles: { type: 'number' },
          message: { type: 'string' },
        },
      },
      [
        {
          name: 'filesystem-retriever',
          args: { operation: 'search', pattern: '*.md', maxResults: 5 },
        },
        {
          name: 'filesystem-retriever',
          args: { operation: 'read', filepath: 'README.md' },
        },
        {
          name: 'filesystem-retriever',
          args: { operation: 'list', directory: 'src' },
        },
      ],
      RetrievalType.FILE_SYSTEM,
      true, // caching enabled for file operations
      {
        similarity: 0.8,
        topK: 10,
        includeMetadata: true,
      },
    );

    super(metadata, errorEvents);

    this.metadata = metadata;
    this.errorEvents = errorEvents;
  }

  get retrievalType(): string {
    return 'file-system';
  }

  get caching(): boolean {
    return true; // File metadata can be cached
  }

  protected async retrieve(
    args: FilesystemArgs & { ragConfig: RAGConfig },
  ): Promise<FilesystemOutput> {
    const {
      operation,
      pattern,
      filepath,
      directory = '.',
      encoding = 'utf8',
      maxResults = 10,
      includeContent = false,
    } = args;

    // Validate required parameters based on operation
    if (operation === 'search' && !pattern) {
      throw Object.assign(
        new Error('Pattern parameter is required for search operation'),
        {
          name: 'ValidationError',
        },
      );
    }

    if (operation === 'read' && !filepath) {
      throw Object.assign(
        new Error('Filepath parameter is required for read operation'),
        {
          name: 'ValidationError',
        },
      );
    }

    // Security validation
    if (filepath) {
      this.validatePathSecurity(filepath);
    }
    if (directory && directory !== '.') {
      this.validatePathSecurity(directory);
    }

    switch (operation) {
      case 'search':
        return await this.performSearch(
          pattern!,
          maxResults,
          includeContent,
          encoding,
        );

      case 'read':
        return await this.performRead(filepath!, encoding);

      case 'list':
        return await this.performList(directory, maxResults);

      default:
        throw Object.assign(new Error(`Unknown operation: ${operation}`), {
          name: 'ValidationError',
        });
    }
  }

  private async performSearch(
    pattern: string,
    maxResults: number,
    includeContent: boolean,
    encoding: BufferEncoding,
  ): Promise<FilesystemOutput> {
    // Simple pattern matching for common cases (can be enhanced later)
    const isWildcard = pattern.includes('*') || pattern.includes('?');
    let files: string[];

    if (isWildcard) {
      // For wildcard patterns, use directory listing with filtering
      const dir = path.dirname(pattern) || '.';
      const basePattern = path.basename(pattern);

      try {
        const entries = await fs.readdir(path.resolve(dir));
        files = entries
          .filter((entry) => this.matchesPattern(entry, basePattern))
          .map((entry) => path.join(dir, entry))
          .slice(0, maxResults);
      } catch (error) {
        const fileError = error as { message?: string };
        throw Object.assign(
          new Error(
            `Failed to search directory: ${fileError.message || 'Unknown error'}`,
          ),
          {
            name: 'FilesystemError',
          },
        );
      }
    } else {
      // Direct file path
      files = [pattern];
    }

    const fileDetails = await Promise.all(
      files.map(async (filePath) => {
        try {
          const fullPath = path.resolve(filePath);
          const stats = await fs.stat(fullPath);

          const fileDetail: {
            path: string;
            name: string;
            size?: number;
            modified?: Date;
            content?: string;
          } = {
            path: filePath,
            name: path.basename(filePath),
            size: stats.size,
            modified: stats.mtime,
          };

          if (includeContent && stats.size < 1024 * 1024) {
            // Only include content for files < 1MB
            try {
              fileDetail.content = await fs.readFile(fullPath, encoding);
            } catch {
              // Skip content if read fails
            }
          }

          return fileDetail;
        } catch {
          return null;
        }
      }),
    );

    const validFiles = fileDetails.filter(
      (detail): detail is NonNullable<typeof detail> => detail !== null,
    );

    return {
      success: true,
      operation: 'search',
      files: validFiles,
      totalFiles: validFiles.length,
    };
  }

  private matchesPattern(filename: string, pattern: string): boolean {
    // Simple wildcard matching (* and ?)
    const regex = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${regex}$`).test(filename);
  }

  private async performRead(
    filepath: string,
    encoding: BufferEncoding,
  ): Promise<FilesystemOutput> {
    try {
      const fullPath = path.resolve(filepath);
      const content = await fs.readFile(fullPath, encoding);
      const stats = await fs.stat(fullPath);

      return {
        success: true,
        operation: 'read',
        content,
        files: [
          {
            path: filepath,
            name: path.basename(filepath),
            size: stats.size,
            modified: stats.mtime,
            content,
          },
        ],
      };
    } catch (error) {
      const fileError = error as { code?: string; message?: string };
      if (fileError.code === 'ENOENT') {
        throw Object.assign(new Error(`File not found: ${filepath}`), {
          name: 'FilesystemError',
        });
      }
      if (fileError.code === 'EACCES') {
        throw Object.assign(new Error(`Access denied to file: ${filepath}`), {
          name: 'FilesystemError',
        });
      }
      throw Object.assign(
        new Error(
          `Failed to read file ${filepath}: ${fileError.message || 'Unknown error'}`,
        ),
        {
          name: 'FilesystemError',
        },
      );
    }
  }

  private async performList(
    directory: string,
    maxResults: number,
  ): Promise<FilesystemOutput> {
    try {
      const fullPath = path.resolve(directory);
      const entries = await fs.readdir(fullPath);

      const fileDetails = await Promise.all(
        entries.slice(0, maxResults).map(async (entry) => {
          const entryPath = path.join(fullPath, entry);
          const stats = await fs.stat(entryPath);

          return {
            path: path.relative(process.cwd(), entryPath),
            name: entry,
            size: stats.size,
            modified: stats.mtime,
          };
        }),
      );

      return {
        success: true,
        operation: 'list',
        files: fileDetails,
        totalFiles: fileDetails.length,
      };
    } catch (error) {
      const fileError = error as { code?: string; message?: string };
      if (fileError.code === 'ENOENT') {
        throw Object.assign(new Error(`Directory not found: ${directory}`), {
          name: 'FilesystemError',
        });
      }
      if (fileError.code === 'EACCES') {
        throw Object.assign(
          new Error(`Access denied to directory: ${directory}`),
          {
            name: 'FilesystemError',
          },
        );
      }
      throw Object.assign(
        new Error(
          `Failed to list directory ${directory}: ${fileError.message || 'Unknown error'}`,
        ),
        {
          name: 'FilesystemError',
        },
      );
    }
  }

  private validatePathSecurity(filePath: string): void {
    const normalizedPath = path.resolve(filePath);

    // Check against blocked paths
    for (const blockedPath of this.blockedPaths) {
      if (normalizedPath.startsWith(blockedPath)) {
        throw Object.assign(
          new Error(`Access denied: Path ${filePath} is in a restricted area`),
          {
            name: 'SecurityError',
          },
        );
      }
    }

    // Check against blocked patterns
    const fileName = path.basename(normalizedPath);
    for (const blockedPattern of this.blockedPatterns) {
      if (blockedPattern.test(fileName)) {
        throw Object.assign(
          new Error(
            `Access denied: File ${fileName} matches security restriction pattern`,
          ),
          {
            name: 'SecurityError',
          },
        );
      }
    }
  }
}
