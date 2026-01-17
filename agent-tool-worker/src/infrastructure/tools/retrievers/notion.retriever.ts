/**
 * Notion Retriever
 *
 * Retrieves pages, databases, and content from Notion with comprehensive search,
 * filtering, and property extraction capabilities. Supports Notion API v1 integration
 * with token-based authentication.
 *
 * Features:
 * - Database and page search
 * - Property extraction and filtering
 * - Full-text content search
 * - Pagination support
 * - Comprehensive error handling
 * - Token-based authentication
 */

import { Injectable } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { BaseRetriever } from '../../../domain/tools/base/base-retriever';
import {
  RetrieverConfig,
  ErrorEvent,
} from '../../../domain/value-objects/tool-config.value-objects';
import {
  ToolOutput,
  RAGConfig,
  RetrievalType,
} from '../../../domain/entities/tool.entities';

export interface NotionArgs extends Record<string, unknown> {
  query?: string;
  database_id?: string;
  filter?: Record<string, unknown>;
  sort?: Array<{
    property: string;
    direction: 'ascending' | 'descending';
  }>;
  max_results?: number;
  start_cursor?: string;
  search_in?: 'title' | 'content' | 'all';
}

interface NotionPage {
  object: string;
  id: string;
  created_time: string;
  last_edited_time: string;
  created_by: {
    object: string;
    id: string;
  };
  last_edited_by: {
    object: string;
    id: string;
  };
  parent: {
    type: string;
    database_id?: string;
    page_id?: string;
  };
  archived: boolean;
  properties: Record<string, unknown>;
  url: string;
  public_url?: string;
}

interface NotionApiResponse {
  object: string;
  results: NotionPage[];
  next_cursor?: string;
  has_more: boolean;
}

export interface NotionOutput extends ToolOutput {
  success: boolean;
  query?: string;
  database_id?: string;
  total_results: number;
  has_more: boolean;
  next_cursor?: string;
  pages: Array<{
    page_id: string;
    url: string;
    title?: string;
    created_time: string;
    last_edited_time: string;
    archived: boolean;
    parent_id?: string;
    properties_count: number;
    preview?: string;
  }>;
}

@Injectable()
export class NotionRetriever extends BaseRetriever<NotionArgs, NotionOutput> {
  readonly inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for page titles and content',
      },
      database_id: {
        type: 'string',
        description: 'Notion database ID to search within',
      },
      filter: {
        type: 'object',
        description: 'Notion filter object for advanced filtering',
      },
      sort: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            property: { type: 'string' },
            direction: { type: 'string', enum: ['ascending', 'descending'] },
          },
        },
        description: 'Sort order for results',
      },
      max_results: {
        type: 'number',
        description: 'Maximum pages to return',
        minimum: 1,
        maximum: 100,
        default: 10,
      },
      start_cursor: {
        type: 'string',
        description: 'Cursor for pagination',
      },
      search_in: {
        type: 'string',
        enum: ['title', 'content', 'all'],
        description: 'Where to search',
        default: 'all',
      },
    },
    required: [],
  };

  readonly outputSchema = {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      query: { type: 'string' },
      database_id: { type: 'string' },
      total_results: { type: 'number' },
      has_more: { type: 'boolean' },
      next_cursor: { type: 'string' },
      pages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            page_id: { type: 'string' },
            url: { type: 'string' },
            title: { type: 'string' },
            created_time: { type: 'string', format: 'date-time' },
            last_edited_time: { type: 'string', format: 'date-time' },
            archived: { type: 'boolean' },
            parent_id: { type: 'string' },
            properties_count: { type: 'number' },
            preview: { type: 'string' },
          },
        },
      },
    },
    required: ['success', 'total_results', 'has_more', 'pages'],
  };

  readonly name = 'notion-retriever';
  readonly description =
    'Search Notion databases and pages with filtering, sorting, and property extraction';
  readonly retrievalType: RetrievalType = RetrievalType.API_DATA;

  readonly metadata = new RetrieverConfig(
    this.name,
    this.description,
    'Notion database and page search and retrieval',
    this.inputSchema,
    this.outputSchema,
    [],
    this.retrievalType,
    this.caching,
    {},
  );

  readonly errorEvents: ErrorEvent[] = [
    new ErrorEvent('notion-auth-failed', 'Notion authentication failed', false),
    new ErrorEvent('notion-api-error', 'Notion API request failed', true),
    new ErrorEvent(
      'notion-invalid-database',
      'Invalid database ID provided',
      false,
    ),
    new ErrorEvent(
      'notion-network-error',
      'Network connectivity issue with Notion API',
      true,
    ),
    new ErrorEvent('notion-rate-limit', 'Notion API rate limit exceeded', true),
  ];

  public get caching(): boolean {
    return false; // Notion content changes frequently
  }

  protected async retrieve(
    args: NotionArgs & { ragConfig: RAGConfig },
  ): Promise<NotionOutput> {
    // Manual input validation
    if (
      args.max_results !== undefined &&
      (args.max_results < 1 || args.max_results > 100)
    ) {
      throw new Error('max_results must be between 1 and 100');
    }

    try {
      const response = await this.sendNotionRequest(args);

      return {
        success: true,
        query: args.query,
        database_id: args.database_id,
        total_results: response.data.results?.length || 0,
        has_more: response.data.has_more || false,
        next_cursor: response.data.next_cursor,
        pages: this.transformPages(response.data.results || []),
      };
    } catch (error: unknown) {
      return this.handleNotionError(error);
    }
  }

  private async sendNotionRequest(
    args: NotionArgs,
  ): Promise<AxiosResponse<NotionApiResponse>> {
    const token = process.env.NOTION_API_TOKEN;
    if (!token) {
      throw new Error('Notion API token not configured');
    }

    // Use search endpoint if no database specified, otherwise query database
    const endpoint = args.database_id
      ? `https://api.notion.com/v1/databases/${args.database_id}/query`
      : 'https://api.notion.com/v1/search';

    const headers = {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    };

    const data: Record<string, unknown> = {};

    if (args.query) {
      data.query = args.query;
    }

    if (args.database_id && args.filter) {
      data.filter = args.filter;
    }

    if (args.sort) {
      data.sorts = args.sort.map((s) => ({
        property: s.property,
        direction: s.direction,
      }));
    }

    if (args.max_results) {
      data.page_size = Math.min(args.max_results, 100);
    } else {
      data.page_size = 10;
    }

    if (args.start_cursor) {
      data.start_cursor = args.start_cursor;
    }

    return axios.post<NotionApiResponse>(endpoint, data, {
      headers,
      timeout: 30000,
    });
  }

  private transformPages(pages: NotionPage[]): NotionOutput['pages'] {
    return pages.map((page) => {
      // Extract title from properties if available
      let title: string | undefined;
      if (page.properties) {
        const titleProp = (
          Object.entries(page.properties) as Array<[string, unknown]>
        ).find(
          ([, prop]) => (prop as Record<string, unknown>)?.type === 'title',
        );
        if (titleProp && (titleProp[1] as Record<string, unknown>)?.title) {
          const titleContent = (titleProp[1] as Record<string, unknown>)
            .title as Array<{
            plain_text?: string;
            text?: { content?: string };
          }>;
          const extractedTitle = titleContent
            .map((t) => t.plain_text || t.text?.content || '')
            .join('');
          title = extractedTitle || undefined; // Convert empty string to undefined
        }
      }

      return {
        page_id: page.id,
        url: page.url,
        title,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        archived: page.archived,
        parent_id: page.parent.database_id || page.parent.page_id,
        properties_count: Object.keys(page.properties || {}).length,
        preview: this.extractPreview(page),
      };
    });
  }

  private extractPreview(page: NotionPage): string | undefined {
    // Try to extract preview from properties
    if (page.properties) {
      const textProps = Object.entries(page.properties)
        .filter(
          ([, prop]) => (prop as Record<string, unknown>)?.type === 'rich_text',
        )
        .map(([, prop]) => {
          const richText = (prop as Record<string, unknown>).rich_text as
            | Array<{
                plain_text?: string;
                text?: { content?: string };
              }>
            | undefined;
          return (
            richText
              ?.map((t) => t.plain_text || t.text?.content || '')
              .join('') || ''
          );
        });

      return textProps.find((text) => text.length > 0)?.substring(0, 200);
    }
  }

  private handleNotionError(error: unknown): never {
    let errorMessage = 'Unknown error occurred while accessing Notion API';

    // Check for axios-like error structure (works with mocks and real axios errors)
    const axiosLikeError = error as {
      isAxiosError?: boolean;
      response?: {
        status?: number;
        data?: { message?: string; error?: { message?: string } };
      };
      message?: string;
    };

    if (axios.isAxiosError(error) || axiosLikeError.isAxiosError) {
      const status = axiosLikeError.response?.status;
      const message =
        axiosLikeError.response?.data?.message || axiosLikeError.message;

      if (status === 401 || status === 403) {
        errorMessage = 'Notion authentication failed - check API token';
      } else if (status === 404) {
        errorMessage = 'Notion database not found - check database ID';
      } else if (status === 429) {
        errorMessage = 'Notion API rate limit exceeded - retry later';
      } else if (status === 400) {
        errorMessage = `Notion API error: ${message}`;
      } else {
        errorMessage = `Notion API error: ${message}`;
      }
    } else if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'Notion API request timeout';
      } else if (
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED')
      ) {
        errorMessage = 'Network connectivity issue with Notion API';
      } else if (error.message.includes('token not configured')) {
        errorMessage = error.message;
      } else if (error.message.includes('max_results')) {
        errorMessage = error.message;
      }
    }

    throw new Error(errorMessage);
  }
}
