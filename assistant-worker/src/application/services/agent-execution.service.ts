import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentEventService } from './agent-event.service';
import { AgentSessionService } from './agent-session.service';
import { ILogger } from '../ports/logger.port';
import { ExecutionContext, ExecutionResult } from '@domain/entities';
import { MetricsAdapter } from '@infrastructure/adapters/monitoring/metrics.adapter';

interface ExecuteOptions {
  timeoutMs?: number;
}

@Injectable()
export class AgentExecutionService {
  constructor(
    @Inject(forwardRef(() => AgentService))
    private readonly agentService: AgentService,
    private readonly events: AgentEventService,
    private readonly sessions: AgentSessionService,
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly metrics?: MetricsAdapter,
  ) {}

  async execute(
    agentId: string,
    userId: string,
    input: string,
    context?: Partial<ExecutionContext>,
    options: ExecuteOptions = {},
  ): Promise<ExecutionResult> {
    const start = Date.now();
    const timeoutMs = options.timeoutMs ?? 60000;

    // Create session
    const session = this.sessions.createSession(agentId, userId, {
      mode: 'sync',
    });

    const execContext: ExecutionContext = {
      userId,
      sessionId: session.sessionId,
      conversationId: context?.conversationId || `conv_${Date.now()}`,
      contextId: context?.contextId || `exec_${Date.now()}`,
      input,
      createdAt: context?.createdAt || new Date(),
      updatedAt: new Date(),
      config: context?.config || {},
      memory: context?.memory || { messages: [] },
      metadata: context?.metadata || {},
      tools: context?.tools,
    };

    // Emit start event
    this.events.emitEvent({
      type: 'agent.started',
      agentId,
      userId,
      timestamp: new Date(),
      data: { sessionId: session.sessionId },
    });

    // Metrics: increment active
    try {
      const agent = await this.agentService.getAgent(agentId, userId);
      const type = (agent as any)?.agentType || 'unknown';
      this.metrics?.setActiveAgents(type, 1);
    } catch {}

    let timeoutHandle: NodeJS.Timeout | null = null;
    let timedOut = false;
    try {
      // Get instance
      const instance = await this.agentService.getAgentInstance(
        agentId,
        userId,
      );

      // Setup timeout
      const abortPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          try {
            instance.abort();
          } catch {}
          reject(new Error('Agent execution timed out'));
        }, timeoutMs);
      });

      const resultPromise = instance.execute(input, execContext);
      const result = await Promise.race([resultPromise, abortPromise]);

      // Emit complete event
      this.events.emitEvent({
        type: 'agent.completed',
        agentId,
        userId,
        timestamp: new Date(),
        data: { sessionId: session.sessionId },
      });

      this.sessions.updateSessionStatus(session.sessionId, 'completed');

      const duration = (Date.now() - start) / 1000;
      try {
        const agent = await this.agentService.getAgent(agentId, userId);
        const type = (agent as any)?.agentType || 'unknown';
        this.metrics?.recordAgentExecution(type, 'success', duration);
        this.metrics?.setActiveAgents(type, 0);
      } catch {}

      return result as ExecutionResult;
    } catch (error) {
      const err = error as Error;

      // Emit error/abort event
      this.events.emitEvent({
        type: timedOut ? 'agent.aborted' : 'agent.failed',
        agentId,
        userId,
        timestamp: new Date(),
        data: {
          reason: timedOut ? 'timeout' : 'error',
          message: err.message,
          sessionId: session.sessionId,
        },
      });

      this.sessions.updateSessionStatus(
        session.sessionId,
        timedOut ? 'failed' : 'failed',
      );

      const duration = (Date.now() - start) / 1000;
      try {
        const agent = await this.agentService.getAgent(agentId, userId);
        const type = (agent as any)?.agentType || 'unknown';
        this.metrics?.recordAgentExecution(type, 'error', duration);
        this.metrics?.setActiveAgents(type, 0);
      } catch {}

      throw error;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  async *stream(
    agentId: string,
    userId: string,
    input: string,
    context?: Partial<ExecutionContext>,
    options: ExecuteOptions = {},
  ): AsyncGenerator<string> {
    const start = Date.now();
    const timeoutMs = options.timeoutMs ?? 120000;

    // Create session
    const session = this.sessions.createSession(agentId, userId, {
      mode: 'stream',
    });

    const execContext: ExecutionContext = {
      userId,
      sessionId: session.sessionId,
      conversationId: context?.conversationId || `conv_${Date.now()}`,
      contextId: context?.contextId || `stream_${Date.now()}`,
      input,
      createdAt: context?.createdAt || new Date(),
      updatedAt: new Date(),
      config: context?.config || {},
      memory: context?.memory || { messages: [] },
      metadata: context?.metadata || {},
      tools: context?.tools,
    };

    // Emit start event
    this.events.emitEvent({
      type: 'agent.started',
      agentId,
      userId,
      timestamp: new Date(),
      data: { sessionId: session.sessionId, mode: 'stream' },
    });

    let timeoutHandle: NodeJS.Timeout | null = null;
    let timedOut = false;

    try {
      const instance = await this.agentService.getAgentInstance(
        agentId,
        userId,
      );

      // Setup timeout
      const resolveAbort: (() => void) | null = null;
      const abortPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          try {
            instance.abort();
          } catch {}
          reject(new Error('Agent stream timed out'));
        }, timeoutMs);
      });

      // Stream execution alongside timeout race; we cannot race a generator easily
      // so we check abort flag in the loop and break if timed out
      const stream = instance.stream(input, execContext);

      for await (const chunk of stream) {
        if (timedOut) break;
        this.sessions.updateSessionActivity(session.sessionId);
        yield chunk;
      }

      // Emit completion
      this.events.emitEvent({
        type: 'agent.completed',
        agentId,
        userId,
        timestamp: new Date(),
        data: { sessionId: session.sessionId, mode: 'stream' },
      });

      this.sessions.updateSessionStatus(session.sessionId, 'completed');

      const duration = (Date.now() - start) / 1000;
      try {
        const agent = await this.agentService.getAgent(agentId, userId);
        const type = (agent as any)?.agentType || 'unknown';
        this.metrics?.recordAgentExecution(type, 'success', duration);
      } catch {}
    } catch (error) {
      const err = error as Error;

      this.events.emitEvent({
        type: timedOut ? 'agent.aborted' : 'agent.failed',
        agentId,
        userId,
        timestamp: new Date(),
        data: {
          sessionId: session.sessionId,
          reason: timedOut ? 'timeout' : 'error',
          message: err.message,
        },
      });

      this.sessions.updateSessionStatus(session.sessionId, 'failed');

      const duration = (Date.now() - start) / 1000;
      try {
        const agent = await this.agentService.getAgent(agentId, userId);
        const type = (agent as any)?.agentType || 'unknown';
        this.metrics?.recordAgentExecution(type, 'error', duration);
      } catch {}

      throw error;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }
}
