/**
 * ExecutionResult Value Object
 *
 * Represents the result of an agent execution.
 * Immutable and contains status, output, and metadata.
 */

export type ExecutionStatus = 'success' | 'error' | 'pending' | 'partial';

export interface ExecutionResult {
  status: ExecutionStatus;
  output: unknown;
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}

/**
 * Create a successful execution result
 */
export function createSuccessResult(output: unknown): ExecutionResult {
  return {
    status: 'success',
    output,
    startTime: new Date(),
    endTime: new Date(),
    duration: 0,
  };
}

/**
 * Create an error execution result
 */
export function createErrorResult(
  error: Error | string,
  code?: string,
): ExecutionResult {
  const message = typeof error === 'string' ? error : error.message;
  const stack = error instanceof Error ? error.stack : undefined;

  return {
    status: 'error',
    output: null,
    error: { message, code, stack },
    startTime: new Date(),
    endTime: new Date(),
    duration: 0,
  };
}

/**
 * Create a pending execution result
 */
export function createPendingResult(output?: unknown): ExecutionResult {
  return {
    status: 'pending',
    output,
    startTime: new Date(),
  };
}

/**
 * Create a partial execution result
 */
export function createPartialResult(
  output: unknown,
  error?: Error,
): ExecutionResult {
  return {
    status: 'partial',
    output,
    error: error ? { message: error.message } : undefined,
    startTime: new Date(),
    endTime: new Date(),
    duration: 0,
  };
}

/**
 * Update execution result with timing
 */
export function withTiming(
  result: ExecutionResult,
  startTime: Date,
): ExecutionResult {
  const endTime = new Date();
  const duration = endTime.getTime() - startTime.getTime();

  return {
    ...result,
    startTime,
    endTime,
    duration,
  };
}

/**
 * Add metadata to result
 */
export function withMetadata(
  result: ExecutionResult,
  metadata: Record<string, unknown>,
): ExecutionResult {
  return {
    ...result,
    metadata: { ...result.metadata, ...metadata },
  };
}
