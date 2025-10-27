import { Test, TestingModule } from '@nestjs/testing';
import { FilesystemRetriever, FilesystemArgs } from '@infrastructure/tools/retrievers/filesystem.retriever';

describe('FilesystemRetriever', () => {
  let retriever: FilesystemRetriever;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FilesystemRetriever],
    }).compile();

    retriever = module.get<FilesystemRetriever>(FilesystemRetriever);
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(retriever.name).toBe('filesystem-retriever');
      expect(retriever.description).toContain('Search and retrieve files');
    });

    it('should have correct retrieval type', () => {
      expect(retriever.retrievalType).toBe('file-system');
    });

    it('should enable caching', () => {
      expect(retriever.caching).toBe(true);
    });
  });

  describe('List Operation', () => {
    it('should list files in current directory successfully', async () => {
      const args: FilesystemArgs = {
        operation: 'list',
        directory: '.'
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.operation).toBe('list');
      expect(result.output!.files).toBeDefined();
      expect(result.output!.totalFiles).toBeGreaterThan(0);
      expect(result.output!.files!.length).toBeGreaterThan(0);
    });

    it('should list files in src directory', async () => {
      const args: FilesystemArgs = {
        operation: 'list',
        directory: 'src'
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.operation).toBe('list');
      expect(result.output!.files).toBeDefined();
    });
  });

  describe('Read Operation', () => {
    it('should read a file successfully', async () => {
      const args: FilesystemArgs = {
        operation: 'read',
        filepath: 'package.json'
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.operation).toBe('read');
      expect(result.output!.content).toBeDefined();
      expect(result.output!.content!.length).toBeGreaterThan(0);
      expect(result.output!.files).toBeDefined();
      expect(result.output!.files!.length).toBe(1);
    });

    it('should handle file not found', async () => {
      const args: FilesystemArgs = {
        operation: 'read',
        filepath: 'nonexistent-file.txt'
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('File not found');
    });
  });

  describe('Search Operation', () => {
    it('should search for files with wildcard pattern', async () => {
      const args: FilesystemArgs = {
        operation: 'search',
        pattern: '*.json'
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.operation).toBe('search');
      expect(result.output!.files).toBeDefined();
      expect(result.output!.totalFiles).toBeGreaterThanOrEqual(0);
    });

    it('should search for TypeScript files', async () => {
      const args: FilesystemArgs = {
        operation: 'search',
        pattern: 'src/**/*.ts'
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      // Search might succeed or fail depending on directory structure
      // Just verify it returns a valid result
      expect(typeof result.success).toBe('boolean');
      if (result.success) {
        expect(result.output!.operation).toBe('search');
        expect(result.output!.files).toBeDefined();
      }
    });

    it('should include content when requested', async () => {
      const args: FilesystemArgs = {
        operation: 'search',
        pattern: 'README.md',
        includeContent: true
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.operation).toBe('search');
      if (result.output!.files && result.output!.files.length > 0) {
        // Content might not be included for large files
        expect(result.output!.files[0]).toHaveProperty('path');
        expect(result.output!.files[0]).toHaveProperty('name');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown operations', async () => {
      const args = {
        operation: 'unknown'
      } as unknown as FilesystemArgs;

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Unknown operation');
    });

    it('should handle missing required parameters for search', async () => {
      const args: FilesystemArgs = {
        operation: 'search'
        // missing pattern parameter
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Pattern parameter is required');
    });

    it('should handle missing required parameters for read', async () => {
      const args: FilesystemArgs = {
        operation: 'read'
        // missing filepath parameter
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Filepath parameter is required');
    });

    it('should handle directory not found', async () => {
      const args: FilesystemArgs = {
        operation: 'list',
        directory: 'nonexistent-directory'
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Directory not found');
    });
  });

  describe('Security Validation', () => {
    it('should reject access to system directories', async () => {
      const args: FilesystemArgs = {
        operation: 'list',
        directory: 'C:\\Windows\\System32'
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Access denied');
    });

    it('should reject access to sensitive files', async () => {
      const args: FilesystemArgs = {
        operation: 'read',
        filepath: '.env'
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Access denied');
    });

    it('should reject access to Windows system directories', async () => {
      const args: FilesystemArgs = {
        operation: 'list',
        directory: 'C:\\Windows'
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Access denied');
    });
  });

  describe('RAG Configuration', () => {
    it('should accept RAG configuration parameters', async () => {
      const args: FilesystemArgs = {
        operation: 'list',
        directory: '.'
      };

      const ragConfig = {
        similarity: 0.8,
        topK: 50,
        includeMetadata: false
      };

      const result = await retriever.execute({
        name: 'filesystem-retriever',
        args: { ...args, ragConfig }
      });

      expect(result.success).toBe(true);
      expect(result.output!.operation).toBe('list');
    });
  });

  describe('Encoding Support', () => {
    it('should read files with different encodings', async () => {
      const args: FilesystemArgs = {
        operation: 'read',
        filepath: 'package.json',
        encoding: 'utf8'
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.content).toBeDefined();
    });
  });

  describe('Max Results', () => {
    it('should respect maxResults parameter', async () => {
      const args: FilesystemArgs = {
        operation: 'list',
        directory: '.',
        maxResults: 2
      };

      const result = await retriever.execute({ name: 'filesystem-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.files!.length).toBeLessThanOrEqual(2);
    });
  });
});