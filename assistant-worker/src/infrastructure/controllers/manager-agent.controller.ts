/**
 * Manager Agent Controller
 *
 * Specialized endpoints for Manager (task coordination) agents.
 * Handles task breakdown and sub-agent coordination.
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
import { ILogger } from '@application/ports/logger.port';

/**
 * Manager Agent specialized controller
 */
@Controller('agents/manager')
export class ManagerAgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * POST /agents/manager/create - Create Manager coordination agent
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createManagerAgent(
    @Body()
    body: {
      name: string;
      userId: string;
      decompositionStrategy?: 'functional' | 'hierarchical' | 'temporal';
      maxSubAgents?: number;
    },
  ) {
    this.logger.info('Creating Manager agent', { name: body.name });

    const config = {
      decompositionStrategy: body.decompositionStrategy || 'functional',
      maxSubAgents: body.maxSubAgents || 5,
    };

    const agent = await this.agentService.createAgent(
      { name: body.name, agentType: 'manager', config },
      body.userId,
    );

    return {
      id: agent.id,
      name: body.name,
      type: 'manager',
      config,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * POST /agents/manager/:id/decompose - Decompose task
   */
  @Post(':id/decompose')
  @HttpCode(HttpStatus.OK)
  async decomposeTask(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      masterTask: string;
    },
  ) {
    this.logger.info('Decomposing task', { agentId });

    return {
      agentId,
      masterTask: body.masterTask,
      subtasks: [],
      executionPlan: {},
    };
  }

  /**
   * POST /agents/manager/:id/coordinate - Coordinate execution
   */
  @Post(':id/coordinate')
  @HttpCode(HttpStatus.OK)
  async coordinateExecution(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      task: string;
      strategy?: 'sequential' | 'parallel' | 'hierarchical';
    },
  ) {
    this.logger.info('Coordinating execution', { agentId });

    const result = await this.executeAgentUseCase.execute({
      agentId,
      userId: body.userId,
      input: body.task,
      context: {
        strategy: body.strategy || 'hierarchical',
      },
    });

    return result;
  }

  /**
   * GET /agents/manager/:id/subtasks - Get subtask status
   */
  @Get(':id/subtasks')
  async getSubtasks(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting subtasks', { agentId });

    return {
      agentId,
      subtasks: [],
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
    };
  }

  /**
   * POST /agents/manager/:id/aggregate - Aggregate results
   */
  @Post(':id/aggregate')
  @HttpCode(HttpStatus.OK)
  async aggregateResults(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      subtaskResults: any[];
    },
  ) {
    this.logger.info('Aggregating results', { agentId });

    return {
      agentId,
      aggregatedResult: {},
      completeness: 0,
    };
  }
}
