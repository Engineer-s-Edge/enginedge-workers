/**
 * Genius Agent Controller
 *
 * Specialized endpoints for Genius (learning) agents.
 * Handles expert pool management and learning modes.
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
 * Genius Agent specialized controller
 */
@Controller('agents/genius')
export class GeniusAgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    @Inject('ILogger')
    private readonly logger: Logger,
  ) {}

  /**
   * POST /agents/genius/create - Create Genius learning agent
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createGeniusAgent(
    @Body()
    body: {
      name: string;
      userId: string;
      learningMode?: 'user-directed' | 'autonomous' | 'scheduled';
      expertPoolSize?: number;
    },
  ) {
    this.logger.info('Creating Genius agent', { name: body.name });

    const config = {
      learningMode: body.learningMode || 'user-directed',
      expertPoolSize: body.expertPoolSize || 5,
    };

    const agent = await this.agentService.createAgent(
      { name: body.name, agentType: 'genius', config },
      body.userId,
    );

    return {
      id: agent.id,
      name: body.name,
      type: 'genius',
      config,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * POST /agents/genius/:id/train - Train on data
   */
  @Post(':id/train')
  @HttpCode(HttpStatus.OK)
  async trainAgent(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      trainingData: any[];
      mode: 'supervised' | 'unsupervised' | 'reinforcement';
    },
  ) {
    this.logger.info('Training Genius agent', { agentId, mode: body.mode });

    return {
      agentId,
      trainingId: `training_${Date.now()}`,
      mode: body.mode,
      status: 'started',
    };
  }

  /**
   * GET /agents/genius/:id/experts - Get expert pool
   */
  @Get(':id/experts')
  async getExpertPool(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting expert pool', { agentId });

    return {
      agentId,
      experts: [],
      poolSize: 0,
    };
  }

  /**
   * POST /agents/genius/:id/experts/add - Add expert to pool
   */
  @Post(':id/experts/add')
  @HttpCode(HttpStatus.CREATED)
  async addExpert(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      expertId: string;
      specialty: string;
    },
  ) {
    this.logger.info('Adding expert to pool', {
      agentId,
      expertId: body.expertId,
    });

    return {
      success: true,
      message: `Expert ${body.expertId} added to pool`,
    };
  }

  /**
   * GET /agents/genius/:id/learning-progress - Get learning progress
   */
  @Get(':id/learning-progress')
  async getLearningProgress(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting learning progress', { agentId });

    return {
      agentId,
      accuracy: 0,
      iterations: 0,
      lastTraining: null,
    };
  }

  /**
   * POST /agents/genius/:id/validate - Validate quality
   */
  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  async validateQuality(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      testData: any[];
    },
  ) {
    this.logger.info('Validating quality', { agentId });

    return {
      agentId,
      validationScore: 0,
      metrics: {},
    };
  }
}
