import { NodeFileSystemAdapter } from '../../../infrastructure/adapters/filesystem.adapter';
import { ILogger } from '../../../domain/ports';
import * as fs from 'fs/promises';

jest.mock('fs/promises');

describe('NodeFileSystemAdapter', () => {
  let adapter: NodeFileSystemAdapter;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as jest.Mocked<ILogger>;

    adapter = new NodeFileSystemAdapter(mockLogger);
    jest.clearAllMocks();
  });

  describe('writeFile', () => {
    it('should write file successfully', async () => {
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await adapter.writeFile('/test/file.txt', 'content');

      expect(fs.writeFile).toHaveBeenCalledWith('/test/file.txt', 'content', 'utf-8');
    });

    it('should write buffer data', async () => {
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      const buffer = Buffer.from('data');

      await adapter.writeFile('/test/file.bin', buffer);

      expect(fs.writeFile).toHaveBeenCalledWith('/test/file.bin', buffer, 'utf-8');
    });
  });

  describe('readFile', () => {
    it('should read file as buffer', async () => {
      const buffer = Buffer.from('content');
      (fs.readFile as jest.Mock).mockResolvedValue(buffer);

      const result = await adapter.readFile('/test/file.txt');

      expect(result).toEqual(buffer);
      expect(fs.readFile).toHaveBeenCalledWith('/test/file.txt');
    });
  });

  describe('mkdir', () => {
    it('should create directory recursively', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      await adapter.mkdir('/test/deep/dir');

      expect(fs.mkdir).toHaveBeenCalledWith('/test/deep/dir', { recursive: true });
    });
  });

  describe('rmdir', () => {
    it('should remove directory recursively', async () => {
      (fs.rm as jest.Mock).mockResolvedValue(undefined);

      await adapter.rmdir('/test/dir');

      expect(fs.rm).toHaveBeenCalledWith('/test/dir', { recursive: true, force: true });
    });
  });

  describe('exists', () => {
    it('should return true if file exists', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await adapter.exists('/test/file.txt');

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should return false if file does not exist', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      const result = await adapter.exists('/test/missing.txt');

      expect(result).toBe(false);
    });
  });

  describe('readdir', () => {
    it('should list directory contents', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue(['file1.txt', 'file2.txt']);

      const result = await adapter.readdir('/test/dir');

      expect(result).toEqual(['file1.txt', 'file2.txt']);
      expect(fs.readdir).toHaveBeenCalledWith('/test/dir');
    });
  });

  describe('delete', () => {
    it('should delete file', async () => {
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await adapter.delete('/test/file.txt');

      expect(fs.unlink).toHaveBeenCalledWith('/test/file.txt');
    });
  });
});
