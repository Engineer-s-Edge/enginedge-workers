/**
 * Agent Capability Value Object
 * 
 * Describes the capabilities and constraints of an agent type.
 * Immutable and used for validation and capability checking.
 * 
 * IMPORTANT: These capabilities apply ONLY to individual agent types
 * (ReAct, Graph, Expert, Genius). Collective is an orchestrator that
 * coordinates MEMBER agents - it does NOT have capabilities itself.
 * Each member agent has its own capability and memory configuration.
 */

export type ExecutionModel =
  | 'chain-of-thought'
  | 'dag'
  | 'research'
  | 'learning';

/**
 * ACTUAL memory types from enginedge-core infrastructure
 * 
 * These correspond to concrete implementations in memory.service.ts:
 * - buffer: Fixed-size message buffer
 * - buffer_window: Token-limited window
 * - token_buffer: Exact token count management
 * - summary: Summarize older messages
 * - summary_buffer: Hybrid (summary + recent buffer)
 * - entity: Extract and track entities
 * - knowledge_graph: Knowledge graph-based memory
 * - vector_store: Semantic search-based
 */
export type MemoryType =
  | 'buffer'
  | 'buffer_window'
  | 'token_buffer'
  | 'summary'
  | 'summary_buffer'
  | 'entity'
  | 'knowledge_graph'
  | 'vector_store';

export interface AgentCapabilityProps {
  executionModel: ExecutionModel;
  canUseTools: boolean;
  canStreamResults: boolean;
  canPauseResume: boolean;
  canCoordinate: boolean;
  supportsParallelExecution: boolean;
  maxInputTokens: number;
  maxOutputTokens: number;
  supportedMemoryTypes: readonly MemoryType[];
  timeoutMs: number;
}

/**
 * Immutable capability descriptor
 */
export class AgentCapability {
  private constructor(
    public readonly executionModel: ExecutionModel,
    public readonly canUseTools: boolean,
    public readonly canStreamResults: boolean,
    public readonly canPauseResume: boolean,
    public readonly canCoordinate: boolean,
    public readonly supportsParallelExecution: boolean,
    public readonly maxInputTokens: number,
    public readonly maxOutputTokens: number,
    public readonly supportedMemoryTypes: readonly MemoryType[],
    public readonly timeoutMs: number,
  ) {}

  /**
   * Create with validation
   */
  static create(props: AgentCapabilityProps): AgentCapability {
    if (props.maxInputTokens < 1) {
      throw new Error('maxInputTokens must be positive');
    }
    if (props.maxOutputTokens < 1) {
      throw new Error('maxOutputTokens must be positive');
    }
    if (props.timeoutMs < 100) {
      throw new Error('timeoutMs must be at least 100ms');
    }
    if (props.supportedMemoryTypes.length === 0) {
      throw new Error('At least one memory type must be supported');
    }
    if (props.canCoordinate) {
      throw new Error(
        'Individual agent types cannot coordinate. Coordination is only for Collective orchestration.',
      );
    }

    return new AgentCapability(
      props.executionModel,
      props.canUseTools,
      props.canStreamResults,
      props.canPauseResume,
      props.canCoordinate,
      props.supportsParallelExecution,
      props.maxInputTokens,
      props.maxOutputTokens,
      props.supportedMemoryTypes,
      props.timeoutMs,
    );
  }

  /**
   * Predefined capabilities for ReAct agent
   */
  static forReAct(): AgentCapability {
    return AgentCapability.create({
      executionModel: 'chain-of-thought',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: true,
      canCoordinate: false,
      supportsParallelExecution: false,
      maxInputTokens: 8000,
      maxOutputTokens: 4000,
      supportedMemoryTypes: [
        'buffer',
        'buffer_window',
        'token_buffer',
        'summary',
        'summary_buffer',
        'entity',
        'knowledge_graph',
        'vector_store',
      ],
      timeoutMs: 300000, // 5 minutes
    });
  }

  /**
   * Predefined capabilities for Graph agent
   */
  static forGraph(): AgentCapability {
    return AgentCapability.create({
      executionModel: 'dag',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: true,
      canCoordinate: false,
      supportsParallelExecution: true,
      maxInputTokens: 12000,
      maxOutputTokens: 6000,
      supportedMemoryTypes: [
        'buffer',
        'buffer_window',
        'token_buffer',
        'summary',
        'summary_buffer',
        'entity',
        'knowledge_graph',
        'vector_store',
      ],
      timeoutMs: 600000, // 10 minutes
    });
  }

  /**
   * Predefined capabilities for Expert agent
   */
  static forExpert(): AgentCapability {
    return AgentCapability.create({
      executionModel: 'research',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: true,
      canCoordinate: false,
      supportsParallelExecution: true,
      maxInputTokens: 16000,
      maxOutputTokens: 8000,
      supportedMemoryTypes: [
        'buffer',
        'buffer_window',
        'token_buffer',
        'summary',
        'summary_buffer',
        'entity',
        'knowledge_graph',
        'vector_store',
      ],
      timeoutMs: 1200000, // 20 minutes
    });
  }

  /**
   * Predefined capabilities for Genius agent
   */
  static forGenius(): AgentCapability {
    return AgentCapability.create({
      executionModel: 'learning',
      canUseTools: true,
      canStreamResults: false,
      canPauseResume: true,
      canCoordinate: false,
      supportsParallelExecution: false,
      maxInputTokens: 8000,
      maxOutputTokens: 4000,
      supportedMemoryTypes: [
        'buffer',
        'buffer_window',
        'token_buffer',
        'summary',
        'summary_buffer',
        'entity',
        'knowledge_graph',
        'vector_store',
      ],
      timeoutMs: 900000, // 15 minutes
    });
  }

  /**
   * Collective DOES NOT have a capability
   * 
   * Collective is an ORCHESTRATOR that coordinates member agents.
   * Each member agent has its own AgentCapability.
   * Collective itself does not execute - it delegates to member agents.
   * 
   * @deprecated This method should never be called
   * @throws Always throws an error
   */
  static forCollective(): never {
    throw new Error(
      'Collective agents do NOT have capabilities. ' +
      'Collective is an orchestrator that coordinates member agents. ' +
      'Each member agent has its own AgentCapability.'
    );
  }

  /**
   * Check if this capability supports a specific memory type
   */
  supportsMemoryType(memoryType: MemoryType): boolean {
    return this.supportedMemoryTypes.includes(memoryType);
  }

  /**
   * Get total token budget (input + output)
   */
  getTotalTokenBudget(): number {
    return this.maxInputTokens + this.maxOutputTokens;
  }

  /**
   * Check if can perform an operation
   */
  canPerform(operation: 'stream' | 'pause' | 'coordinate' | 'use-tools'): boolean {
    switch (operation) {
      case 'stream':
        return this.canStreamResults;
      case 'pause':
        return this.canPauseResume;
      case 'coordinate':
        return this.canCoordinate;
      case 'use-tools':
        return this.canUseTools;
      default:
        return false;
    }
  }
}
