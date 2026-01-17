/**
 * Create Agent DTO
 *
 * Request payload for creating a new agent
 */

import {
  ConfigObject,
  ExecutionContext,
  AgentTypeValue,
  MemoryTypeValue,
} from './types';

export class CreateAgentDTO {
  /**
   * Agent name (required, 1-100 chars)
   */
  readonly name: string;

  /**
   * Agent type: 'react', 'graph', 'expert', 'genius', 'collective'
   */
  readonly agentType: AgentTypeValue;

  /**
   * Agent configuration (type-specific)
   */
  readonly config: ConfigObject;

  /**
   * Memory type for this agent
   * One of: buffer, buffer_window, token_buffer, summary, summary_buffer, entity, knowledge_graph, vector_store
   */
  readonly memoryType?: MemoryTypeValue;

  /**
   * Optional memory configuration
   */
  readonly memoryConfig?: ConfigObject;

  /**
   * For Collective agents: array of child agent IDs
   */
  readonly childAgentIds?: string[];

  constructor(data: {
    name: string;
    agentType: AgentTypeValue;
    config: ConfigObject;
    memoryType?: MemoryTypeValue;
    memoryConfig?: ConfigObject;
    childAgentIds?: string[];
  }) {
    this.name = data.name;
    this.agentType = data.agentType;
    this.config = data.config;
    this.memoryType = data.memoryType || 'buffer';
    this.memoryConfig = data.memoryConfig;
    this.childAgentIds = data.childAgentIds;
  }
}

/**
 * Update Agent DTO
 */
export class UpdateAgentDTO {
  /**
   * New agent name (optional)
   */
  readonly name?: string;

  /**
   * New configuration (optional, merged with existing)
   */
  readonly config?: ConfigObject;

  /**
   * New memory type (optional)
   */
  readonly memoryType?: MemoryTypeValue;

  /**
   * New memory configuration (optional)
   */
  readonly memoryConfig?: ConfigObject;

  constructor(data: {
    name?: string;
    config?: ConfigObject;
    memoryType?: MemoryTypeValue;
    memoryConfig?: ConfigObject;
  }) {
    this.name = data.name;
    this.config = data.config;
    this.memoryType = data.memoryType;
    this.memoryConfig = data.memoryConfig;
  }
}

/**
 * Execute Agent DTO
 */
export class ExecuteAgentDTO {
  /**
   * Agent ID to execute
   */
  readonly agentId: string;

  /**
   * User input/prompt for the agent
   */
  readonly userInput: string;

  /**
   * Optional execution context/history
   */
  readonly context?: ExecutionContext;

  /**
   * Maximum execution time in milliseconds
   */
  readonly timeoutMs?: number;

  /**
   * Whether to use worker thread for execution
   */
  readonly useWorker?: boolean;

  constructor(data: {
    agentId: string;
    userInput: string;
    context?: ExecutionContext;
    timeoutMs?: number;
    useWorker?: boolean;
  }) {
    this.agentId = data.agentId;
    this.userInput = data.userInput;
    this.context = data.context;
    this.timeoutMs = data.timeoutMs;
    this.useWorker = data.useWorker ?? true;
  }
}

/**
 * Stream Agent Execution DTO
 */
export class StreamAgentExecutionDTO {
  /**
   * Agent ID to execute
   */
  readonly agentId: string;

  /**
   * User input/prompt for the agent
   */
  readonly userInput: string;

  /**
   * Optional execution context/history
   */
  readonly context?: ExecutionContext;

  /**
   * Maximum execution time in milliseconds
   */
  readonly timeoutMs?: number;

  /**
   * Batch size for streaming updates
   */
  readonly batchSize?: number;

  constructor(data: {
    agentId: string;
    userInput: string;
    context?: ExecutionContext;
    timeoutMs?: number;
    batchSize?: number;
  }) {
    this.agentId = data.agentId;
    this.userInput = data.userInput;
    this.context = data.context;
    this.timeoutMs = data.timeoutMs;
    this.batchSize = data.batchSize ?? 10;
  }
}

/**
 * Configure Agent DTO
 */
export class ConfigureAgentDTO {
  /**
   * Agent ID
   */
  readonly agentId: string;

  /**
   * New configuration (merged with existing)
   */
  readonly config: ConfigObject;

  /**
   * New memory configuration (optional)
   */
  readonly memoryConfig?: ConfigObject;

  constructor(data: {
    agentId: string;
    config: ConfigObject;
    memoryConfig?: ConfigObject;
  }) {
    this.agentId = data.agentId;
    this.config = data.config;
    this.memoryConfig = data.memoryConfig;
  }
}

/**
 * List Agents Query DTO
 */
export class ListAgentsQueryDTO {
  /**
   * Page number (0-indexed)
   */
  readonly page: number;

  /**
   * Items per page
   */
  readonly limit: number;

  /**
   * Filter by agent type
   */
  readonly agentType?: AgentTypeValue;

  /**
   * Filter by agent name (substring match)
   */
  readonly name?: string;

  /**
   * Sort field
   */
  readonly sortBy: string;

  /**
   * Sort direction: 'asc' or 'desc'
   */
  readonly sortDir: 'asc' | 'desc';

  constructor(data: {
    page?: number;
    limit?: number;
    agentType?: AgentTypeValue;
    name?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }) {
    this.page = data.page ?? 0;
    this.limit = data.limit ?? 20;
    this.agentType = data.agentType;
    this.name = data.name;
    this.sortBy = data.sortBy ?? 'createdAt';
    this.sortDir = data.sortDir ?? 'desc';
  }
}

/**
 * Delete Agent DTO
 */
export class DeleteAgentDTO {
  /**
   * Agent ID to delete
   */
  readonly agentId: string;

  /**
   * Force delete even if agent is in use
   */
  readonly force: boolean;

  constructor(data: { agentId: string; force?: boolean }) {
    this.agentId = data.agentId;
    this.force = data.force ?? false;
  }
}
