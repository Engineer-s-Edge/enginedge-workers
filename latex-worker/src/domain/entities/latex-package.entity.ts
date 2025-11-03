/**
 * LaTeXPackage Entity
 *
 * Represents a LaTeX package with caching information.
 * Used for package management and caching to speed up compilation.
 */

export enum PackageStatus {
  AVAILABLE = 'available', // Available in TeX Live
  INSTALLED = 'installed', // Installed and cached
  MISSING = 'missing', // Not available
  FAILED = 'failed', // Installation failed
}

export interface PackageMetadata {
  description?: string;
  version?: string;
  dependencies?: string[];
  files?: string[];
  size?: number; // Size in bytes
}

export class LaTeXPackage {
  constructor(
    public readonly name: string,
    public readonly status: PackageStatus,
    public readonly metadata: PackageMetadata,
    public readonly installedAt: Date | null,
    public readonly lastUsedAt: Date | null,
  ) {}

  /**
   * Create a new package reference
   */
  static create(name: string): LaTeXPackage {
    return new LaTeXPackage(name, PackageStatus.AVAILABLE, {}, null, null);
  }

  /**
   * Mark package as installed
   */
  markInstalled(metadata: PackageMetadata = {}): LaTeXPackage {
    return new LaTeXPackage(
      this.name,
      PackageStatus.INSTALLED,
      { ...this.metadata, ...metadata },
      new Date(),
      this.lastUsedAt,
    );
  }

  /**
   * Mark package as missing
   */
  markMissing(): LaTeXPackage {
    return new LaTeXPackage(
      this.name,
      PackageStatus.MISSING,
      this.metadata,
      this.installedAt,
      this.lastUsedAt,
    );
  }

  /**
   * Mark package as failed
   */
  markFailed(): LaTeXPackage {
    return new LaTeXPackage(
      this.name,
      PackageStatus.FAILED,
      this.metadata,
      this.installedAt,
      this.lastUsedAt,
    );
  }

  /**
   * Update last used timestamp
   */
  touch(): LaTeXPackage {
    return new LaTeXPackage(
      this.name,
      this.status,
      this.metadata,
      this.installedAt,
      new Date(),
    );
  }

  /**
   * Check if package is installed
   */
  isInstalled(): boolean {
    return this.status === PackageStatus.INSTALLED;
  }

  /**
   * Check if package needs installation
   */
  needsInstallation(): boolean {
    return (
      this.status === PackageStatus.AVAILABLE ||
      this.status === PackageStatus.MISSING
    );
  }

  /**
   * Get age in days since last use
   */
  getAgeInDays(): number | null {
    if (!this.lastUsedAt) return null;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - this.lastUsedAt.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if package is stale (not used in X days)
   */
  isStale(days: number = 90): boolean {
    const age = this.getAgeInDays();
    return age !== null && age > days;
  }
}
