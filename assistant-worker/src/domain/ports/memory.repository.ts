/**
 * Memory Repository Port
 *
 * Interface defining the persistence contract for agent memory.
 * Implementation provided by infrastructure layer (Phase 5).
 */

import { AgentMemory } from '../entities/agent-memory.entity';
import { AgentId } from '../entities/agent.entity';

/**
 * Port for agent memory persistence
 */
export interface IMemoryRepository {
  /**
   * Save memory for an agent
   */
  saveMemory(agentId: AgentId, memory: AgentMemory): Promise<void>;

  /**
   * Load memory for an agent
   */
  loadMemory(agentId: AgentId): Promise<AgentMemory | null>;

  /**
   * Append messages to agent memory
   */
  appendMessages(agentId: AgentId, messages: readonly unknown[]): Promise<void>;

  /**
   * Get recent messages for an agent
   */
  getRecentMessages(
    agentId: AgentId,
    count: number,
  ): Promise<readonly unknown[]>;

  /**
   * Clear memory for an agent
   */
  clearMemory(agentId: AgentId): Promise<void>;

  /**
   * Check if memory exists
   */
  hasMemory(agentId: AgentId): Promise<boolean>;

  /**
   * Get memory size (number of messages)
   */
  getMemorySize(agentId: AgentId): Promise<number>;

  /**
   * Search messages by content
   */
  searchMessages(agentId: AgentId, query: string): Promise<readonly unknown[]>;

  /**
   * Delete all memory (for testing)
   */
  clear?(): Promise<void>;
}
