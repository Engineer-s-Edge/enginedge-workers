import { Injectable } from '@nestjs/common';
import { Agent } from '@domain/entities/agent.entity';
import { IAgentRepository } from '@application/ports/agent.repository';

/**
 * In-Memory Agent Repository
 *
 * Simple in-memory implementation for development/testing
 * Production would use MongoDB or similar
 */
@Injectable()
export class InMemoryAgentRepository implements IAgentRepository {
  private agents: Map<string, Agent> = new Map();
  private agentsByName: Map<string, Agent> = new Map();

  async save(agent: Agent): Promise<void> {
    this.agents.set(agent.id, agent);
    this.agentsByName.set(agent.name, agent);
  }

  async findById(id: string): Promise<Agent | null> {
    const agent = this.agents.get(id);
    return agent || null;
  }

  async findByName(name: string): Promise<Agent | null> {
    const agent = this.agentsByName.get(name);
    return agent || null;
  }

  async delete(id: string): Promise<void> {
    const agent = this.agents.get(id);
    if (agent) {
      this.agents.delete(id);
      this.agentsByName.delete(agent.name);
    }
  }

  async findAll(filters?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<Agent[]> {
    let agents = Array.from(this.agents.values());

    // Apply filters
    if (filters?.userId) {
      // Agents don't currently have userId, but this shows filter pattern
      agents = agents.filter(() => true);
    }

    // Apply pagination
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 100;

    return agents.slice(offset, offset + limit);
  }

  async exists(id: string): Promise<boolean> {
    return this.agents.has(id);
  }

  // Testing helper
  clear(): void {
    this.agents.clear();
    this.agentsByName.clear();
  }
}
