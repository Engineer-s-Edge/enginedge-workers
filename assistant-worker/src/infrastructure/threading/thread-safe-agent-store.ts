import { Injectable, Inject } from '@nestjs/common';
import { Agent } from '@domain/entities/agent.entity';
import { ILogger } from '@application/ports/logger.port';

interface LockHandle {
  agentId: string;
  acquiredAt: Date;
  timeoutHandle: NodeJS.Timeout;
}

@Injectable()
export class ThreadSafeAgentStore {
  private agents = new Map<string, Agent>();
  private locks = new Map<string, LockHandle>();
  private readonly lockTimeout = 30000; // 30s default

  constructor(
    @Inject('ILogger') private readonly logger: ILogger,
  ) {}

  async acquireLock(agentId: string, timeout: number = this.lockTimeout): Promise<boolean> {
    // Check if already locked
    if (this.locks.has(agentId)) {
      this.logger.debug('ThreadSafeAgentStore: Agent already locked', { agentId });
      return false;
    }

    // Acquire lock
    const timeoutHandle = setTimeout(() => {
      this.logger.warn('ThreadSafeAgentStore: Lock timeout', { agentId });
      this.releaseLock(agentId);
    }, timeout);

    const lock: LockHandle = {
      agentId,
      acquiredAt: new Date(),
      timeoutHandle,
    };

    this.locks.set(agentId, lock);
    this.logger.debug('ThreadSafeAgentStore: Lock acquired', { agentId });
    return true;
  }

  releaseLock(agentId: string): void {
    const lock = this.locks.get(agentId);
    if (lock) {
      clearTimeout(lock.timeoutHandle);
      this.locks.delete(agentId);
      this.logger.debug('ThreadSafeAgentStore: Lock released', { agentId });
    }
  }

  async withLock<T>(
    agentId: string,
    operation: (agent: Agent | undefined) => Promise<T>,
  ): Promise<T> {
    const maxRetries = 10;
    const retryDelay = 100;

    for (let i = 0; i < maxRetries; i++) {
      if (await this.acquireLock(agentId)) {
        try {
          const agent = this.agents.get(agentId);
          return await operation(agent);
        } finally {
          this.releaseLock(agentId);
        }
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    throw new Error(`Failed to acquire lock for agent ${agentId} after ${maxRetries} retries`);
  }

  async set(agentId: string, agent: Agent): Promise<void> {
    await this.withLock(agentId, async () => {
      this.agents.set(agentId, agent);
      this.logger.debug('ThreadSafeAgentStore: Agent stored', { agentId });
    });
  }

  async get(agentId: string): Promise<Agent | undefined> {
    return this.withLock(agentId, async (agent) => agent);
  }

  async update(
    agentId: string,
    updateFn: (agent: Agent) => Agent,
  ): Promise<Agent> {
    return this.withLock(agentId, async (agent) => {
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      const updated = updateFn(agent);
      this.agents.set(agentId, updated);
      this.logger.debug('ThreadSafeAgentStore: Agent updated', { agentId });
      return updated;
    });
  }

  async delete(agentId: string): Promise<boolean> {
    return this.withLock(agentId, async () => {
      const deleted = this.agents.delete(agentId);
      this.logger.debug('ThreadSafeAgentStore: Agent deleted', { agentId, deleted });
      return deleted;
    });
  }

  async has(agentId: string): Promise<boolean> {
    return this.withLock(agentId, async (agent) => agent !== undefined);
  }

  async clear(): Promise<void> {
    // Acquire locks for all agents
    const agentIds = Array.from(this.agents.keys());
    const locks = await Promise.all(
      agentIds.map(id => this.acquireLock(id)),
    );

    try {
      this.agents.clear();
      this.logger.info('ThreadSafeAgentStore: All agents cleared');
    } finally {
      // Release all locks
      agentIds.forEach(id => this.releaseLock(id));
    }
  }

  getMetrics() {
    return {
      agentCount: this.agents.size,
      lockedAgents: this.locks.size,
      oldestLock: this.getOldestLockAge(),
    };
  }

  private getOldestLockAge(): number | undefined {
    if (this.locks.size === 0) return undefined;

    const now = Date.now();
    let oldest = 0;

    for (const lock of this.locks.values()) {
      const age = now - lock.acquiredAt.getTime();
      if (age > oldest) oldest = age;
    }

    return oldest;
  }
}
