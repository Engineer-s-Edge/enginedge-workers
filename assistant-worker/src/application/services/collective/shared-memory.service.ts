/**
 * Shared Memory Service
 *
 * Orchestrates collective knowledge and provides context retrieval for agents.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ILogger } from '@application/ports/logger.port';
import {
  CollectiveArtifact,
  LockType,
  ArtifactType,
} from '@domain/entities/collective-artifact.entity';
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
  private readonly artifactSubject = new Subject<CollectiveArtifactEvent>();

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
      LockType.WRITE,
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

      artifact.searchableContent = this.buildSearchableContent({
        name: artifact.name,
        description: artifact.description,
        content: artifact.content,
      });

    // Store artifact
    this.artifacts.set(artifact.id, artifact);
    this.searchService.indexArtifact(artifact);

    this.publishArtifactEvent({ action: 'created', artifact });

      this.logger.info(`Created artifact ${artifact.id}`, {});
      return artifact;
    } finally {
      await this.lockingService.releaseLock(artifact.id, lockToken);
    }
  }

  private buildSearchableContent(input: {
    name: string;
    description?: string;
    content: string;
  }): string {
    return `${input.name} ${input.description || ''} ${input.content}`.toLowerCase();
  }

  async listArtifacts(
    collectiveId: string,
    options: {
      search?: string;
      type?: ArtifactType;
      tags?: string[];
      taskId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{
    items: CollectiveArtifact[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const offset = Math.max(options.offset ?? 0, 0);

    let artifacts: CollectiveArtifact[];

    if (options.search && options.search.trim().length > 0) {
      artifacts = await this.searchService.search(options.search, {
        collectiveId,
        taskId: options.taskId,
        type: options.type,
        tags: options.tags,
      });
    } else {
      artifacts = Array.from(this.artifacts.values()).filter(
        (artifact) => artifact.collectiveId === collectiveId,
      );

      if (options.taskId) {
        artifacts = artifacts.filter((a) => a.taskId === options.taskId);
      }

      if (options.type) {
        artifacts = artifacts.filter((a) => a.type === options.type);
      }

      if (options.tags && options.tags.length > 0) {
        artifacts = artifacts.filter((artifact) =>
          options.tags?.some((tag) => artifact.tags.includes(tag)),
        );
      }
    }

    artifacts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const total = artifacts.length;
    const items = artifacts.slice(offset, offset + limit);

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  async updateArtifact(
    collectiveId: string,
    artifactId: string,
    userId: string,
    updates: {
      name?: string;
      description?: string;
      content?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
      type?: ArtifactType;
    },
  ): Promise<CollectiveArtifact> {
    const artifact = this.artifacts.get(artifactId);

    if (!artifact || artifact.collectiveId !== collectiveId) {
      throw new Error(`Artifact ${artifactId} not found in collective ${collectiveId}`);
    }

    const lockToken = await this.lockingService.acquireLock(
      artifactId,
      userId,
      LockType.WRITE,
      collectiveId,
    );

    if (!lockToken) {
      throw new Error(`Failed to acquire lock for artifact ${artifactId}`);
    }

    try {
      this.versioningService.createVersion(artifact);

      const updated: CollectiveArtifact = {
        ...artifact,
        name: updates.name ?? artifact.name,
        description: updates.description ?? artifact.description,
        content: updates.content ?? artifact.content,
        tags: updates.tags ?? artifact.tags,
    metadata: updates.metadata ?? artifact.metadata,
    type: updates.type ?? artifact.type,
        version: artifact.version + 1,
        updatedAt: new Date(),
        searchableContent: this.buildSearchableContent({
          name: updates.name ?? artifact.name,
          description: updates.description ?? artifact.description,
          content: updates.content ?? artifact.content,
        }),
        previousVersionId: artifact.id,
        createdBy: artifact.createdBy,
      };

  this.artifacts.set(artifactId, updated);
  this.searchService.indexArtifact(updated);

  this.publishArtifactEvent({ action: 'updated', artifact: updated });

      return updated;
    } finally {
      await this.lockingService.releaseLock(artifactId, lockToken);
    }
  }

  async deleteArtifact(
    collectiveId: string,
    artifactId: string,
    userId: string,
  ): Promise<boolean> {
    const artifact = this.artifacts.get(artifactId);

    if (!artifact || artifact.collectiveId !== collectiveId) {
      throw new Error(`Artifact ${artifactId} not found in collective ${collectiveId}`);
    }

    const lockToken = await this.lockingService.acquireLock(
      artifactId,
      userId,
      LockType.WRITE,
      collectiveId,
    );

    if (!lockToken) {
      throw new Error(`Failed to acquire lock for artifact ${artifactId}`);
    }

    try {
  const snapshot = { ...artifact };
  this.artifacts.delete(artifactId);
  this.searchService.removeArtifact(artifactId);
  this.publishArtifactEvent({ action: 'deleted', artifact: snapshot });
      return true;
    } finally {
      await this.lockingService.releaseLock(artifactId, lockToken);
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

  streamArtifactEvents(collectiveId: string): Observable<CollectiveArtifactEvent> {
    return this.artifactSubject.asObservable().pipe(
      filter((event) => event.artifact.collectiveId === collectiveId),
    );
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

  private publishArtifactEvent(event: CollectiveArtifactEvent): void {
    this.artifactSubject.next(event);
  }
}

export interface CollectiveArtifactEvent {
  action: 'created' | 'updated' | 'deleted';
  artifact: CollectiveArtifact;
}
