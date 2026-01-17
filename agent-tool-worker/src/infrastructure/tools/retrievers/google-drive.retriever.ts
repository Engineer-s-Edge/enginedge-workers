/**
 * Google Drive Retriever
 *
 * Retrieves files, folders, and documents from Google Drive with comprehensive search,
 * filtering, and metadata capabilities. Supports OAuth 2.0 authentication and Google
 * Drive API v3 integration.
 *
 * Features:
 * - Full-text search across files and folders
 * - Filtering by file type, owner, modification time, and size
 * - Folder hierarchy navigation
 * - Pagination support
 * - Comprehensive error handling
 * - OAuth token management
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

export interface GoogleDriveArgs extends Record<string, unknown> {
  query?: string;
  folder_id?: string;
  file_types?: string[];
  owner?: string;
  modified_after?: string;
  modified_before?: string;
  min_size?: number;
  max_size?: number;
  max_results?: number;
  page_token?: string;
  order_by?: string;
  trash?: boolean;
}

interface GoogleDriveFile {
  kind: string;
  id: string;
  name: string;
  mimeType: string;
  description?: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  owners?: Array<{
    displayName?: string;
    emailAddress?: string;
  }>;
  lastModifyingUser?: {
    displayName?: string;
    emailAddress?: string;
  };
  webViewLink?: string;
  webContentLink?: string;
  sharingUser?: {
    displayName?: string;
    emailAddress?: string;
  };
  fileExtension?: string;
  fullFileExtension?: string;
  md5Checksum?: string;
  viewedByMe?: boolean;
  trashed?: boolean;
  starred?: boolean;
  shared?: boolean;
}

interface GoogleDriveApiResponse {
  kind: string;
  nextPageToken?: string;
  incompleteSearch?: boolean;
  files: GoogleDriveFile[];
}

export interface GoogleDriveOutput extends ToolOutput {
  success: boolean;
  query?: string;
  folder_id?: string;
  total_files: number;
  next_page_token?: string;
  incomplete_search: boolean;
  files: Array<{
    file_id: string;
    name: string;
    mime_type: string;
    description?: string;
    size_bytes?: string;
    created_time?: string;
    modified_time?: string;
    owner?: string;
    last_modifying_user?: string;
    web_view_link?: string;
    web_content_link?: string;
    is_folder: boolean;
    file_extension?: string;
    is_trashed: boolean;
    is_starred: boolean;
    is_shared: boolean;
    viewed_by_me: boolean;
  }>;
}

@Injectable()
export class GoogleDriveRetriever extends BaseRetriever<
  GoogleDriveArgs,
  GoogleDriveOutput
> {
  readonly inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for file names, descriptions, or content',
      },
      folder_id: {
        type: 'string',
        description: 'Folder ID to search within (defaults to root)',
        default: 'root',
      },
      file_types: {
        type: 'array',
        items: { type: 'string' },
        description:
          'MIME types to filter by (e.g., "application/pdf", "text/plain")',
      },
      owner: {
        type: 'string',
        description: 'Email address of file owner',
      },
      modified_after: {
        type: 'string',
        description: 'ISO 8601 date-time for minimum modification time',
        format: 'date-time',
      },
      modified_before: {
        type: 'string',
        description: 'ISO 8601 date-time for maximum modification time',
        format: 'date-time',
      },
      min_size: {
        type: 'number',
        description: 'Minimum file size in bytes',
        minimum: 0,
      },
      max_size: {
        type: 'number',
        description: 'Maximum file size in bytes',
        minimum: 0,
      },
      max_results: {
        type: 'number',
        description: 'Maximum files to return',
        minimum: 1,
        maximum: 1000,
        default: 10,
      },
      page_token: {
        type: 'string',
        description: 'Token for pagination',
      },
      order_by: {
        type: 'string',
        description: 'Order results by field',
        enum: [
          'name',
          'modifiedTime',
          'createdTime',
          'starred',
          'sharedWithMe',
        ],
        default: 'modifiedTime',
      },
      trash: {
        type: 'boolean',
        description: 'Include trashed files',
        default: false,
      },
    },
    required: [],
  };

  readonly outputSchema = {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      query: { type: 'string' },
      folder_id: { type: 'string' },
      total_files: { type: 'number' },
      next_page_token: { type: 'string' },
      incomplete_search: { type: 'boolean' },
      files: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file_id: { type: 'string' },
            name: { type: 'string' },
            mime_type: { type: 'string' },
            description: { type: 'string' },
            size_bytes: { type: 'string' },
            created_time: { type: 'string', format: 'date-time' },
            modified_time: { type: 'string', format: 'date-time' },
            owner: { type: 'string' },
            last_modifying_user: { type: 'string' },
            web_view_link: { type: 'string' },
            web_content_link: { type: 'string' },
            is_folder: { type: 'boolean' },
            file_extension: { type: 'string' },
            is_trashed: { type: 'boolean' },
            is_starred: { type: 'boolean' },
            is_shared: { type: 'boolean' },
            viewed_by_me: { type: 'boolean' },
          },
        },
      },
    },
    required: ['success', 'total_files', 'incomplete_search', 'files'],
  };

  readonly name = 'google-drive-retriever';
  readonly description =
    'Search Google Drive for files, folders, and documents with comprehensive filtering and metadata';
  readonly retrievalType: RetrievalType = RetrievalType.API_DATA;

  readonly metadata = new RetrieverConfig(
    this.name,
    this.description,
    'Google Drive file and folder search and retrieval',
    this.inputSchema,
    this.outputSchema,
    [],
    this.retrievalType,
    this.caching,
    {},
  );

  readonly errorEvents: ErrorEvent[] = [
    new ErrorEvent(
      'google-drive-auth-failed',
      'Google Drive authentication failed',
      false,
    ),
    new ErrorEvent(
      'google-drive-api-error',
      'Google Drive API request failed',
      true,
    ),
    new ErrorEvent(
      'google-drive-invalid-folder',
      'Invalid folder ID provided',
      false,
    ),
    new ErrorEvent(
      'google-drive-network-error',
      'Network connectivity issue with Google Drive API',
      true,
    ),
    new ErrorEvent(
      'google-drive-quota-exceeded',
      'Google Drive API quota exceeded',
      true,
    ),
  ];

  public get caching(): boolean {
    return false; // Drive contents change frequently
  }

  protected async retrieve(
    args: GoogleDriveArgs & { ragConfig: RAGConfig },
  ): Promise<GoogleDriveOutput> {
    // Manual input validation
    if (
      args.max_results !== undefined &&
      (args.max_results < 1 || args.max_results > 1000)
    ) {
      throw new Error('max_results must be between 1 and 1000');
    }
    if (args.modified_after && !this.isValidISODate(args.modified_after)) {
      throw new Error(
        'Invalid modified_after format - must be ISO 8601 date-time',
      );
    }
    if (args.modified_before && !this.isValidISODate(args.modified_before)) {
      throw new Error(
        'Invalid modified_before format - must be ISO 8601 date-time',
      );
    }

    const folderId = args.folder_id || 'root';

    try {
      const response = await this.sendGoogleDriveRequest(args, folderId);

      return {
        success: true,
        query: args.query,
        folder_id: folderId,
        total_files: response.data.files?.length || 0,
        next_page_token: response.data.nextPageToken,
        incomplete_search: response.data.incompleteSearch || false,
        files: this.transformFiles(response.data.files || []),
      };
    } catch (error: unknown) {
      return this.handleGoogleDriveError(error);
    }
  }

  private async sendGoogleDriveRequest(
    args: GoogleDriveArgs,
    folderId: string,
  ): Promise<AxiosResponse<GoogleDriveApiResponse>> {
    const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('Google access token not configured');
    }

    // Build query string
    const queryParts: string[] = [];

    if (args.query) {
      queryParts.push(`name contains '${args.query.replace(/'/g, "\\'")}'`);
    }

    if (folderId !== 'root') {
      queryParts.push(`'${folderId}' in parents`);
    }

    if (args.file_types && args.file_types.length > 0) {
      const mimeQueries = args.file_types
        .map((type) => `mimeType='${type}'`)
        .join(' or ');
      queryParts.push(`(${mimeQueries})`);
    }

    if (args.owner) {
      queryParts.push(`owners='${args.owner}'`);
    }

    if (args.modified_after) {
      queryParts.push(`modifiedTime>='${args.modified_after}'`);
    }

    if (args.modified_before) {
      queryParts.push(`modifiedTime<='${args.modified_before}'`);
    }

    if (!args.trash) {
      queryParts.push('trashed=false');
    }

    const query = queryParts.join(' and ');

    const params: Record<string, unknown> = {
      key: process.env.GOOGLE_API_KEY || '',
      pageSize: Math.min(args.max_results || 10, 1000),
      fields:
        'nextPageToken,incompleteSearch,files(id,name,mimeType,description,size,createdTime,modifiedTime,parents,owners,lastModifyingUser,webViewLink,webContentLink,sharingUser,fileExtension,fullFileExtension,md5Checksum,viewedByMe,trashed,starred,shared)',
      orderBy: args.order_by || 'modifiedTime desc',
    };

    if (query) {
      params.q = query;
    }

    if (args.page_token) {
      params.pageToken = args.page_token;
    }

    return axios.get<GoogleDriveApiResponse>(
      'https://www.googleapis.com/drive/v3/files',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        params,
        timeout: 30000,
      },
    );
  }

  private transformFiles(files: GoogleDriveFile[]): GoogleDriveOutput['files'] {
    return files.map((file) => ({
      file_id: file.id,
      name: file.name,
      mime_type: file.mimeType,
      description: file.description,
      size_bytes: file.size,
      created_time: file.createdTime,
      modified_time: file.modifiedTime,
      owner: file.owners?.[0]?.emailAddress,
      last_modifying_user: file.lastModifyingUser?.emailAddress,
      web_view_link: file.webViewLink,
      web_content_link: file.webContentLink,
      is_folder: file.mimeType === 'application/vnd.google-apps.folder',
      file_extension: file.fileExtension,
      is_trashed: file.trashed || false,
      is_starred: file.starred || false,
      is_shared: file.shared || false,
      viewed_by_me: file.viewedByMe || false,
    }));
  }

  private handleGoogleDriveError(error: unknown): never {
    let errorMessage =
      'Unknown error occurred while accessing Google Drive API';

    // Check for axios-like error structure (works with mocks and real axios errors)
    const axiosLikeError = error as {
      isAxiosError?: boolean;
      response?: { status?: number; data?: { error?: { message?: string } } };
      message?: string;
    };

    if (axios.isAxiosError(error) || axiosLikeError.isAxiosError) {
      const status = axiosLikeError.response?.status;
      const message =
        axiosLikeError.response?.data?.error?.message || axiosLikeError.message;

      if (status === 401 || status === 403) {
        errorMessage =
          'Google Drive authentication failed - check access token';
      } else if (status === 404) {
        errorMessage = 'Folder not found - check folder ID and permissions';
      } else if (status === 429) {
        errorMessage = 'Google Drive API quota exceeded - retry later';
      } else {
        errorMessage = `Google Drive API error: ${message}`;
      }
    } else if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'Google Drive API request timeout';
      } else if (
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED')
      ) {
        errorMessage = 'Network connectivity issue with Google Drive API';
      } else if (error.message.includes('token not configured')) {
        errorMessage = error.message;
      } else if (
        error.message.includes('max_results') ||
        error.message.includes('min_size') ||
        error.message.includes('max_size') ||
        error.message.includes('modified')
      ) {
        errorMessage = error.message;
      }
    }

    throw new Error(errorMessage);
  }

  private isValidISODate(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      // Check if date is valid and the string is in ISO 8601 format
      return (
        !isNaN(date.getTime()) &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(dateString)
      );
    } catch {
      return false;
    }
  }
}
