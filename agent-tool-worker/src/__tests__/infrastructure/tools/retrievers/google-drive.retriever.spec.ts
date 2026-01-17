/**
 * Google Drive Retriever - Unit Tests
 *
 * Tests the Google Drive retriever implementation for file search and retrieval functionality.
 * Uses mocked axios for API interaction and comprehensive error scenario testing.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  GoogleDriveRetriever,
  GoogleDriveArgs,
} from '@infrastructure/tools/retrievers/google-drive.retriever';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GoogleDriveRetriever', () => {
  let retriever: GoogleDriveRetriever;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleDriveRetriever],
    }).compile();

    retriever = module.get<GoogleDriveRetriever>(GoogleDriveRetriever);

    // Reset all mocks
    jest.clearAllMocks();

    // Set required environment variables
    process.env.GOOGLE_ACCESS_TOKEN = 'test-access-token';
    process.env.GOOGLE_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GOOGLE_ACCESS_TOKEN;
    delete process.env.GOOGLE_API_KEY;
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(retriever.name).toBe('google-drive-retriever');
      expect(retriever.description).toContain('Google Drive');
    });

    it('should have metadata configured', () => {
      expect(retriever.metadata).toBeDefined();
      expect(retriever.metadata.name).toBe('google-drive-retriever');
    });

    it('should have error events configured', () => {
      expect(retriever.errorEvents).toBeDefined();
      expect(retriever.errorEvents.length).toBeGreaterThan(0);
      expect(
        retriever.errorEvents.some(
          (e) => e.name === 'google-drive-auth-failed',
        ),
      ).toBe(true);
      expect(
        retriever.errorEvents.some(
          (e) => e.name === 'google-drive-quota-exceeded',
        ),
      ).toBe(true);
    });

    it('should have correct retrieval type and caching settings', () => {
      expect(retriever.retrievalType).toBe('API_DATA');
      expect(retriever.caching).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should reject max_results greater than 1000', async () => {
      const args: GoogleDriveArgs = {
        query: 'test',
        max_results: 1001,
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain(
        'max_results must be between 1 and 1000',
      );
    });

    it('should reject max_results less than 1', async () => {
      const args: GoogleDriveArgs = {
        query: 'test',
        max_results: 0,
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain(
        'max_results must be between 1 and 1000',
      );
    });

    it('should reject invalid modified_after date format', async () => {
      const args: GoogleDriveArgs = {
        query: 'test',
        modified_after: '2023/12/25',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('modified_after format');
    });

    it('should reject invalid modified_before date format', async () => {
      const args: GoogleDriveArgs = {
        query: 'test',
        modified_before: '12-25-2023',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('modified_before format');
    });

    it('should accept valid max_results', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [],
          incompleteSearch: false,
        },
      });

      const args: GoogleDriveArgs = {
        query: 'test',
        max_results: 50,
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid ISO date for modified_after', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [],
          incompleteSearch: false,
        },
      });

      const args: GoogleDriveArgs = {
        query: 'test',
        modified_after: '2023-12-25T10:30:00Z',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('File Search Operations', () => {
    it('should handle basic file search by name', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [
            {
              id: 'file-123',
              name: 'test-document.pdf',
              mimeType: 'application/pdf',
              createdTime: '2023-12-25T10:00:00Z',
              modifiedTime: '2023-12-25T10:30:00Z',
              viewedByMe: true,
              trashed: false,
              starred: false,
              shared: false,
            },
          ],
          incompleteSearch: false,
        },
      });

      const args: GoogleDriveArgs = {
        query: 'test-document',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.total_files).toBe(1);
      expect(result.output!.files[0].name).toBe('test-document.pdf');
      expect(result.output!.files[0].mime_type).toBe('application/pdf');
    });

    it('should handle search within specific folder', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [
            {
              id: 'file-456',
              name: 'folder-item.txt',
              mimeType: 'text/plain',
              viewedByMe: false,
              trashed: false,
              starred: false,
              shared: false,
            },
          ],
          incompleteSearch: false,
        },
      });

      const args: GoogleDriveArgs = {
        query: 'item',
        folder_id: 'folder-abc123',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.folder_id).toBe('folder-abc123');
      expect(result.output!.files[0].file_id).toBe('file-456');
    });

    it('should handle multiple file types filtering', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [
            {
              id: 'pdf-file',
              name: 'document.pdf',
              mimeType: 'application/pdf',
              viewedByMe: true,
              trashed: false,
              starred: false,
              shared: false,
            },
            {
              id: 'doc-file',
              name: 'letter.docx',
              mimeType:
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              viewedByMe: false,
              trashed: false,
              starred: false,
              shared: false,
            },
          ],
          incompleteSearch: false,
        },
      });

      const args: GoogleDriveArgs = {
        file_types: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.total_files).toBe(2);
    });

    it('should handle folder identification', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [
            {
              id: 'folder-id',
              name: 'My Folder',
              mimeType: 'application/vnd.google-apps.folder',
              viewedByMe: true,
              trashed: false,
              starred: false,
              shared: false,
            },
          ],
          incompleteSearch: false,
        },
      });

      const args: GoogleDriveArgs = {
        query: 'My Folder',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.files[0].is_folder).toBe(true);
    });

    it('should handle pagination with next_page_token', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [
            {
              id: 'file-1',
              name: 'file1.txt',
              mimeType: 'text/plain',
              viewedByMe: false,
              trashed: false,
              starred: false,
              shared: false,
            },
          ],
          nextPageToken: 'NEXT_PAGE_TOKEN_123',
          incompleteSearch: false,
        },
      });

      const args: GoogleDriveArgs = {
        query: 'file',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.next_page_token).toBe('NEXT_PAGE_TOKEN_123');
    });

    it('should handle date range filtering', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [
            {
              id: 'file-recent',
              name: 'recent-file.txt',
              mimeType: 'text/plain',
              modifiedTime: '2023-12-20T15:00:00Z',
              viewedByMe: false,
              trashed: false,
              starred: false,
              shared: false,
            },
          ],
          incompleteSearch: false,
        },
      });

      const args: GoogleDriveArgs = {
        modified_after: '2023-12-01T00:00:00Z',
        modified_before: '2023-12-31T23:59:59Z',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.total_files).toBe(1);
    });
  });

  describe('Error Handling - Authentication', () => {
    it('should handle missing access token', async () => {
      delete process.env.GOOGLE_ACCESS_TOKEN;

      const args: GoogleDriveArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('access token');
    });

    it('should handle 401 unauthorized error', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 401,
          data: {
            error: { message: 'Invalid credentials' },
          },
        },
      });

      const args: GoogleDriveArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('authentication failed');
    });

    it('should handle 403 forbidden error', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 403,
          data: {
            error: { message: 'Permission denied' },
          },
        },
      });

      const args: GoogleDriveArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('authentication failed');
    });
  });

  describe('Error Handling - Not Found', () => {
    it('should handle 404 folder not found error', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 404,
          data: {
            error: { message: 'File not found' },
          },
        },
      });

      const args: GoogleDriveArgs = {
        folder_id: 'invalid-folder-id',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('not found');
    });
  });

  describe('Error Handling - Rate Limiting', () => {
    it('should handle 429 quota exceeded error', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 429,
          data: {
            error: { message: 'Rate limit exceeded' },
          },
        },
      });

      const args: GoogleDriveArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('quota exceeded');
    });
  });

  describe('Error Handling - Network', () => {
    it('should handle network timeout', async () => {
      mockedAxios.get.mockRejectedValueOnce(
        new Error('timeout of 30000ms exceeded'),
      );

      const args: GoogleDriveArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('timeout');
    });

    it('should handle ECONNREFUSED network error', async () => {
      mockedAxios.get.mockRejectedValueOnce(
        new Error('ECONNREFUSED: Connection refused'),
      );

      const args: GoogleDriveArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Network connectivity');
    });
  });

  describe('Error Handling - API Errors', () => {
    it('should handle generic API error with message', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 500,
          data: {
            error: { message: 'Internal server error' },
          },
        },
      });

      const args: GoogleDriveArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('API error');
    });

    it('should handle unknown error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Unexpected error'));

      const args: GoogleDriveArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Unknown error');
    });
  });

  describe('Response Transformation', () => {
    it('should correctly transform file metadata', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [
            {
              id: 'file-789',
              name: 'document.pdf',
              mimeType: 'application/pdf',
              description: 'Test document',
              size: '1024000',
              createdTime: '2023-12-01T10:00:00Z',
              modifiedTime: '2023-12-25T15:30:00Z',
              owners: [
                { emailAddress: 'owner@example.com', displayName: 'John Doe' },
              ],
              lastModifyingUser: {
                emailAddress: 'editor@example.com',
                displayName: 'Jane Smith',
              },
              webViewLink: 'https://drive.google.com/file/d/file-789/view',
              webContentLink: 'https://drive.google.com/uc?id=file-789',
              fileExtension: 'pdf',
              viewedByMe: true,
              trashed: false,
              starred: true,
              shared: true,
            },
          ],
          incompleteSearch: false,
        },
      });

      const args: GoogleDriveArgs = {
        query: 'document',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(true);
      const file = result.output!.files[0];
      expect(file.file_id).toBe('file-789');
      expect(file.name).toBe('document.pdf');
      expect(file.mime_type).toBe('application/pdf');
      expect(file.description).toBe('Test document');
      expect(file.size_bytes).toBe('1024000');
      expect(file.owner).toBe('owner@example.com');
      expect(file.last_modifying_user).toBe('editor@example.com');
      expect(file.is_starred).toBe(true);
      expect(file.is_shared).toBe(true);
      expect(file.viewed_by_me).toBe(true);
    });

    it('should handle incomplete search flag', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [],
          incompleteSearch: true,
        },
      });

      const args: GoogleDriveArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.incomplete_search).toBe(true);
    });

    it('should handle empty results', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [],
          incompleteSearch: false,
        },
      });

      const args: GoogleDriveArgs = {
        query: 'nonexistent',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.total_files).toBe(0);
      expect(result.output!.files.length).toBe(0);
    });
  });

  describe('Special Cases', () => {
    it('should handle files with owner information', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [
            {
              id: 'file-with-owner',
              name: 'owned-file.txt',
              mimeType: 'text/plain',
              owners: [
                {
                  emailAddress: 'owner1@example.com',
                  displayName: 'Owner One',
                },
                {
                  emailAddress: 'owner2@example.com',
                  displayName: 'Owner Two',
                },
              ],
              viewedByMe: false,
              trashed: false,
              starred: false,
              shared: false,
            },
          ],
          incompleteSearch: false,
        },
      });

      const args: GoogleDriveArgs = {
        query: 'owned-file',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.files[0].owner).toBe('owner1@example.com');
    });

    it('should handle starred and shared file status', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [
            {
              id: 'shared-starred',
              name: 'important.doc',
              mimeType: 'text/plain',
              starred: true,
              shared: true,
              viewedByMe: true,
              trashed: false,
            },
          ],
          incompleteSearch: false,
        },
      });

      const args: GoogleDriveArgs = {
        query: 'important',
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(true);
      const file = result.output!.files[0];
      expect(file.is_starred).toBe(true);
      expect(file.is_shared).toBe(true);
      expect(file.viewed_by_me).toBe(true);
    });

    it('should include order_by parameter in request', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [],
          incompleteSearch: false,
        },
      });

      const args: GoogleDriveArgs = {
        order_by: 'name',
      };

      await retriever.execute({ name: 'google-drive-retriever', args });

      expect(mockedAxios.get).toHaveBeenCalled();
      const callArgs = mockedAxios.get.mock.calls[0];
      expect(callArgs[1]?.params?.orderBy).toContain('name');
    });

    it('should handle trash parameter correctly', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          files: [
            {
              id: 'trashed-file',
              name: 'deleted.txt',
              mimeType: 'text/plain',
              trashed: true,
              viewedByMe: false,
              starred: false,
              shared: false,
            },
          ],
          incompleteSearch: false,
        },
      });

      const args: GoogleDriveArgs = {
        trash: true,
      };

      const result = await retriever.execute({
        name: 'google-drive-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.files[0].is_trashed).toBe(true);
    });
  });
});
