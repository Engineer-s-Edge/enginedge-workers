import { EventEmitter2 } from 'eventemitter2';
import {
  ExecutionContext,
  AgentState,
  ExecutionResult,
  Message,
  AgentStateType,
} from '../entities';
import { ILogger } from '../../ports/logger.port';
import { ILLMProvider } from '../../ports/llm-provider.port';

/**
 * Internal agent execution state
 */
interface InternalAgentState {
  status: 'idle' | 'thinking' | 'executing' | 'complete' | 'error' | 'aborted';
  messageCount: number;
  lastUpdate: Date;
  executedTools: Array<{
    name: string;
    input: any;
    output: any;
    timestamp: Date;
  }>;
  thinkingSteps: Array<{
    step: string;
    timestamp: Date;
  }>;
  errors: Array<{
    message: string;
    timestamp: Date;
    stack?: string;
  }>;
}

/**
 * BaseAgent - Abstract base class for all agent types
 *
 * Implements core agent lifecycle and execution patterns:
 * - State management (idle, thinking, executing, complete, error)
 * - Message streaming
 * - Event emission (lifecycle events)
 * - Abort handling
 * - Error recovery
 */
export abstract class BaseAgent {
  protected internalState: InternalAgentState = {
    status: 'idle',
    messageCount: 0,
    lastUpdate: new Date(),
    executedTools: [],
    thinkingSteps: [],
    errors: [],
  };

  protected context: ExecutionContext | null = null;
  private abortController: AbortController | null = null;
  protected eventEmitter: EventEmitter2;

  constructor(
    protected llmProvider: ILLMProvider,
    protected logger: ILogger,
  ) {
    this.eventEmitter = new EventEmitter2();
  }

  /**
   * Main execution method - synchronous response
   */
  async execute(
    input: string,
    context: Partial<ExecutionContext> = {},
  ): Promise<ExecutionResult> {
    try {
      this.internalState.status = 'thinking';
      this.emitEvent('agent:started', { input, timestamp: new Date() });

      // Initialize context
      this.context = this.initializeContext(input, context);

      // Run agent loop
      const result = await this.run(input, this.context);

      this.internalState.status = 'complete';
      this.emitEvent('agent:completed', { result, timestamp: new Date() });

      return result;
    } catch (error) {
      this.internalState.status = 'error';
      this.internalState.errors.push({
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        stack: error instanceof Error ? error.stack : undefined,
      });
      this.emitEvent('agent:error', { error, timestamp: new Date() });
      throw error;
    }
  }

  /**
   * Stream-based execution - yields tokens as they arrive
   */
  async *stream(
    input: string,
    context: Partial<ExecutionContext> = {},
  ): AsyncGenerator<string> {
    try {
      this.internalState.status = 'thinking';
      this.emitEvent('agent:stream_started', { input });

      this.context = this.initializeContext(input, context);

      // Yield tokens from LLM
      for await (const chunk of this.runStream(input, this.context)) {
        if (this.isAborted()) {
          break;
        }
        this.internalState.messageCount++;
        yield chunk;
      }

      this.internalState.status = 'complete';
      this.emitEvent('agent:stream_completed', {
        messagesCount: this.internalState.messageCount,
      });
    } catch (error) {
      this.internalState.status = 'error';
      if (
        !(error instanceof Error) ||
        error.message !== 'Agent execution aborted'
      ) {
        this.internalState.errors.push({
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
        });
        this.emitEvent('agent:stream_error', { error });
      }
      throw error;
    }
  }

  /**
   * Abort execution
   */
  abort(): void {
    this.logger.debug('Aborting agent execution', {
      status: this.internalState.status,
    });
    this.internalState.status = 'aborted';
    if (this.abortController) {
      this.abortController.abort();
    }
    this.emitEvent('agent:aborted', { timestamp: new Date() });
  }

  /**
   * Check if execution was aborted
   */
  isAborted(): boolean {
    return (
      this.internalState.status === 'aborted' ||
      (this.abortController?.signal.aborted ?? false)
    );
  }

  /**
   * Get current state
   */
  getState(): AgentState {
    // Convert internal state to AgentState class
    const statusMap: Record<string, AgentStateType> = {
      idle: 'idle',
      thinking: 'processing',
      executing: 'processing',
      complete: 'complete',
      error: 'error',
      aborted: 'error',
    };

    const stateType = statusMap[this.internalState.status] || 'idle';
    const metadata = {
      messageCount: this.internalState.messageCount,
      lastUpdate: this.internalState.lastUpdate,
      executedTools: this.internalState.executedTools,
      thinkingSteps: this.internalState.thinkingSteps,
      errors: this.internalState.errors,
    };

    switch (stateType) {
      case 'idle':
        return AgentState.idle();
      case 'processing':
        return AgentState.processing(metadata);
      case 'complete':
        return AgentState.complete(metadata);
      case 'error':
        const lastError =
          this.internalState.errors[this.internalState.errors.length - 1];
        const errorMessage = lastError?.message || 'Unknown error';
        return AgentState.error(errorMessage, metadata);
      default:
        return AgentState.idle();
    }
  }

  /**
   * Reset agent state
   */
  reset(): void {
    this.internalState = {
      status: 'idle',
      messageCount: 0,
      lastUpdate: new Date(),
      executedTools: [],
      thinkingSteps: [],
      errors: [],
    };
    this.context = null;
    this.emitEvent('agent:reset', { timestamp: new Date() });
  }

  /**
   * Subscribe to agent events
   */
  on(event: string, callback: (...args: any[]) => void): void {
    this.eventEmitter.on(event, callback);
  }

  /**
   * Unsubscribe from agent events
   */
  off(event: string, callback: (...args: any[]) => void): void {
    this.eventEmitter.off(event, callback);
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  protected abstract run(
    input: string,
    context: ExecutionContext,
  ): Promise<ExecutionResult>;

  protected abstract runStream(
    input: string,
    context: ExecutionContext,
  ): AsyncGenerator<string>;

  /**
   * Initialize execution context
   */
  protected initializeContext(
    input: string,
    context: Partial<ExecutionContext>,
  ): ExecutionContext {
    this.abortController = new AbortController();

    return {
      userId: context.userId || 'anonymous',
      conversationId: context.conversationId || `conv_${Date.now()}`,
      sessionId: context.sessionId || `sess_${Date.now()}`,
      contextId:
        context.contextId ||
        `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      input,
      createdAt: context.createdAt || new Date(),
      updatedAt: new Date(),
      config: context.config || {},
      memory: context.memory || { messages: [] },
      metadata: context.metadata || {},
      tools: context.tools,
    };
  }

  /**
   * Emit event
   */
  protected emitEvent(event: string, data: any): void {
    try {
      this.eventEmitter.emit(event, data);
    } catch (error) {
      this.logger.error('Failed to emit event', { event, error });
    }
  }

  /**
   * Add thinking step
   */
  protected addThinkingStep(step: string): void {
    this.internalState.thinkingSteps.push({
      step,
      timestamp: new Date(),
    });
  }

  /**
   * Record tool execution
   */
  protected recordToolExecution(
    toolName: string,
    input: any,
    output: any,
  ): void {
    this.internalState.executedTools.push({
      name: toolName,
      input,
      output,
      timestamp: new Date(),
    });
  }

  /**
   * Update last update timestamp
   */
  protected touch(): void {
    this.internalState.lastUpdate = new Date();
  }
}

// Backwards compatibility export
export { BaseAgent as AgentBase };

// Export StateUpdate type for old tests
export type StateUpdate = {
  state: AgentState;
  message?: string;
  timestamp: Date;
};
