/**
 * Artifact Search Service
 *
 * Full-text search for artifacts in collective memory.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import { CollectiveArtifact } from '@domain/entities/collective-artifact.entity';

@Injectable()
export class ArtifactSearchService {
  private artifacts = new Map<string, CollectiveArtifact>(); // Key: artifactId

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * Index artifact for search
   */
  indexArtifact(artifact: CollectiveArtifact): void {
    this.artifacts.set(artifact.id, artifact);
  }

  /**
   * Search artifacts
   */
  async search(
    query: string,
    options: {
      collectiveId?: string;
      taskId?: string;
      type?: string;
      tags?: string[];
      limit?: number;
    } = {},
  ): Promise<CollectiveArtifact[]> {
    const queryLower = query.toLowerCase();
    const results: CollectiveArtifact[] = [];

    for (const artifact of this.artifacts.values()) {
      // Filter by collective
      if (
        options.collectiveId &&
        artifact.collectiveId !== options.collectiveId
      ) {
        continue;
      }

      // Filter by task
      if (options.taskId && artifact.taskId !== options.taskId) {
        continue;
      }

      // Filter by type
      if (options.type && artifact.type !== options.type) {
        continue;
      }

      // Filter by tags
      if (options.tags && options.tags.length > 0) {
        const hasMatchingTag = options.tags.some((tag) =>
          artifact.tags.includes(tag),
        );
        if (!hasMatchingTag) {
          continue;
        }
      }

      // Search in content
      const searchableText =
        `${artifact.name} ${artifact.description || ''} ${artifact.searchableContent}`.toLowerCase();
      if (searchableText.includes(queryLower)) {
        results.push(artifact);
      }
    }

    // Sort by relevance (simple: longer matches first)
    results.sort((a, b) => {
      const aScore = this.calculateRelevance(a, queryLower);
      const bScore = this.calculateRelevance(b, queryLower);
      return bScore - aScore;
    });

    return options.limit ? results.slice(0, options.limit) : results;
  }

  /**
   * Get most accessed artifacts
   */
  async getMostAccessed(
    collectiveId: string,
    limit: number,
  ): Promise<CollectiveArtifact[]> {
    const artifacts = Array.from(this.artifacts.values()).filter(
      (a) => a.collectiveId === collectiveId,
    );

    // Sort by updatedAt (most recently accessed)
    artifacts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return artifacts.slice(0, limit);
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(
    artifact: CollectiveArtifact,
    query: string,
  ): number {
    const searchableText =
      `${artifact.name} ${artifact.description || ''} ${artifact.searchableContent}`.toLowerCase();

    let score = 0;

    // Name matches get highest score
    if (artifact.name.toLowerCase().includes(query)) {
      score += 100;
    }

    // Description matches
    if (artifact.description?.toLowerCase().includes(query)) {
      score += 50;
    }

    // Content matches
    if (artifact.searchableContent.includes(query)) {
      score += 10;
    }

    // Tag matches
    if (artifact.tags.some((tag) => tag.toLowerCase().includes(query))) {
      score += 30;
    }

    return score;
  }
}
