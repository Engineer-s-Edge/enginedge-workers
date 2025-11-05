/**
 * Artifact Versioning Service
 *
 * Manages artifact version history and rollback capabilities.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import { CollectiveArtifact } from '@domain/entities/collective-artifact.entity';

@Injectable()
export class ArtifactVersioningService {
  private artifactVersions = new Map<string, CollectiveArtifact[]>(); // Key: artifactId

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * Create new version of artifact
   */
  createVersion(artifact: CollectiveArtifact): CollectiveArtifact {
    const versions = this.artifactVersions.get(artifact.id) || [];

    // Store previous version
    if (versions.length > 0) {
      artifact.previousVersionId = versions[versions.length - 1].id;
    }

    // Create new version
    const newVersion: CollectiveArtifact = {
      ...artifact,
      id: `${artifact.id}_v${artifact.version + 1}`,
      version: artifact.version + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    versions.push(newVersion);
    this.artifactVersions.set(artifact.id, versions);

    this.logger.info(`Created version ${newVersion.version} of artifact ${artifact.id}`, {});

    return newVersion;
  }

  /**
   * Get version history
   */
  getVersionHistory(artifactId: string): CollectiveArtifact[] {
    return this.artifactVersions.get(artifactId) || [];
  }

  /**
   * Get specific version
   */
  getVersion(artifactId: string, version: number): CollectiveArtifact | null {
    const versions = this.artifactVersions.get(artifactId) || [];
    return versions.find((v) => v.version === version) || null;
  }

  /**
   * Get latest version
   */
  getLatestVersion(artifactId: string): CollectiveArtifact | null {
    const versions = this.artifactVersions.get(artifactId) || [];
    return versions.length > 0 ? versions[versions.length - 1] : null;
  }
}
