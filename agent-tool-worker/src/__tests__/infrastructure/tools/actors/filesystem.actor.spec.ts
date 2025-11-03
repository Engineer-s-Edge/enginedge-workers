/**
 * Unit tests for FilesystemActor
 */

import { Test, TestingModule } from '@nestjs/testing';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  FilesystemActor,
  FilesystemArgs,
  FilesystemOutput,
  FilesystemOperation,
} from '@infrastructure/tools/actors/filesystem.actor';

describe('FilesystemActor', () => {
  let actor: FilesystemActor;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(os.tmpdir(), 'filesystem-actor-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [FilesystemActor],
    }).compile();

    actor = module.get<FilesystemActor>(FilesystemActor);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(actor.name).toBe('filesystem-actor');
      expect(actor.description).toContain('filesystem operations');
      expect(actor.category).toBe('INTERNAL_SANDBOX');
      expect(actor.requiresAuth).toBe(false);
    });
  });

  describe('File Operations', () => {
    const testFile = 'test.txt';
    const testContent = 'Hello, World!';

    it('should write and read a file', async () => {
      // Write file
      const writeArgs: FilesystemArgs = {
        operation: 'write',
        filepath: testFile,
        content: testContent,
        sandboxRoot: tempDir,
      };

      const writeResult = await actor.execute({
        name: 'filesystem-actor',
        args: writeArgs as unknown as Record<string, unknown>,
      });
      expect(writeResult.success).toBe(true);
      expect((writeResult.output as FilesystemOutput).operation).toBe('write');
      expect((writeResult.output as FilesystemOutput).filepath).toBe(testFile);

      // Read file
      const readArgs: FilesystemArgs = {
        operation: 'read',
        filepath: testFile,
        sandboxRoot: tempDir,
      };

      const readResult = await actor.execute({
        name: 'filesystem-actor',
        args: readArgs as unknown as Record<string, unknown>,
      });
      expect(readResult.success).toBe(true);
      expect((readResult.output as FilesystemOutput).operation).toBe('read');
      expect((readResult.output as FilesystemOutput).content).toBe(testContent);
    });

    it('should check if file exists', async () => {
      const existsArgs: FilesystemArgs = {
        operation: 'exists',
        filepath: testFile,
        sandboxRoot: tempDir,
      };

      // File doesn't exist yet
      let result = await actor.execute({
        name: 'filesystem-actor',
        args: existsArgs as unknown as Record<string, unknown>,
      });
      expect((result.output as FilesystemOutput).exists).toBe(false);

      // Create file
      await fs.writeFile(path.join(tempDir, testFile), testContent);

      // File exists now
      result = await actor.execute({
        name: 'filesystem-actor',
        args: existsArgs as unknown as Record<string, unknown>,
      });
      expect((result.output as FilesystemOutput).exists).toBe(true);
    });

    it('should list directory contents', async () => {
      // Create some test files
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(tempDir, 'subdir'));

      const listArgs: FilesystemArgs = {
        operation: 'list',
        filepath: '.',
        sandboxRoot: tempDir,
      };

      const result = await actor.execute({
        name: 'filesystem-actor',
        args: listArgs as unknown as Record<string, unknown>,
      });
      expect((result.output as FilesystemOutput).success).toBe(true);
      expect((result.output as FilesystemOutput).entries).toContain(
        'file1.txt',
      );
      expect((result.output as FilesystemOutput).entries).toContain(
        'file2.txt',
      );
      expect((result.output as FilesystemOutput).entries).toContain('subdir');
    });

    it('should create and remove directories', async () => {
      const dirName = 'testdir';

      // Create directory
      const mkdirArgs: FilesystemArgs = {
        operation: 'mkdir',
        filepath: dirName,
        sandboxRoot: tempDir,
      };

      let result = await actor.execute({
        name: 'filesystem-actor',
        args: mkdirArgs as unknown as Record<string, unknown>,
      });
      expect((result.output as FilesystemOutput).success).toBe(true);

      // Verify directory exists
      const existsArgs: FilesystemArgs = {
        operation: 'exists',
        filepath: dirName,
        sandboxRoot: tempDir,
      };

      result = await actor.execute({
        name: 'filesystem-actor',
        args: existsArgs as unknown as Record<string, unknown>,
      });
      expect((result.output as FilesystemOutput).exists).toBe(true);

      // Remove directory
      const deleteArgs: FilesystemArgs = {
        operation: 'delete',
        filepath: dirName,
        recursive: true,
        sandboxRoot: tempDir,
      };

      result = await actor.execute({
        name: 'filesystem-actor',
        args: deleteArgs as unknown as Record<string, unknown>,
      });
      expect(result.success).toBe(true);
      expect((result.output as FilesystemOutput).success).toBe(true);

      // Verify directory is gone
      result = await actor.execute({
        name: 'filesystem-actor',
        args: existsArgs as unknown as Record<string, unknown>,
      });
      expect((result.output as FilesystemOutput).exists).toBe(false);
    });
  });

  describe('Security', () => {
    it('should prevent path traversal attacks', async () => {
      const maliciousArgs: FilesystemArgs = {
        operation: 'read',
        filepath: '../../../etc/passwd',
        sandboxRoot: tempDir,
      };

      const result = await actor.execute({
        name: 'filesystem-actor',
        args: maliciousArgs as unknown as Record<string, unknown>,
      });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Path escapes sandbox root');
    });

    it('should require filepath for operations that need it', async () => {
      const args: FilesystemArgs = {
        operation: 'read',
        sandboxRoot: tempDir,
      };

      const result = await actor.execute({
        name: 'filesystem-actor',
        args: args as unknown as Record<string, unknown>,
      });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('filepath is required');
    });
  });

  describe('Error Handling', () => {
    it('should handle file not found errors', async () => {
      const args: FilesystemArgs = {
        operation: 'read',
        filepath: 'nonexistent.txt',
        sandboxRoot: tempDir,
      };

      const result = await actor.execute({
        name: 'filesystem-actor',
        args: args as unknown as Record<string, unknown>,
      });
      expect(result.success).toBe(false);
      expect(result.error?.name).toBe('ENOENT');
    });

    it('should handle invalid operations', async () => {
      const args: FilesystemArgs = {
        operation: 'invalid' as FilesystemOperation,
        filepath: 'test.txt',
        sandboxRoot: tempDir,
      };

      const result = await actor.execute({
        name: 'filesystem-actor',
        args: args as unknown as Record<string, unknown>,
      });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Unsupported operation');
    });
  });
});
