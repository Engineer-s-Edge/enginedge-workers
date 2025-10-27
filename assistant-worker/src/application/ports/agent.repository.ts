import { Agent } from '../../domain/entities/agent.entity';

/**
 * Agent Repository Port - Interface for agent persistence
 * 
 * Infrastructure layer will implement this interface
 */
export interface IAgentRepository {
  /**
   * Save agent (create or update)
   */
  save(agent: Agent): Promise<void>;

  /**
   * Find agent by ID
   */
  findById(id: string): Promise<Agent | null>;

  /**
   * Find agent by name
   */
  findByName(name: string): Promise<Agent | null>;

  /**
   * Delete agent
   */
  delete(id: string): Promise<void>;

  /**
   * List all agents (with optional filters)
   */
  findAll(filters?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Agent[]>;

  /**
   * Check if agent exists
   */
  exists(id: string): Promise<boolean>;
}
