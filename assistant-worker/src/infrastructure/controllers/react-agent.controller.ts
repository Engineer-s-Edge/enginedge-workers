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
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AgentService } from '@application/services/agent.service';
import { ExecuteAgentUseCase } from '@application/use-cases/execute-agent.use-case';
import { StreamAgentExecutionUseCase } from '@application/use-cases/stream-agent-execution.use-case';
import { UpdateAgentDTO } from '@application/dto/agent.dto';
import { Agent } from '@domain/entities/agent.entity';
import {
  ReActAgent,
  ReasoningTrace,
  Thought,
  Action,
  Observation,
} from '@domain/agents/react-agent/react-agent';
// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

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
    private readonly logger: Logger,
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
      reasoning: body.showReasoning
        ? this.extractReasoning(result.metadata)
        : undefined,
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
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const resolvedLimit = this.normalizeLimit(limit);
    const { instance } = await this.ensureReActAgent(agentId, userId);
    const trace = instance.getReasoningTrace(resolvedLimit);
    const state = instance.getState();
    const metadata = state.getMetadata() || {};

    return {
      agentId,
      limit: resolvedLimit,
      status: state.getCurrentState(),
      reasoning: this.serializeReasoningTrace(trace),
      thinkingSteps: trace.thinkingSteps.map((step, index) => ({
        index,
        step: step.step,
        timestamp: this.toIsoString(step.timestamp),
      })),
      toolExecutions: trace.toolExecutions.map((tool, index) => ({
        index,
        name: tool.name,
        input: tool.input,
        output: tool.output,
        timestamp: this.toIsoString(tool.timestamp),
      })),
      registeredTools: instance.getRegisteredTools(),
      metrics: {
        totalThoughts: trace.thoughts.length,
        totalActions: trace.actions.length,
        totalObservations: trace.observations.length,
        iterations:
          (typeof metadata?.iterations === 'number'
            ? (metadata.iterations as number)
            : trace.thoughts.length) || 0,
      },
      lastUpdate: this.toIsoString(metadata?.lastUpdate as Date | string | undefined),
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
    if (!body?.userId) {
      throw new BadRequestException('userId is required');
    }
    if (!body?.toolName) {
      throw new BadRequestException('toolName is required');
    }

    const normalizedTool = body.toolName.trim();
    if (!normalizedTool) {
      throw new BadRequestException('toolName cannot be empty');
    }

    this.logger.info('Adding tool to ReAct agent', {
      agentId,
      tool: normalizedTool,
    });

    const agent = await this.agentService.getAgent(agentId, body.userId);
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }

    const existingTools = Array.isArray(agent.config.toolNames)
      ? [...agent.config.toolNames]
      : [];

    if (existingTools.includes(normalizedTool)) {
      const instance = await this.agentService.getAgentInstance(
        agentId,
        body.userId,
      );
      if (instance instanceof ReActAgent) {
        instance.registerTool(normalizedTool);
      }

      return {
        success: true,
        message: `Tool ${normalizedTool} already registered for agent ${agentId}`,
        tools: existingTools,
      };
    }

    const updatedTools = [...existingTools, normalizedTool];
    const updateDto = new UpdateAgentDTO({
      config: {
        enableTools: true,
        toolNames: updatedTools,
      },
    });

    await this.agentService.updateAgent(agentId, updateDto, body.userId);

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );
    if (instance instanceof ReActAgent) {
      instance.registerTool(normalizedTool);
    }

    return {
      success: true,
      message: `Tool ${normalizedTool} added to agent ${agentId}`,
      tools: updatedTools,
    };
  }

  // Helper methods
  private extractReasoning(metadata?: Record<string, unknown>) {
    if (!metadata) {
      return undefined;
    }

    const thoughts = this.serializeThoughts(
      (metadata.thoughts as Thought[]) || [],
    );
    const actions = this.serializeActions(
      (metadata.actions as Action[]) || [],
    );
    const observations = this.serializeObservations(
      (metadata.observations as Observation[]) || [],
    );

    if (!thoughts.length && !actions.length && !observations.length) {
      return undefined;
    }

    return {
      iterations:
        (typeof metadata.iterations === 'number'
          ? (metadata.iterations as number)
          : thoughts.length) || 0,
      thoughts,
      actions,
      observations,
    };
  }

  private serializeReasoningTrace(trace: ReasoningTrace) {
    return {
      thoughts: this.serializeThoughts(trace.thoughts),
      actions: this.serializeActions(trace.actions),
      observations: this.serializeObservations(trace.observations),
    };
  }

  private serializeThoughts(thoughts: Thought[]) {
    return thoughts.map((thought, index) => ({
      index,
      reasoning: thought.reasoning,
      timestamp: this.toIsoString(thought.timestamp),
    }));
  }

  private serializeActions(actions: Action[]) {
    return actions.map((action, index) => ({
      index,
      type: action.type,
      toolName: action.toolName,
      input: action.input,
      answer: action.answer,
    }));
  }

  private serializeObservations(observations: Observation[]) {
    return observations.map((observation, index) => ({
      index,
      result: observation.result,
      timestamp: this.toIsoString(observation.timestamp),
    }));
  }

  private toIsoString(value?: Date | string | null): string | null {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(Number(limit))) {
      return 50;
    }

    const parsed = Number(limit);
    return Math.min(Math.max(parsed, 1), 200);
  }

  private async ensureReActAgent(
    agentId: string,
    userId: string,
    existingAgent?: Agent,
  ): Promise<{ agent: Agent; instance: ReActAgent }> {
    const agent = existingAgent || (await this.agentService.getAgent(agentId, userId));
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);
    if (!(instance instanceof ReActAgent)) {
      throw new BadRequestException(
        `Agent ${agentId} is not a ReAct agent (type: ${agent.agentType})`,
      );
    }

    const persistedTools = Array.isArray(agent.config.toolNames)
      ? [...agent.config.toolNames]
      : [];
    for (const tool of persistedTools) {
      instance.registerTool(tool);
    }

    return { agent, instance };
  }
}
