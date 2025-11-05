import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ExecuteAgentUseCase } from '@application/use-cases/execute-agent.use-case';
import { StreamAgentExecutionUseCase } from '@application/use-cases/stream-agent-execution.use-case';
import { AgentService } from '@application/services/agent.service';
import { AgentEventService } from '@application/services/agent-event.service';

// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
import { SSEStreamAdapter } from '@infrastructure/adapters/streaming/sse-stream.adapter';
import { AgentSessionService } from '@application/services/agent-session.service';

/**
 * Agent Controller - HTTP API for agent operations (Phase 1 Complete)
 *
 * Implements all 7 core Phase 1 endpoints:
 * - POST /agents/create
 * - GET /agents
 * - GET /agents/:id
 * - POST /agents/:id/execute
 * - POST /agents/:id/stream
 * - DELETE /agents/:id
 * - POST /agents/:id/abort
 */
@Controller('agents')
export class AgentController {
  constructor(
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    private readonly streamAgentExecutionUseCase: StreamAgentExecutionUseCase,
    private readonly agentService: AgentService,
    @Inject('ILogger')
    private readonly logger: Logger,
    private readonly events: AgentEventService,
    private readonly sse: SSEStreamAdapter,
    private readonly sessions: AgentSessionService,
  ) {}

  /**
   * POST /agents/create - Create a new agent
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body()
    body: {
      name: string;
      type: 'react' | 'graph' | 'expert' | 'genius' | 'collective' | 'manager';
      userId: string;
      config?: Record<string, unknown>;
    },
  ) {
    this.logger.info('Creating agent', { name: body.name, type: body.type });

    const agent = await this.agentService.createAgent(
      {
        name: body.name,
        agentType: body.type,
        config: (body.config || {}) as any,
      },
      body.userId,
    );

    return {
      id: agent.id,
      name: body.name,
      type: body.type,
      state: 'idle',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * GET /agents - List all agents for user
   */
  @Get()
  async listAgents(@Query('userId') userId: string) {
    this.logger.info('Listing agents', { userId });

    const agents = await this.agentService.listAgents(userId);

    return {
      total: agents.length,
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.name || 'Unknown',
        type: 'unknown',
        state: agent.getState().getCurrentState(),
      })),
    };
  }

  /**
   * GET /agents/:id - Get agent details
   */
  @Get(':id')
  async getAgent(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting agent', { agentId });

    const agent = await this.agentService.getAgent(agentId, userId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return {
      id: agent.id,
      name: agent.name || 'Unknown',
      state: agent.getState().getCurrentState(),
      config: agent.config || {},
    };
  }

  /**
   * POST /agents/:id/execute - Execute agent (non-streaming)
   */
  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  async execute(
    @Param('id') agentId: string,
    @Body()
    body: {
      input: string;
      userId: string;
      sessionId?: string;
      conversationId?: string;
    },
  ) {
    this.logger.info('Executing agent', { agentId, userId: body.userId });

    const result = await this.executeAgentUseCase.execute({
      agentId,
      userId: body.userId,
      input: body.input,
      context: {
        sessionId: body.sessionId,
        conversationId: body.conversationId,
      },
    });

    return result;
  }

  /**
   * POST /agents/:id/stream - Execute agent with streaming
   */
  @Post(':id/stream')
  @HttpCode(HttpStatus.OK)
  async executeStream(
    @Param('id') agentId: string,
    @Body()
    body: {
      input: string;
      userId: string;
      sessionId?: string;
      conversationId?: string;
    },
  ): Promise<{ stream: string[] }> {
    this.logger.info('Stream executing agent', { agentId });

    const chunks: string[] = [];

    for await (const chunk of this.streamAgentExecutionUseCase.execute({
      agentId,
      userId: body.userId,
      input: body.input,
      context: {
        sessionId: body.sessionId,
        conversationId: body.conversationId,
      },
    })) {
      chunks.push(chunk);
    }

    return { stream: chunks };
  }

  /**
   * DELETE /agents/:id - Delete agent
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAgent(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Deleting agent', { agentId });

    await this.agentService.deleteAgent(agentId, userId);

    return { success: true };
  }

  /**
   * POST /agents/:id/abort - Abort agent execution
   */
  @Post(':id/abort')
  @HttpCode(HttpStatus.OK)
  async abortAgent(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Aborting agent', { agentId });

    await this.agentService.abortAgent(agentId);

    return { success: true, message: 'Agent execution aborted' };
  }

  /**
   * GET /agents/events/stream - Subscribe to agent events via SSE
   */
  @Get('events/stream')
  async streamAgentEvents(
    @Res() res: Response,
    @Query('userId') userId?: string,
    @Query('agentId') agentId?: string,
    @Query('types') types?: string,
  ) {
    const filter = {
      userId,
      agentId,
      types: types ? (types.split(',') as any) : undefined,
    } as any;

    const streamId = `events-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Initialize SSE stream
    this.sse.initializeStream(streamId, res);

    // Subscribe to events and forward to SSE
    const subscriptionId = `sub-${streamId}`;
    this.events.subscribeToAgentEvents(subscriptionId, filter, (event) => {
      this.sse.sendToStream(streamId, {
        type: 'progress',
        data: event,
        timestamp: new Date(),
      });
    });
  }

  /**
   * GET /agents/stats - Basic agent/session stats
   */
  @Get('stats')
  async getStats(@Query('userId') userId?: string) {
    const sessions = userId ? this.sessions.getUserSessions(userId) : [];

    return {
      sessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status === 'active').length,
      pausedSessions: sessions.filter((s) => s.status === 'paused').length,
    };
  }
}
