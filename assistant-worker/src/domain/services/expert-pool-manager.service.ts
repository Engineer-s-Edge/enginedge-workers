/**
 * Expert Pool Manager Service
 *
 * Domain service for managing expert agent lifecycle and availability.
 * Core business logic for expert allocation, tracking, and release.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ExpertAgent } from '../agents/expert-agent';
import { Agent } from '../entities/agent.entity';
import { AgentConfig } from '../value-objects/agent-config.vo';
import { AgentCapability } from '../value-objects/agent-capability.vo';
import { ILLMProvider } from '@application/ports/llm-provider.port';
import { ILogger } from '@application/ports/logger.port';

export interface ExpertAllocationRequest {
  count: number;
  specialization?: string;
  complexity?: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
  expertise?: string[];
}

export interface AllocationResult {
  allocated: ExpertAgentInstance[];
  failed: string[];
  timestamp: Date;
}

export interface ExpertAgentInstance {
  id: string;
  specialization: string;
  complexity: number;
  availability: boolean;
  expertise: string[];
  agent: ExpertAgent;
  allocatedAt: Date;
}

/**
 * Expert Pool Manager
 * Encapsulates expert agent creation and lifecycle management
 */
@Injectable()
export class ExpertPoolManager {
  private expertPool: Map<string, ExpertAgentInstance> = new Map();
  private allocationHistory: Array<{
    expertId: string;
    action: 'allocate' | 'release';
    timestamp: Date;
  }> = [];

  constructor(
    @Inject('ILLMProvider')
    private readonly llmProvider: ILLMProvider,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {
    this.logger.info('Expert Pool Manager initialized', {});
  }

  /**
   * Allocate experts based on requirements
   */
  async allocateExperts(request: ExpertAllocationRequest): Promise<AllocationResult> {
    this.logger.info(`Allocating ${request.count} experts: ${request.specialization || 'general'}`, {});

    const allocated: ExpertAgentInstance[] = [];
    const failed: string[] = [];

    try {
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
   * Create a single expert agent
   */
  private async createExpertAgent(
    request: ExpertAllocationRequest,
    index: number,
  ): Promise<ExpertAgentInstance> {
    const expertId = `expert-${Date.now()}-${index}`;
    const complexityLevel = request.complexity ? parseInt(request.complexity.replace('L', '')) : 3;

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
      timeoutMs: 300000, // 5 minutes for research
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
      query: request.specialization || 'general research',
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
   * Release experts and free resources
   */
  async releaseExperts(expertIds: string[]): Promise<boolean> {
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
      });

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
    const available = Array.from(this.expertPool.values()).filter((e) => e.availability).length;
    this.logger.debug(`Available experts: ${available}`);
    return available;
  }

  /**
   * Get specific expert
   */
  async getExpert(expertId: string): Promise<ExpertAgentInstance | null> {
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
  async isExpertAvailable(expertId: string): Promise<boolean> {
    const expert = this.expertPool.get(expertId);
    return expert ? expert.availability : false;
  }

  /**
   * Mark expert as unavailable (busy)
   */
  async markExpertBusy(expertId: string): Promise<boolean> {
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
  async markExpertAvailable(expertId: string): Promise<boolean> {
    const expert = this.expertPool.get(expertId);
    if (expert) {
      expert.availability = true;
      this.logger.debug(`Expert marked available: ${expertId}`);
      return true;
    }
    return false;
  }

  /**
   * Get allocation history
   */
  getAllocationHistory(): Array<{
    expertId: string;
    action: 'allocate' | 'release';
    timestamp: Date;
  }> {
    return [...this.allocationHistory];
  }

  /**
   * Get pool statistics
   */
  async getPoolStats(): Promise<{
    total: number;
    available: number;
    busy: number;
    allocations: number;
    releases: number;
  }> {
    const total = this.expertPool.size;
    const available = await this.getAvailableCount();
    const busy = total - available;
    const allocations = this.allocationHistory.filter((h) => h.action === 'allocate').length;
    const releases = this.allocationHistory.filter((h) => h.action === 'release').length;

    return { total, available, busy, allocations, releases };
  }
}
