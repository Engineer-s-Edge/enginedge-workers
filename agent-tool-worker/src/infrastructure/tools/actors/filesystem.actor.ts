/**
 * Filesystem Actor - Infrastructure Layer
 *
 * Provides sandboxed filesystem operations for agents.
 * Implements security measures to prevent path traversal attacks.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { BaseActor } from '@domain/tools/base/base-actor';
import {
  ActorConfig,
  ErrorEvent,
} from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, ActorCategory } from '@domain/entities/tool.entities';

export type FilesystemOperation =
  | 'read'
  | 'write'
  | 'delete'
  | 'mkdir'
  | 'exists'
  | 'list';

export interface FilesystemArgs {
  operation: FilesystemOperation;
  filepath?: string;
  content?: string;
  encoding?: BufferEncoding;
  recursive?: boolean;
  sandboxRoot?: string;
}

export interface FilesystemOutput extends ToolOutput {
  success: boolean;
  operation: string;
  filepath?: string;
  content?: string;
  exists?: boolean;
  entries?: string[];
  message?: string;
}

@Injectable()
export class FilesystemActor extends BaseActor<
  FilesystemArgs,
  FilesystemOutput
> {
  readonly name = 'filesystem-actor';
  readonly description =
    'Safely perform basic filesystem operations within a sandboxed root directory';

  readonly metadata: ActorConfig = {
    name: this.name,
    description: this.description,
    useCase:
      'Create, read, update, delete files and folders for automation within sandboxed environment',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['operation'],
      properties: {
        operation: {
          type: 'string',
          enum: ['read', 'write', 'delete', 'mkdir', 'exists', 'list'],
          description: 'The filesystem operation to perform',
        },
        filepath: {
          type: 'string',
          description:
            'Path to the file or directory (relative to sandbox root)',
        },
        content: {
          type: 'string',
          description: 'Content to write to file (for write operation)',
        },
        encoding: {
          type: 'string',
          enum: ['utf8', 'utf-8', 'ascii', 'base64'],
          default: 'utf8',
          description: 'Text encoding for file operations',
        },
        recursive: {
          type: 'boolean',
          default: false,
          description: 'Whether to perform recursive operations',
        },
        sandboxRoot: {
          type: 'string',
          description: 'Override the default sandbox root directory',
        },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['success', 'operation'],
      properties: {
        success: { type: 'boolean' },
        operation: { type: 'string' },
        filepath: { type: 'string' },
        content: { type: 'string' },
        exists: { type: 'boolean' },
        entries: { type: 'array', items: { type: 'string' } },
        message: { type: 'string' },
      },
    },
    invocationExample: [
      {
        name: 'filesystem-actor',
        args: { operation: 'read', filepath: 'README.md' },
      },
      {
        name: 'filesystem-actor',
        args: {
          operation: 'write',
          filepath: 'notes/todo.txt',
          content: 'Buy groceries',
        },
      },
      {
        name: 'filesystem-actor',
        args: { operation: 'list', filepath: '.' },
      },
    ],
    retries: 0,
    maxIterations: 1,
    parallel: false,
    concatenate: false,
    pauseBeforeUse: false,
    userModifyQuery: false,
    category: ActorCategory.INTERNAL_SANDBOX,
    requiresAuth: false,
  };

  readonly errorEvents: ErrorEvent[] = [
    {
      name: 'ENOENT',
      guidance:
        'File or directory not found. Check if the path exists within the sandbox.',
      retryable: false,
    },
    {
      name: 'EACCES',
      guidance:
        'Permission denied. The path may be outside the sandbox or access is restricted.',
      retryable: false,
    },
    {
      name: 'EISDIR',
      guidance: 'Expected a file but found a directory, or vice versa.',
      retryable: false,
    },
    {
      name: 'ENOTDIR',
      guidance: 'Expected a directory but found a file.',
      retryable: false,
    },
    {
      name: 'ValidationError',
      guidance:
        'Invalid input parameters. Check the operation and required fields.',
      retryable: false,
    },
  ];

  /**
   * Execute filesystem operation with sandboxing
   */
  protected async act(args: FilesystemArgs): Promise<FilesystemOutput> {
    const sandboxRoot = path.resolve(args.sandboxRoot || process.cwd());
    const encoding = (args.encoding || 'utf8') as BufferEncoding;

    // Validate and resolve path within sandbox
    const validatePath = (filepath?: string): string => {
      if (!filepath) {
        throw Object.assign(
          new Error('filepath is required for this operation'),
          {
            name: 'ValidationError',
          },
        );
      }

      const fullPath = path.resolve(sandboxRoot, filepath);

      // Security check: ensure path doesn't escape sandbox
      if (!fullPath.startsWith(sandboxRoot)) {
        const error = Object.assign(new Error('Path escapes sandbox root'), {
          name: 'EACCES',
        });
        throw error;
      }

      return fullPath;
    };

    try {
      switch (args.operation) {
        case 'read': {
          const fullPath = validatePath(args.filepath);
          const content = await fs.readFile(fullPath, { encoding });
          return {
            success: true,
            operation: 'read',
            filepath: args.filepath,
            content,
          };
        }

        case 'write': {
          const fullPath = validatePath(args.filepath);
          // Ensure parent directory exists
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, args.content || '', { encoding });
          return {
            success: true,
            operation: 'write',
            filepath: args.filepath,
          };
        }

        case 'delete': {
          const fullPath = validatePath(args.filepath);
          await fs.rm(fullPath, {
            recursive: args.recursive || false,
            force: true,
          });
          return {
            success: true,
            operation: 'delete',
            filepath: args.filepath,
          };
        }

        case 'mkdir': {
          const fullPath = validatePath(args.filepath);
          await fs.mkdir(fullPath, { recursive: args.recursive || false });
          return {
            success: true,
            operation: 'mkdir',
            filepath: args.filepath,
          };
        }

        case 'exists': {
          const fullPath = validatePath(args.filepath);
          let exists = false;
          try {
            await fs.access(fullPath);
            exists = true;
          } catch {
            // File doesn't exist or no access
          }
          return {
            success: true,
            operation: 'exists',
            filepath: args.filepath,
            exists,
          };
        }

        case 'list': {
          const targetPath = args.filepath || '.';
          const fullPath = validatePath(targetPath);
          const entries = await fs.readdir(fullPath);
          return {
            success: true,
            operation: 'list',
            filepath: targetPath,
            entries,
          };
        }

        default: {
          throw Object.assign(
            new Error(`Unsupported operation: ${args.operation}`),
            {
              name: 'ValidationError',
            },
          );
        }
      }
    } catch (error: unknown) {
      // Re-throw with appropriate error name for error event handling
      const err = error as Error & { code?: string };
      if (err.code) {
        err.name = err.code;
      }
      throw err;
    }
  }

  get category(): ActorCategory {
    return ActorCategory.INTERNAL_SANDBOX;
  }

  get requiresAuth(): boolean {
    return false;
  }
}
