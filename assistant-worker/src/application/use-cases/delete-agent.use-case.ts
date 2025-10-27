import { Inject, Injectable } from '@nestjs/common';
import { DeleteAgentDTO } from '../dto';
import { IAgentRepository } from '../ports/agent.repository';
import { AgentNotFoundException, AgentInUseException } from '../exceptions';

export interface DeleteAgentResponse {
  id: string;
  deleted: boolean;
  deletedAt: Date;
}

/**
 * DeleteAgentUseCase: Remove an agent from the system
 *
 * Supports soft and hard delete strategies.
 * Can force delete even if agent is in use (cascade delete child agents).
 */
@Injectable()
export class DeleteAgentUseCase {
  constructor(
    @Inject('IAgentRepository') private agentRepository: IAgentRepository,
  ) {}

  async execute(dto: DeleteAgentDTO): Promise<DeleteAgentResponse> {
    // Check if agent exists
    const agent = await this.agentRepository.findById(dto.agentId);
    if (!agent) {
      throw new AgentNotFoundException(dto.agentId);
    }

    // Check if agent is in use (has parent references)
    if (!dto.force && agent.childAgents && agent.childAgents.length > 0) {
      throw new AgentInUseException(
        dto.agentId,
        'Agent has child agents. Use force flag to cascade delete.',
      );
    }

    // Delete agent
    await this.agentRepository.delete(dto.agentId);

    return {
      id: dto.agentId,
      deleted: true,
      deletedAt: new Date(),
    };
  }
}
