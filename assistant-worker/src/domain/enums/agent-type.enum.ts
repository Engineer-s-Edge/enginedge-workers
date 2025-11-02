/**
 * Agent Type Enumeration
 * 
 * Defines all supported agent types in the system.
 * Each type represents a distinct execution model and behavior pattern.
 */

export const AgentType = {
  /** Chain-of-Thought reasoning with tool use */
  REACT: 'react',
  
  /** Directed Acyclic Graph workflow execution */
  GRAPH: 'graph',
  
  /** ICS Bear Hunter research pattern (AIM → SHOOT → SKIN) */
  EXPERT: 'expert',
  
  /** Autonomous learning agent with scheduling */
  GENIUS: 'genius',
  
  /** Multi-agent coordination and orchestration */
  COLLECTIVE: 'collective',
  
  /** Hierarchical task decomposition and delegation */
  MANAGER: 'manager',
  
  /** AI-powered interview conducting agent */
  INTERVIEW: 'interview',
} as const;

/**
 * Type-safe agent type
 * Prevents string typos and ensures compile-time safety
 */
export type AgentTypeValue = typeof AgentType[keyof typeof AgentType];

/**
 * Branded type to prevent accidental string usage
 * Usage: const agentType: BrandedAgentType = AgentType.REACT as BrandedAgentType;
 */
export type BrandedAgentType = AgentTypeValue & { readonly __brand: 'AgentType' };

/**
 * Check if a string is a valid agent type
 */
export function isValidAgentType(value: unknown): value is AgentTypeValue {
  if (typeof value !== 'string') return false;
  return Object.values(AgentType).includes(value as AgentTypeValue);
}

/**
 * Convert string to branded agent type with validation
 * @throws Error if value is not a valid agent type
 */
export function toAgentType(value: unknown): BrandedAgentType {
  if (!isValidAgentType(value)) {
    throw new Error(
      `Invalid agent type: "${value}". Must be one of: ${Object.values(AgentType).join(', ')}`,
    );
  }
  return value as BrandedAgentType;
}

/**
 * Get human-readable name for agent type
 */
export function getAgentTypeDisplayName(type: AgentTypeValue): string {
  const names: Record<AgentTypeValue, string> = {
    [AgentType.REACT]: 'ReAct (Chain-of-Thought)',
    [AgentType.GRAPH]: 'Graph (DAG Workflow)',
    [AgentType.EXPERT]: 'Expert (Research)',
    [AgentType.GENIUS]: 'Genius (Learning)',
    [AgentType.COLLECTIVE]: 'Collective (Coordination)',
    [AgentType.MANAGER]: 'Manager (Hierarchical)',
    [AgentType.INTERVIEW]: 'Interview (Mock Interview)',
  };
  return names[type];
}

/**
 * Get execution model for agent type
 */
export function getExecutionModel(
  type: AgentTypeValue,
): 'chain-of-thought' | 'dag' | 'research' | 'learning' | 'coordination' | 'hierarchical' | 'interview' {
  const models: Record<AgentTypeValue, 'chain-of-thought' | 'dag' | 'research' | 'learning' | 'coordination' | 'hierarchical' | 'interview'> = {
    [AgentType.REACT]: 'chain-of-thought',
    [AgentType.GRAPH]: 'dag',
    [AgentType.EXPERT]: 'research',
    [AgentType.GENIUS]: 'learning',
    [AgentType.COLLECTIVE]: 'coordination',
    [AgentType.MANAGER]: 'hierarchical',
    [AgentType.INTERVIEW]: 'interview',
  };
  return models[type];
}
