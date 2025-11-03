/**
 * Execute Agent Use Case
 *
 * Orchestrates synchronous agent execution with caching, logging, and error handling.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger, ILLMProvider } from '@application/ports';
import { AgentService } from '@application/services/agent.service';
import { ExecutionContext, ExecutionResult } from '@domain/entities';

export interface ExecuteAgentRequest {
  agentId: string;
  userId: string;
  input: string;
  context?: Partial<ExecutionContext>;
}

export interface ExecuteAgentResponse {
  agentId: string;
  status: string;
  output: unknown;
  duration: number;
  metadata?: Record<string, unknown>;
}

/**
 * Use case for executing agents
 */
@Injectable()
export class ExecuteAgentUseCase {
  constructor(
    private readonly agentService: AgentService,
    @Inject('ILogger')
    private readonly logger: ILogger,
    @Inject('ILLMProvider')
    private readonly llmProvider: ILLMProvider,
  ) {}

  /**
   * Execute an agent synchronously
   */
  async execute(request: ExecuteAgentRequest): Promise<ExecuteAgentResponse> {
    const startTime = Date.now();

    try {
      this.logger.info('Executing agent', {
        agentId: request.agentId,
        userId: request.userId,
      });

      // Verify agent exists
      const agent = await this.agentService.getAgent(
        request.agentId,
        request.userId,
      );
      if (!agent) {
        throw new Error(`Agent ${request.agentId} not found`);
      }

      // Create execution context
      const context = {
        userId: request.userId,
        sessionId: request.context?.sessionId,
        conversationId: request.context?.conversationId,
        contextId: `exec-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...request.context,
      } as ExecutionContext;

      // Execute agent
      const result = await this.agentService.executeAgent(
        request.agentId,
        request.userId,
        request.input,
        context,
      );

      const duration = Date.now() - startTime;

      this.logger.info('Agent execution completed', {
        agentId: request.agentId,
        status: result.status,
        duration,
      });

      return {
        agentId: request.agentId,
        status: result.status,
        output: result.output,
        duration,
        metadata: result.metadata,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.logger.error('Agent execution failed', {
        agentId: request.agentId,
        error: errorMsg,
        duration,
      });

      return {
        agentId: request.agentId,
        status: 'error',
        output: null,
        duration,
        metadata: { error: errorMsg },
      };
    }
  }
}
