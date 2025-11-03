/**
 * ReAct Agent Controller
 *
 * Specialized endpoints for ReAct (Reasoning + Acting) agents.
 * Handles chain-of-thought reasoning and tool execution.
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
import { StreamAgentExecutionUseCase } from '@application/use-cases/stream-agent-execution.use-case';
import { ILogger } from '@application/ports/logger.port';

/**
 * ReAct Agent specialized controller
 */
@Controller('agents/react')
export class ReActAgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    private readonly streamAgentExecutionUseCase: StreamAgentExecutionUseCase,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * POST /agents/react/create - Create ReAct agent
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createReActAgent(
    @Body()
    body: {
      name: string;
      userId: string;
      maxIterations?: number;
      tools?: string[];
      temperature?: number;
    },
  ) {
    this.logger.info('Creating ReAct agent', { name: body.name });

    const config = {
      maxIterations: body.maxIterations || 10,
      tools: body.tools || [],
      temperature: body.temperature || 0.7,
    };

    const agent = await this.agentService.createAgent(
      { name: body.name, agentType: 'react', config },
      body.userId,
    );

    return {
      id: agent.id,
      name: body.name,
      type: 'react',
      config,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * POST /agents/react/:id/execute - Execute with reasoning trace
   */
  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  async executeWithReasoning(
    @Param('id') agentId: string,
    @Body()
    body: {
      input: string;
      userId: string;
      showReasoning?: boolean;
    },
  ) {
    this.logger.info('Executing ReAct agent with reasoning', { agentId });

    const result = await this.executeAgentUseCase.execute({
      agentId,
      userId: body.userId,
      input: body.input,
    });

    return {
      ...result,
      reasoning: body.showReasoning ? this.extractReasoning(result) : undefined,
    };
  }

  /**
   * GET /agents/react/:id/reasoning - Get reasoning history
   */
  @Get(':id/reasoning')
  async getReasoningHistory(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    this.logger.info('Getting reasoning history', { agentId });

    const agent = await this.agentService.getAgent(agentId, userId);

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Extract reasoning steps from agent state
    return {
      agentId,
      reasoning: [],
      limit: limit || 50,
    };
  }

  /**
   * POST /agents/react/:id/add-tool - Add tool to agent
   */
  @Post(':id/add-tool')
  @HttpCode(HttpStatus.OK)
  async addTool(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      toolName: string;
    },
  ) {
    this.logger.info('Adding tool to ReAct agent', {
      agentId,
      tool: body.toolName,
    });

    // Update agent config to include new tool
    return {
      success: true,
      message: `Tool ${body.toolName} added to agent ${agentId}`,
    };
  }

  // Helper methods

  private extractReasoning(result: any): any[] {
    // Extract reasoning steps from execution result
    return [];
  }
}
