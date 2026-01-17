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
  agentType?:
    | 'react'
    | 'graph'
    | 'expert'
    | 'genius'
    | 'collective'
    | 'manager';
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

      // 3. Determine agent type and create appropriate capability
      const agentType = request.agentType || 'react';
      let capability: AgentCapability;

      switch (agentType) {
        case 'react':
          capability = AgentCapability.forReAct();
          break;
        case 'graph':
          capability = AgentCapability.forGraph();
          break;
        case 'expert':
          capability = AgentCapability.forExpert();
          break;
        case 'genius':
          capability = AgentCapability.forGenius();
          break;
        case 'collective':
          capability = AgentCapability.forCollective();
          break;
        case 'manager':
          capability = AgentCapability.forManager();
          break;
        default:
          this.logger.warn(
            `Unknown agent type: ${agentType}, defaulting to react`,
          );
          capability = AgentCapability.forReAct();
      }

      // 4. Create agent with selected type
      const agent = Agent.create(request.name, agentType, config, capability);

      // 5. Save to repository
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
