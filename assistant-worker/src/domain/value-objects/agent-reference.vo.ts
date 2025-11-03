/**
 * Agent Reference Value Object
 *
 * Safe reference to another agent for composition relationships.
 * Prevents circular references and enables proper dependency tracking.
 */

import { AgentId } from '../entities/agent.entity';
import { AgentTypeValue } from '../enums/agent-type.enum';

export interface AgentReferenceProps {
  agentId: AgentId;
  agentType: AgentTypeValue;
  name: string;
  role?: string; // e.g., 'researcher', 'validator', 'synthesizer' for Collective
}

/**
 * Immutable reference to another agent
 * Used for Collective child agents, dependencies, etc.
 */
export class AgentReference {
  private constructor(
    public readonly agentId: AgentId,
    public readonly agentType: AgentTypeValue,
    public readonly name: string,
    public readonly role: string,
  ) {}

  /**
   * Create with validation
   */
  static create(props: AgentReferenceProps): AgentReference {
    if (!props.agentId || props.agentId.trim().length === 0) {
      throw new Error('Agent ID is required');
    }

    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Agent name is required');
    }

    if (props.role !== undefined && props.role.trim().length === 0) {
      throw new Error('Agent role must be non-empty if provided');
    }

    return new AgentReference(
      props.agentId,
      props.agentType,
      props.name.trim(),
      props.role?.trim() || 'default',
    );
  }

  /**
   * Check if this reference points to a specific agent
   */
  pointsTo(agentId: AgentId): boolean {
    return this.agentId === agentId;
  }

  /**
   * Convert to plain object
   */
  toPlain(): AgentReferenceProps {
    return {
      agentId: this.agentId,
      agentType: this.agentType,
      name: this.name,
      role: this.role,
    };
  }
}
