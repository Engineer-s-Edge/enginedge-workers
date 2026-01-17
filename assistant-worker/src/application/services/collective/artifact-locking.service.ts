/**
 * Artifact Locking Service
 *
 * Prevents concurrent modification conflicts through optimistic and pessimistic locking.
 * Similar to KG node locking but for collective artifacts.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import { LockType } from '@domain/entities/collective-artifact.entity';

export interface ArtifactLockInfo {
  artifactId: string;
  agentId: string;
  lockType: LockType;
  acquiredAt: Date;
  expiresAt: Date;
  token: string;
  collectiveId: string;
}

interface QueuedLockRequest {
  artifactId: string;
  agentId: string;
  lockType: LockType;
  requestedAt: Date;
  timeoutMs: number;
  resolve?: (token: string | null) => void;
  reject?: (error: Error) => void;
}

@Injectable()
export class ArtifactLockingService {
  private readonly activeLocks = new Map<string, ArtifactLockInfo>();
  private readonly lockQueues = new Map<string, QueuedLockRequest[]>();

  private readonly DEFAULT_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_LOCK_WAIT_MS = 30 * 1000; // 30 seconds
  private readonly LOCK_CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {
    this.startLockCleanup();
  }

  /**
   * Acquire a lock on an artifact
   */
  async acquireLock(
    artifactId: string,
    agentId: string,
    lockType: LockType,
    collectiveId: string,
    timeoutMs: number = this.DEFAULT_LOCK_TIMEOUT_MS,
  ): Promise<string | null> {
    this.logger.info(
      `Agent ${agentId} requesting ${lockType} lock on artifact ${artifactId}`,
      {},
    );

    // Check if lock can be granted immediately
    if (this.canGrantLock(artifactId, lockType)) {
      return this.grantLock(
        artifactId,
        agentId,
        lockType,
        collectiveId,
        timeoutMs,
      );
    }

    // Add to queue and wait
    const queuedRequest: QueuedLockRequest = {
      artifactId,
      agentId,
      lockType,
      requestedAt: new Date(),
      timeoutMs,
    };

    const promise = new Promise<string | null>((resolve, reject) => {
      queuedRequest.resolve = resolve;
      queuedRequest.reject = reject;
    });

    // Add to queue
    const queue = this.lockQueues.get(artifactId) || [];
    queue.push(queuedRequest);
    this.lockQueues.set(artifactId, queue);

    // Set timeout for queue wait
    setTimeout(() => {
      if (queuedRequest.resolve) {
        this.removeFromQueue(artifactId, queuedRequest);
        queuedRequest.resolve(null); // Timeout - lock not acquired
      }
    }, this.MAX_LOCK_WAIT_MS);

    return promise;
  }

  /**
   * Release a lock on an artifact
   */
  async releaseLock(artifactId: string, lockToken: string): Promise<boolean> {
    const lock = this.activeLocks.get(artifactId);

    if (!lock) {
      this.logger.warn(`No active lock found for artifact ${artifactId}`, {});
      return false;
    }

    if (lock.token !== lockToken) {
      this.logger.warn(`Invalid lock token for artifact ${artifactId}`, {});
      return false;
    }

    this.logger.info(
      `Releasing ${lock.lockType} lock on artifact ${artifactId} by ${lock.agentId}`,
      {},
    );

    // Remove lock
    this.activeLocks.delete(artifactId);

    // Process queue
    await this.processLockQueue(artifactId);

    return true;
  }

  /**
   * Check if artifact is locked
   */
  isLocked(artifactId: string): boolean {
    return this.activeLocks.has(artifactId);
  }

  /**
   * Get lock information
   */
  getLockInfo(artifactId: string): ArtifactLockInfo | null {
    return this.activeLocks.get(artifactId) || null;
  }

  /**
   * Check if lock can be granted
   */
  private canGrantLock(artifactId: string, lockType: LockType): boolean {
    const existingLock = this.activeLocks.get(artifactId);

    if (!existingLock) {
      return true; // No lock exists
    }

    // Check if expired
    if (existingLock.expiresAt.getTime() < Date.now()) {
      this.activeLocks.delete(artifactId);
      return true;
    }

    // READ locks can be shared, WRITE locks are exclusive
    if (lockType === LockType.READ && existingLock.lockType === LockType.READ) {
      return true; // Multiple READ locks allowed
    }

    return false; // Lock exists and is not compatible
  }

  /**
   * Grant lock
   */
  private grantLock(
    artifactId: string,
    agentId: string,
    lockType: LockType,
    collectiveId: string,
    timeoutMs: number,
  ): string {
    const token = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const lock: ArtifactLockInfo = {
      artifactId,
      agentId,
      lockType,
      acquiredAt: now,
      expiresAt: new Date(now.getTime() + timeoutMs),
      token,
      collectiveId,
    };

    this.activeLocks.set(artifactId, lock);

    this.logger.info(
      `Lock granted: ${lockType} on ${artifactId} to ${agentId}`,
      {},
    );

    return token;
  }

  /**
   * Process lock queue for an artifact
   */
  private async processLockQueue(artifactId: string): Promise<void> {
    const queue = this.lockQueues.get(artifactId) || [];
    if (queue.length === 0) {
      return;
    }

    // Process first request in queue
    const request = queue[0];
    if (this.canGrantLock(request.artifactId, request.lockType)) {
      queue.shift();
      this.lockQueues.set(artifactId, queue);

      const token = this.grantLock(
        request.artifactId,
        request.agentId,
        request.lockType,
        '', // Will be set by caller
        request.timeoutMs,
      );

      if (request.resolve) {
        request.resolve(token);
      }
    }
  }

  /**
   * Remove request from queue
   */
  private removeFromQueue(
    artifactId: string,
    request: QueuedLockRequest,
  ): void {
    const queue = this.lockQueues.get(artifactId) || [];
    const index = queue.indexOf(request);
    if (index !== -1) {
      queue.splice(index, 1);
      this.lockQueues.set(artifactId, queue);
    }
  }

  /**
   * Start periodic lock cleanup
   */
  private startLockCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [artifactId, lock] of this.activeLocks.entries()) {
        if (lock.expiresAt.getTime() < now) {
          this.activeLocks.delete(artifactId);
          cleanedCount++;

          // Process queue
          this.processLockQueue(artifactId);
        }
      }

      if (cleanedCount > 0) {
        this.logger.info(`Cleaned up ${cleanedCount} expired locks`, {});
      }
    }, this.LOCK_CLEANUP_INTERVAL_MS);
  }
}
