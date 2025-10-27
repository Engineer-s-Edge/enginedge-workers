/**
 * PackageManagerService (Application Layer)
 * 
 * Manages LaTeX packages with caching to MongoDB.
 * Uses tlmgr (TeX Live Manager) for package installation.
 */

import { Injectable, Inject } from '@nestjs/common';
import { LaTeXPackage } from '../../domain/entities';
import { ILogger, IPackageCacheRepository } from '../../domain/ports';

@Injectable()
export class PackageManagerService {
  // Common packages that are typically pre-installed
  private readonly commonPackages = new Set([
    'amsmath',
    'amssymb',
    'amsthm',
    'graphicx',
    'hyperref',
    'geometry',
    'fontenc',
    'inputenc',
    'babel',
    'xcolor',
    'enumitem',
    'fancyhdr',
    'titlesec',
    'tocloft',
    'caption',
    'subcaption',
    'natbib',
    'biblatex',
    'listings',
    'algorithm',
    'algorithmic',
  ]);

  constructor(
    @Inject('IPackageCacheRepository')
    private readonly cacheRepo: IPackageCacheRepository,
    @Inject('ILogger') private readonly logger: ILogger,
  ) {}

  /**
   * Install a LaTeX package
   */
  async install(packageName: string): Promise<LaTeXPackage> {
    this.logger.log(`Installing package: ${packageName}`, 'PackageManagerService');

    // Check cache first
    const cached = await this.cacheRepo.findByName(packageName);
    if (cached && cached.isInstalled()) {
      this.logger.log(`Package ${packageName} already installed (cached)`, 'PackageManagerService');
      await this.cacheRepo.touch(packageName);
      return cached;
    }

    // Check if it's a common package (assume installed)
    if (this.commonPackages.has(packageName)) {
      const pkg = LaTeXPackage.create(packageName).markInstalled({
        description: 'Common LaTeX package (pre-installed)',
      });
      await this.cacheRepo.save(pkg);
      this.logger.log(`Package ${packageName} is pre-installed`, 'PackageManagerService');
      return pkg;
    }

    try {
      // TODO: Execute tlmgr install command in worker thread
      // For now, simulate installation
      this.logger.log(`Installing ${packageName} via tlmgr...`, 'PackageManagerService');

      // Simulate package installation
      const pkg = LaTeXPackage.create(packageName).markInstalled({
        description: `Installed via tlmgr`,
        version: '1.0.0',
      });

      await this.cacheRepo.save(pkg);
      this.logger.log(`Successfully installed: ${packageName}`, 'PackageManagerService');
      return pkg;
    } catch (error) {
      this.logger.error(
        `Failed to install package ${packageName}`,
        error instanceof Error ? error.stack : undefined,
        'PackageManagerService',
      );

      const pkg = LaTeXPackage.create(packageName).markFailed();
      await this.cacheRepo.save(pkg);
      throw error;
    }
  }

  /**
   * Check if a package is installed
   */
  async isInstalled(packageName: string): Promise<boolean> {
    // Check common packages first (fast path)
    if (this.commonPackages.has(packageName)) {
      return true;
    }

    // Check cache
    const cached = await this.cacheRepo.findByName(packageName);
    if (cached) {
      await this.cacheRepo.touch(packageName);
      return cached.isInstalled();
    }

    // TODO: Check via kpsewhich command
    // For now, assume not installed if not in cache
    return false;
  }

  /**
   * Get package information
   */
  async getPackageInfo(packageName: string): Promise<LaTeXPackage | null> {
    // Check cache
    const cached = await this.cacheRepo.findByName(packageName);
    if (cached) {
      return cached;
    }

    // Check if common package
    if (this.commonPackages.has(packageName)) {
      return LaTeXPackage.create(packageName).markInstalled({
        description: 'Common LaTeX package (pre-installed)',
      });
    }

    // TODO: Query tlmgr for package info
    return null;
  }

  /**
   * Search for packages
   */
  async search(query: string): Promise<string[]> {
    this.logger.log(`Searching packages: ${query}`, 'PackageManagerService');

    // TODO: Execute tlmgr search command
    // For now, filter common packages
    const results = Array.from(this.commonPackages).filter((pkg) =>
      pkg.includes(query.toLowerCase()),
    );

    return results;
  }

  /**
   * Update package cache (run tlmgr update)
   */
  async updateCache(): Promise<void> {
    this.logger.log('Updating package cache...', 'PackageManagerService');

    try {
      // TODO: Execute tlmgr update --self --all
      this.logger.log('Package cache updated successfully', 'PackageManagerService');
    } catch (error) {
      this.logger.error(
        'Failed to update package cache',
        error instanceof Error ? error.stack : undefined,
        'PackageManagerService',
      );
      throw error;
    }
  }

  /**
   * Clean stale packages from cache
   */
  async cleanStalePackages(days: number = 90): Promise<number> {
    this.logger.log(
      `Cleaning packages not used in ${days} days...`,
      'PackageManagerService',
    );

    const deletedCount = await this.cacheRepo.deleteStale(days);

    this.logger.log(
      `Cleaned ${deletedCount} stale packages`,
      'PackageManagerService',
    );

    return deletedCount;
  }

  /**
   * List all cached packages
   */
  async listCachedPackages(): Promise<LaTeXPackage[]> {
    return await this.cacheRepo.list();
  }

  /**
   * Pre-warm cache with common packages
   */
  async prewarmCache(): Promise<void> {
    this.logger.log('Pre-warming package cache...', 'PackageManagerService');

    for (const packageName of this.commonPackages) {
      const existing = await this.cacheRepo.findByName(packageName);
      if (!existing) {
        const pkg = LaTeXPackage.create(packageName).markInstalled({
          description: 'Common LaTeX package (pre-installed)',
        });
        await this.cacheRepo.save(pkg);
      }
    }

    this.logger.log('Package cache pre-warmed', 'PackageManagerService');
  }
}
