/**
 * PackageManagerService (Application Layer)
 *
 * Manages LaTeX packages with caching to MongoDB.
 * Uses tlmgr (TeX Live Manager) for package installation.
 */

import { Injectable, Inject } from '@nestjs/common';
import { spawn } from 'child_process';
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
    this.logger.log(
      `Installing package: ${packageName}`,
      'PackageManagerService',
    );

    // Check cache first
    const cached = await this.cacheRepo.findByName(packageName);
    if (cached && cached.isInstalled()) {
      this.logger.log(
        `Package ${packageName} already installed (cached)`,
        'PackageManagerService',
      );
      await this.cacheRepo.touch(packageName);
      return cached;
    }

    // Check if it's a common package (assume installed)
    if (this.commonPackages.has(packageName)) {
      const pkg = LaTeXPackage.create(packageName).markInstalled({
        description: 'Common LaTeX package (pre-installed)',
      });
      await this.cacheRepo.save(pkg);
      this.logger.log(
        `Package ${packageName} is pre-installed`,
        'PackageManagerService',
      );
      return pkg;
    }

    try {
      this.logger.log(
        `Installing ${packageName} via tlmgr...`,
        'PackageManagerService',
      );

      // Execute tlmgr install command
      const result = await this.executeCommand('tlmgr', [
        'install',
        '--no-depends-at-all',
        packageName,
      ]);

      if (result.exitCode !== 0) {
        throw new Error(`tlmgr install failed: ${result.stderr}`);
      }

      // Extract version from output if available
      const versionMatch = result.stdout.match(/version\s+([^\s]+)/i);
      const version = versionMatch ? versionMatch[1] : '1.0.0';

      const pkg = LaTeXPackage.create(packageName).markInstalled({
        description: `Installed via tlmgr`,
        version,
      });

      await this.cacheRepo.save(pkg);
      this.logger.log(
        `Successfully installed: ${packageName}`,
        'PackageManagerService',
      );
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

    // Check via kpsewhich command
    try {
      const result = await this.executeCommand('kpsewhich', [
        `-format=tex`,
        `${packageName}.sty`,
      ]);
      return result.exitCode === 0 && result.stdout.trim().length > 0;
    } catch {
      return false;
    }
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

    // Query tlmgr for package info
    try {
      const result = await this.executeCommand('tlmgr', [
        'info',
        '--only-installed',
        packageName,
      ]);

      if (result.exitCode === 0 && result.stdout.includes(packageName)) {
        // Parse package info from tlmgr output
        const lines = result.stdout.split('\n');
        const versionMatch = lines
          .find((line) => line.includes('revision'))
          ?.match(/revision\s+(\d+)/i);
        const version = versionMatch ? versionMatch[1] : '1.0.0';

        const pkg = LaTeXPackage.create(packageName).markInstalled({
          description: 'Installed via tlmgr',
          version,
        });
        await this.cacheRepo.save(pkg);
        return pkg;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to query package info for ${packageName}`,
        'PackageManagerService',
      );
    }

    return null;
  }

  /**
   * Search for packages
   */
  async search(query: string): Promise<string[]> {
    this.logger.log(`Searching packages: ${query}`, 'PackageManagerService');

    try {
      const result = await this.executeCommand('tlmgr', [
        'search',
        '--global',
        '--word',
        query,
      ]);

      if (result.exitCode === 0) {
        // Parse package names from tlmgr search output
        const lines = result.stdout.split('\n');
        const packages = lines
          .filter((line) => line.trim().length > 0)
          .map((line) => {
            const match = line.match(/^([^\s:]+)/);
            return match ? match[1] : null;
          })
          .filter((pkg): pkg is string => pkg !== null);

        // Combine with common packages
        const commonMatches = Array.from(this.commonPackages).filter((pkg) =>
          pkg.includes(query.toLowerCase()),
        );

        return [...new Set([...commonMatches, ...packages])];
      }
    } catch (error) {
      this.logger.warn(
        `Failed to search packages: ${error instanceof Error ? error.message : String(error)}`,
        'PackageManagerService',
      );
    }

    // Fallback to common packages
    return Array.from(this.commonPackages).filter((pkg) =>
      pkg.includes(query.toLowerCase()),
    );
  }

  /**
   * Update package cache (run tlmgr update)
   */
  async updateCache(): Promise<void> {
    this.logger.log('Updating package cache...', 'PackageManagerService');

    try {
      // Update tlmgr itself first
      await this.executeCommand('tlmgr', ['update', '--self']);

      // Update all packages
      await this.executeCommand('tlmgr', ['update', '--all']);

      this.logger.log(
        'Package cache updated successfully',
        'PackageManagerService',
      );
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

  /**
   * Execute a shell command
   */
  private async executeCommand(
    command: string,
    args: string[],
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }
}
