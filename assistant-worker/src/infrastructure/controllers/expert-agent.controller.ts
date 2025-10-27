/**
 * Expert Agent Controller
 * 
 * Specialized endpoints for Expert (research) agents.
 * Handles AIM-SHOOT-SKIN research methodology.
 */

import { Controller, Post, Get, Body, Param, Query, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { AgentService } from '@application/services/agent.service';
import { ExecuteAgentUseCase } from '@application/use-cases/execute-agent.use-case';
import { ILogger } from '@application/ports/logger.port';

/**
 * Expert Agent specialized controller
 */
@Controller('agents/expert')
export class ExpertAgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * POST /agents/expert/create - Create Expert research agent
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createExpertAgent(@Body() body: {
    name: string;
    userId: string;
    maxSources?: number;
    researchDepth?: 'shallow' | 'medium' | 'deep';
  }) {
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
    @Body() body: {
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
    @Body() body: {
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
}

