import { AgentCapability } from '../value-objects/agent-capability.vo';
import { AgentConfig } from '../value-objects/agent-config.vo';
import { AgentReference } from '../value-objects/agent-reference.vo';
import { AgentTypeValue } from '../enums/agent-type.enum';
import { AgentMemory } from './agent-memory.entity';
import { AgentState } from './agent-state.entity';

export type AgentId = string & { readonly __brand: 'AgentId' };

/**
 * Agent Entity - Core domain object representing an AI agent
 * 
 * Immutable by design - all mutations create new instances
 * Supports all agent types: ReAct, Graph, Expert, Genius, Collective
 * Factory pattern for creation with validation
 */
export class Agent {
  private constructor(
    public readonly id: AgentId,
    public readonly name: string,
    public readonly agentType: AgentTypeValue,
    public readonly config: AgentConfig,
    public readonly capability: AgentCapability,
    private readonly state: AgentState,
    private readonly memory: AgentMemory,
    public readonly childAgents: readonly AgentReference[], // For Collective
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /**
   * Create a new agent with validation
   */
  static create(
    name: string,
    agentType: AgentTypeValue,
    config: AgentConfig,
    capability: AgentCapability,
  ): Agent {
    // Validation
    if (!name || name.trim().length === 0) {
      throw new Error('Agent name is required');
    }

    if (name.length > 100) {
      throw new Error('Agent name must be less than 100 characters');
    }

    const now = new Date();
    return new Agent(
      crypto.randomUUID() as AgentId,
      name.trim(),
      agentType,
      config,
      capability,
      AgentState.idle(),
      AgentMemory.empty(),
      [],
      now,
      now,
    );
  }

  /**
   * Restore agent from persistence layer
   */
  static restore(
    id: AgentId,
    name: string,
    agentType: AgentTypeValue,
    config: AgentConfig,
    capability: AgentCapability,
    state: AgentState,
    memory: AgentMemory,
    childAgents: readonly AgentReference[],
    createdAt: Date,
    updatedAt: Date,
  ): Agent {
    return new Agent(
      id,
      name,
      agentType,
      config,
      capability,
      state,
      memory,
      childAgents,
      createdAt,
      updatedAt,
    );
  }

  // Getters
  getState(): AgentState {
    return this.state;
  }

  getMemory(): AgentMemory {
    return this.memory;
  }

  getChildAgents(): readonly AgentReference[] {
    return this.childAgents;
  }

  // Immutable state transitions
  withState(newState: AgentState): Agent {
    return new Agent(
      this.id,
      this.name,
      this.agentType,
      this.config,
      this.capability,
      newState,
      this.memory,
      this.childAgents,
      this.createdAt,
      new Date(),
    );
  }

  withMemory(newMemory: AgentMemory): Agent {
    return new Agent(
      this.id,
      this.name,
      this.agentType,
      this.config,
      this.capability,
      this.state,
      newMemory,
      this.childAgents,
      this.createdAt,
      new Date(),
    );
  }

  withConfig(newConfig: AgentConfig): Agent {
    return new Agent(
      this.id,
      this.name,
      this.agentType,
      newConfig,
      this.capability,
      this.state,
      this.memory,
      this.childAgents,
      this.createdAt,
      new Date(),
    );
  }

  withChildAgents(childAgents: readonly AgentReference[]): Agent {
    return new Agent(
      this.id,
      this.name,
      this.agentType,
      this.config,
      this.capability,
      this.state,
      this.memory,
      childAgents,
      this.createdAt,
      new Date(),
    );
  }

  /**
   * Check if agent is ready to execute
   */
  isReady(): boolean {
    return this.state.canTransitionTo('processing');
  }

  /**
   * Check if agent is currently processing
   */
  isProcessing(): boolean {
    return this.state.getCurrentState() === 'processing';
  }

  /**
   * Convert to plain object for persistence
   */
  toPlainObject(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      agentType: this.agentType,
      config: this.config.toPlainObject(),
      capability: {
        executionModel: this.capability.executionModel,
        canUseTools: this.capability.canUseTools,
        canStreamResults: this.capability.canStreamResults,
        canPauseResume: this.capability.canPauseResume,
        canCoordinate: this.capability.canCoordinate,
      },
      state: this.state.toPlainObject(),
      memory: this.memory.toPlainObject(),
      childAgents: this.childAgents.map(ca => ca.toPlain()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
