/**
 * Expert Agent Controller
 *
 * Specialized endpoints for Expert (research) agents.
 * Handles AIM-SHOOT-SKIN research methodology.
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
  Sse,
} from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { AgentService } from '@application/services/agent.service';
import { ExecuteAgentUseCase } from '@application/use-cases/execute-agent.use-case';
import { StreamAgentExecutionUseCase } from '@application/use-cases/stream-agent-execution.use-case';
import { ILogger } from '@application/ports/logger.port';

/**
 * Expert Agent specialized controller
 */
@Controller('agents/expert')
export class ExpertAgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    private readonly streamAgentExecutionUseCase: StreamAgentExecutionUseCase,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * POST /agents/expert/create - Create Expert research agent
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createExpertAgent(
    @Body()
    body: {
      name: string;
      userId: string;
      maxSources?: number;
      researchDepth?: 'shallow' | 'medium' | 'deep';
    },
  ) {
    this.logger.info('Creating Expert agent', { name: body.name });

    const config = {
      maxSources: body.maxSources || 10,
      researchDepth: body.researchDepth || 'medium',
    };

    const agent = await this.agentService.createAgent(
      { name: body.name, agentType: 'expert', config },
      body.userId,
    );

    return {
      id: agent.id,
      name: body.name,
      type: 'expert',
      config,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * POST /agents/expert/:id/research - Conduct research
   */
  @Post(':id/research')
  @HttpCode(HttpStatus.OK)
  async conductResearch(
    @Param('id') agentId: string,
    @Body()
    body: {
      query: string;
      userId: string;
      phases?: Array<'aim' | 'shoot' | 'skin'>;
    },
  ) {
    this.logger.info('Conducting research', { agentId, query: body.query });

    const result = await this.executeAgentUseCase.execute({
      agentId,
      userId: body.userId,
      input: body.query,
      context: {
        phases: body.phases || ['aim', 'shoot', 'skin'],
      },
    });

    return result;
  }

  /**
   * GET /agents/expert/:id/sources - Get research sources
   */
  @Get(':id/sources')
  async getResearchSources(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting research sources', { agentId });

    const agent = await this.agentService.getAgent(agentId, userId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return {
      agentId,
      sources: [],
      total: 0,
    };
  }

  /**
   * GET /agents/expert/:id/evidence - Get extracted evidence
   */
  @Get(':id/evidence')
  async getEvidence(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting extracted evidence', { agentId });

    return {
      agentId,
      evidence: [],
      total: 0,
    };
  }

  /**
   * GET /agents/expert/:id/contradictions - Get detected contradictions
   */
  @Get(':id/contradictions')
  async getContradictions(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting contradictions', { agentId });

    return {
      agentId,
      contradictions: [],
      total: 0,
    };
  }

  /**
   * POST /agents/expert/:id/synthesize - Generate research report
   */
  @Post(':id/synthesize')
  @HttpCode(HttpStatus.OK)
  async synthesizeReport(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      format?: 'markdown' | 'html' | 'pdf';
    },
  ) {
    this.logger.info('Synthesizing research report', { agentId });

    return {
      agentId,
      report: '',
      format: body.format || 'markdown',
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * GET /agents/expert/research/stream - Stream research progress (SSE)
   * Legacy-compatible endpoint matching /assistants/expert/research/stream
   */
  @Get('research/stream')
  @Sse()
  streamResearch(
    @Query('query') query: string,
    @Query('userId') userId: string,
    @Query('researchDepth') researchDepth?: 'basic' | 'advanced',
    @Query('maxSources') maxSources?: string,
    @Query('maxTokens') maxTokens?: string,
    @Query('useBertScore') useBertScore?: string,
    @Query('conversationId') conversationId?: string,
    @Query('agentId') agentId?: string,
  ): Observable<MessageEvent> {
    if (!query || !userId) {
      throw new Error('Query and userId are required');
    }

    const subject = new Subject<MessageEvent>();
    let heartbeatInterval: NodeJS.Timeout;

    // Send heartbeat every 30 seconds to keep connection alive
    heartbeatInterval = setInterval(() => {
      subject.next({
        data: JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }),
        type: 'heartbeat',
      } as MessageEvent);
    }, 30000);

    // Start streaming research
    (async () => {
      try {
        // If agentId is provided, use it; otherwise create a temporary agent or use default
        const targetAgentId = agentId || 'default-expert';

        // Send progress event: Phase start (AIM)
        subject.next({
          data: JSON.stringify({
            type: 'progress',
            phase: 'aim',
            message: 'Starting research analysis...',
            timestamp: new Date().toISOString(),
          }),
          type: 'progress',
        } as MessageEvent);

        // Stream agent execution
        const stream = this.streamAgentExecutionUseCase.execute({
          agentId: targetAgentId,
          userId,
          input: query,
          context: {
            conversationId,
            researchDepth,
            maxSources: maxSources ? parseInt(maxSources, 10) : undefined,
            maxTokens: maxTokens ? parseInt(maxTokens, 10) : undefined,
            useBertScore: useBertScore === 'true',
          },
        });

        let phase = 'aim';
        let chunkCount = 0;

        for await (const chunk of stream) {
          chunkCount++;

          // Send chunk events
          subject.next({
            data: JSON.stringify({
              type: 'chunk',
              content: chunk,
              phase,
              chunkIndex: chunkCount,
              timestamp: new Date().toISOString(),
            }),
            type: 'chunk',
          } as MessageEvent);

          // Simulate phase transitions based on chunk count (for demo purposes)
          // In real implementation, this would come from the agent's state
          if (chunkCount === 10 && phase === 'aim') {
            phase = 'shoot';
            subject.next({
              data: JSON.stringify({
                type: 'progress',
                phase: 'shoot',
                message: 'Gathering sources and evidence...',
                timestamp: new Date().toISOString(),
              }),
              type: 'progress',
            } as MessageEvent);
          } else if (chunkCount === 25 && phase === 'shoot') {
            phase = 'skin';
            subject.next({
              data: JSON.stringify({
                type: 'progress',
                phase: 'skin',
                message: 'Synthesizing findings...',
                timestamp: new Date().toISOString(),
              }),
              type: 'progress',
            } as MessageEvent);
          }
        }

        // Send final event
        subject.next({
          data: JSON.stringify({
            type: 'final',
            message: 'Research completed',
            totalChunks: chunkCount,
            timestamp: new Date().toISOString(),
          }),
          type: 'final',
        } as MessageEvent);

        clearInterval(heartbeatInterval);
        subject.complete();
      } catch (error: any) {
        clearInterval(heartbeatInterval);
        subject.next({
          data: JSON.stringify({
            type: 'error',
            error: error.message || 'Stream error',
            timestamp: new Date().toISOString(),
          }),
          type: 'error',
        } as MessageEvent);
        subject.complete();
      }
    })();

    return subject.asObservable();
  }
}
