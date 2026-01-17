/**
 * YouTube Retriever - Infrastructure Layer
 *
 * Searches YouTube for videos and retrieves metadata using YouTube Data API.
 * Provides video search results with titles, descriptions, and statistics.
 */

import { Injectable } from '@nestjs/common';
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
import axios, { AxiosResponse } from 'axios';

export interface YouTubeArgs {
  query: string;
  max_results?: number;
  order?:
    | 'relevance'
    | 'date'
    | 'rating'
    | 'title'
    | 'videoCount'
    | 'viewCount';
  type?: 'video' | 'channel' | 'playlist';
  published_after?: string; // ISO 8601 date
  published_before?: string; // ISO 8601 date
  region_code?: string;
  relevance_language?: string;
  safe_search?: 'moderate' | 'none' | 'strict';
  video_definition?: 'any' | 'high' | 'standard';
  video_duration?: 'any' | 'long' | 'medium' | 'short';
  channel_id?: string;
  [key: string]: unknown; // Index signature for compatibility
}

interface YouTubeThumbnails {
  default: { url: string; width: number; height: number };
  medium?: { url: string; width: number; height: number };
  high?: { url: string; width: number; height: number };
}

export interface YouTubeOutput extends ToolOutput {
  success: boolean;
  query: string;
  total_results: number;
  results_per_page: number;
  next_page_token?: string;
  prev_page_token?: string;
  videos?: Array<{
    video_id: string;
    title: string;
    description: string;
    channel_title: string;
    channel_id: string;
    published_at: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium?: { url: string; width: number; height: number };
      high?: { url: string; width: number; height: number };
    };
    duration?: string;
    view_count?: string;
    like_count?: string;
    comment_count?: string;
    tags?: string[];
    category_id?: string;
  }>;
  channels?: Array<{
    channel_id: string;
    title: string;
    description: string;
    published_at: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium?: { url: string; width: number; height: number };
      high?: { url: string; width: number; height: number };
    };
    subscriber_count?: string;
    video_count?: string;
    view_count?: string;
  }>;
  playlists?: Array<{
    playlist_id: string;
    title: string;
    description: string;
    channel_title: string;
    channel_id: string;
    published_at: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium?: { url: string; width: number; height: number };
      high?: { url: string; width: number; height: number };
    };
    item_count?: number;
  }>;
  processingTime?: number;
  message?: string;
}

@Injectable()
export class YouTubeRetriever extends BaseRetriever<
  YouTubeArgs,
  YouTubeOutput
> {
  readonly name = 'youtube-retriever';
  readonly description =
    'Search YouTube for videos, channels, and playlists using YouTube Data API with comprehensive metadata';
  readonly retrievalType: RetrievalType = RetrievalType.VIDEO_TRANSCRIPT;
  readonly caching = false;

  readonly inputSchema = {
    type: 'object',
    required: ['query'],
    properties: {
      query: {
        type: 'string',
        description: 'Search query for YouTube content',
        minLength: 1,
        maxLength: 500,
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return',
        minimum: 1,
        maximum: 50,
        default: 25,
      },
      order: {
        type: 'string',
        enum: [
          'relevance',
          'date',
          'rating',
          'title',
          'videoCount',
          'viewCount',
        ],
        description: 'Sort order for results',
        default: 'relevance',
      },
      type: {
        type: 'string',
        enum: ['video', 'channel', 'playlist'],
        description: 'Type of content to search for',
        default: 'video',
      },
      published_after: {
        type: 'string',
        description: 'Return results published after this date (ISO 8601)',
        format: 'date-time',
      },
      published_before: {
        type: 'string',
        description: 'Return results published before this date (ISO 8601)',
        format: 'date-time',
      },
      region_code: {
        type: 'string',
        description: 'Region code for localized results',
        pattern: '^[A-Z]{2}$',
      },
      relevance_language: {
        type: 'string',
        description: 'Language for relevance ranking',
        pattern: '^[a-z]{2}(-[A-Z]{2})?$',
      },
      safe_search: {
        type: 'string',
        enum: ['moderate', 'none', 'strict'],
        description: 'Safe search filtering',
        default: 'moderate',
      },
      video_definition: {
        type: 'string',
        enum: ['any', 'high', 'standard'],
        description: 'Video definition filter',
        default: 'any',
      },
      video_duration: {
        type: 'string',
        enum: ['any', 'long', 'medium', 'short'],
        description: 'Video duration filter',
        default: 'any',
      },
      channel_id: {
        type: 'string',
        description: 'Restrict search to a specific channel',
      },
    },
  };

  readonly outputSchema = {
    type: 'object',
    required: ['success', 'query', 'total_results', 'results_per_page'],
    properties: {
      success: { type: 'boolean' },
      query: { type: 'string' },
      total_results: { type: 'number' },
      results_per_page: { type: 'number' },
      next_page_token: { type: 'string' },
      prev_page_token: { type: 'string' },
      videos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            video_id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            channel_title: { type: 'string' },
            channel_id: { type: 'string' },
            published_at: { type: 'string' },
            thumbnails: { type: 'object' },
            duration: { type: 'string' },
            view_count: { type: 'string' },
            like_count: { type: 'string' },
            comment_count: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            category_id: { type: 'string' },
          },
        },
      },
      channels: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            channel_id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            published_at: { type: 'string' },
            thumbnails: { type: 'object' },
            subscriber_count: { type: 'string' },
            video_count: { type: 'string' },
            view_count: { type: 'string' },
          },
        },
      },
      playlists: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            playlist_id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            channel_title: { type: 'string' },
            channel_id: { type: 'string' },
            published_at: { type: 'string' },
            thumbnails: { type: 'object' },
            item_count: { type: 'number' },
          },
        },
      },
      processingTime: { type: 'number' },
      message: { type: 'string' },
    },
  };

  readonly metadata = new RetrieverConfig(
    this.name,
    this.description,
    'YouTube video and content search and retrieval',
    this.inputSchema,
    this.outputSchema,
    [],
    this.retrievalType,
    this.caching,
    {},
  );

  readonly errorEvents: ErrorEvent[] = [
    new ErrorEvent(
      'youtube-service-unavailable',
      'YouTube API service is not available',
      false,
    ),
    new ErrorEvent(
      'youtube-search-failed',
      'YouTube search request failed',
      true,
    ),
    new ErrorEvent(
      'youtube-invalid-query',
      'Invalid YouTube search query',
      false,
    ),
    new ErrorEvent(
      'youtube-api-quota-exceeded',
      'YouTube API quota exceeded',
      true,
    ),
  ];

  protected async retrieve(
    args: YouTubeArgs & { ragConfig: RAGConfig },
  ): Promise<YouTubeOutput> {
    // Validate input
    const {
      query,
      max_results = 25,
      order = 'relevance',
      type = 'video',
      published_after,
      published_before,
      region_code,
      relevance_language,
      safe_search = 'moderate',
      video_definition = 'any',
      video_duration = 'any',
      channel_id,
    } = args;

    // Validate query
    if (!query || query.trim().length === 0) {
      throw Object.assign(new Error('Search query cannot be empty'), {
        name: 'ValidationError',
      });
    }

    if (query.length > 500) {
      throw Object.assign(
        new Error('Search query too long (max 500 characters)'),
        {
          name: 'ValidationError',
        },
      );
    }

    // Validate max_results
    if (max_results < 1 || max_results > 50) {
      throw Object.assign(new Error('max_results must be between 1 and 50'), {
        name: 'ValidationError',
      });
    }

    // Validate date formats if provided
    if (
      published_after &&
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(published_after)
    ) {
      throw Object.assign(
        new Error(
          'published_after must be in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)',
        ),
        {
          name: 'ValidationError',
        },
      );
    }

    if (
      published_before &&
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(published_before)
    ) {
      throw Object.assign(
        new Error(
          'published_before must be in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)',
        ),
        {
          name: 'ValidationError',
        },
      );
    }

    // Validate query
    if (!query || query.trim().length === 0) {
      throw Object.assign(new Error('Search query cannot be empty'), {
        name: 'ValidationError',
      });
    }

    if (query.length > 500) {
      throw Object.assign(
        new Error('Search query too long (max 500 characters)'),
        {
          name: 'ValidationError',
        },
      );
    }

    // Send request to YouTube API
    return await this.sendYouTubeRequest({
      query: query.trim(),
      max_results,
      order,
      type,
      published_after,
      published_before,
      region_code,
      relevance_language,
      safe_search,
      video_definition,
      video_duration,
      channel_id,
    });
  }

  private async sendYouTubeRequest(request: {
    query: string;
    max_results: number;
    order: string;
    type: string;
    published_after?: string;
    published_before?: string;
    region_code?: string;
    relevance_language?: string;
    safe_search: string;
    video_definition: string;
    video_duration: string;
    channel_id?: string;
  }): Promise<YouTubeOutput> {
    try {
      // Make HTTP call to YouTube Data API
      const params: Record<string, string | number> = {
        key: process.env.YOUTUBE_API_KEY || '',
        q: request.query,
        part: 'snippet',
        maxResults: request.max_results,
        order: request.order,
        type: request.type,
        safeSearch: request.safe_search,
      };

      // Add optional parameters
      if (request.published_after)
        params.publishedAfter = request.published_after;
      if (request.published_before)
        params.publishedBefore = request.published_before;
      if (request.region_code) params.regionCode = request.region_code;
      if (request.relevance_language)
        params.relevanceLanguage = request.relevance_language;
      if (request.channel_id) params.channelId = request.channel_id;

      // Video-specific parameters
      if (request.type === 'video') {
        params.videoDefinition = request.video_definition;
        params.videoDuration = request.video_duration;
      }

      const response: AxiosResponse = await axios.get(
        'https://www.googleapis.com/youtube/v3/search',
        {
          params,
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data && response.status === 200) {
        // Transform YouTube API response to our format
        const result: YouTubeOutput = {
          success: true,
          query: request.query,
          total_results: response.data.pageInfo?.totalResults || 0,
          results_per_page: response.data.pageInfo?.resultsPerPage || 0,
          next_page_token: response.data.nextPageToken,
          prev_page_token: response.data.prevPageToken,
        };

        if (request.type === 'video') {
          result.videos = this.transformVideos(response.data.items || []);
        } else if (request.type === 'channel') {
          result.channels = this.transformChannels(response.data.items || []);
        } else if (request.type === 'playlist') {
          result.playlists = this.transformPlaylists(response.data.items || []);
        }

        return result;
      } else {
        return {
          success: false,
          query: request.query,
          total_results: 0,
          results_per_page: 0,
          message: 'YouTube search request failed',
        };
      }
    } catch (error) {
      const axiosError = error as {
        code?: string;
        response?: { status?: number; data?: { error?: { message?: string } } };
        message?: string;
      };

      if (
        axiosError.code === 'ECONNREFUSED' ||
        axiosError.code === 'ENOTFOUND'
      ) {
        throw Object.assign(new Error('YouTube API service is not available'), {
          name: 'ServiceUnavailableError',
        });
      }

      if (
        axiosError.response?.status === 408 ||
        axiosError.code === 'ETIMEDOUT'
      ) {
        throw Object.assign(new Error('YouTube search timed out'), {
          name: 'TimeoutError',
        });
      }

      if (axiosError.response?.status === 403) {
        throw Object.assign(
          new Error('YouTube API quota exceeded or access denied'),
          {
            name: 'QuotaExceededError',
          },
        );
      }

      if (axiosError.response?.status === 400) {
        throw Object.assign(
          new Error('Invalid YouTube API request parameters'),
          {
            name: 'InvalidRequestError',
          },
        );
      }

      const errorMessage =
        axiosError.response?.data?.error?.message ||
        axiosError.message ||
        'Unknown error';
      throw Object.assign(new Error(`YouTube search failed: ${errorMessage}`), {
        name: 'YouTubeError',
      });
    }
  }

  private transformVideos(
    items: Record<string, unknown>[],
  ): YouTubeOutput['videos'] {
    return items.map((item) => {
      const data = item as Record<string, unknown>;
      return {
        video_id:
          ((data.id as Record<string, unknown>)?.videoId as string) || '',
        title:
          ((data.snippet as Record<string, unknown>)?.title as string) || '',
        description:
          ((data.snippet as Record<string, unknown>)?.description as string) ||
          '',
        channel_title:
          ((data.snippet as Record<string, unknown>)?.channelTitle as string) ||
          '',
        channel_id:
          ((data.snippet as Record<string, unknown>)?.channelId as string) ||
          '',
        published_at:
          ((data.snippet as Record<string, unknown>)?.publishedAt as string) ||
          '',
        thumbnails: ((data.snippet as Record<string, unknown>)
          ?.thumbnails as YouTubeThumbnails) || {
          default: { url: '', width: 0, height: 0 },
        },
      };
    });
  }

  private transformChannels(
    items: Record<string, unknown>[],
  ): YouTubeOutput['channels'] {
    return items.map((item) => {
      const data = item as Record<string, unknown>;
      return {
        channel_id:
          ((data.id as Record<string, unknown>)?.channelId as string) || '',
        title:
          ((data.snippet as Record<string, unknown>)?.title as string) || '',
        description:
          ((data.snippet as Record<string, unknown>)?.description as string) ||
          '',
        published_at:
          ((data.snippet as Record<string, unknown>)?.publishedAt as string) ||
          '',
        thumbnails: ((data.snippet as Record<string, unknown>)
          ?.thumbnails as YouTubeThumbnails) || {
          default: { url: '', width: 0, height: 0 },
        },
      };
    });
  }

  private transformPlaylists(
    items: Record<string, unknown>[],
  ): YouTubeOutput['playlists'] {
    return items.map((item) => {
      const data = item as Record<string, unknown>;
      return {
        playlist_id:
          ((data.id as Record<string, unknown>)?.playlistId as string) || '',
        title:
          ((data.snippet as Record<string, unknown>)?.title as string) || '',
        description:
          ((data.snippet as Record<string, unknown>)?.description as string) ||
          '',
        channel_title:
          ((data.snippet as Record<string, unknown>)?.channelTitle as string) ||
          '',
        channel_id:
          ((data.snippet as Record<string, unknown>)?.channelId as string) ||
          '',
        published_at:
          ((data.snippet as Record<string, unknown>)?.publishedAt as string) ||
          '',
        thumbnails: ((data.snippet as Record<string, unknown>)
          ?.thumbnails as YouTubeThumbnails) || {
          default: { url: '', width: 0, height: 0 },
        },
      };
    });
  }
}
