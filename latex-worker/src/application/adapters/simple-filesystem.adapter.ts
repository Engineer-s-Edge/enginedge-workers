import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IFileSystem } from '../../domain/ports';

@Injectable()
export class SimpleFileSystemAdapter implements IFileSystem {
  async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    const dir = path.dirname(filePath);
    await this.mkdir(dir);
    await fs.writeFile(filePath, content as any);
  }

  async readFile(filePath: string): Promise<Buffer> {
    return await fs.readFile(filePath);
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
    await fs.unlink(filePath);
  }

  async mkdir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async rmdir(dirPath: string): Promise<void> {
    await fs.rm(dirPath, { recursive: true, force: true });
  }

  async readdir(dirPath: string): Promise<string[]> {
    return await fs.readdir(dirPath);
  }
}
