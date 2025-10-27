import { Inject, Injectable } from '@nestjs/common';
import { ListAgentsQueryDTO, AgentResponseDTO } from '../dto';
import { IAgentRepository } from '../ports/agent.repository';
import { AgentDTOValidator } from '../validators/agent.validator';
import { InvalidDTOException } from '../exceptions';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

@Injectable()
export class ListAgentsUseCase {
  constructor(
    @Inject('IAgentRepository') private agentRepository: IAgentRepository,
    private agentValidator: AgentDTOValidator,
  ) {}

  async execute(dto: ListAgentsQueryDTO): Promise<PaginatedResponse<AgentResponseDTO>> {
    const agents = await this.agentRepository.findAll({
      limit: dto.limit,
      offset: dto.page * dto.limit,
    });

    const responseAgents = agents.map((agent) => AgentResponseDTO.fromAgent(agent));
    const hasMore = (dto.page + 1) * dto.limit < agents.length;

    return {
      items: responseAgents,
      total: agents.length,
      page: dto.page,
      limit: dto.limit,
      hasMore,
    };
  }
}
