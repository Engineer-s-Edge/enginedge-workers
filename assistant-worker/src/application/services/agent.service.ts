import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ILogger } from '../ports/logger.port';
import { IAgentRepository } from '../ports/agent.repository';
import { BaseAgent } from '@domain/agents/agent.base';
import { Agent, AgentId } from '@domain/entities/agent.entity';
import { AgentConfig } from '@domain/value-objects/agent-config.vo';
import { AgentCapability } from '@domain/value-objects/agent-capability.vo';
import { AgentType } from '@domain/enums/agent-type.enum';
import { ExecutionResult } from '@domain/entities';
import { AgentFactory } from '@domain/services/agent-factory.service';
import { CreateAgentDTO, UpdateAgentDTO } from '../dto';

/**
 * AgentService - Core agent management
 *
 * Responsibilities:
 * - CRUD operations for agents
 * - Agent registry (in-memory cache)
 * - Session management
 * - Instance creation and lifecycle
 */
@Injectable()
export class AgentService {
  private agentRegistry: Map<string, Agent> = new Map();
  private agentInstances: Map<string, BaseAgent> = new Map();
  private sessionAgents: Map<string, string[]> = new Map(); // sessionId -> agentIds

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
    @Inject('IAgentRepository')
    private readonly agentRepository: IAgentRepository,
    private readonly agentFactory: AgentFactory,
  ) {
    this.logger.info('AgentService initialized', {
      agentsInRegistry: this.agentRegistry.size,
    });
  }

  /**
   * Create new agent
   */
  async createAgent(dto: CreateAgentDTO, userId: string): Promise<Agent> {
    try {
      // Check if agent with same name exists for this user
      const existingAgent = Array.from(this.agentRegistry.values()).find(
        (a) => a.name === dto.name,
      );

      if (existingAgent) {
        throw new ConflictException(
          `Agent with name '${dto.name}' already exists`,
        );
      }

      // Create agent config
      const config = AgentConfig.create({
        model: (dto.config?.model as string) || 'gpt-4',
        provider: (dto.config?.provider as string) || 'openai',
        temperature: dto.config?.temperature as number | undefined,
        maxTokens: dto.config?.maxTokens as number | undefined,
        systemPrompt: dto.config?.systemPrompt as string | undefined,
        enableTools: dto.config?.enableTools as boolean | undefined,
        toolNames: dto.config?.toolNames as string[] | undefined,
        streamingEnabled: dto.config?.streamingEnabled as boolean | undefined,
        timeout: dto.config?.timeout as number | undefined,
      });

      // Create agent capability
      const capability = AgentCapability.create({
        executionModel: this.getExecutionModel(dto.agentType) as any,
        canUseTools: (dto.config?.enableTools as boolean) ?? false,
        canStreamResults: (dto.config?.streamingEnabled as boolean) ?? false,
        canPauseResume: dto.agentType === 'graph',
        canCoordinate: ['collective', 'manager'].includes(dto.agentType),
        supportsParallelExecution: dto.agentType === 'collective',
        maxInputTokens: 4096,
        maxOutputTokens: 2048,
        supportedMemoryTypes: ['buffer', 'buffer_window', 'summary'],
        timeoutMs: (dto.config?.timeout as number) || 30000,
      });

      // Create agent entity using factory method
      const agent = Agent.create(
        dto.name,
        this.mapAgentType(dto.agentType),
        config,
        capability,
      );

      // Persist to repository
      await this.agentRepository.save(agent);

      // Save to registry
      this.agentRegistry.set(agent.id, agent);

      this.logger.info('Agent created', {
        agentId: agent.id,
        name: agent.name,
        userId,
      });

      return agent;
    } catch (error) {
      this.logger.error(
        'Failed to create agent',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  private mapAgentType(
    type: string,
  ): (typeof AgentType)[keyof typeof AgentType] {
    const typeMap: Record<string, (typeof AgentType)[keyof typeof AgentType]> =
      {
        react: AgentType.REACT,
        graph: AgentType.GRAPH,
        expert: AgentType.EXPERT,
        genius: AgentType.GENIUS,
        collective: AgentType.COLLECTIVE,
        manager: AgentType.MANAGER,
      };
    return typeMap[type] || AgentType.REACT;
  }

  private getExecutionModel(type: string): string {
    const modelMap: Record<string, string> = {
      react: 'chain-of-thought',
      graph: 'dag',
      expert: 'research',
      genius: 'learning',
      collective: 'coordination',
      manager: 'hierarchical',
    };
    return modelMap[type] || 'chain-of-thought';
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string, userId?: string): Promise<Agent> {
    try {
      // Check registry first
      let agent = this.agentRegistry.get(agentId);

      if (!agent) {
        // Load from repository
        const foundAgent = await this.agentRepository.findById(
          agentId as AgentId,
        );
        if (foundAgent) {
          agent = foundAgent;
          this.agentRegistry.set(agentId, foundAgent);
        }
      }

      if (!agent) {
        throw new NotFoundException(`Agent '${agentId}' not found`);
      }

      return agent;
    } catch (error) {
      this.logger.error(
        'Failed to get agent',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * List agents for user
   */
  async listAgents(
    userId: string,
    filter?: { type?: string; active?: boolean },
  ): Promise<Agent[]> {
    try {
      let agents = Array.from(this.agentRegistry.values());

      // Apply filters
      if (filter?.type) {
        const agentType = this.mapAgentType(filter.type);
        agents = agents.filter((a) => a.agentType === agentType);
      }

      return agents.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    } catch (error) {
      this.logger.error(
        'Failed to list agents',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Update agent
   */
  async updateAgent(
    agentId: string,
    dto: UpdateAgentDTO,
    userId: string,
  ): Promise<Agent> {
    try {
      let agent = await this.getAgent(agentId, userId);

      // Update config if provided (Agent is immutable, so we create new instances)
      if (dto.config) {
        const updatedConfig = agent.config.update(dto.config);
        agent = agent.withConfig(updatedConfig);
      }

      // Persist to repository
      await this.agentRepository.save(agent);

      // Update registry
      this.agentRegistry.set(agentId, agent);

      this.logger.info('Agent updated', { agentId, userId });

      return agent;
    } catch (error) {
      this.logger.error(
        'Failed to update agent',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Delete agent
   */
  async deleteAgent(agentId: string, userId: string): Promise<void> {
    try {
      const agent = await this.getAgent(agentId, userId);

      // Persist deletion to repository
      await this.agentRepository.delete(agentId as AgentId);

      // Remove from registry
      this.agentRegistry.delete(agentId);

      // Remove instances
      this.agentInstances.delete(agentId);

      this.logger.info('Agent deleted', { agentId, userId });
    } catch (error) {
      this.logger.error(
        'Failed to delete agent',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Get or create agent instance
   */
  async getAgentInstance(agentId: string, userId: string): Promise<BaseAgent> {
    try {
      // Check if instance already exists
      let instance = this.agentInstances.get(agentId);

      if (instance) {
        return instance;
      }

      // Get agent definition
      const agent = await this.getAgent(agentId, userId);

      // Create instance
      instance = this.agentFactory.createInstance(agent);

      // Cache instance
      this.agentInstances.set(agentId, instance);

      this.logger.debug('Agent instance created', {
        agentId,
        type: agent.agentType,
      });

      return instance;
    } catch (error) {
      this.logger.error(
        'Failed to get agent instance',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Execute agent
   */
  async executeAgent(
    agentId: string,
    userId: string,
    input: string,
    context?: any,
  ): Promise<ExecutionResult> {
    try {
      const instance = await this.getAgentInstance(agentId, userId);
      const agent = await this.getAgent(agentId, userId);

      this.logger.info('Executing agent', {
        agentId,
        userId,
        inputLength: input.length,
      });

      // Execute
      const result = await instance.execute(input, context);

      // Note: execution stats would be tracked separately in a metrics system
      // Agent entity is immutable and doesn't have executionCount/lastExecuted

      return result;
    } catch (error) {
      this.logger.error(
        'Failed to execute agent',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Stream agent execution
   */
  async *streamAgent(
    agentId: string,
    userId: string,
    input: string,
    context?: any,
  ): AsyncGenerator<string> {
    try {
      const instance = await this.getAgentInstance(agentId, userId);
      const agent = await this.getAgent(agentId, userId);

      this.logger.info('Streaming agent execution', { agentId, userId });

      // Stream execution
      for await (const chunk of instance.stream(input, context)) {
        yield chunk;
      }

      // Note: execution stats would be tracked separately in a metrics system
    } catch (error) {
      this.logger.error(
        'Failed to stream agent',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Abort agent execution
   */
  async abortAgent(agentId: string): Promise<void> {
    try {
      const instance = this.agentInstances.get(agentId);

      if (!instance) {
        throw new NotFoundException(`Agent instance '${agentId}' not found`);
      }

      instance.abort();
      this.logger.info('Agent execution aborted', { agentId });
    } catch (error) {
      this.logger.error('Failed to abort agent', { error, agentId });
      throw error;
    }
  }

  /**
   * Get agent state
   */
  async getAgentState(agentId: string) {
    try {
      const instance = this.agentInstances.get(agentId);

      if (!instance) {
        throw new NotFoundException(`Agent instance '${agentId}' not found`);
      }

      return instance.getState();
    } catch (error) {
      this.logger.error(
        'Failed to get agent state',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Release session agents
   */
  async releaseSession(sessionId: string): Promise<void> {
    try {
      const agentIds = this.sessionAgents.get(sessionId) || [];

      for (const agentId of agentIds) {
        this.agentInstances.delete(agentId);
      }

      this.sessionAgents.delete(sessionId);

      this.logger.debug('Session released', {
        sessionId,
        agentCount: agentIds.length,
      });
    } catch (error) {
      this.logger.error(
        'Failed to release session',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Generate unique agent ID
   */
  private generateAgentId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    return {
      registeredAgents: this.agentRegistry.size,
      activeInstances: this.agentInstances.size,
      activeSessions: this.sessionAgents.size,
      // Note: execution stats would be tracked separately in a metrics system
      totalExecutions: 0,
    };
  }
}
