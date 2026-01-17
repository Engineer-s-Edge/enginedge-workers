/**
 * Execution Result Value Object
 *
 * Unified result format for all agent executions.
 * Enables consistent handling across all agent types.
 */

import { Message } from './message.vo';

export type ExecutionStatus =
  | 'success'
  | 'partial'
  | 'failed'
  | 'timeout'
  | 'cancelled';

export interface ExecutionResultProps {
  status: ExecutionStatus;
  messages: readonly Message[];
  output?: unknown;
  error?: Error | string;
  metadata?: Record<string, unknown>;
  executionTimeMs?: number;
  tokensUsed?: number;
  childResults?: readonly ExecutionResult[]; // For Collective
}

/**
 * Immutable execution result
 */
export class ExecutionResult {
  private constructor(
    public readonly status: ExecutionStatus,
    public readonly messages: readonly Message[],
    public readonly output: unknown,
    public readonly error: Error | string | undefined,
    public readonly metadata: Record<string, unknown>,
    public readonly executionTimeMs: number,
    public readonly tokensUsed: number,
    public readonly childResults: readonly ExecutionResult[],
  ) {}

  /**
   * Create successful result
   */
  static success(props: {
    messages: readonly Message[];
    output: unknown;
    metadata?: Record<string, unknown>;
    executionTimeMs?: number;
    tokensUsed?: number;
    childResults?: readonly ExecutionResult[];
  }): ExecutionResult {
    return new ExecutionResult(
      'success',
      props.messages,
      props.output,
      undefined,
      props.metadata || {},
      props.executionTimeMs || 0,
      props.tokensUsed || 0,
      props.childResults || [],
    );
  }

  /**
   * Create partial result (some parts succeeded)
   */
  static partial(props: {
    messages: readonly Message[];
    output: unknown;
    error: Error | string;
    metadata?: Record<string, unknown>;
    executionTimeMs?: number;
    tokensUsed?: number;
    childResults?: readonly ExecutionResult[];
  }): ExecutionResult {
    return new ExecutionResult(
      'partial',
      props.messages,
      props.output,
      props.error,
      props.metadata || {},
      props.executionTimeMs || 0,
      props.tokensUsed || 0,
      props.childResults || [],
    );
  }

  /**
   * Create failed result
   */
  static failed(props: {
    error: Error | string;
    messages?: readonly Message[];
    output?: unknown;
    metadata?: Record<string, unknown>;
    executionTimeMs?: number;
    tokensUsed?: number;
  }): ExecutionResult {
    return new ExecutionResult(
      'failed',
      props.messages || [],
      props.output,
      props.error,
      props.metadata || {},
      props.executionTimeMs || 0,
      props.tokensUsed || 0,
      [],
    );
  }

  /**
   * Create timeout result
   */
  static timeout(props: {
    messages?: readonly Message[];
    output?: unknown;
    executionTimeMs: number;
    metadata?: Record<string, unknown>;
  }): ExecutionResult {
    return new ExecutionResult(
      'timeout',
      props.messages || [],
      props.output,
      'Execution timeout',
      props.metadata || {},
      props.executionTimeMs,
      0,
      [],
    );
  }

  /**
   * Create cancelled result
   */
  static cancelled(props: {
    messages?: readonly Message[];
    output?: unknown;
    metadata?: Record<string, unknown>;
    executionTimeMs?: number;
  }): ExecutionResult {
    return new ExecutionResult(
      'cancelled',
      props.messages || [],
      props.output,
      'Execution cancelled',
      props.metadata || {},
      props.executionTimeMs || 0,
      0,
      [],
    );
  }

  /**
   * Check if execution was successful
   */
  isSuccess(): boolean {
    return this.status === 'success';
  }

  /**
   * Check if execution had errors
   */
  hasError(): boolean {
    return this.error !== undefined;
  }

  /**
   * Get all messages recursively (including from child agents)
   */
  getAllMessages(): readonly Message[] {
    const all = [...this.messages];
    for (const childResult of this.childResults) {
      all.push(...childResult.getAllMessages());
    }
    return all;
  }

  /**
   * Get error message as string
   */
  getErrorMessage(): string {
    if (typeof this.error === 'string') {
      return this.error;
    }
    if (this.error instanceof Error) {
      return this.error.message;
    }
    return 'Unknown error';
  }

  /**
   * Calculate total execution time including children
   */
  getTotalExecutionTimeMs(): number {
    let total = this.executionTimeMs;
    for (const childResult of this.childResults) {
      total += childResult.getTotalExecutionTimeMs();
    }
    return total;
  }

  /**
   * Calculate total tokens used including children
   */
  getTotalTokensUsed(): number {
    let total = this.tokensUsed;
    for (const childResult of this.childResults) {
      total += childResult.getTotalTokensUsed();
    }
    return total;
  }

  /**
   * Convert to plain object for API response
   */
  toPlain(): Record<string, unknown> {
    return {
      status: this.status,
      messages: this.messages,
      output: this.output,
      error: this.error,
      metadata: this.metadata,
      executionTimeMs: this.executionTimeMs,
      tokensUsed: this.tokensUsed,
      childResults: this.childResults.map((cr) => cr.toPlain()),
    };
  }
}
