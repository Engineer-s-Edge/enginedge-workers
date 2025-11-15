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
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AgentService } from '@application/services/agent.service';
import { ExecuteAgentUseCase } from '@application/use-cases/execute-agent.use-case';
import { CheckpointService } from '@application/services/checkpoint.service';

// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

interface EdgeHistoryQueryParams {
  userId?: string;
  limit?: string;
  cursor?: string;
  direction?: string;
  start?: string;
  end?: string;
}

/**
 * Graph Agent specialized controller
 */
@Controller('agents/graph')
export class GraphAgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    @Inject('ILogger')
    private readonly logger: Logger,
    private readonly checkpoints: CheckpointService,
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
        memoryGroups?: Array<{
          id: string;
          name: string;
          description?: string;
          memoryType?: string;
          vectorStore?: string;
          knowledgeGraphId?: string;
          ragPipelineId?: string;
          tags?: string[];
          metadata?: Record<string, unknown>;
        }>;
      };
    },
  ) {
    this.logger.info('Creating Graph agent', { name: body.name });

    const agent = await this.agentService.createAgent(
      {
        name: body.name,
        agentType: 'graph',
        config: { workflow: body.workflow as Record<string, unknown> },
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

    const state = await this.agentService.getGraphAgentExecutionState(
      agentId,
      userId,
    );

    return {
      agentId,
      ...state,
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

    // Fetch graph state if available
    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );
    const anyInstance = instance as any;
    const state =
      typeof anyInstance.getGraphState === 'function'
        ? anyInstance.getGraphState()
        : {};

    const cp = await this.checkpoints.createCheckpoint(
      agentId,
      body.userId,
      state,
      body.name,
    );

    return {
      checkpointId: cp.id,
      agentId,
      name: cp.name,
      createdAt: cp.createdAt.toISOString(),
    };
  }

  /**
   * POST /agents/graph/:id/resume - Resume from checkpoint (pause/resume semantics)
   */
  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  async resumeFromCheckpoint(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      checkpointId?: string;
    },
  ) {
    this.logger.info('Resuming from checkpoint', {
      agentId,
      checkpointId: body.checkpointId,
    });

    const res = await this.agentService.resumeGraphAgent(
      agentId,
      body.userId,
      body.checkpointId,
    );

    return {
      success: res.ok,
      message: res.message,
    };
  }

  /**
   * POST /agents/graph/:id/pause - Pause and checkpoint
   */
  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  async pauseGraph(
    @Param('id') agentId: string,
    @Body() body: { userId: string; reason?: string },
  ) {
    const res = await this.agentService.pauseGraphAgent(agentId, body.userId, {
      reason: body.reason,
    });
    return { success: true, checkpointId: res.checkpointId };
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

    await this.agentService.provideGraphAgentUserInput(
      agentId,
      body.userId,
      body.nodeId,
      body.input,
    );

    return {
      success: true,
      message: `Input provided to node ${body.nodeId}`,
    };
  }

  /**
   * POST /agents/graph/:id/approval - Provide approval for a node
   */
  @Post(':id/approval')
  @HttpCode(HttpStatus.OK)
  async provideApproval(
    @Param('id') agentId: string,
    @Body() body: { userId: string; nodeId: string; approved: boolean },
  ) {
    await this.agentService.provideGraphAgentUserApproval(
      agentId,
      body.userId,
      body.nodeId,
      body.approved,
    );
    return { success: true };
  }

  /**
   * POST /agents/graph/:id/chat-action - Provide chat action for a node
   */
  @Post(':id/chat-action')
  @HttpCode(HttpStatus.OK)
  async provideChatAction(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      nodeId: string;
      action: 'continue' | 'end';
      input?: string;
    },
  ) {
    await this.agentService.provideGraphAgentChatAction(
      agentId,
      body.userId,
      body.nodeId,
      body.action,
      body.input,
    );
    return { success: true };
  }

  /**
   * POST /agents/graph/:id/continue - Continue with new input (optionally from checkpoint)
   */
  @Post(':id/continue')
  @HttpCode(HttpStatus.OK)
  async continueWithInput(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      input: string;
      checkpointId?: string;
      stream?: boolean;
    },
  ) {
    const res = await this.agentService.continueGraphAgentWithInput(
      agentId,
      body.userId,
      body.input,
      { checkpointId: body.checkpointId, stream: body.stream },
    );

    if (body.stream && Symbol.asyncIterator in Object(res)) {
      // In a real HTTP streaming scenario you'd pipe this to response.
      // For now return a simple marker.
      return { success: true, message: 'Streaming started' };
    }

    return res;
  }

  /**
   * GET /agents/graph/:id/memory-groups - List shared memory groups
   */
  @Get(':id/memory-groups')
  async listMemoryGroups(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const groups = await this.agentService.getGraphMemoryGroups(
      agentId,
      userId,
    );

    return {
      agentId,
      total: groups.length,
      groups,
    };
  }

  /**
   * GET /agents/graph/:id/memory-groups/:groupId - Get specific memory group
   */
  @Get(':id/memory-groups/:groupId')
  async getMemoryGroup(
    @Param('id') agentId: string,
    @Param('groupId') groupId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const group = await this.agentService.getGraphMemoryGroup(
      agentId,
      userId,
      groupId,
    );

    if (!group) {
      throw new NotFoundException(
        `Memory group '${groupId}' not found for agent '${agentId}'`,
      );
    }

    return {
      agentId,
      group,
    };
  }

  /**
   * GET /agents/graph/:id/edges/:edgeId/queue - Inspect edge queue state
   */
  @Get(':id/edges/:edgeId/queue')
  async getEdgeQueue(
    @Param('id') agentId: string,
    @Param('edgeId') edgeId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const queue = await this.agentService.getGraphAgentEdgeQueue(
      agentId,
      userId,
      edgeId,
    );

    if (!queue) {
      throw new NotFoundException(
        `Edge queue '${edgeId}' not found for agent '${agentId}'`,
      );
    }

    return {
      agentId,
      edgeId,
      queue,
    };
  }

  /**
   * GET /agents/graph/:id/edges/:edgeId/history - Edge input history
   */
  @Get(':id/edges/:edgeId/history')
  async getEdgeHistory(
    @Param('id') agentId: string,
    @Param('edgeId') edgeId: string,
    @Query() query: EdgeHistoryQueryParams,
  ) {
    const { userId, limit, cursor, direction, start, end } = query;
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const parsedLimit = this.parsePositiveInteger(limit, 'limit');
    const parsedDirection = this.parseDirection(direction);
    const cursorIso = this.parseIsoTimestamp(cursor, 'cursor');
    const startIso = this.parseIsoTimestamp(start, 'start');
    const endIso = this.parseIsoTimestamp(end, 'end');

    const history = await this.agentService.getGraphEdgeHistory(
      agentId,
      userId,
      edgeId,
      {
        limit: parsedLimit,
        direction: parsedDirection,
        cursor: cursorIso,
        start: startIso,
        end: endIso,
      },
    );

    return {
      agentId,
      edgeId,
      limit: parsedLimit,
      filters: {
        cursor: cursorIso,
        direction: parsedDirection,
        start: startIso,
        end: endIso,
      },
      entries: history.entries,
      pageInfo: history.pageInfo,
    };
  }

  /**
   * GET /agents/graph/:id/edges/:edgeId/decisions - Edge decision history
   */
  @Get(':id/edges/:edgeId/decisions')
  async getEdgeDecisions(
    @Param('id') agentId: string,
    @Param('edgeId') edgeId: string,
    @Query() query: EdgeHistoryQueryParams,
  ) {
    const { userId, limit, cursor, direction, start, end } = query;
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const parsedLimit = this.parsePositiveInteger(limit, 'limit');
    const parsedDirection = this.parseDirection(direction);
    const cursorIso = this.parseIsoTimestamp(cursor, 'cursor');
    const startIso = this.parseIsoTimestamp(start, 'start');
    const endIso = this.parseIsoTimestamp(end, 'end');
    const decisions = await this.agentService.getGraphEdgeDecisionHistory(
      agentId,
      userId,
      edgeId,
      {
        limit: parsedLimit,
        direction: parsedDirection,
        cursor: cursorIso,
        start: startIso,
        end: endIso,
      },
    );

    return {
      agentId,
      edgeId,
      limit: parsedLimit,
      filters: {
        cursor: cursorIso,
        direction: parsedDirection,
        start: startIso,
        end: endIso,
      },
      entries: decisions.entries,
      pageInfo: decisions.pageInfo,
    };
  }

  /**
   * GET /agents/graph/:id/pending - List pending interactions
   */
  @Get(':id/pending')
  async listPendingInteractions(
    @Param('id') agentId: string,
    @Query('userId') _userId: string,
  ) {
    const pending =
      await this.agentService.getGraphAgentPendingUserInteractions(
        agentId,
        _userId,
      );
    return { pending };
  }

  /**
   * GET /agents/graph/:id/has-pending - Check pending interactions
   */
  @Get(':id/has-pending')
  async hasPending(
    @Param('id') agentId: string,
    @Query('userId') userId?: string,
  ) {
    if (userId) {
      const pending =
        await this.agentService.getGraphAgentPendingUserInteractions(
          agentId,
          userId,
        );
      return { has: pending.length > 0 };
    }

    const has =
      await this.agentService.hasGraphAgentAwaitingUserInteraction(agentId);
    return { has };
  }

  private parsePositiveInteger(
    value: string | undefined,
    field: string,
  ): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      throw new BadRequestException(
        `${field} must be a positive integer when provided`,
      );
    }

    return parsed;
  }

  private parseDirection(
    value: string | undefined,
  ): 'forward' | 'backward' | undefined {
    if (!value) {
      return undefined;
    }

    const normalized = value.toLowerCase();
    if (normalized !== 'forward' && normalized !== 'backward') {
      throw new BadRequestException(
        "direction must be either 'forward' or 'backward' when provided",
      );
    }

    return normalized as 'forward' | 'backward';
  }

  private parseIsoTimestamp(
    value: string | undefined,
    field: string,
  ): string | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(
        `${field} must be a valid ISO-8601 timestamp when provided`,
      );
    }

    return new Date(parsed).toISOString();
  }
}
