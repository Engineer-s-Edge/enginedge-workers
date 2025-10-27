/**
 * Notion Retriever - Unit Tests
 *
 * Tests the Notion retriever implementation for database and page search functionality.
 * Uses mocked axios for API interaction and comprehensive error scenario testing.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotionRetriever, NotionArgs } from '@infrastructure/tools/retrievers/notion.retriever';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('NotionRetriever', () => {
  let retriever: NotionRetriever;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotionRetriever],
    }).compile();

    retriever = module.get<NotionRetriever>(NotionRetriever);

    // Reset all mocks
    jest.clearAllMocks();

    // Set required environment variables
    process.env.NOTION_API_TOKEN = 'test-notion-token';
  });

  afterEach(() => {
    delete process.env.NOTION_API_TOKEN;
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(retriever.name).toBe('notion-retriever');
      expect(retriever.description).toContain('Notion');
    });

    it('should have metadata configured', () => {
      expect(retriever.metadata).toBeDefined();
      expect(retriever.metadata.name).toBe('notion-retriever');
    });

    it('should have error events configured', () => {
      expect(retriever.errorEvents).toBeDefined();
      expect(retriever.errorEvents.length).toBeGreaterThan(0);
      expect(retriever.errorEvents.some(e => e.name === 'notion-auth-failed')).toBe(true);
      expect(retriever.errorEvents.some(e => e.name === 'notion-rate-limit')).toBe(true);
    });

    it('should have correct retrieval type and caching settings', () => {
      expect(retriever.retrievalType).toBe('API_DATA');
      expect(retriever.caching).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should reject max_results greater than 100', async () => {
      const args: NotionArgs = {
        query: 'test',
        max_results: 101
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('max_results must be between 1 and 100');
    });

    it('should reject max_results less than 1', async () => {
      const args: NotionArgs = {
        query: 'test',
        max_results: 0
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('max_results must be between 1 and 100');
    });

    it('should accept valid max_results', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [],
          has_more: false
        }
      });

      const args: NotionArgs = {
        query: 'test',
        max_results: 50
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });
      expect(result.success).toBe(true);
    });
  });

  describe('Database Queries', () => {
    it('should search across all Notion pages when no database specified', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [
            {
              object: 'page',
              id: 'page-123',
              created_time: '2023-12-01T10:00:00Z',
              last_edited_time: '2023-12-25T15:30:00Z',
              created_by: { object: 'user', id: 'user-1' },
              last_edited_by: { object: 'user', id: 'user-1' },
              parent: { type: 'page_id', page_id: 'parent-page' },
              archived: false,
              properties: {
                title: {
                  type: 'title',
                  title: [{ type: 'text', text: { content: 'Test Page' } }]
                }
              },
              url: 'https://notion.so/test-page'
            }
          ],
          has_more: false
        }
      });

      const args: NotionArgs = {
        query: 'Test Page'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.total_results).toBe(1);
      expect(result.output!.pages[0].page_id).toBe('page-123');
    });

    it('should query specific database when database_id provided', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [],
          has_more: false
        }
      });

      const args: NotionArgs = {
        database_id: 'db-abc123'
      };

      await retriever.execute({ name: 'notion-retriever', args });

      expect(mockedAxios.post).toHaveBeenCalled();
      const callUrl = mockedAxios.post.mock.calls[0][0];
      expect(callUrl).toContain('databases/db-abc123/query');
    });

    it('should apply filter when provided', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [],
          has_more: false
        }
      });

      const args: NotionArgs = {
        database_id: 'db-123',
        filter: {
          property: 'Status',
          select: { equals: 'Done' }
        }
      };

      await retriever.execute({ name: 'notion-retriever', args });

      expect(mockedAxios.post).toHaveBeenCalled();
      const callData = mockedAxios.post.mock.calls[0][1] as Record<string, unknown>;
      expect(callData.filter).toBeDefined();
    });

    it('should apply sorting when provided', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [],
          has_more: false
        }
      });

      const args: NotionArgs = {
        database_id: 'db-123',
        sort: [
          { property: 'Name', direction: 'ascending' },
          { property: 'Created', direction: 'descending' }
        ]
      };

      await retriever.execute({ name: 'notion-retriever', args });

      expect(mockedAxios.post).toHaveBeenCalled();
      const callData = mockedAxios.post.mock.calls[0][1] as Record<string, unknown>;
      expect((callData.sorts as Array<unknown>)).toHaveLength(2);
      expect(((callData.sorts as Array<Record<string, unknown>>)[0]).property).toBe('Name');
      expect(((callData.sorts as Array<Record<string, unknown>>)[0]).direction).toBe('ascending');
    });
  });

  describe('Page Search', () => {
    it('should extract page titles from properties', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [
            {
              object: 'page',
              id: 'page-456',
              created_time: '2023-12-01T10:00:00Z',
              last_edited_time: '2023-12-25T15:30:00Z',
              created_by: { object: 'user', id: 'user-1' },
              last_edited_by: { object: 'user', id: 'user-1' },
              parent: { type: 'database_id', database_id: 'db-xyz' },
              archived: false,
              properties: {
                title: {
                  type: 'title',
                  title: [
                    { type: 'text', text: { content: 'Project Overview' } }
                  ]
                }
              },
              url: 'https://notion.so/project-overview'
            }
          ],
          has_more: false
        }
      });

      const args: NotionArgs = {
        query: 'Project'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.pages[0].title).toBe('Project Overview');
    });

    it('should handle multiple title text spans', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [
            {
              object: 'page',
              id: 'page-789',
              created_time: '2023-12-01T10:00:00Z',
              last_edited_time: '2023-12-25T15:30:00Z',
              created_by: { object: 'user', id: 'user-1' },
              last_edited_by: { object: 'user', id: 'user-1' },
              parent: { type: 'page_id' },
              archived: false,
              properties: {
                title: {
                  type: 'title',
                  title: [
                    { type: 'text', text: { content: 'Multi ' } },
                    { type: 'text', text: { content: 'Part ' } },
                    { type: 'text', text: { content: 'Title' } }
                  ]
                }
              },
              url: 'https://notion.so/multi-part'
            }
          ],
          has_more: false
        }
      });

      const args: NotionArgs = {
        query: 'Multi'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.pages[0].title).toBe('Multi Part Title');
    });

    it('should extract page URL and metadata', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [
            {
              object: 'page',
              id: 'page-url-test',
              created_time: '2023-12-01T10:00:00Z',
              last_edited_time: '2023-12-25T15:30:00Z',
              created_by: { object: 'user', id: 'user-1' },
              last_edited_by: { object: 'user', id: 'user-1' },
              parent: { type: 'page_id', page_id: 'parent-id' },
              archived: false,
              properties: {},
              url: 'https://notion.so/abc123def456'
            }
          ],
          has_more: false
        }
      });

      const args: NotionArgs = {
        query: 'test'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(true);
      const page = result.output!.pages[0];
      expect(page.page_id).toBe('page-url-test');
      expect(page.url).toBe('https://notion.so/abc123def456');
      expect(page.created_time).toBe('2023-12-01T10:00:00Z');
      expect(page.last_edited_time).toBe('2023-12-25T15:30:00Z');
    });

    it('should mark pages as archived correctly', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [
            {
              object: 'page',
              id: 'archived-page',
              created_time: '2023-12-01T10:00:00Z',
              last_edited_time: '2023-12-25T15:30:00Z',
              created_by: { object: 'user', id: 'user-1' },
              last_edited_by: { object: 'user', id: 'user-1' },
              parent: { type: 'page_id' },
              archived: true,
              properties: {},
              url: 'https://notion.so/archived'
            }
          ],
          has_more: false
        }
      });

      const args: NotionArgs = {
        query: 'archived'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.pages[0].archived).toBe(true);
    });
  });

  describe('Pagination', () => {
    it('should return next_cursor when has_more is true', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [
            {
              object: 'page',
              id: 'page-1',
              created_time: '2023-12-01T10:00:00Z',
              last_edited_time: '2023-12-25T15:30:00Z',
              created_by: { object: 'user', id: 'user-1' },
              last_edited_by: { object: 'user', id: 'user-1' },
              parent: { type: 'page_id' },
              archived: false,
              properties: {},
              url: 'https://notion.so/page1'
            }
          ],
          has_more: true,
          next_cursor: 'NEXT_PAGE_CURSOR_123'
        }
      });

      const args: NotionArgs = {
        query: 'test'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.has_more).toBe(true);
      expect(result.output!.next_cursor).toBe('NEXT_PAGE_CURSOR_123');
    });

    it('should use start_cursor for pagination', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [],
          has_more: false
        }
      });

      const args: NotionArgs = {
        query: 'test',
        start_cursor: 'CURSOR_FROM_PREVIOUS'
      };

      await retriever.execute({ name: 'notion-retriever', args });

      expect(mockedAxios.post).toHaveBeenCalled();
      const callData = mockedAxios.post.mock.calls[0][1] as Record<string, unknown>;
      expect(callData.start_cursor).toBe('CURSOR_FROM_PREVIOUS');
    });
  });

  describe('Error Handling - Authentication', () => {
    it('should handle missing API token', async () => {
      delete process.env.NOTION_API_TOKEN;

      const args: NotionArgs = {
        query: 'test'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('token');
    });

    it('should handle 401 unauthorized error', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 401,
          data: { message: 'Invalid token' }
        }
      });

      const args: NotionArgs = {
        query: 'test'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('authentication failed');
    });

    it('should handle 403 forbidden error', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 403,
          data: { message: 'Permission denied' }
        }
      });

      const args: NotionArgs = {
        query: 'test'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('authentication failed');
    });
  });

  describe('Error Handling - Invalid Database', () => {
    it('should handle 404 database not found error', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 404,
          data: { message: 'Database not found' }
        }
      });

      const args: NotionArgs = {
        database_id: 'invalid-db-id'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('database not found');
    });
  });

  describe('Error Handling - Rate Limiting', () => {
    it('should handle 429 rate limit error', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 429,
          data: { message: 'Rate limit exceeded' }
        }
      });

      const args: NotionArgs = {
        query: 'test'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('rate limit exceeded');
    });
  });

  describe('Error Handling - Bad Request', () => {
    it('should handle 400 bad request error', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 400,
          data: { message: 'Invalid filter format' }
        }
      });

      const args: NotionArgs = {
        database_id: 'db-123',
        filter: { invalid: 'format' }
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('API error');
    });
  });

  describe('Error Handling - Network', () => {
    it('should handle network timeout', async () => {
      mockedAxios.post.mockRejectedValueOnce(
        new Error('timeout of 30000ms exceeded')
      );

      const args: NotionArgs = {
        query: 'test'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('timeout');
    });

    it('should handle ECONNREFUSED network error', async () => {
      mockedAxios.post.mockRejectedValueOnce(
        new Error('ECONNREFUSED: Connection refused')
      );

      const args: NotionArgs = {
        query: 'test'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Network connectivity');
    });
  });

  describe('Response Transformation', () => {
    it('should correctly transform page metadata', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [
            {
              object: 'page',
              id: 'page-metadata',
              created_time: '2023-12-01T10:00:00Z',
              last_edited_time: '2023-12-25T15:30:00Z',
              created_by: { object: 'user', id: 'user-1' },
              last_edited_by: { object: 'user', id: 'user-1' },
              parent: { type: 'database_id', database_id: 'db-parent' },
              archived: false,
              properties: {
                title: {
                  type: 'title',
                  title: [{ type: 'text', text: { content: 'Metadata Test' } }]
                },
                description: {
                  type: 'rich_text',
                  rich_text: [{ type: 'text', text: { content: 'Test description' } }]
                }
              },
              url: 'https://notion.so/metadata-test'
            }
          ],
          has_more: false
        }
      });

      const args: NotionArgs = {
        query: 'Metadata'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(true);
      const page = result.output!.pages[0];
      expect(page.page_id).toBe('page-metadata');
      expect(page.title).toBe('Metadata Test');
      expect(page.parent_id).toBe('db-parent');
      expect(page.properties_count).toBeGreaterThan(0);
    });

    it('should handle pages without titles', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [
            {
              object: 'page',
              id: 'page-no-title',
              created_time: '2023-12-01T10:00:00Z',
              last_edited_time: '2023-12-25T15:30:00Z',
              created_by: { object: 'user', id: 'user-1' },
              last_edited_by: { object: 'user', id: 'user-1' },
              parent: { type: 'page_id' },
              archived: false,
              properties: {},
              url: 'https://notion.so/no-title'
            }
          ],
          has_more: false
        }
      });

      const args: NotionArgs = {
        query: 'test'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.pages[0].title).toBeUndefined();
    });

    it('should handle empty results', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [],
          has_more: false
        }
      });

      const args: NotionArgs = {
        query: 'nonexistent'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.total_results).toBe(0);
      expect(result.output!.pages.length).toBe(0);
    });
  });

  describe('Special Cases', () => {
    it('should extract preview from rich_text properties', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [
            {
              object: 'page',
              id: 'page-preview',
              created_time: '2023-12-01T10:00:00Z',
              last_edited_time: '2023-12-25T15:30:00Z',
              created_by: { object: 'user', id: 'user-1' },
              last_edited_by: { object: 'user', id: 'user-1' },
              parent: { type: 'page_id' },
              archived: false,
              properties: {
                description: {
                  type: 'rich_text',
                  rich_text: [
                    { type: 'text', text: { content: 'This is a preview text for the page' } }
                  ]
                }
              },
              url: 'https://notion.so/preview-test'
            }
          ],
          has_more: false
        }
      });

      const args: NotionArgs = {
        query: 'preview'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.pages[0].preview).toContain('This is a preview');
    });

    it('should set search endpoint when no database specified', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [],
          has_more: false
        }
      });

      const args: NotionArgs = {
        query: 'test'
      };

      await retriever.execute({ name: 'notion-retriever', args });

      expect(mockedAxios.post).toHaveBeenCalled();
      const callUrl = mockedAxios.post.mock.calls[0][0];
      expect(callUrl).toContain('/search');
    });

    it('should include Notion-Version header in requests', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [],
          has_more: false
        }
      });

      const args: NotionArgs = {
        query: 'test'
      };

      await retriever.execute({ name: 'notion-retriever', args });

      expect(mockedAxios.post).toHaveBeenCalled();
      const headers = mockedAxios.post.mock.calls[0][2]?.headers;
      expect(headers?.['Notion-Version']).toBeDefined();
    });

    it('should handle multiple pages from results', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          results: [
            {
              object: 'page',
              id: 'page-1',
              created_time: '2023-12-01T10:00:00Z',
              last_edited_time: '2023-12-25T15:30:00Z',
              created_by: { object: 'user', id: 'user-1' },
              last_edited_by: { object: 'user', id: 'user-1' },
              parent: { type: 'page_id' },
              archived: false,
              properties: { title: { type: 'title', title: [{ type: 'text', text: { content: 'Page 1' } }] } },
              url: 'https://notion.so/page1'
            },
            {
              object: 'page',
              id: 'page-2',
              created_time: '2023-12-02T10:00:00Z',
              last_edited_time: '2023-12-26T15:30:00Z',
              created_by: { object: 'user', id: 'user-1' },
              last_edited_by: { object: 'user', id: 'user-1' },
              parent: { type: 'page_id' },
              archived: false,
              properties: { title: { type: 'title', title: [{ type: 'text', text: { content: 'Page 2' } }] } },
              url: 'https://notion.so/page2'
            }
          ],
          has_more: false
        }
      });

      const args: NotionArgs = {
        query: 'page'
      };

      const result = await retriever.execute({ name: 'notion-retriever', args });

      expect(result.success).toBe(true);
      expect(result.output!.total_results).toBe(2);
      expect(result.output!.pages).toHaveLength(2);
      expect(result.output!.pages[0].page_id).toBe('page-1');
      expect(result.output!.pages[1].page_id).toBe('page-2');
    });
  });
});
