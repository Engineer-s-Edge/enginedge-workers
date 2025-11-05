/**
 * Collective Agent Controller
 *
 * Specialized endpoints for Collective (multi-agent orchestration) agents.
 * Handles PM-style task decomposition and coordination.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { AgentService } from '@application/services/agent.service';
import { ExecuteAgentUseCase } from '@application/use-cases/execute-agent.use-case';
// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Collective Agent specialized controller
 */
@Controller('agents/collective')
export class CollectiveAgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    @Inject('ILogger')
    private readonly logger: Logger,
  ) {}

  /**
   * POST /agents/collective/create - Create Collective orchestration agent
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createCollectiveAgent(
    @Body()
    body: {
      name: string;
      userId: string;
      maxAgents?: number;
      coordinationStrategy?: 'sequential' | 'parallel' | 'hierarchical';
    },
  ) {
    this.logger.info('Creating Collective agent', { name: body.name });

    const config = {
      maxAgents: body.maxAgents || 10,
      coordinationStrategy: body.coordinationStrategy || 'hierarchical',
    };

    const agent = await this.agentService.createAgent(
      { name: body.name, agentType: 'collective', config },
      body.userId,
    );

    return {
      id: agent.id,
      name: body.name,
      type: 'collective',
      config,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * POST /agents/collective/:id/orchestrate - Orchestrate multi-agent task
   */
  @Post(':id/orchestrate')
  @HttpCode(HttpStatus.OK)
  async orchestrateTask(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      task: string;
      subAgents?: string[];
    },
  ) {
    this.logger.info('Orchestrating task', { agentId });

    const result = await this.executeAgentUseCase.execute({
      agentId,
      userId: body.userId,
      input: body.task,
      context: {
        subAgents: body.subAgents,
      },
    });

    return result;
  }

  /**
   * GET /agents/collective/:id/sub-agents - Get sub-agent status
   */
  @Get(':id/sub-agents')
  async getSubAgents(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting sub-agents', { agentId });

    return {
      agentId,
      subAgents: [],
      total: 0,
    };
  }

  /**
   * POST /agents/collective/:id/sub-agents/add - Add sub-agent
   */
  @Post(':id/sub-agents/add')
  @HttpCode(HttpStatus.CREATED)
  async addSubAgent(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      subAgentId: string;
      role: string;
    },
  ) {
    this.logger.info('Adding sub-agent', {
      agentId,
      subAgentId: body.subAgentId,
    });

    return {
      success: true,
      message: `Sub-agent ${body.subAgentId} added`,
    };
  }

  /**
   * GET /agents/collective/:id/task-queue - Get task queue
   */
  @Get(':id/task-queue')
  async getTaskQueue(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting task queue', { agentId });

    return {
      agentId,
      queue: [],
      pending: 0,
      inProgress: 0,
      completed: 0,
    };
  }

  /**
   * GET /agents/collective/:id/artifacts - Get generated artifacts
   */
  @Get(':id/artifacts')
  async getArtifacts(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting artifacts', { agentId });

    return {
      agentId,
      artifacts: [],
      total: 0,
    };
  }
}
