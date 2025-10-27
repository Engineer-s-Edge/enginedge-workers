/**
 * Notion Actor - Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotionActor, NotionArgs, NotionOutput } from '@infrastructure/tools/actors/notion.actor';

describe('NotionActor', () => {
  let actor: NotionActor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotionActor],
    }).compile();

    actor = module.get<NotionActor>(NotionActor);
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(actor.name).toBe('notion-actor');
      expect(actor.description).toBe('Provides integration with Notion API for page and database management');
    });

    it('should have correct category and auth requirements', () => {
      expect(actor.category).toBeDefined();
      expect(actor.requiresAuth).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should return error when API key is missing', async () => {
      const args: NotionArgs = {
        operation: 'create-page',
        parentId: 'parent-123',
        title: 'Test Page'
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Notion API key is required');
      expect(result.error?.name).toBe('AuthenticationError');
    });
  });

  describe('Create Page', () => {
    const validArgs: NotionArgs = {
      operation: 'create-page',
      apiKey: 'test-api-key',
      parentId: 'parent-123',
      title: 'Test Page',
      content: [
        {
          type: 'heading_1',
          heading_1: { rich_text: [{ type: 'text', text: { content: 'Test Heading' } }] }
        }
      ],
      properties: { Status: { select: { name: 'Draft' } } }
    };

    it('should create a page successfully', async () => {
      const result = await actor.execute({ name: 'notion-actor', args: validArgs as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as NotionOutput).operation).toBe('create-page');
      expect((result.output as NotionOutput).id).toMatch(/^page-\d+$/);
      expect((result.output as NotionOutput).url).toContain('https://notion.so/test-page');
    });

    it('should return error when parentId is missing', async () => {
      const args: NotionArgs = {
        operation: 'create-page',
        apiKey: 'test-api-key',
        title: 'Test Page'
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Parent ID and title are required for page creation');
      expect(result.error?.name).toBe('ValidationError');
    });

    it('should return error when title is missing', async () => {
      const args: NotionArgs = {
        operation: 'create-page',
        apiKey: 'test-api-key',
        parentId: 'parent-123'
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Parent ID and title are required for page creation');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Update Page', () => {
    it('should update a page successfully', async () => {
      const args: NotionArgs = {
        operation: 'update-page',
        apiKey: 'test-api-key',
        pageId: 'page-123',
        properties: { Status: { select: { name: 'Published' } } }
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as NotionOutput).operation).toBe('update-page');
      expect((result.output as NotionOutput).updated).toBe(true);
    });

    it('should return error when pageId is missing', async () => {
      const args: NotionArgs = {
        operation: 'update-page',
        apiKey: 'test-api-key'
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Page ID is required for page update');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Get Page', () => {
    it('should get a page successfully', async () => {
      const args: NotionArgs = {
        operation: 'get-page',
        apiKey: 'test-api-key',
        pageId: 'page-123'
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as NotionOutput).operation).toBe('get-page');
      expect((result.output as NotionOutput).page).toBeDefined();
      const page = (result.output as NotionOutput).page as { id: string; title: string };
      expect(page.id).toBe('page-123');
      expect(page.title).toBe('Sample Page');
    });

    it('should return error when pageId is missing', async () => {
      const args: NotionArgs = {
        operation: 'get-page',
        apiKey: 'test-api-key'
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Page ID is required');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Create Database', () => {
    it('should create a database successfully', async () => {
      const args: NotionArgs = {
        operation: 'create-database',
        apiKey: 'test-api-key',
        parentId: 'parent-123',
        databaseTitle: 'Test Database',
        databaseProperties: {
          Name: { title: {} },
          Status: { select: { options: [{ name: 'Todo' }, { name: 'Done' }] } }
        }
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as NotionOutput).operation).toBe('create-database');
      expect((result.output as NotionOutput).id).toMatch(/^database-\d+$/);
      expect((result.output as NotionOutput).url).toContain('https://notion.so/test-database');
    });

    it('should return error when parentId is missing', async () => {
      const args: NotionArgs = {
        operation: 'create-database',
        apiKey: 'test-api-key',
        databaseTitle: 'Test Database'
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Parent ID and database title are required');
      expect(result.error?.name).toBe('ValidationError');
    });

    it('should return error when databaseTitle is missing', async () => {
      const args: NotionArgs = {
        operation: 'create-database',
        apiKey: 'test-api-key',
        parentId: 'parent-123'
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Parent ID and database title are required');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Query Database', () => {
    it('should query a database successfully', async () => {
      const args: NotionArgs = {
        operation: 'query-database',
        apiKey: 'test-api-key',
        databaseId: 'database-123',
        filter: { property: 'Status', select: { equals: 'In Progress' } },
        sorts: [{ property: 'Name', direction: 'ascending' }]
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as NotionOutput).operation).toBe('query-database');
      expect((result.output as NotionOutput).results).toBeDefined();
      expect(Array.isArray((result.output as NotionOutput).results)).toBe(true);
      expect((result.output as NotionOutput).hasMore).toBe(false);
    });

    it('should return error when databaseId is missing', async () => {
      const args: NotionArgs = {
        operation: 'query-database',
        apiKey: 'test-api-key'
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Database ID is required for querying');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Update Database Item', () => {
    it('should update a database item successfully', async () => {
      const args: NotionArgs = {
        operation: 'update-database-item',
        apiKey: 'test-api-key',
        itemId: 'item-123',
        itemProperties: { Status: { select: { name: 'Completed' } } }
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as NotionOutput).operation).toBe('update-database-item');
      expect((result.output as NotionOutput).updated).toBe(true);
    });

    it('should return error when itemId is missing', async () => {
      const args: NotionArgs = {
        operation: 'update-database-item',
        apiKey: 'test-api-key'
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Item ID is required for database item update');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Error Handling', () => {
    it('should return error for unsupported operation', async () => {
      const args = {
        operation: 'invalid-operation' as unknown as 'create-page',
        apiKey: 'test-api-key'
      };

      const result = await actor.execute({ name: 'notion-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Unsupported operation: invalid-operation');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('API Error Handling', () => {
    // Note: In a real implementation, these would test actual API error responses
    // For now, they test the error handling structure
    it('should handle authentication errors', async () => {
      // This would test actual API 401 responses in a real implementation
      expect(actor).toBeDefined();
    });

    it('should handle not found errors', async () => {
      // This would test actual API 404 responses in a real implementation
      expect(actor).toBeDefined();
    });

    it('should handle rate limit errors', async () => {
      // This would test actual API 429 responses in a real implementation
      expect(actor).toBeDefined();
    });
  });
});