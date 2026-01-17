/**
 * Stream Agent Execution Use Case
 *
 * Orchestrates streaming agent execution with real-time updates.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger, ILLMProvider } from '@application/ports';
import { AgentService } from '@application/services/agent.service';
import { ExecutionContext } from '@domain/entities';
import { AgentExecutionService } from '@application/services/agent-execution.service';

export interface StreamAgentRequest {
  agentId: string;
  userId: string;
  input: string;
  context?: Partial<ExecutionContext>;
}

/**
 * Use case for streaming agent execution
 */
@Injectable()
export class StreamAgentExecutionUseCase {
  constructor(
    private readonly agentService: AgentService,
    private readonly execService: AgentExecutionService,
    @Inject('ILogger')
    private readonly logger: ILogger,
    @Inject('ILLMProvider')
    private readonly llmProvider: ILLMProvider,
  ) {}

  /**
   * Execute an agent with streaming
   */
  async *execute(request: StreamAgentRequest): AsyncGenerator<string> {
    try {
      this.logger.info('Starting agent stream execution', {
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
        contextId: `stream-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...request.context,
      } as ExecutionContext;

      // Stream via AgentExecutionService
      yield `[START] Executing agent ${request.agentId}\n`;

      for await (const chunk of this.execService.stream(
        request.agentId,
        request.userId,
        request.input,
        context,
      )) {
        yield chunk;
      }

      yield `\n[COMPLETE] Agent execution finished\n`;

      this.logger.info('Agent stream execution completed', {
        agentId: request.agentId,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.logger.error('Agent stream execution failed', {
        agentId: request.agentId,
        error: errorMsg,
      });

      yield `\n[ERROR] ${errorMsg}\n`;
    }
  }
}
