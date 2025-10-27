/**
 * Google Drive Actor - Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GoogleDriveActor, GoogleDriveArgs, GoogleDriveOutput } from '@infrastructure/tools/actors/google-drive.actor';

describe('GoogleDriveActor', () => {
  let actor: GoogleDriveActor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleDriveActor],
    }).compile();

    actor = module.get<GoogleDriveActor>(GoogleDriveActor);
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(actor.name).toBe('google-drive-actor');
      expect(actor.description).toBe('Provides integration with Google Drive API for file management');
    });

    it('should have correct category and auth requirements', () => {
      expect(actor.category).toBeDefined();
      expect(actor.requiresAuth).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should return error when access token is missing', async () => {
      const args: GoogleDriveArgs = {
        operation: 'upload-file',
        fileName: 'test.txt'
      };

      const result = await actor.execute({ name: 'google-drive-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Google Drive access token is required');
      expect(result.error?.name).toBe('AuthenticationError');
    });
  });

  describe('Upload File', () => {
    const validArgs: GoogleDriveArgs = {
      operation: 'upload-file',
      accessToken: 'test-access-token',
      fileName: 'document.pdf',
      fileContent: 'JVBERi0xLjQK...', // Mock base64 content
      mimeType: 'application/pdf',
      parentId: 'folder-123'
    };

    it('should upload a file successfully', async () => {
      const result = await actor.execute({ name: 'google-drive-actor', args: validArgs as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as GoogleDriveOutput).operation).toBe('upload-file');
      expect((result.output as GoogleDriveOutput).fileId).toMatch(/^file-\d+$/);
      expect((result.output as GoogleDriveOutput).webViewLink).toContain('https://drive.google.com/file/d/');
    });

    it('should return error when fileName is missing', async () => {
      const args: GoogleDriveArgs = {
        operation: 'upload-file',
        accessToken: 'test-access-token',
        fileContent: 'JVBERi0xLjQK...'
      };

      const result = await actor.execute({ name: 'google-drive-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('File name and content are required for file upload');
      expect(result.error?.name).toBe('ValidationError');
    });

    it('should return error when fileContent is missing', async () => {
      const args: GoogleDriveArgs = {
        operation: 'upload-file',
        accessToken: 'test-access-token',
        fileName: 'document.pdf'
      };

      const result = await actor.execute({ name: 'google-drive-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('File name and content are required for file upload');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Download File', () => {
    it('should download a file successfully', async () => {
      const args: GoogleDriveArgs = {
        operation: 'download-file',
        accessToken: 'test-access-token',
        fileId: 'file-123'
      };

      const result = await actor.execute({ name: 'google-drive-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as GoogleDriveOutput).operation).toBe('download-file');
      expect((result.output as GoogleDriveOutput).fileContent).toBe('SGVsbG8gV29ybGQ=');
      expect((result.output as GoogleDriveOutput).mimeType).toBe('text/plain');
    });

    it('should return error when fileId is missing', async () => {
      const args: GoogleDriveArgs = {
        operation: 'download-file',
        accessToken: 'test-access-token'
      };

      const result = await actor.execute({ name: 'google-drive-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('File ID is required for file download');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('List Files', () => {
    it('should list files successfully', async () => {
      const args: GoogleDriveArgs = {
        operation: 'list-files',
        accessToken: 'test-access-token',
        folderId: 'folder-123',
        query: "mimeType='application/pdf'",
        pageSize: 50
      };

      const result = await actor.execute({ name: 'google-drive-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as GoogleDriveOutput).operation).toBe('list-files');
      expect((result.output as GoogleDriveOutput).files).toBeDefined();
      expect(Array.isArray((result.output as GoogleDriveOutput).files)).toBe(true);
      expect((result.output as GoogleDriveOutput).files!.length).toBeGreaterThan(0);
    });
  });

  describe('Delete File', () => {
    it('should delete a file successfully', async () => {
      const args: GoogleDriveArgs = {
        operation: 'delete-file',
        accessToken: 'test-access-token',
        fileId: 'file-123'
      };

      const result = await actor.execute({ name: 'google-drive-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as GoogleDriveOutput).operation).toBe('delete-file');
      expect((result.output as GoogleDriveOutput).deleted).toBe(true);
    });

    it('should return error when fileId is missing', async () => {
      const args: GoogleDriveArgs = {
        operation: 'delete-file',
        accessToken: 'test-access-token'
      };

      const result = await actor.execute({ name: 'google-drive-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('File ID is required for file deletion');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Create Folder', () => {
    it('should create a folder successfully', async () => {
      const args: GoogleDriveArgs = {
        operation: 'create-folder',
        accessToken: 'test-access-token',
        folderName: 'New Folder',
        parentId: 'root'
      };

      const result = await actor.execute({ name: 'google-drive-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as GoogleDriveOutput).operation).toBe('create-folder');
      expect((result.output as GoogleDriveOutput).fileId).toMatch(/^folder-\d+$/);
      expect((result.output as GoogleDriveOutput).webViewLink).toContain('https://drive.google.com/drive/folders/');
    });

    it('should return error when folderName is missing', async () => {
      const args: GoogleDriveArgs = {
        operation: 'create-folder',
        accessToken: 'test-access-token'
      };

      const result = await actor.execute({ name: 'google-drive-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Folder name is required for folder creation');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Get File Metadata', () => {
    it('should get file metadata successfully', async () => {
      const args: GoogleDriveArgs = {
        operation: 'get-file-metadata',
        accessToken: 'test-access-token',
        fileId: 'file-123'
      };

      const result = await actor.execute({ name: 'google-drive-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as GoogleDriveOutput).operation).toBe('get-file-metadata');
      expect((result.output as GoogleDriveOutput).metadata).toBeDefined();
      const metadata = (result.output as GoogleDriveOutput).metadata as { id: string; name: string };
      expect(metadata.id).toBe('file-123');
      expect(metadata.name).toBe('Sample Document.pdf');
    });

    it('should return error when fileId is missing', async () => {
      const args: GoogleDriveArgs = {
        operation: 'get-file-metadata',
        accessToken: 'test-access-token'
      };

      const result = await actor.execute({ name: 'google-drive-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('File ID is required for metadata retrieval');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Error Handling', () => {
    it('should return error for unsupported operation', async () => {
      const args = {
        operation: 'invalid-operation' as unknown as 'upload-file',
        accessToken: 'test-access-token'
      };

      const result = await actor.execute({ name: 'google-drive-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Unsupported operation: invalid-operation');
      expect(result.error?.name).toBe('ValidationError');
    });
  });
});