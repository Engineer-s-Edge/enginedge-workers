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
import {
  ArtifactLockingService,
  ArtifactLockInfo,
} from './artifact-locking.service';
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

  getArtifactVersions(artifactId: string): CollectiveArtifact[] {
    return this.versioningService.getVersionHistory(artifactId);
  }

  getArtifactLockInfo(artifactId: string): ArtifactLockInfo | null {
    return this.lockingService.getLockInfo(artifactId);
  }

  async lockArtifact(
    collectiveId: string,
    artifactId: string,
    userId: string,
    lockType: LockType,
    timeoutMs?: number,
  ): Promise<{
    artifact: CollectiveArtifact;
    lock: ArtifactLockInfo;
    lockToken: string;
  }> {
    const artifact = this.requireArtifactInCollective(collectiveId, artifactId);

    const lockToken = await this.lockingService.acquireLock(
      artifactId,
      userId,
      lockType,
      collectiveId,
      timeoutMs,
    );

    if (!lockToken) {
      throw new Error(
        `Unable to acquire ${lockType} lock on artifact ${artifactId}`,
      );
    }

    const lock = this.lockingService.getLockInfo(artifactId);
    if (!lock) {
      throw new Error(`Failed to resolve lock info for artifact ${artifactId}`);
    }

    return {
      artifact,
      lock,
      lockToken,
    };
  }

  async unlockArtifact(
    collectiveId: string,
    artifactId: string,
    userId: string,
    lockToken?: string,
  ): Promise<boolean> {
    this.requireArtifactInCollective(collectiveId, artifactId);

    const lock = this.lockingService.getLockInfo(artifactId);
    if (!lock) {
      return true;
    }

    if (lockToken) {
      if (lock.token !== lockToken) {
        throw new Error('Invalid lock token provided for artifact unlock');
      }
    } else if (lock.agentId !== userId) {
      throw new Error('Artifact is locked by another user');
    }

    return this.lockingService.releaseLock(artifactId, lock.token);
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

    // Detect knowledge gaps
    const knowledgeGaps = this.detectKnowledgeGaps(artifacts, knowledgeAreas);

    return {
      totalArtifacts: artifacts.length,
      byType,
      knowledgeAreas,
      knowledgeGaps,
      frequentlyAccessed,
      recentActivity,
    };
  }

  /**
   * Detect knowledge gaps in the artifact board
   * Identifies areas with insufficient coverage or missing artifacts
   */
  private detectKnowledgeGaps(
    artifacts: CollectiveArtifact[],
    knowledgeAreas: string[],
  ): string[] {
    const gaps: string[] = [];

    // Expected artifact types for a complete knowledge base
    const expectedTypes: ArtifactType[] = [
      ArtifactType.DOCUMENT,
      ArtifactType.CODE,
      ArtifactType.DATA,
      ArtifactType.OTHER, // Using OTHER instead of non-existent ANALYSIS
      ArtifactType.DESIGN,
    ];

    // Check for missing artifact types
    const existingTypes = new Set(artifacts.map((a) => a.type));
    for (const expectedType of expectedTypes) {
      if (!existingTypes.has(expectedType)) {
        gaps.push(`Missing ${expectedType} artifacts`);
      }
    }

    // Check for knowledge areas with very few artifacts
    const artifactsByArea = new Map<string, number>();
    for (const artifact of artifacts) {
      for (const tag of artifact.tags) {
        artifactsByArea.set(tag, (artifactsByArea.get(tag) || 0) + 1);
      }
    }

    // Identify areas with less than 2 artifacts as gaps
    const MIN_ARTIFACTS_PER_AREA = 2;
    for (const [area, count] of artifactsByArea.entries()) {
      if (count < MIN_ARTIFACTS_PER_AREA) {
        gaps.push(`Insufficient coverage in "${area}" (only ${count} artifact(s))`);
      }
    }

    // Check for knowledge areas mentioned in tasks but not covered by artifacts
    const taskAreas = new Set<string>();
    for (const task of this.tasks.values()) {
      // Extract keywords from task description as potential knowledge areas
      const words = task.description
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4); // Filter short words
      words.forEach((word) => taskAreas.add(word));
    }

    // Find task areas not covered by artifacts
    const artifactAreasSet = new Set(knowledgeAreas.map((a) => a.toLowerCase()));
    for (const taskArea of taskAreas) {
      if (!artifactAreasSet.has(taskArea)) {
        gaps.push(`Task area "${taskArea}" lacks artifact coverage`);
      }
    }

    // Check for artifacts that haven't been updated recently (stale knowledge)
    const STALE_THRESHOLD_DAYS = 90;
    const now = new Date();
    const staleArtifacts = artifacts.filter((a) => {
      const daysSinceUpdate =
        (now.getTime() - a.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate > STALE_THRESHOLD_DAYS;
    });

    if (staleArtifacts.length > 0) {
      const staleAreas = new Set(
        staleArtifacts.flatMap((a) => a.tags).filter((tag) => tag),
      );
      if (staleAreas.size > 0) {
        gaps.push(
          `Stale knowledge in: ${Array.from(staleAreas).join(', ')} (${staleArtifacts.length} artifact(s) not updated in ${STALE_THRESHOLD_DAYS}+ days)`,
        );
      }
    }

    // Check for low artifact diversity (all artifacts of same type)
    if (artifacts.length > 0) {
      const typeCounts = new Map<ArtifactType, number>();
      for (const artifact of artifacts) {
        typeCounts.set(
          artifact.type,
          (typeCounts.get(artifact.type) || 0) + 1,
        );
      }

      // If one type dominates (>80%), flag as gap
      const total = artifacts.length;
      for (const [type, count] of typeCounts.entries()) {
        if (count / total > 0.8 && total > 3) {
          gaps.push(
            `Low artifact diversity: ${Math.round((count / total) * 100)}% are ${type} artifacts`,
          );
        }
      }
    }

    this.logger.debug(`Detected ${gaps.length} knowledge gaps`, { gaps });
    return gaps;
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

  /**
   * Remove task from shared memory cache
   */
  removeTask(taskId: string): void {
    this.tasks.delete(taskId);
  }

  private publishArtifactEvent(event: CollectiveArtifactEvent): void {
    this.artifactSubject.next(event);
  }

  private requireArtifactInCollective(
    collectiveId: string,
    artifactId: string,
  ): CollectiveArtifact {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact || artifact.collectiveId !== collectiveId) {
      throw new Error(
        `Artifact ${artifactId} not found in collective ${collectiveId}`,
      );
    }

    return artifact;
  }
}

export interface CollectiveArtifactEvent {
  action: 'created' | 'updated' | 'deleted';
  artifact: CollectiveArtifact;
}
