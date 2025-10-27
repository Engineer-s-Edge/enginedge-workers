import { Injectable, Inject } from '@nestjs/common';
import { Agent } from '../../domain/entities/agent.entity';
import { AgentConfig } from '../../domain/value-objects/agent-config.vo';
import { AgentCapability } from '../../domain/value-objects/agent-capability.vo';
import { IAgentRepository } from '../ports/agent.repository';
import { ILogger } from '../ports/logger.port';

/**
 * Create Agent Request
 */
export interface CreateAgentRequest {
  name: string;
  model: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  enableTools?: boolean;
  userId?: string;
}

/**
 * Create Agent Use Case
 * 
 * Creates a new agent with validation
 */
@Injectable()
export class CreateAgentUseCase {
  constructor(
    @Inject('IAgentRepository')
    private readonly agentRepository: IAgentRepository,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  async execute(request: CreateAgentRequest): Promise<Agent> {
    this.logger.info('CreateAgentUseCase: Creating new agent', {
      name: request.name,
      model: request.model,
    });

    try {
      // 1. Check if agent with name already exists
      const existing = await this.agentRepository.findByName(request.name);
      
      if (existing) {
        throw new Error(`Agent with name '${request.name}' already exists`);
      }

      // 2. Create configuration
      const config = AgentConfig.create({
        model: request.model,
        provider: request.provider,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
        systemPrompt: request.systemPrompt,
        enableTools: request.enableTools,
      });

      // 3. Create agent (default to react type for backward compatibility)
      // TODO: Update in Phase 3 to support agent type selection
      const agent = Agent.create(
        request.name,
        'react',
        config,
        AgentCapability.forReAct(),
      );

      // 4. Save to repository
      await this.agentRepository.save(agent);

      this.logger.info('CreateAgentUseCase: Agent created successfully', {
        agentId: agent.id,
        name: agent.name,
      });

      return agent;
    } catch (error) {
      this.logger.error('Failed to create agent', {
        name: request.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
