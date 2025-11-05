/**
 * Shared Memory Service
 *
 * Orchestrates collective knowledge and provides context retrieval for agents.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import { CollectiveArtifact } from '@domain/entities/collective-artifact.entity';
import { CollectiveTask } from '@domain/entities/collective-task.entity';
import { ArtifactLockingService } from './artifact-locking.service';
import { ArtifactVersioningService } from './artifact-versioning.service';
import { ArtifactSearchService } from './artifact-search.service';

export interface TaskContext {
  task: CollectiveTask;
  relatedArtifacts: CollectiveArtifact[];
  parentTask?: CollectiveTask;
  childTasks: CollectiveTask[];
  dependencyTasks: CollectiveTask[];
}

export interface CollectiveMemory {
  totalArtifacts: number;
  byType: Record<string, number>;
  knowledgeAreas: string[];
  knowledgeGaps: string[];
  frequentlyAccessed: CollectiveArtifact[];
  recentActivity: Array<{
    artifactId: string;
    updatedAt: Date;
    updatedBy: string;
  }>;
}

@Injectable()
export class SharedMemoryService {
  private artifacts = new Map<string, CollectiveArtifact>();
  private tasks = new Map<string, CollectiveTask>();

  constructor(
    private readonly lockingService: ArtifactLockingService,
    private readonly versioningService: ArtifactVersioningService,
    private readonly searchService: ArtifactSearchService,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * Create or update artifact
   */
  async createArtifact(
    artifact: CollectiveArtifact,
  ): Promise<CollectiveArtifact> {
    // Acquire write lock
    const lockToken = await this.lockingService.acquireLock(
      artifact.id,
      artifact.createdBy,
      'WRITE' as any,
      artifact.collectiveId,
    );

    if (!lockToken) {
      throw new Error(`Failed to acquire lock on artifact ${artifact.id}`);
    }

    try {
      // Create new version if artifact exists
      const existing = this.artifacts.get(artifact.id);
      if (existing) {
        this.versioningService.createVersion(existing);
      }

      // Store artifact
      this.artifacts.set(artifact.id, artifact);
      this.searchService.indexArtifact(artifact);

      this.logger.info(`Created artifact ${artifact.id}`, {});
      return artifact;
    } finally {
      await this.lockingService.releaseLock(artifact.id, lockToken);
    }
  }

  /**
   * Get artifact
   */
  async getArtifact(artifactId: string): Promise<CollectiveArtifact | null> {
    return this.artifacts.get(artifactId) || null;
  }

  /**
   * Get context for a specific task
   */
  async getTaskContext(
    collectiveId: string,
    taskId: string,
  ): Promise<TaskContext> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Find related artifacts
    const relatedArtifacts = await this.searchService.search(task.description, {
      collectiveId,
      taskId,
      limit: 10,
    });

    // Get parent and child tasks
    const parentTask = task.parentTaskId
      ? this.tasks.get(task.parentTaskId)
      : undefined;
    const childTasks = Array.from(this.tasks.values()).filter(
      (t) => t.parentTaskId === taskId,
    );

    // Get dependency tasks
    const dependencyTasks = task.dependencies
      .map((depId) => this.tasks.get(depId))
      .filter((t): t is CollectiveTask => t !== undefined);

    return {
      task,
      relatedArtifacts,
      parentTask,
      childTasks,
      dependencyTasks,
    };
  }

  /**
   * Get collective memory summary
   */
  async getCollectiveMemory(collectiveId: string): Promise<CollectiveMemory> {
    const artifacts = Array.from(this.artifacts.values()).filter(
      (a) => a.collectiveId === collectiveId,
    );

    // Organize by type
    const byType: Record<string, number> = {};
    for (const artifact of artifacts) {
      byType[artifact.type] = (byType[artifact.type] || 0) + 1;
    }

    // Identify knowledge areas (from tags)
    const knowledgeAreas = Array.from(
      new Set(artifacts.flatMap((a) => a.tags)),
    );

    // Get frequently accessed
    const frequentlyAccessed = await this.searchService.getMostAccessed(
      collectiveId,
      10,
    );

    // Recent activity
    const recentActivity = artifacts
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 10)
      .map((a) => ({
        artifactId: a.id,
        updatedAt: a.updatedAt,
        updatedBy: a.createdBy,
      }));

    return {
      totalArtifacts: artifacts.length,
      byType,
      knowledgeAreas,
      knowledgeGaps: [], // TODO: Implement gap detection
      frequentlyAccessed,
      recentActivity,
    };
  }

  /**
   * Store task
   */
  storeTask(task: CollectiveTask): void {
    this.tasks.set(task.id, task);
  }

  /**
   * Get task
   */
  getTask(taskId: string): CollectiveTask | null {
    return this.tasks.get(taskId) || null;
  }
}
