import { PackageManagerService } from '../../../application/services/package-manager.service';
import { ILogger, IPackageCacheRepository } from '../../../domain/ports';
import { LaTeXPackage } from '../../../domain/entities';

describe('PackageManagerService', () => {
  let service: PackageManagerService;
  let mockCacheRepo: jest.Mocked<IPackageCacheRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockCacheRepo = {
      findByName: jest.fn(),
      save: jest.fn(),
      touch: jest.fn(),
      list: jest.fn(),
      deleteStale: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IPackageCacheRepository>;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as jest.Mocked<ILogger>;

    service = new PackageManagerService(mockCacheRepo, mockLogger);
  });

  describe('install', () => {
    it('should return cached package if already installed', async () => {
      const cachedPackage = LaTeXPackage.create('test-package').markInstalled({
        description: 'Test package',
      });
      mockCacheRepo.findByName.mockResolvedValue(cachedPackage);
      mockCacheRepo.touch.mockResolvedValue(undefined);

      const result = await service.install('test-package');

      expect(result).toBe(cachedPackage);
      expect(mockCacheRepo.findByName).toHaveBeenCalledWith('test-package');
      expect(mockCacheRepo.touch).toHaveBeenCalledWith('test-package');
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('already installed'),
        'PackageManagerService',
      );
    });

    it('should handle common packages as pre-installed', async () => {
      mockCacheRepo.findByName.mockResolvedValue(null);
      mockCacheRepo.save.mockResolvedValue(undefined);

      const result = await service.install('amsmath');

      expect(result.name).toBe('amsmath');
      expect(result.isInstalled()).toBe(true);
      expect(mockCacheRepo.save).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('pre-installed'),
        'PackageManagerService',
      );
    });

    it('should install a new package', async () => {
      mockCacheRepo.findByName.mockResolvedValue(null);
      mockCacheRepo.save.mockResolvedValue(undefined);

      const result = await service.install('custom-package');

      expect(result.name).toBe('custom-package');
      expect(result.isInstalled()).toBe(true);
      expect(mockCacheRepo.save).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Successfully installed'),
        'PackageManagerService',
      );
    });

    it('should mark package as failed on installation error', async () => {
      mockCacheRepo.findByName.mockResolvedValue(null);
      mockCacheRepo.save.mockRejectedValueOnce(
        new Error('Installation failed'),
      );

      await expect(service.install('broken-package')).rejects.toThrow(
        'Installation failed',
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log installation start', async () => {
      mockCacheRepo.findByName.mockResolvedValue(null);
      mockCacheRepo.save.mockResolvedValue(undefined);

      await service.install('new-package');

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Installing package: new-package'),
        'PackageManagerService',
      );
    });

    it('should handle graphicx as common package', async () => {
      mockCacheRepo.findByName.mockResolvedValue(null);
      mockCacheRepo.save.mockResolvedValue(undefined);

      const result = await service.install('graphicx');

      expect(result.name).toBe('graphicx');
      expect(result.isInstalled()).toBe(true);
    });

    it('should handle hyperref as common package', async () => {
      mockCacheRepo.findByName.mockResolvedValue(null);
      mockCacheRepo.save.mockResolvedValue(undefined);

      const result = await service.install('hyperref');

      expect(result.name).toBe('hyperref');
      expect(result.isInstalled()).toBe(true);
    });
  });

  describe('isInstalled', () => {
    it('should return true for common packages', async () => {
      const result = await service.isInstalled('amsmath');

      expect(result).toBe(true);
      expect(mockCacheRepo.findByName).not.toHaveBeenCalled();
    });

    it('should check cache for non-common packages', async () => {
      const cachedPackage = LaTeXPackage.create('custom-pkg').markInstalled({});
      mockCacheRepo.findByName.mockResolvedValue(cachedPackage);
      mockCacheRepo.touch.mockResolvedValue(undefined);

      const result = await service.isInstalled('custom-pkg');

      expect(result).toBe(true);
      expect(mockCacheRepo.findByName).toHaveBeenCalledWith('custom-pkg');
      expect(mockCacheRepo.touch).toHaveBeenCalledWith('custom-pkg');
    });

    it('should return false for non-installed packages', async () => {
      mockCacheRepo.findByName.mockResolvedValue(null);

      const result = await service.isInstalled('unknown-package');

      expect(result).toBe(false);
    });

    it('should return false for cached but failed packages', async () => {
      const failedPackage = LaTeXPackage.create('broken-pkg').markFailed();
      mockCacheRepo.findByName.mockResolvedValue(failedPackage);
      mockCacheRepo.touch.mockResolvedValue(undefined);

      const result = await service.isInstalled('broken-pkg');

      expect(result).toBe(false);
    });
  });

  describe('getPackageInfo', () => {
    it('should return cached package info', async () => {
      const cachedPackage = LaTeXPackage.create('test-pkg').markInstalled({
        description: 'Test package description',
      });
      mockCacheRepo.findByName.mockResolvedValue(cachedPackage);

      const result = await service.getPackageInfo('test-pkg');

      expect(result).toBe(cachedPackage);
    });

    it('should return info for common packages', async () => {
      mockCacheRepo.findByName.mockResolvedValue(null);

      const result = await service.getPackageInfo('amsmath');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('amsmath');
      expect(result?.isInstalled()).toBe(true);
    });

    it('should return null for unknown packages', async () => {
      mockCacheRepo.findByName.mockResolvedValue(null);

      const result = await service.getPackageInfo('unknown-pkg');

      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('should search and return matching common packages', async () => {
      const results = await service.search('ams');

      expect(results).toContain('amsmath');
      expect(results).toContain('amssymb');
      expect(results).toContain('amsthm');
    });

    it('should return empty array for no matches', async () => {
      const results = await service.search('nonexistent-xyz-123');

      expect(results).toEqual([]);
    });

    it('should be case-insensitive', async () => {
      const results = await service.search('AMS');

      expect(results.length).toBeGreaterThan(0);
      expect(results).toContain('amsmath');
    });

    it('should log search query', async () => {
      await service.search('test');

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Searching packages: test'),
        'PackageManagerService',
      );
    });
  });

  describe('updateCache', () => {
    it('should update cache successfully', async () => {
      await service.updateCache();

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Updating package cache'),
        'PackageManagerService',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('updated successfully'),
        'PackageManagerService',
      );
    });
  });

  describe('cleanStalePackages', () => {
    it('should clean stale packages with default days', async () => {
      mockCacheRepo.deleteStale.mockResolvedValue(5);

      const result = await service.cleanStalePackages();

      expect(result).toBe(5);
      expect(mockCacheRepo.deleteStale).toHaveBeenCalledWith(90);
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned 5 stale packages'),
        'PackageManagerService',
      );
    });

    it('should clean stale packages with custom days', async () => {
      mockCacheRepo.deleteStale.mockResolvedValue(3);

      const result = await service.cleanStalePackages(30);

      expect(result).toBe(3);
      expect(mockCacheRepo.deleteStale).toHaveBeenCalledWith(30);
    });

    it('should handle zero stale packages', async () => {
      mockCacheRepo.deleteStale.mockResolvedValue(0);

      const result = await service.cleanStalePackages();

      expect(result).toBe(0);
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned 0 stale packages'),
        'PackageManagerService',
      );
    });
  });

  describe('listCachedPackages', () => {
    it('should return all cached packages', async () => {
      const packages = [
        LaTeXPackage.create('pkg1').markInstalled({}),
        LaTeXPackage.create('pkg2').markInstalled({}),
        LaTeXPackage.create('pkg3').markInstalled({}),
      ];
      mockCacheRepo.list.mockResolvedValue(packages);

      const result = await service.listCachedPackages();

      expect(result).toEqual(packages);
      expect(result.length).toBe(3);
    });

    it('should return empty array when cache is empty', async () => {
      mockCacheRepo.list.mockResolvedValue([]);

      const result = await service.listCachedPackages();

      expect(result).toEqual([]);
    });
  });

  describe('prewarmCache', () => {
    it('should pre-warm cache with common packages', async () => {
      mockCacheRepo.findByName.mockResolvedValue(null);
      mockCacheRepo.save.mockResolvedValue(undefined);

      await service.prewarmCache();

      // Should save multiple common packages
      expect(mockCacheRepo.save).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Pre-warming package cache'),
        'PackageManagerService',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Package cache pre-warmed'),
        'PackageManagerService',
      );
    });

    it('should skip existing packages in cache', async () => {
      const existingPackage = LaTeXPackage.create('amsmath').markInstalled({});
      mockCacheRepo.findByName.mockResolvedValue(existingPackage);

      await service.prewarmCache();

      // Should not save packages that already exist
      expect(mockCacheRepo.save).not.toHaveBeenCalled();
    });

    it('should handle mixed existing and new packages', async () => {
      mockCacheRepo.findByName.mockImplementation(async (name) => {
        if (name === 'amsmath') {
          return LaTeXPackage.create('amsmath').markInstalled({});
        }
        return null;
      });
      mockCacheRepo.save.mockResolvedValue(undefined);

      await service.prewarmCache();

      // Should save only packages not in cache
      expect(mockCacheRepo.save).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty package names', async () => {
      mockCacheRepo.findByName.mockResolvedValue(null);
      mockCacheRepo.save.mockResolvedValue(undefined);

      const result = await service.install('');

      expect(result.name).toBe('');
    });

    it('should handle package names with special characters', async () => {
      mockCacheRepo.findByName.mockResolvedValue(null);
      mockCacheRepo.save.mockResolvedValue(undefined);

      const result = await service.install('test-pkg_v2.0');

      expect(result.name).toBe('test-pkg_v2.0');
    });

    it('should handle concurrent install requests', async () => {
      mockCacheRepo.findByName.mockResolvedValue(null);
      mockCacheRepo.save.mockResolvedValue(undefined);

      const [result1, result2, result3] = await Promise.all([
        service.install('pkg1'),
        service.install('pkg2'),
        service.install('pkg3'),
      ]);

      expect(result1.name).toBe('pkg1');
      expect(result2.name).toBe('pkg2');
      expect(result3.name).toBe('pkg3');
    });
  });
});
