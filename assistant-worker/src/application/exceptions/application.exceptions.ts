/**
 * Application Layer Exception Hierarchy
 */

/**
 * Base application exception
 */
export abstract class ApplicationException extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ApplicationException.prototype);
  }
}

/**
 * Agent not found exception
 */
export class AgentNotFoundException extends ApplicationException {
  readonly code = 'AGENT_NOT_FOUND';
  readonly statusCode = 404;

  constructor(agentId: string) {
    super(`Agent with ID "${agentId}" not found`);
    Object.setPrototypeOf(this, AgentNotFoundException.prototype);
  }
}

/**
 * Invalid agent configuration exception
 */
export class InvalidAgentConfigException extends ApplicationException {
  readonly code = 'INVALID_AGENT_CONFIG';
  readonly statusCode = 400;

  constructor(message: string) {
    super(`Invalid agent configuration: ${message}`);
    Object.setPrototypeOf(this, InvalidAgentConfigException.prototype);
  }
}

/**
 * Invalid memory type exception
 */
export class InvalidMemoryTypeException extends ApplicationException {
  readonly code = 'INVALID_MEMORY_TYPE';
  readonly statusCode = 400;

  constructor(memoryType: string) {
    super(
      `Invalid memory type: "${memoryType}". Valid types are: buffer, buffer_window, token_buffer, summary, summary_buffer, entity, knowledge_graph, vector_store`,
    );
    Object.setPrototypeOf(this, InvalidMemoryTypeException.prototype);
  }
}

/**
 * Invalid agent type exception
 */
export class InvalidAgentTypeException extends ApplicationException {
  readonly code = 'INVALID_AGENT_TYPE';
  readonly statusCode = 400;

  constructor(agentType: string) {
    super(
      `Invalid agent type: "${agentType}". Valid types are: react, graph, expert, genius, collective`,
    );
    Object.setPrototypeOf(this, InvalidAgentTypeException.prototype);
  }
}

/**
 * Agent execution exception
 */
export class AgentExecutionException extends ApplicationException {
  readonly code = 'AGENT_EXECUTION_ERROR';
  readonly statusCode = 500;

  constructor(agentId: string, message: string) {
    super(`Agent execution failed for "${agentId}": ${message}`);
    Object.setPrototypeOf(this, AgentExecutionException.prototype);
  }
}

/**
 * Agent execution timeout exception
 */
export class AgentExecutionTimeoutException extends ApplicationException {
  readonly code = 'AGENT_EXECUTION_TIMEOUT';
  readonly statusCode = 408;

  constructor(agentId: string, timeoutMs: number) {
    super(`Agent execution timeout for "${agentId}" after ${timeoutMs}ms`);
    Object.setPrototypeOf(this, AgentExecutionTimeoutException.prototype);
  }
}

/**
 * Invalid DTO exception
 */
export class InvalidDTOException extends ApplicationException {
  readonly code = 'INVALID_DTO';
  readonly statusCode = 400;

  constructor(dtoName: string, errors: Record<string, string>) {
    const errorMessages = Object.entries(errors)
      .map(([field, error]) => `${field}: ${error}`)
      .join('; ');
    super(`Invalid ${dtoName}: ${errorMessages}`);
    Object.setPrototypeOf(this, InvalidDTOException.prototype);
  }
}

/**
 * Agent in use exception (cannot delete)
 */
export class AgentInUseException extends ApplicationException {
  readonly code = 'AGENT_IN_USE';
  readonly statusCode = 409;

  constructor(agentId: string, reason: string) {
    super(`Cannot delete agent "${agentId}": ${reason}`);
    Object.setPrototypeOf(this, AgentInUseException.prototype);
  }
}

/**
 * Duplicate agent name exception
 */
export class DuplicateAgentNameException extends ApplicationException {
  readonly code = 'DUPLICATE_AGENT_NAME';
  readonly statusCode = 409;

  constructor(name: string) {
    super(`Agent with name "${name}" already exists`);
    Object.setPrototypeOf(this, DuplicateAgentNameException.prototype);
  }
}

/**
 * Worker pool exhausted exception
 */
export class WorkerPoolExhaustedException extends ApplicationException {
  readonly code = 'WORKER_POOL_EXHAUSTED';
  readonly statusCode = 503;

  constructor(queueSize: number) {
    super(
      `Worker pool exhausted. Task queue size: ${queueSize}. Please retry later.`,
    );
    Object.setPrototypeOf(this, WorkerPoolExhaustedException.prototype);
  }
}

/**
 * Worker thread error exception
 */
export class WorkerThreadException extends ApplicationException {
  readonly code = 'WORKER_THREAD_ERROR';
  readonly statusCode = 500;

  constructor(workerId: number, message: string) {
    super(`Worker thread ${workerId} error: ${message}`);
    Object.setPrototypeOf(this, WorkerThreadException.prototype);
  }
}
