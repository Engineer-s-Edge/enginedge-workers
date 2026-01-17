/**
 * Assistant Repository Port
 *
 * Application layer port (interface) for assistant persistence
 */

import { Assistant } from '@domain/entities/assistant.entity';
import { AssistantFiltersDto } from '../dto/assistant.dto';

export interface IAssistantRepository {
  /**
   * Create a new assistant
   */
  create(assistantData: Partial<Assistant>): Promise<Assistant>;

  /**
   * Find all assistants with optional filters
   */
  findAll(filters?: AssistantFiltersDto): Promise<Assistant[]>;

  /**
   * Find assistant by name
   */
  findByName(name: string): Promise<Assistant | null>;

  /**
   * Find assistant by ID
   */
  findById(id: string): Promise<Assistant | null>;

  /**
   * Update assistant by name
   */
  update(
    name: string,
    updateData: Partial<Assistant>,
  ): Promise<Assistant | null>;

  /**
   * Delete assistant by name
   */
  delete(name: string): Promise<boolean>;

  /**
   * Check if assistant exists by name
   */
  exists(name: string): Promise<boolean>;

  /**
   * Update execution statistics
   */
  updateExecutionStats(name: string): Promise<void>;

  /**
   * Find public assistants
   */
  findPublicAssistants(): Promise<Assistant[]>;

  /**
   * Find assistants by user ID
   */
  findUserAssistants(userId: string): Promise<Assistant[]>;
}
