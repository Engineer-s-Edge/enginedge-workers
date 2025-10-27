/**
 * Notion Actor - Infrastructure Layer
 *
 * Provides integration with Notion API for page and database management.
 */

import { Injectable } from '@nestjs/common';
import { BaseActor } from '@domain/tools/base/base-actor';
import { ActorConfig, ErrorEvent } from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, ActorCategory } from '@domain/entities/tool.entities';

export type NotionOperation = 'create-page' | 'update-page' | 'get-page' | 'create-database' | 'query-database' | 'update-database-item';

export interface NotionArgs {
  operation: NotionOperation;
  // Authentication
  apiKey?: string;
  // For create-page
  parentId?: string;
  title?: string;
  content?: unknown[]; // Notion block objects
  properties?: Record<string, unknown>;
  // For update-page
  pageId?: string;
  // For get-page
  // For create-database
  databaseTitle?: string;
  databaseProperties?: Record<string, unknown>;
  // For query-database
  databaseId?: string;
  filter?: unknown;
  sorts?: unknown[];
  // For update-database-item
  itemId?: string;
  itemProperties?: Record<string, unknown>;
}

export interface NotionOutput extends ToolOutput {
  success: boolean;
  operation: NotionOperation;
  // For create-page/create-database
  id?: string;
  url?: string;
  // For get-page
  page?: unknown;
  // For query-database
  results?: unknown[];
  hasMore?: boolean;
  nextCursor?: string;
  // For update operations
  updated?: boolean;
}

@Injectable()
export class NotionActor extends BaseActor<NotionArgs, NotionOutput> {
  readonly name = 'notion-actor';
  readonly description = 'Provides integration with Notion API for page and database management';

  readonly errorEvents: ErrorEvent[];

  readonly metadata: ActorConfig;

  constructor() {
    const errorEvents = [
      new ErrorEvent('NotionAPIError', 'Error communicating with Notion API', false),
      new ErrorEvent('AuthenticationError', 'Invalid or missing Notion API key', false),
      new ErrorEvent('ValidationError', 'Invalid request parameters', false),
      new ErrorEvent('NotFoundError', 'Requested Notion resource not found', false),
      new ErrorEvent('RateLimitError', 'Notion API rate limit exceeded', true),
    ];

    const metadata = new ActorConfig(
      'notion-actor',
      'Notion API integration',
      'Create, read, update, and manage Notion pages and databases',
      {
        type: 'object',
        additionalProperties: false,
        required: ['operation'],
        properties: {
          operation: {
            type: 'string',
            enum: ['create-page', 'update-page', 'get-page', 'create-database', 'query-database', 'update-database-item'],
            description: 'The Notion operation to perform'
          },
          apiKey: {
            type: 'string',
            description: 'Notion API key for authentication'
          },
          parentId: {
            type: 'string',
            description: 'Parent page ID for creating pages'
          },
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
            description: 'Title for pages or databases'
          },
          content: {
            type: 'array',
            description: 'Notion block objects for page content'
          },
          properties: {
            type: 'object',
            description: 'Page or database properties'
          },
          pageId: {
            type: 'string',
            description: 'Page ID for operations'
          },
          databaseTitle: {
            type: 'string',
            description: 'Title for new database'
          },
          databaseProperties: {
            type: 'object',
            description: 'Properties schema for database'
          },
          databaseId: {
            type: 'string',
            description: 'Database ID for queries'
          },
          filter: {
            type: 'object',
            description: 'Filter object for database queries'
          },
          sorts: {
            type: 'array',
            description: 'Sort specifications for database queries'
          },
          itemId: {
            type: 'string',
            description: 'Database item ID for updates'
          },
          itemProperties: {
            type: 'object',
            description: 'Properties to update on database item'
          }
        }
      },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          operation: { type: 'string' },
          id: { type: 'string' },
          url: { type: 'string' },
          page: { type: 'object' },
          results: { type: 'array' },
          hasMore: { type: 'boolean' },
          nextCursor: { type: 'string' },
          updated: { type: 'boolean' }
        }
      },
      [
        {
          operation: 'create-page',
          parentId: 'page-parent-id',
          title: 'Meeting Notes',
          content: [
            {
              type: 'heading_1',
              heading_1: { rich_text: [{ type: 'text', text: { content: 'Meeting Notes' } }] }
            }
          ]
        },
        {
          operation: 'query-database',
          databaseId: 'database-id',
          filter: { property: 'Status', select: { equals: 'In Progress' } }
        },
        {
          operation: 'update-database-item',
          itemId: 'item-id',
          itemProperties: { Status: { select: { name: 'Completed' } } }
        }
      ],
      ActorCategory.EXTERNAL_PRODUCTIVITY,
      true
    );

    super(metadata, errorEvents);
    this.metadata = metadata;
    this.errorEvents = errorEvents;
  }

  get category(): ActorCategory {
    return ActorCategory.EXTERNAL_PRODUCTIVITY;
  }

  get requiresAuth(): boolean {
    return true;
  }

  protected async act(args: NotionArgs): Promise<NotionOutput> {
    // Validate API key
    if (!args.apiKey) {
      throw Object.assign(new Error('Notion API key is required'), {
        name: 'AuthenticationError'
      });
    }

    switch (args.operation) {
      case 'create-page':
        return this.createPage(args);
      case 'update-page':
        return this.updatePage(args);
      case 'get-page':
        return this.getPage(args);
      case 'create-database':
        return this.createDatabase(args);
      case 'query-database':
        return this.queryDatabase(args);
      case 'update-database-item':
        return this.updateDatabaseItem(args);
      default:
        throw Object.assign(new Error(`Unsupported operation: ${args.operation}`), {
          name: 'ValidationError'
        });
    }
  }

  private async createPage(args: NotionArgs): Promise<NotionOutput> {
    if (!args.parentId || !args.title) {
      throw Object.assign(new Error('Parent ID and title are required for page creation'), {
        name: 'ValidationError'
      });
    }

    try {
      // In a real implementation, this would make an HTTP request to Notion API
      // For now, we'll simulate the response structure
      const mockResponse = {
        id: `page-${Date.now()}`,
        url: `https://notion.so/${args.title.toLowerCase().replace(/\s+/g, '-')}`,
        created: true
      };

      return {
        success: true,
        operation: 'create-page',
        id: mockResponse.id,
        url: mockResponse.url
      };
    } catch (error: unknown) {
      this.handleApiError(error);
    }
  }

  private async updatePage(args: NotionArgs): Promise<NotionOutput> {
    if (!args.pageId) {
      throw Object.assign(new Error('Page ID is required for page update'), {
        name: 'ValidationError'
      });
    }

    try {
      // Simulate API call
      return {
        success: true,
        operation: 'update-page',
        updated: true
      };
    } catch (error: unknown) {
      this.handleApiError(error);
    }
  }

  private async getPage(args: NotionArgs): Promise<NotionOutput> {
    if (!args.pageId) {
      throw Object.assign(new Error('Page ID is required'), {
        name: 'ValidationError'
      });
    }

    try {
      // Simulate API call
      const mockPage = {
        id: args.pageId,
        title: 'Sample Page',
        content: [],
        properties: {}
      };

      return {
        success: true,
        operation: 'get-page',
        page: mockPage
      };
    } catch (error: unknown) {
      this.handleApiError(error);
    }
  }

  private async createDatabase(args: NotionArgs): Promise<NotionOutput> {
    if (!args.parentId || !args.databaseTitle) {
      throw Object.assign(new Error('Parent ID and database title are required'), {
        name: 'ValidationError'
      });
    }

    try {
      // Simulate API call
      const mockResponse = {
        id: `database-${Date.now()}`,
        url: `https://notion.so/${args.databaseTitle.toLowerCase().replace(/\s+/g, '-')}`,
        created: true
      };

      return {
        success: true,
        operation: 'create-database',
        id: mockResponse.id,
        url: mockResponse.url
      };
    } catch (error: unknown) {
      this.handleApiError(error);
    }
  }

  private async queryDatabase(args: NotionArgs): Promise<NotionOutput> {
    if (!args.databaseId) {
      throw Object.assign(new Error('Database ID is required for querying'), {
        name: 'ValidationError'
      });
    }

    try {
      // Simulate API call
      const mockResults = [
        {
          id: 'item-1',
          properties: { Name: 'Sample Item', Status: 'In Progress' }
        }
      ];

      return {
        success: true,
        operation: 'query-database',
        results: mockResults,
        hasMore: false
      };
    } catch (error: unknown) {
      this.handleApiError(error);
    }
  }

  private async updateDatabaseItem(args: NotionArgs): Promise<NotionOutput> {
    if (!args.itemId) {
      throw Object.assign(new Error('Item ID is required for database item update'), {
        name: 'ValidationError'
      });
    }

    try {
      // Simulate API call
      return {
        success: true,
        operation: 'update-database-item',
        updated: true
      };
    } catch (error: unknown) {
      this.handleApiError(error);
    }
  }

  private handleApiError(error: unknown): never {
    const err = error as { response?: { status?: number }; message?: string };
    if (err.response?.status === 401) {
      throw Object.assign(new Error('Invalid Notion API key'), {
        name: 'AuthenticationError'
      });
    }
    if (err.response?.status === 404) {
      throw Object.assign(new Error('Notion resource not found'), {
        name: 'NotFoundError'
      });
    }
    if (err.response?.status === 429) {
      throw Object.assign(new Error('Notion API rate limit exceeded'), {
        name: 'RateLimitError'
      });
    }
    throw Object.assign(new Error(`Notion API error: ${err.message || 'Unknown error'}`), {
      name: 'NotionAPIError'
    });
  }
}