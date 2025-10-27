import { Inject, Injectable } from '@nestjs/common';
import { ConfigureAgentDTO, AgentResponseDTO } from '../dto';
import { IAgentRepository } from '../ports/agent.repository';
import { AgentNotFoundException } from '../exceptions';

/**
 * ConfigureAgentUseCase: Update agent configuration
 *
 * Allows dynamic reconfiguration of agent parameters (model, temperature, etc.)
 */
@Injectable()
export class ConfigureAgentUseCase {
  constructor(
    @Inject('IAgentRepository') private agentRepository: IAgentRepository,
  ) {}

  async execute(dto: ConfigureAgentDTO): Promise<AgentResponseDTO> {
    // Fetch existing agent
    const agent = await this.agentRepository.findById(dto.agentId);
    if (!agent) {
      throw new AgentNotFoundException(dto.agentId);
    }

    // Update configuration using immutable update pattern
    const updatedConfig = agent.config.update(
      dto.config as Record<string, string | number | boolean>,
    );
    const updatedAgent = agent.withConfig(updatedConfig);

    // Persist changes
    await this.agentRepository.save(updatedAgent);

    return AgentResponseDTO.fromAgent(updatedAgent);
  }
}
