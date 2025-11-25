/**
 * Research Session Repository Port
 *
 * Interface for persisting and retrieving research sessions from storage.
 */

import {
  ResearchSession,
  CreateResearchSessionInput,
} from '../../domain/entities/research-session.entity';

export interface IResearchSessionRepository {
  /**
   * Create a new research session
   */
  create(input: CreateResearchSessionInput): Promise<ResearchSession>;

  /**
   * Find session by ID
   */
  findById(id: string): Promise<ResearchSession | null>;

  /**
   * Find sessions by user ID
   */
  findByUserId(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<ResearchSession[]>;

  /**
   * Find sessions by agent ID
   */
  findByAgentId(
    agentId: string,
    limit?: number,
    offset?: number,
  ): Promise<ResearchSession[]>;

  /**
   * Find sessions by conversation ID
   */
  findByConversationId(
    conversationId: string,
    limit?: number,
    offset?: number,
  ): Promise<ResearchSession[]>;

  /**
   * Update session
   */
  update(
    id: string,
    updates: Partial<ResearchSession>,
  ): Promise<ResearchSession>;

  /**
   * Delete session
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count sessions by user ID
   */
  countByUserId(userId: string): Promise<number>;
}
