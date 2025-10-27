/**
 * Checkpoint Service
 * 
 * Manages agent execution checkpoints for pause/resume functionality.
 * Particularly important for long-running Graph agents.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';

export interface Checkpoint {
  id: string;
  agentId: string;
  userId: string;
  name: string;
  state: any; // Agent-specific state
  createdAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Checkpoint Service
 */
@Injectable()
export class CheckpointService {
  // In-memory storage (replace with database in production)
  private checkpoints: Map<string, Checkpoint> = new Map();
  private agentCheckpoints: Map<string, string[]> = new Map(); // agentId -> checkpoint IDs

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * Create a checkpoint
   */
  async createCheckpoint(
    agentId: string,
    userId: string,
    state: any,
    name?: string,
    metadata?: Record<string, any>
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      userId,
      name: name || `Checkpoint ${new Date().toISOString()}`,
      state: JSON.parse(JSON.stringify(state)), // Deep clone
      createdAt: new Date(),
      metadata,
    };

    this.checkpoints.set(checkpoint.id, checkpoint);

    // Track checkpoints by agent
    if (!this.agentCheckpoints.has(agentId)) {
      this.agentCheckpoints.set(agentId, []);
    }
    this.agentCheckpoints.get(agentId)!.push(checkpoint.id);

    this.logger.info('Checkpoint created', { checkpointId: checkpoint.id, agentId });

    return checkpoint;
  }

  /**
   * Get a checkpoint by ID
   */
  async getCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    return this.checkpoints.get(checkpointId) || null;
  }

  /**
   * List checkpoints for an agent
   */
  async listCheckpoints(agentId: string, limit?: number): Promise<Checkpoint[]> {
    const checkpointIds = this.agentCheckpoints.get(agentId) || [];
    const checkpoints = checkpointIds
      .map((id) => this.checkpoints.get(id))
      .filter((cp): cp is Checkpoint => cp !== undefined)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (limit && limit > 0) {
      return checkpoints.slice(0, limit);
    }

    return checkpoints;
  }

  /**
   * Get the latest checkpoint for an agent
   */
  async getLatestCheckpoint(agentId: string): Promise<Checkpoint | null> {
    const checkpoints = await this.listCheckpoints(agentId, 1);
    return checkpoints.length > 0 ? checkpoints[0] : null;
  }

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(checkpointId: string): Promise<boolean> {
    const checkpoint = this.checkpoints.get(checkpointId);

    if (!checkpoint) {
      return false;
    }

    // Remove from agent's checkpoint list
    const agentCheckpointIds = this.agentCheckpoints.get(checkpoint.agentId);
    if (agentCheckpointIds) {
      const index = agentCheckpointIds.indexOf(checkpointId);
      if (index > -1) {
        agentCheckpointIds.splice(index, 1);
      }
    }

    this.checkpoints.delete(checkpointId);
    this.logger.info('Checkpoint deleted', { checkpointId });

    return true;
  }

  /**
   * Delete all checkpoints for an agent
   */
  async deleteAgentCheckpoints(agentId: string): Promise<number> {
    const checkpointIds = this.agentCheckpoints.get(agentId) || [];
    let deletedCount = 0;

    for (const checkpointId of checkpointIds) {
      if (this.checkpoints.delete(checkpointId)) {
        deletedCount++;
      }
    }

    this.agentCheckpoints.delete(agentId);
    this.logger.info('Agent checkpoints deleted', { agentId, count: deletedCount });

    return deletedCount;
  }

  /**
   * Restore state from checkpoint
   */
  async restoreFromCheckpoint(checkpointId: string): Promise<any> {
    const checkpoint = await this.getCheckpoint(checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    this.logger.info('Restoring from checkpoint', { checkpointId, agentId: checkpoint.agentId });

    // Return deep clone to prevent mutations
    return JSON.parse(JSON.stringify(checkpoint.state));
  }

  /**
   * Update checkpoint metadata
   */
  async updateCheckpointMetadata(
    checkpointId: string,
    metadata: Record<string, any>
  ): Promise<Checkpoint | null> {
    const checkpoint = this.checkpoints.get(checkpointId);

    if (!checkpoint) {
      return null;
    }

    checkpoint.metadata = {
      ...checkpoint.metadata,
      ...metadata,
    };

    return checkpoint;
  }

  /**
   * Clean up old checkpoints (keep only N most recent per agent)
   */
  async cleanupOldCheckpoints(agentId: string, keepCount: number = 5): Promise<number> {
    const checkpoints = await this.listCheckpoints(agentId);

    if (checkpoints.length <= keepCount) {
      return 0;
    }

    const toDelete = checkpoints.slice(keepCount);
    let deletedCount = 0;

    for (const checkpoint of toDelete) {
      if (await this.deleteCheckpoint(checkpoint.id)) {
        deletedCount++;
      }
    }

    this.logger.info('Old checkpoints cleaned up', { agentId, deletedCount });

    return deletedCount;
  }

  /**
   * Get checkpoint statistics
   */
  async getStats(): Promise<{
    totalCheckpoints: number;
    checkpointsByAgent: Record<string, number>;
  }> {
    const checkpointsByAgent: Record<string, number> = {};

    for (const [agentId, checkpointIds] of this.agentCheckpoints.entries()) {
      checkpointsByAgent[agentId] = checkpointIds.length;
    }

    return {
      totalCheckpoints: this.checkpoints.size,
      checkpointsByAgent,
    };
  }
}

