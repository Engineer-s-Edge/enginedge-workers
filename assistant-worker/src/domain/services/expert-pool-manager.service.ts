/**
 * Expert Pool Manager Service
 *
 * Enhanced domain service for managing expert agent lifecycle, execution coordination,
 * concurrency control, collision detection, and comprehensive tracking.
 *
 * Features:
 * - Semaphore-based concurrency control
 * - Execution timeout management with AbortController
 * - Knowledge Graph collision detection
 * - Work logging (optional/configurable)
 * - Comprehensive statistics and expert reports
 * - Prometheus metrics integration
 * - Factory pattern support for on-demand creation
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import pLimit from 'p-limit';
import { ExpertAgent } from '../agents/expert-agent';
import { Agent } from '../entities/agent.entity';
import { AgentId } from '../entities/agent.entity';
import { AgentConfig } from '../value-objects/agent-config.vo';
import { AgentCapability } from '../value-objects/agent-capability.vo';
import { ILLMProvider } from '@application/ports/llm-provider.port';
import { ILogger } from '@application/ports/logger.port';
import { KnowledgeGraphService } from '@application/services/knowledge-graph.service';
import {
  ExpertPoolConfig,
  ExpertPoolStats,
  ExpertReport,
  ActiveExecution,
  KGModification,
  CollisionResult,
} from './expert-pool.types';

export interface ExpertAllocationRequest {
  count: number;
  specialization?: string;
  complexity?: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
  expertise?: string[];
  /** Optional factory function for on-demand execution with coordination */
  executeFactory?: (expertId: AgentId, expert: ExpertAgent) => Promise<any>;
  /** Optional topic for execution */
  topic?: string;
  /** Optional topic ID */
  topicId?: string;
}

export interface AllocationResult {
  allocated: ExpertAgentInstance[];
  failed: string[];
  timestamp: Date;
  /** Execution reports if executeFactory was provided */
  reports?: ExpertReport[];
}

export interface ExpertAgentInstance {
  id: AgentId;
  specialization: string;
  complexity: number;
  availability: boolean;
  expertise: string[];
  agent: ExpertAgent;
  allocatedAt: Date;
}

/**
 * Expert Pool Manager
 * Encapsulates expert agent creation, lifecycle management, and execution coordination
 */
@Injectable()
export class ExpertPoolManager {
  private expertPool: Map<AgentId, ExpertAgentInstance> = new Map();
  private activeExecutions: Map<AgentId, ActiveExecution> = new Map();
  private expertWorkLogs: Map<AgentId, KGModification[]> = new Map();
  private allocationHistory: Array<{
    expertId: AgentId;
    action: 'allocate' | 'release';
    timestamp: Date;
  }> = [];

  // Configuration
  private config: ExpertPoolConfig = {
    maxConcurrentExperts: 1,
    expertTimeout: 10 * 60 * 1000, // 10 minutes
    maxRetriesPerTopic: 3,
    knowledgeGraphWriteSemaphore: 5,
    verbose: false,
    enableWorkLogging: true,
    staleLockThreshold: 15 * 60 * 1000, // 15 minutes
  };

  // Semaphores for resource control
  private expertSemaphore: ReturnType<typeof pLimit>;
  private kgWriteSemaphore: ReturnType<typeof pLimit>;

  // Statistics
  private stats: ExpertPoolStats = {
    activeExperts: 0,
    totalExpertsSpawned: 0,
    totalTopicsCompleted: 0,
    totalTopicsFailed: 0,
    totalTimeout: 0,
    totalEscalations: 0,
    averageCompletionTimeMs: 0,
    collisionCount: 0,
    queuedRequests: 0,
    totalModifications: 0,
    totalSourcesUsed: 0,
  };

  private completionTimes: number[] = [];

  constructor(
    @Inject('ILLMProvider')
    private readonly llmProvider: ILLMProvider,
    @Inject('ILogger')
    private readonly logger: ILogger,
    @Inject(KnowledgeGraphService)
    private readonly knowledgeGraph: KnowledgeGraphService,
    @Optional()
    @Inject('MetricsAdapter')
    private readonly metrics?: any, // MetricsAdapter - optional to avoid circular dependency
  ) {
    // Initialize semaphores
    this.expertSemaphore = pLimit(this.config.maxConcurrentExperts);
    this.kgWriteSemaphore = pLimit(this.config.knowledgeGraphWriteSemaphore);

    this.logger.info('Expert Pool Manager initialized', {
      maxConcurrentExperts: this.config.maxConcurrentExperts,
      expertTimeout: this.config.expertTimeout,
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ExpertPoolConfig>): void {
    const oldMax = this.config.maxConcurrentExperts;
    this.config = { ...this.config, ...config };

    // Recreate semaphore if max changed
    if (config.maxConcurrentExperts && config.maxConcurrentExperts !== oldMax) {
      this.expertSemaphore = pLimit(config.maxConcurrentExperts);
      this.logger.info(
        `Updated max concurrent experts: ${oldMax} → ${config.maxConcurrentExperts}`,
      );
    }

    if (config.knowledgeGraphWriteSemaphore) {
      this.kgWriteSemaphore = pLimit(config.knowledgeGraphWriteSemaphore);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ExpertPoolConfig {
    return { ...this.config };
  }

  /**
   * Allocate experts based on requirements
   * Supports both pre-allocation and on-demand execution with coordination
   */
  async allocateExperts(
    request: ExpertAllocationRequest,
  ): Promise<AllocationResult> {
    this.logger.info(
      `Allocating ${request.count} experts: ${request.specialization || 'general'}`,
      {},
    );

    const allocated: ExpertAgentInstance[] = [];
    const failed: string[] = [];
    const reports: ExpertReport[] = [];

    try {
      // If executeFactory is provided, allocate and execute with coordination
      if (request.executeFactory) {
        return await this.allocateAndExecute(request);
      }

      // Otherwise, just allocate experts
      for (let i = 0; i < request.count; i++) {
        try {
          const expert = await this.createExpertAgent(request, i);
          allocated.push(expert);
          this.expertPool.set(expert.id, expert);
          this.allocationHistory.push({
            expertId: expert.id,
            action: 'allocate',
            timestamp: new Date(),
          });

          // Record metrics
          if (this.metrics) {
            this.metrics.recordExpertPoolAllocation();
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.logger.warn(`Failed to allocate expert ${i}: ${err.message}`);
          failed.push(`expert-${i}`);
        }
      }

      this.logger.info(
        `Allocation complete: ${allocated.length} succeeded, ${failed.length} failed`,
        {},
      );

      return {
        allocated,
        failed,
        timestamp: new Date(),
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Expert allocation failed: ${err.message}`, {
        stack: err.stack,
      });
      throw error;
    }
  }

  /**
   * Allocate and execute experts with coordination (factory pattern)
   */
  private async allocateAndExecute(
    request: ExpertAllocationRequest,
  ): Promise<AllocationResult> {
    const allocated: ExpertAgentInstance[] = [];
    const failed: string[] = [];
    const reports: ExpertReport[] = [];

    const executionPromises: Promise<ExpertReport>[] = [];

    for (let i = 0; i < request.count; i++) {
      try {
        const expert = await this.createExpertAgent(request, i);
        allocated.push(expert);
        this.expertPool.set(expert.id, expert);
        this.allocationHistory.push({
          expertId: expert.id,
          action: 'allocate',
          timestamp: new Date(),
        });

        // Execute with coordination if factory provided
        if (request.executeFactory) {
          const executionPromise = this.executeExpertWithCoordination(
            expert.id,
            expert.agent,
            request.topic || request.specialization || 'general research',
            request.topicId,
            request.executeFactory,
          );
          executionPromises.push(executionPromise);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Failed to allocate expert ${i}: ${err.message}`);
        failed.push(`expert-${i}`);
      }
    }

    // Wait for all executions to complete
    const executionResults = await Promise.allSettled(executionPromises);
    for (const result of executionResults) {
      if (result.status === 'fulfilled') {
        reports.push(result.value);
      }
    }

    return {
      allocated,
      failed,
      timestamp: new Date(),
      reports,
    };
  }

  /**
   * Execute expert with coordination (semaphore, timeout, collision detection)
   */
  private async executeExpertWithCoordination(
    expertId: AgentId,
    expert: ExpertAgent,
    topic: string,
    topicId: string | undefined,
    executeFactory: (expertId: AgentId, expert: ExpertAgent) => Promise<any>,
  ): Promise<ExpertReport> {
    this.logger.info(
      `Executing expert ${expertId} for topic: "${topic}"`,
      {},
    );

    // Wait for available slot
    this.stats.totalExpertsSpawned++;
    this.updateQueuedRequests();

    const startTime = new Date();
    let status: 'completed' | 'failed' | 'timeout' | 'escalated' = 'completed';
    let result: any;
    let error: string | undefined;

    // Initialize work log
    if (this.config.enableWorkLogging) {
      this.expertWorkLogs.set(expertId, []);
    }

    // Create AbortController for cancellation
    const abortController = new AbortController();

    // Create timeout
    const timeoutHandle = setTimeout(() => {
      abortController.abort();
      error = `Expert ${expertId} timed out after ${this.config.expertTimeout}ms`;
      status = 'timeout';
    }, this.config.expertTimeout);

    // Track active execution
    const executionPromise = this.expertSemaphore(async () => {
      try {
        // Execute expert with signal support
        const executionPromise = executeFactory(expertId, expert);

        // If expert supports AbortSignal, pass it
        if (typeof (expert as any).setAbortSignal === 'function') {
          (expert as any).setAbortSignal(abortController.signal);
        }

        result = await executionPromise;
        this.stats.totalTopicsCompleted++;

        // Record metrics
        if (this.metrics) {
          this.metrics.recordExpertExecution('expert', 'success');
        }

        return result;
      } catch (err) {
        const errorInfo = err instanceof Error ? err : new Error(String(err));
        error = errorInfo.message;

        if (abortController.signal.aborted) {
          status = 'timeout';
          this.stats.totalTimeout++;

          if (this.metrics) {
            this.metrics.recordExpertExecution('expert', 'timeout');
          }
        } else if (errorInfo.message.includes('escalat')) {
          status = 'escalated';
          this.stats.totalEscalations++;

          if (this.metrics) {
            this.metrics.recordExpertExecution('expert', 'escalated');
          }
        } else {
          status = 'failed';
          this.stats.totalTopicsFailed++;

          if (this.metrics) {
            this.metrics.recordExpertExecution('expert', 'failed');
          }
        }

        throw err;
      } finally {
        clearTimeout(timeoutHandle);
        this.activeExecutions.delete(expertId);
        this.updateQueuedRequests();
      }
    })();

    // Store active execution
    this.activeExecutions.set(expertId, {
      expertId,
      topic,
      topicId,
      startTime,
      abortController,
      timeoutHandle,
      promise: executionPromise as Promise<ExpertReport>,
    });

    this.stats.activeExperts = this.activeExecutions.size;

    // Update metrics
    if (this.metrics) {
      this.metrics.updateExpertPoolActiveExperts(this.stats.activeExperts);
    }

    try {
      await executionPromise;
    } catch (err) {
      // Error already handled above
    }

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();

    // Update average completion time
    if (status === 'completed') {
      this.completionTimes.push(durationMs);
      if (this.completionTimes.length > 100) {
        this.completionTimes.shift();
      }
      this.stats.averageCompletionTimeMs = Math.round(
        this.completionTimes.reduce((a, b) => a + b, 0) /
          this.completionTimes.length,
      );
    }

    // Get work log
    const modifications = this.expertWorkLogs.get(expertId) || [];
    const sourcesUsed = modifications.filter(
      (m) => m.operationType === 'add-research',
    ).length;
    const avgConfidence = this.calculateAvgConfidence(modifications);

    // Build report
    const report: ExpertReport = {
      expertId,
      topicResearched: topic,
      topicId,
      startTime,
      endTime,
      durationMs,
      modifications,
      sourcesUsed,
      avgConfidence,
      issuesEncountered: error ? [error] : [],
      escalationRequired: status === 'escalated',
      escalationReason: status === 'escalated' ? error : undefined,
      status,
      result,
    };

    // Record execution duration metric
    if (this.metrics) {
      this.metrics.recordExpertExecutionDuration(durationMs / 1000, status);
    }

    // Cleanup work log
    if (this.config.enableWorkLogging) {
      this.expertWorkLogs.delete(expertId);
    }

    this.logger.info(
      `Expert ${expertId} finished (${status}) in ${durationMs}ms`,
      {},
    );

    return report;
  }

  /**
   * Create a single expert agent
   */
  private async createExpertAgent(
    request: ExpertAllocationRequest,
    index: number,
  ): Promise<ExpertAgentInstance> {
    const expertId = `expert-${Date.now()}-${index}` as AgentId;
    const complexityLevel = request.complexity
      ? parseInt(request.complexity.replace('L', ''))
      : 3;

    // Create agent config
    const config = AgentConfig.create({
      model: 'expert-research-v1',
      provider: 'internal',
      enableTools: true,
      streamingEnabled: true,
      temperature: 0.7,
      maxTokens: 4000,
      systemPrompt: `You are an expert research agent specializing in ${request.specialization || 'general knowledge'}.
Your role is to conduct thorough research, analyze sources, and synthesize findings into comprehensive reports.`,
    });

    // Create capability profile for expert agent
    const capability = AgentCapability.create({
      executionModel: 'research',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: true,
      canCoordinate: false,
      supportsParallelExecution: true,
      maxInputTokens: 8000,
      maxOutputTokens: 4000,
      supportedMemoryTypes: ['knowledge_graph', 'buffer_window'],
      timeoutMs: this.config.expertTimeout,
    });

    // Create underlying Agent entity
    const agent = Agent.create(
      `${request.specialization || 'General'} Expert #${index}`,
      'expert',
      config,
      capability,
    );

    // Create ExpertAgent domain entity with research topics
    const expertAgent = new ExpertAgent(
      this.llmProvider,
      this.logger,
      undefined, // ragAdapter - will be injected when needed
      {
        aim_iterations: 3,
        shoot_iterations: 5,
        skin_model: 'balanced',
        temperature: 0.3,
        model: config.model,
      },
    );

    // Add research topic
    expertAgent.addTopic({
      id: `topic-${index}`,
      query: request.topic || request.specialization || 'general research',
      category: request.specialization || 'general',
      priority: complexityLevel,
      status: 'pending',
    });

    return {
      id: expertId,
      specialization: request.specialization || 'general',
      complexity: complexityLevel,
      availability: true,
      expertise: request.expertise || [],
      agent: expertAgent,
      allocatedAt: new Date(),
    };
  }

  /**
   * Log a knowledge graph modification by an expert
   * Expert Agents should call this for every KG operation
   */
  logModification(modification: KGModification): void {
    if (!this.config.enableWorkLogging) {
      return;
    }

    const log = this.expertWorkLogs.get(modification.expertId);
    if (log) {
      log.push(modification);
      this.stats.totalModifications++;

      if (this.config.verbose) {
        this.logger.debug(
          `Expert ${modification.expertId} ${modification.operationType} ${modification.success ? 'success' : 'failed'}`,
        );
      }

      // Record metrics
      if (this.metrics) {
        this.metrics.recordKGModification(
          modification.operationType,
          modification.success,
        );
      }
    }
  }

  /**
   * Handle node collision
   * Called when an expert tries to create/modify a node that's locked or exists
   */
  async handleNodeCollision(
    expertId: AgentId,
    nodeId: string,
    operation: 'create' | 'update' | 'lock',
  ): Promise<CollisionResult> {
    this.stats.collisionCount++;

    this.logger.info(
      `Collision detected: Expert ${expertId} attempting ${operation} on ${nodeId}`,
      {},
    );

    try {
      // Check node state
      const node = await this.knowledgeGraph.getNode(nodeId);

      if (!node) {
        // Node doesn't exist, safe to create
        return {
          handled: true,
          action: 'skipped',
          message: 'Node does not exist, safe to proceed',
        };
      }

      if (node.lock) {
        // Node is locked by another expert
        if (node.lock.lockedBy === expertId) {
          // This expert owns the lock
          return {
            handled: true,
            action: 'skipped',
            message: 'Expert already owns lock',
          };
        }

        // Check if lock is stale
        const lockAge = Date.now() - node.lock.lockedAt.getTime();
        if (lockAge > this.config.staleLockThreshold) {
          this.logger.warn(`Stale lock detected on ${nodeId}, releasing`, {});
          await this.knowledgeGraph.unlockNode(
            nodeId,
            node.lock.lockedBy,
          );

          // Record collision resolution
          if (this.metrics) {
            this.metrics.recordKGCollision('stale_lock_released');
          }

          return {
            handled: true,
            action: 'merged',
            message: 'Released stale lock, can proceed',
          };
        }

        // Wait briefly and retry
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check again
        const nodeAfterWait = await this.knowledgeGraph.getNode(nodeId);
        if (!nodeAfterWait?.lock) {
          return {
            handled: true,
            action: 'waited',
            message: 'Lock released after wait, can proceed',
          };
        }

        // Still locked, skip this node
        this.logger.info(
          `Expert ${expertId} skipping ${nodeId} (locked by ${node.lock.lockedBy})`,
          {},
        );

        // Record collision resolution
        if (this.metrics) {
          this.metrics.recordKGCollision('skipped');
        }

        return {
          handled: true,
          action: 'skipped',
          message: `Node locked by ${node.lock.lockedBy}`,
        };
      }

      // Node exists but not locked
      if (operation === 'create') {
        // Can't create, already exists - just skip
        return {
          handled: true,
          action: 'skipped',
          message: 'Node already exists, skipping creation',
        };
      }

      // For update, proceed
      return {
        handled: true,
        action: 'merged',
        message: 'Node exists, proceeding with update',
      };
    } catch (error) {
      const info = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Error handling collision for ${nodeId}: ${info.message}`,
        {
          stack: info.stack,
        },
      );

      return {
        handled: false,
        action: 'failed',
        message: `Collision handling failed: ${info.message}`,
      };
    }
  }

  /**
   * Release experts and free resources
   */
  async releaseExperts(expertIds: AgentId[]): Promise<boolean> {
    this.logger.info(`Releasing ${expertIds.length} experts`, {});

    try {
      expertIds.forEach((id) => {
        const expert = this.expertPool.get(id);
        if (expert) {
          this.expertPool.delete(id);
          this.allocationHistory.push({
            expertId: id,
            action: 'release',
            timestamp: new Date(),
          });
          this.logger.debug(`Released expert: ${id}`);
        }

        // Clean up active execution if exists
        const execution = this.activeExecutions.get(id);
        if (execution) {
          execution.abortController.abort();
          clearTimeout(execution.timeoutHandle);
          this.activeExecutions.delete(id);
        }

        // Clean up work log
        this.expertWorkLogs.delete(id);
      });

      this.stats.activeExperts = this.activeExecutions.size;

      // Update metrics
      if (this.metrics) {
        this.metrics.updateExpertPoolActiveExperts(this.stats.activeExperts);
      }

      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Expert release failed: ${err.message}`, {
        stack: err.stack,
      });
      throw error;
    }
  }

  /**
   * Get count of available experts
   */
  async getAvailableCount(): Promise<number> {
    const available = Array.from(this.expertPool.values()).filter(
      (e) => e.availability,
    ).length;
    this.logger.debug(`Available experts: ${available}`);
    return available;
  }

  /**
   * Get specific expert
   */
  async getExpert(expertId: AgentId): Promise<ExpertAgentInstance | null> {
    return this.expertPool.get(expertId) || null;
  }

  /**
   * Get all available experts
   */
  async getAvailableExperts(): Promise<ExpertAgentInstance[]> {
    return Array.from(this.expertPool.values()).filter((e) => e.availability);
  }

  /**
   * Check if expert is available
   */
  async isExpertAvailable(expertId: AgentId): Promise<boolean> {
    const expert = this.expertPool.get(expertId);
    return expert ? expert.availability : false;
  }

  /**
   * Mark expert as unavailable (busy)
   */
  async markExpertBusy(expertId: AgentId): Promise<boolean> {
    const expert = this.expertPool.get(expertId);
    if (expert) {
      expert.availability = false;
      this.logger.debug(`Expert marked busy: ${expertId}`);
      return true;
    }
    return false;
  }

  /**
   * Mark expert as available (done with task)
   */
  async markExpertAvailable(expertId: AgentId): Promise<boolean> {
    const expert = this.expertPool.get(expertId);
    if (expert) {
      expert.availability = true;
      this.logger.debug(`Expert marked available: ${expertId}`);
      return true;
    }
    return false;
  }

  /**
   * Get work log for a specific expert
   */
  getExpertWorkLog(expertId: AgentId): KGModification[] {
    return this.expertWorkLogs.get(expertId) || [];
  }

  /**
   * Get currently active executions
   */
  getActiveExecutions(): ActiveExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Wait for all active experts to complete
   */
  async waitForAll(): Promise<void> {
    const promises = Array.from(this.activeExecutions.values()).map(
      (e) => e.promise,
    );
    await Promise.allSettled(promises);
  }

  /**
   * Abort all active experts
   */
  async abortAll(): Promise<void> {
    this.logger.warn(
      `Aborting ${this.activeExecutions.size} active experts`,
      {},
    );

    for (const execution of this.activeExecutions.values()) {
      execution.abortController.abort();
      clearTimeout(execution.timeoutHandle);
    }

    this.activeExecutions.clear();
    this.stats.activeExperts = 0;

    // Update metrics
    if (this.metrics) {
      this.metrics.updateExpertPoolActiveExperts(0);
    }
  }

  /**
   * Get allocation history
   */
  getAllocationHistory(): Array<{
    expertId: AgentId;
    action: 'allocate' | 'release';
    timestamp: Date;
  }> {
    return [...this.allocationHistory];
  }

  /**
   * Get pool statistics
   */
  async getPoolStats(): Promise<ExpertPoolStats> {
    return {
      ...this.stats,
      activeExperts: this.activeExecutions.size,
      queuedRequests: this.updateQueuedRequests(),
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.stats = {
      activeExperts: 0,
      totalExpertsSpawned: 0,
      totalTopicsCompleted: 0,
      totalTopicsFailed: 0,
      totalTimeout: 0,
      totalEscalations: 0,
      averageCompletionTimeMs: 0,
      collisionCount: 0,
      queuedRequests: 0,
      totalModifications: 0,
      totalSourcesUsed: 0,
    };
    this.completionTimes = [];
  }

  // ========================================
  // Private Helpers
  // ========================================

  /**
   * Update queued requests count
   */
  private updateQueuedRequests(): number {
    // p-limit doesn't expose queue length directly, so we estimate
    // based on active vs max concurrent
    const queued = Math.max(
      0,
      this.activeExecutions.size - this.config.maxConcurrentExperts,
    );
    this.stats.queuedRequests = queued;
    return queued;
  }

  /**
   * Calculate average confidence from modifications
   */
  private calculateAvgConfidence(modifications: KGModification[]): number {
    const confidenceValues = modifications
      .filter((m) => m.metadata?.confidence !== undefined)
      .map((m) => m.metadata!.confidence as number);

    if (confidenceValues.length === 0) return 0.5;

    return (
      confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
    );
  }
}
