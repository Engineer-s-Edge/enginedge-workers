/**
 * Node FileSystem Adapter
 * 
 * Implements file system operations for LaTeX compilation.
 */

import { Injectable, Inject } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IFileSystem, ILogger } from '../../domain/ports';

@Injectable()
export class NodeFileSystemAdapter implements IFileSystem {
  constructor(@Inject('ILogger') private readonly logger: ILogger) {}

  async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await this.mkdir(dir);

      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      this.logger.error(
        `Failed to write file: ${filePath}`,
        error instanceof Error ? error.stack : undefined,
        'NodeFileSystemAdapter',
      );
      throw error;
    }
  }

  async readFile(filePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      this.logger.error(
        `Failed to read file: ${filePath}`,
        error instanceof Error ? error.stack : undefined,
        'NodeFileSystemAdapter',
      );
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.error(
        `Failed to delete file: ${filePath}`,
        error instanceof Error ? error.stack : undefined,
        'NodeFileSystemAdapter',
      );
      throw error;
    }
  }

  async mkdir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        this.logger.error(
          `Failed to create directory: ${dirPath}`,
          error instanceof Error ? error.stack : undefined,
          'NodeFileSystemAdapter',
        );
        throw error;
      }
    }
  }

  async rmdir(dirPath: string): Promise<void> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      this.logger.error(
        `Failed to remove directory: ${dirPath}`,
        error instanceof Error ? error.stack : undefined,
        'NodeFileSystemAdapter',
      );
      throw error;
    }
  }

  async readdir(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath);
    } catch (error) {
      this.logger.error(
        `Failed to read directory: ${dirPath}`,
        error instanceof Error ? error.stack : undefined,
        'NodeFileSystemAdapter',
      );
      throw error;
    }
  }
}
