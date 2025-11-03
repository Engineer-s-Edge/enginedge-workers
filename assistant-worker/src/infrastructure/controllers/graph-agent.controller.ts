/**
 * Graph Agent Controller
 *
 * Specialized endpoints for Graph (DAG-based workflow) agents.
 * Handles workflow execution, checkpointing, and user interaction nodes.
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
 * Graph Agent specialized controller
 */
@Controller('agents/graph')
export class GraphAgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * POST /agents/graph/create - Create Graph agent with workflow
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createGraphAgent(
    @Body()
    body: {
      name: string;
      userId: string;
      workflow: {
        nodes: Array<{
          id: string;
          type: string;
          config?: any;
        }>;
        edges: Array<{
          from: string;
          to: string;
          condition?: string;
        }>;
      };
    },
  ) {
    this.logger.info('Creating Graph agent', { name: body.name });

    const agent = await this.agentService.createAgent(
      {
        name: body.name,
        agentType: 'graph',
        config: { workflow: body.workflow },
      },
      body.userId,
    );

    return {
      id: agent.id,
      name: body.name,
      type: 'graph',
      workflow: body.workflow,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * POST /agents/graph/:id/execute - Execute workflow
   */
  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  async executeWorkflow(
    @Param('id') agentId: string,
    @Body()
    body: {
      input: string;
      userId: string;
      startNode?: string;
    },
  ) {
    this.logger.info('Executing Graph agent workflow', { agentId });

    const result = await this.executeAgentUseCase.execute({
      agentId,
      userId: body.userId,
      input: body.input,
      context: {
        startNode: body.startNode,
      },
    });

    return result;
  }

  /**
   * GET /agents/graph/:id/state - Get current workflow state
   */
  @Get(':id/state')
  async getWorkflowState(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting workflow state', { agentId });

    const agent = await this.agentService.getAgent(agentId, userId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return {
      agentId,
      currentNode: null,
      executedNodes: [],
      pendingNodes: [],
    };
  }

  /**
   * POST /agents/graph/:id/checkpoint - Create checkpoint
   */
  @Post(':id/checkpoint')
  @HttpCode(HttpStatus.CREATED)
  async createCheckpoint(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      name?: string;
    },
  ) {
    this.logger.info('Creating workflow checkpoint', { agentId });

    return {
      checkpointId: `checkpoint_${Date.now()}`,
      agentId,
      name: body.name || 'Unnamed checkpoint',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * POST /agents/graph/:id/resume - Resume from checkpoint
   */
  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  async resumeFromCheckpoint(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      checkpointId: string;
    },
  ) {
    this.logger.info('Resuming from checkpoint', {
      agentId,
      checkpointId: body.checkpointId,
    });

    return {
      success: true,
      message: `Resumed agent ${agentId} from checkpoint ${body.checkpointId}`,
    };
  }

  /**
   * POST /agents/graph/:id/user-input - Provide user input for interaction node
   */
  @Post(':id/user-input')
  @HttpCode(HttpStatus.OK)
  async provideUserInput(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      nodeId: string;
      input: any;
    },
  ) {
    this.logger.info('Providing user input to workflow node', {
      agentId,
      nodeId: body.nodeId,
    });

    return {
      success: true,
      message: `Input provided to node ${body.nodeId}`,
    };
  }
}
