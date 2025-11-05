/**
 * Task Assignment Service
 *
 * Intelligently assigns tasks to agents based on capabilities and availability.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import {
  CollectiveTask,
  TaskState,
} from '@domain/entities/collective-task.entity';

export interface AgentCapability {
  agentId: string;
  agentType: string;
  currentLoad: number; // Number of active tasks
  capabilities: string[]; // Capability tags
  availability: boolean;
}

@Injectable()
export class TaskAssignmentService {
  private agentCapabilities = new Map<string, AgentCapability>();
  private agentTaskCounts = new Map<string, number>();

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * Register agent capabilities
   */
  registerAgent(agentId: string, capabilities: AgentCapability): void {
    this.agentCapabilities.set(agentId, capabilities);
    this.agentTaskCounts.set(agentId, capabilities.currentLoad);
  }

  /**
   * Assign task to best agent
   */
  async assignTask(
    task: CollectiveTask,
    availableAgents: string[],
  ): Promise<string | null> {
    if (availableAgents.length === 0) {
      return null;
    }

    // Filter by allowed agents
    const candidates = availableAgents.filter(
      (agentId) =>
        task.allowedAgentIds.length === 0 ||
        task.allowedAgentIds.includes(agentId),
    );

    if (candidates.length === 0) {
      return null;
    }

    // Score each agent
    const scores = candidates.map((agentId) => ({
      agentId,
      score: this.calculateAssignmentScore(agentId, task),
    }));

    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score);

    const bestAgent = scores[0];
    if (bestAgent.score > 0) {
      // Update load
      const currentCount = this.agentTaskCounts.get(bestAgent.agentId) || 0;
      this.agentTaskCounts.set(bestAgent.agentId, currentCount + 1);

      this.logger.info(
        `Assigned task ${task.id} to agent ${bestAgent.agentId}`,
        {
          score: bestAgent.score,
        },
      );

      return bestAgent.agentId;
    }

    return null;
  }

  /**
   * Calculate assignment score for agent
   */
  private calculateAssignmentScore(
    agentId: string,
    task: CollectiveTask,
  ): number {
    const capability = this.agentCapabilities.get(agentId);
    if (!capability || !capability.availability) {
      return 0;
    }

    let score = 100;

    // Penalize high load
    const load = this.agentTaskCounts.get(agentId) || 0;
    score -= load * 10;

    // Bonus for matching capabilities (if task has metadata with required capabilities)
    if (task.metadata?.requiredCapabilities) {
      const required = task.metadata.requiredCapabilities as string[];
      const matches = required.filter((cap) =>
        capability.capabilities.includes(cap),
      ).length;
      score += matches * 20;
    }

    // Bonus for agent type match
    if (task.allowedAgentIds.includes(agentId)) {
      score += 30;
    }

    // Priority bonus
    score += task.priority / 10;

    return Math.max(0, score);
  }

  /**
   * Release task assignment (agent finished)
   */
  releaseTask(agentId: string): void {
    const currentCount = this.agentTaskCounts.get(agentId) || 0;
    if (currentCount > 0) {
      this.agentTaskCounts.set(agentId, currentCount - 1);
    }
  }

  /**
   * Get agent load
   */
  getAgentLoad(agentId: string): number {
    return this.agentTaskCounts.get(agentId) || 0;
  }
}
