/**
 * LocalDB Retriever - Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  LocalDBRetriever,
  LocalDBArgs,
} from '@infrastructure/tools/retrievers/localdb.retriever';

describe('LocalDBRetriever', () => {
  let retriever: LocalDBRetriever;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalDBRetriever],
    }).compile();

    retriever = module.get<LocalDBRetriever>(LocalDBRetriever);
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(retriever.name).toBe('localdb-retriever');
      expect(retriever.description).toBe(
        'Query and retrieve data from local databases with safe parameterized queries',
      );
    });

    it('should have correct retrieval type and caching settings', () => {
      expect(retriever.retrievalType).toBe('database');
      expect(retriever.caching).toBe(false);
    });
  });

  describe('Query Operation', () => {
    it('should execute a SELECT query successfully', async () => {
      const args: LocalDBArgs = {
        operation: 'query',
        query: 'SELECT * FROM users LIMIT 5',
      };

      const result = await retriever.execute({
        name: 'localdb-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.success).toBe(true);
      expect(result.output!.operation).toBe('query');
      expect(result.output!.data).toBeDefined();
      expect(result.output!.columns).toBeDefined();
      expect(result.output!.rowCount).toBeGreaterThan(0);
      expect(result.output!.format).toBe('json');
    });

    it('should respect the limit parameter', async () => {
      const args: LocalDBArgs = {
        operation: 'query',
        query: 'SELECT * FROM users',
        limit: 1,
      };

      const result = await retriever.execute({
        name: 'localdb-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.data!.length).toBeLessThanOrEqual(1);
      expect(result.output!.rowCount).toBeLessThanOrEqual(1);
    });

    it('should support different output formats', async () => {
      const args: LocalDBArgs = {
        operation: 'query',
        query: 'SELECT * FROM users LIMIT 2',
        format: 'csv',
      };

      const result = await retriever.execute({
        name: 'localdb-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.format).toBe('csv');
    });

    it('should reject non-SELECT queries for security', async () => {
      const args: LocalDBArgs = {
        operation: 'query',
        query: 'DROP TABLE users',
      };

      const result = await retriever.execute({
        name: 'localdb-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain(
        'Only SELECT queries are allowed',
      );
    });

    it('should reject UPDATE queries', async () => {
      const args: LocalDBArgs = {
        operation: 'query',
        query: 'UPDATE users SET name = "test"',
      };

      const result = await retriever.execute({
        name: 'localdb-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain(
        'Only SELECT queries are allowed',
      );
    });

    it('should reject DELETE queries', async () => {
      const args: LocalDBArgs = {
        operation: 'query',
        query: 'DELETE FROM users WHERE id = 1',
      };

      const result = await retriever.execute({
        name: 'localdb-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain(
        'Only SELECT queries are allowed',
      );
    });
  });

  describe('Tables Operation', () => {
    it('should list all tables successfully', async () => {
      const args: LocalDBArgs = {
        operation: 'tables',
      };

      const result = await retriever.execute({
        name: 'localdb-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.success).toBe(true);
      expect(result.output!.operation).toBe('tables');
      expect(result.output!.tables).toBeDefined();
      expect(result.output!.tables!.length).toBeGreaterThan(0);
      expect(result.output!.tables).toContain('users');
    });
  });

  describe('Schema Operation', () => {
    it('should get schema for a table successfully', async () => {
      const args: LocalDBArgs = {
        operation: 'schema',
        tableName: 'users',
      };

      const result = await retriever.execute({
        name: 'localdb-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.success).toBe(true);
      expect(result.output!.operation).toBe('schema');
      expect(result.output!.schema).toBeDefined();
      expect(result.output!.schema!.tableName).toBe('users');
      expect(result.output!.schema!.columns).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown operations', async () => {
      const args = {
        operation: 'unknown',
      } as unknown as LocalDBArgs;

      const result = await retriever.execute({
        name: 'localdb-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Unknown operation');
    });

    it('should handle missing required parameters for query', async () => {
      const args: LocalDBArgs = {
        operation: 'query',
        // missing query parameter
      };

      const result = await retriever.execute({
        name: 'localdb-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Query parameter is required');
    });

    it('should handle missing required parameters for schema', async () => {
      const args: LocalDBArgs = {
        operation: 'schema',
        // missing tableName parameter
      };

      const result = await retriever.execute({
        name: 'localdb-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Table name is required');
    });
  });

  describe('RAG Configuration', () => {
    it('should accept RAG configuration parameters', async () => {
      const args: LocalDBArgs = {
        operation: 'query',
        query: 'SELECT * FROM users LIMIT 5',
      };

      const ragConfig = {
        similarity: 0.8,
        topK: 50,
        includeMetadata: false,
      };

      const result = await retriever.execute({
        name: 'localdb-retriever',
        args: { ...args, ragConfig },
      });

      expect(result.success).toBe(true);
      // RAG config is passed through but doesn't affect mock implementation
    });

    it('should use default RAG configuration when none provided', async () => {
      const args: LocalDBArgs = {
        operation: 'tables',
      };

      const result = await retriever.execute({
        name: 'localdb-retriever',
        args,
      });

      expect(result.success).toBe(true);
      // Should use default RAG config from metadata
    });
  });
});
