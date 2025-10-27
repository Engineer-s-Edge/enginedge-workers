import { Inject, Injectable } from '@nestjs/common';
import { AgentResponseDTO } from '../dto';
import { IAgentRepository } from '../ports/agent.repository';
import { AgentNotFoundException } from '../exceptions';

/**
 * GetAgentUseCase: Retrieve a single agent by ID
 */
@Injectable()
export class GetAgentUseCase {
  constructor(
    @Inject('IAgentRepository') private agentRepository: IAgentRepository,
  ) {}

  async execute(agentId: string): Promise<AgentResponseDTO> {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) {
      throw new AgentNotFoundException(agentId);
    }
    return AgentResponseDTO.fromAgent(agent);
  }
}
