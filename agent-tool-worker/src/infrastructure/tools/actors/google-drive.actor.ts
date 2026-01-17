/**
 * Google Drive Actor - Infrastructure Layer
 *
 * Provides integration with Google Drive API for file management.
 */

import { Injectable } from '@nestjs/common';
import { BaseActor } from '@domain/tools/base/base-actor';
import {
  ActorConfig,
  ErrorEvent,
} from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, ActorCategory } from '@domain/entities/tool.entities';

export type GoogleDriveOperation =
  | 'upload-file'
  | 'download-file'
  | 'list-files'
  | 'delete-file'
  | 'create-folder'
  | 'get-file-metadata';

export interface GoogleDriveArgs {
  operation: GoogleDriveOperation;
  // Authentication
  accessToken?: string;
  refreshToken?: string;
  // For upload-file
  fileName?: string;
  fileContent?: string; // Base64 encoded
  mimeType?: string;
  parentId?: string; // Folder ID
  // For download-file/get-file-metadata
  fileId?: string;
  // For list-files
  folderId?: string;
  query?: string;
  pageSize?: number;
  // For delete-file
  // For create-folder
  folderName?: string;
}

export interface GoogleDriveOutput extends ToolOutput {
  success: boolean;
  operation: GoogleDriveOperation;
  // For upload-file/create-folder
  fileId?: string;
  webViewLink?: string;
  // For download-file
  fileContent?: string; // Base64 encoded
  mimeType?: string;
  // For list-files
  files?: unknown[];
  nextPageToken?: string;
  // For get-file-metadata
  metadata?: unknown;
  // For delete-file
  deleted?: boolean;
}

@Injectable()
export class GoogleDriveActor extends BaseActor<
  GoogleDriveArgs,
  GoogleDriveOutput
> {
  readonly name = 'google-drive-actor';
  readonly description =
    'Provides integration with Google Drive API for file management';

  readonly errorEvents: ErrorEvent[];

  readonly metadata: ActorConfig;

  get category(): ActorCategory {
    return ActorCategory.EXTERNAL_PRODUCTIVITY;
  }

  get requiresAuth(): boolean {
    return true;
  }

  constructor() {
    const errorEvents = [
      new ErrorEvent(
        'AuthenticationError',
        'Invalid or expired access token',
        false,
      ),
      new ErrorEvent('RateLimitError', 'API rate limit exceeded', true),
      new ErrorEvent('NetworkError', 'Network connectivity issue', true),
      new ErrorEvent('ValidationError', 'Invalid request parameters', false),
      new ErrorEvent('NotFoundError', 'File or folder not found', false),
    ];

    const metadata = new ActorConfig(
      'google-drive-actor',
      'Google Drive API integration',
      'Upload, download, list, and manage files and folders in Google Drive',
      {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [
              'upload-file',
              'download-file',
              'list-files',
              'delete-file',
              'create-folder',
              'get-file-metadata',
            ],
          },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          fileName: { type: 'string' },
          fileContent: { type: 'string' },
          mimeType: { type: 'string' },
          parentId: { type: 'string' },
          fileId: { type: 'string' },
          folderId: { type: 'string' },
          query: { type: 'string' },
          pageSize: { type: 'number', minimum: 1, maximum: 1000 },
          folderName: { type: 'string' },
        },
        required: ['operation'],
      },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          operation: {
            type: 'string',
            enum: [
              'upload-file',
              'download-file',
              'list-files',
              'delete-file',
              'create-folder',
              'get-file-metadata',
            ],
          },
          fileId: { type: 'string' },
          webViewLink: { type: 'string', format: 'uri' },
          fileContent: { type: 'string' },
          mimeType: { type: 'string' },
          files: { type: 'array', items: { type: 'object' } },
          nextPageToken: { type: 'string' },
          metadata: { type: 'object' },
          deleted: { type: 'boolean' },
        },
        required: ['success', 'operation'],
      },
      [],
      ActorCategory.EXTERNAL_PRODUCTIVITY,
      true,
    );

    super(metadata, errorEvents);

    this.errorEvents = errorEvents;
    this.metadata = metadata;
  }

  protected async act(args: GoogleDriveArgs): Promise<GoogleDriveOutput> {
    // Validate authentication
    if (!args.accessToken) {
      throw Object.assign(new Error('Google Drive access token is required'), {
        name: 'AuthenticationError',
      });
    }

    switch (args.operation) {
      case 'upload-file':
        return this.uploadFile(args);
      case 'download-file':
        return this.downloadFile(args);
      case 'list-files':
        return this.listFiles(args);
      case 'delete-file':
        return this.deleteFile(args);
      case 'create-folder':
        return this.createFolder(args);
      case 'get-file-metadata':
        return this.getFileMetadata(args);
      default:
        throw Object.assign(
          new Error(`Unsupported operation: ${args.operation}`),
          {
            name: 'ValidationError',
          },
        );
    }
  }

  private async uploadFile(args: GoogleDriveArgs): Promise<GoogleDriveOutput> {
    if (!args.fileName || !args.fileContent) {
      throw Object.assign(
        new Error('File name and content are required for file upload'),
        {
          name: 'ValidationError',
        },
      );
    }

    try {
      // Simulate API call - In real implementation, this would call Google Drive API
      const fileId = `file-${Date.now()}`;
      const webViewLink = `https://drive.google.com/file/d/${fileId}/view`;

      return {
        success: true,
        operation: 'upload-file',
        fileId,
        webViewLink,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async downloadFile(
    args: GoogleDriveArgs,
  ): Promise<GoogleDriveOutput> {
    if (!args.fileId) {
      throw Object.assign(new Error('File ID is required for file download'), {
        name: 'ValidationError',
      });
    }

    try {
      // Simulate API call
      const mockContent = 'SGVsbG8gV29ybGQ='; // Base64 encoded "Hello World"
      const mimeType = 'text/plain';

      return {
        success: true,
        operation: 'download-file',
        fileContent: mockContent,
        mimeType,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async listFiles(args: GoogleDriveArgs): Promise<GoogleDriveOutput> {
    // In a real implementation, args would be used for folderId, query, and pageSize filtering
    try {
      // Simulate API call
      const mockFiles = [
        {
          id: 'file-1',
          name: 'Document.pdf',
          mimeType: 'application/pdf',
          webViewLink: 'https://drive.google.com/file/d/file-1/view',
        },
        {
          id: 'file-2',
          name: 'Spreadsheet.xlsx',
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          webViewLink: 'https://drive.google.com/file/d/file-2/view',
        },
      ];

      return {
        success: true,
        operation: 'list-files',
        files: mockFiles,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async deleteFile(args: GoogleDriveArgs): Promise<GoogleDriveOutput> {
    if (!args.fileId) {
      throw Object.assign(new Error('File ID is required for file deletion'), {
        name: 'ValidationError',
      });
    }

    try {
      // Simulate API call
      return {
        success: true,
        operation: 'delete-file',
        deleted: true,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async createFolder(
    args: GoogleDriveArgs,
  ): Promise<GoogleDriveOutput> {
    if (!args.folderName) {
      throw Object.assign(
        new Error('Folder name is required for folder creation'),
        {
          name: 'ValidationError',
        },
      );
    }

    try {
      // Simulate API call
      const folderId = `folder-${Date.now()}`;
      const webViewLink = `https://drive.google.com/drive/folders/${folderId}`;

      return {
        success: true,
        operation: 'create-folder',
        fileId: folderId,
        webViewLink,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async getFileMetadata(
    args: GoogleDriveArgs,
  ): Promise<GoogleDriveOutput> {
    if (!args.fileId) {
      throw Object.assign(
        new Error('File ID is required for metadata retrieval'),
        {
          name: 'ValidationError',
        },
      );
    }

    try {
      // Simulate API call
      const mockMetadata = {
        id: args.fileId,
        name: 'Sample Document.pdf',
        mimeType: 'application/pdf',
        size: '1024000',
        modifiedTime: '2024-01-15T10:00:00.000Z',
        webViewLink: `https://drive.google.com/file/d/${args.fileId}/view`,
      };

      return {
        success: true,
        operation: 'get-file-metadata',
        metadata: mockMetadata,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private handleApiError(error: unknown): Error {
    // In a real implementation, this would parse Google Drive API errors
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown API error';

    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      return Object.assign(new Error('Invalid or expired access token'), {
        name: 'AuthenticationError',
      });
    }

    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      return Object.assign(new Error('Insufficient permissions'), {
        name: 'PermissionError',
      });
    }

    if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      return Object.assign(new Error('File or folder not found'), {
        name: 'NotFoundError',
      });
    }

    if (errorMessage.includes('429') || errorMessage.includes('quota')) {
      return Object.assign(new Error('API rate limit exceeded'), {
        name: 'RateLimitError',
      });
    }

    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return Object.assign(new Error('Network connectivity issue'), {
        name: 'NetworkError',
      });
    }

    return Object.assign(new Error(`Google Drive API error: ${errorMessage}`), {
      name: 'ApiError',
    });
  }
}
