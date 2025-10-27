/**
 * Tavily Retriever - Infrastructure Layer
 *
 * Performs web search using the Tavily API for comprehensive search results.
 * Provides search results with snippets, titles, and URLs.
 */

import { Injectable } from '@nestjs/common';
import { BaseRetriever } from '@domain/tools/base/base-retriever';
import { RetrieverConfig, ErrorEvent } from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, RAGConfig, RetrievalType } from '@domain/entities/tool.entities';
import axios, { AxiosResponse } from 'axios';

export interface TavilyArgs {
  query: string;
  search_depth?: 'basic' | 'advanced';
  include_images?: boolean;
  include_answer?: boolean;
  include_raw_content?: boolean;
  max_results?: number;
  include_domains?: string[];
  exclude_domains?: string[];
  [key: string]: unknown; // Index signature for compatibility
}

export interface TavilyOutput extends ToolOutput {
  success: boolean;
  query: string;
  answer?: string;
  results?: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    published_date?: string;
  }>;
  images?: Array<{
    url: string;
    description?: string;
  }>;
  query_id?: string;
  response_time?: number;
  processingTime?: number;
  message?: string;
}

@Injectable()
export class TavilyRetriever extends BaseRetriever<TavilyArgs, TavilyOutput> {
  readonly name = 'tavily-retriever';
  readonly description = 'Search the web using Tavily API for comprehensive search results with snippets, titles, and URLs';
  readonly retrievalType: RetrievalType = RetrievalType.WEB_SEARCH;
  readonly caching = false;

  readonly inputSchema = {
    type: 'object',
    required: ['query'],
    properties: {
      query: {
        type: 'string',
        description: 'The search query to execute',
        minLength: 1,
        maxLength: 500
      },
      search_depth: {
        type: 'string',
        enum: ['basic', 'advanced'],
        description: 'Search depth - basic for faster results, advanced for comprehensive search',
        default: 'basic'
      },
      include_images: {
        type: 'boolean',
        description: 'Whether to include images in the search results',
        default: false
      },
      include_answer: {
        type: 'boolean',
        description: 'Whether to include an AI-generated answer in the response',
        default: false
      },
      include_raw_content: {
        type: 'boolean',
        description: 'Whether to include raw content from the search results',
        default: false
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of search results to return',
        minimum: 1,
        maximum: 20,
        default: 10
      },
      include_domains: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of domains to include in search results'
      },
      exclude_domains: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of domains to exclude from search results'
      }
    }
  };

  readonly outputSchema = {
    type: 'object',
    required: ['success', 'query'],
    properties: {
      success: { type: 'boolean' },
      query: { type: 'string' },
      answer: { type: 'string' },
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            content: { type: 'string' },
            score: { type: 'number' },
            published_date: { type: 'string' }
          }
        }
      },
      images: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            description: { type: 'string' }
          }
        }
      },
      query_id: { type: 'string' },
      response_time: { type: 'number' },
      processingTime: { type: 'number' },
      message: { type: 'string' }
    }
  };

  readonly metadata = new RetrieverConfig(
    this.name,
    this.description,
    'Web search and information retrieval',
    this.inputSchema,
    this.outputSchema,
    [],
    this.retrievalType,
    this.caching,
    {}
  );

  readonly errorEvents: ErrorEvent[] = [
    new ErrorEvent('tavily-service-unavailable', 'Tavily service is not available', false),
    new ErrorEvent('tavily-search-failed', 'Tavily search request failed', true),
    new ErrorEvent('tavily-invalid-query', 'Invalid search query provided', false)
  ];

  protected async retrieve(args: TavilyArgs & { ragConfig: RAGConfig }): Promise<TavilyOutput> {
    // Validate input
    this.validateInput(args);

    const {
      query,
      search_depth = 'basic',
      include_images = false,
      include_answer = false,
      include_raw_content = false,
      max_results = 10,
      include_domains,
      exclude_domains
    } = args;

    // Validate query
    if (!query || query.trim().length === 0) {
      throw Object.assign(new Error('Search query cannot be empty'), {
        name: 'ValidationError'
      });
    }

    if (query.length > 500) {
      throw Object.assign(new Error('Search query too long (max 500 characters)'), {
        name: 'ValidationError'
      });
    }

    // Send request to Tavily API
    return await this.sendTavilyRequest({
      query: query.trim(),
      search_depth,
      include_images,
      include_answer,
      include_raw_content,
      max_results,
      include_domains,
      exclude_domains
    });
  }

  private async sendTavilyRequest(request: {
    query: string;
    search_depth: string;
    include_images: boolean;
    include_answer: boolean;
    include_raw_content: boolean;
    max_results: number;
    include_domains?: string[];
    exclude_domains?: string[];
  }): Promise<TavilyOutput> {
    const startTime = Date.now();

    try {
      // Make HTTP call to Tavily API
      const response: AxiosResponse = await axios.post('https://api.tavily.com/search', {
        query: request.query,
        search_depth: request.search_depth,
        include_images: request.include_images,
        include_answer: request.include_answer,
        include_raw_content: request.include_raw_content,
        max_results: request.max_results,
        include_domains: request.include_domains,
        exclude_domains: request.exclude_domains
      }, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json',
          // Note: API key would be configured via environment variables
          'Authorization': `Bearer ${process.env.TAVILY_API_KEY || ''}`
        }
      });

      const processingTime = Date.now() - startTime;

      if (response.data && response.status === 200) {
        return {
          success: true,
          query: request.query,
          answer: response.data.answer,
          results: response.data.results,
          images: response.data.images,
          query_id: response.data.query_id,
          response_time: response.data.response_time,
          processingTime
        };
      } else {
        return {
          success: false,
          query: request.query,
          message: 'Search request failed',
          processingTime
        };
      }

    } catch (error) {
      const axiosError = error as {
        code?: string;
        response?: { status?: number; data?: { error?: string; message?: string } };
        message?: string
      };

      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        throw Object.assign(new Error('Tavily service is not available'), {
          name: 'ServiceUnavailableError'
        });
      }

      if (axiosError.response?.status === 408 || axiosError.code === 'ETIMEDOUT') {
        throw Object.assign(new Error('Tavily search timed out'), {
          name: 'TimeoutError'
        });
      }

      if (axiosError.response?.status === 401) {
        throw Object.assign(new Error('Tavily API key is invalid or missing'), {
          name: 'AuthenticationError'
        });
      }

      if (axiosError.response?.status === 429) {
        throw Object.assign(new Error('Tavily API rate limit exceeded'), {
          name: 'RateLimitError'
        });
      }

      const errorMessage = axiosError.response?.data?.error ||
                          axiosError.response?.data?.message ||
                          axiosError.message ||
                          'Unknown error';
      throw Object.assign(new Error(`Tavily search failed: ${errorMessage}`), {
        name: 'TavilyError'
      });
    }
  }
}