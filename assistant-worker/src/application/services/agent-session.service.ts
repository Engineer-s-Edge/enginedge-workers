/**
 * Agent Session Service
 *
 * Manages agent sessions, instance tracking, and user interaction handling.
 */

import { Injectable, Inject, Optional, OnModuleInit } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import { IAgentSessionRepository } from '../../infrastructure/adapters/storage/mongodb-agent-session.repository';

export interface AgentSession {
  sessionId: string;
  agentId: string;
  userId: string;
  instanceKey: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  createdAt: Date;
  lastActivityAt: Date;
  metadata: Record<string, unknown>;
}

export interface UserInteraction {
  interactionId: string;
  agentId: string;
  sessionId: string;
  type: 'input' | 'approval' | 'choice';
  prompt: string;
  status: 'pending' | 'resolved' | 'cancelled';
  response?: unknown;
  createdAt: Date;
  resolvedAt?: Date;
}

/**
 * Service for managing agent sessions
 *
 * Supports both in-memory (default) and MongoDB persistence (when repository is available).
 * For multi-instance deployment, MongoDB persistence ensures sessions are shared across instances.
 */
@Injectable()
export class AgentSessionService implements OnModuleInit {
  private sessions: Map<string, AgentSession>; // In-memory cache
  private interactions: Map<string, UserInteraction>; // Still in-memory (short-lived)
  private usePersistence: boolean = false;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
    @Optional()
    @Inject('IAgentSessionRepository')
    private readonly sessionRepository?: IAgentSessionRepository,
  ) {
    this.sessions = new Map();
    this.interactions = new Map();
    this.usePersistence = !!this.sessionRepository;
  }

  async onModuleInit() {
    if (this.usePersistence) {
      this.logger.info('AgentSessionService: Using MongoDB persistence');
      // Start periodic cleanup (every hour)
      this.cleanupInterval = setInterval(
        () => {
          this.cleanupOldSessions().catch((error) => {
            this.logger.error('Failed to cleanup old sessions', {
              error: error instanceof Error ? error.message : String(error),
            });
          });
        },
        60 * 60 * 1000,
      ); // 1 hour
    } else {
      this.logger.info(
        'AgentSessionService: Using in-memory storage (single instance)',
      );
      // Start periodic cleanup for in-memory (every 30 minutes)
      this.cleanupInterval = setInterval(
        () => {
          this.cleanupOldSessions();
        },
        30 * 60 * 1000,
      ); // 30 minutes
    }
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Create a new session
   */
  async createSession(
    agentId: string,
    userId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<AgentSession> {
    const sessionId = this.generateSessionId();
    const instanceKey = this.generateInstanceKey(agentId, userId);

    const session: AgentSession = {
      sessionId,
      agentId,
      userId,
      instanceKey,
      status: 'active',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata,
    };

    // Persist to MongoDB if repository is available
    if (this.usePersistence && this.sessionRepository) {
      try {
        await this.sessionRepository.create(session);
      } catch (error) {
        this.logger.error('Failed to persist session to MongoDB', {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Fall back to in-memory only
      }
    }

    // Always cache in memory for fast access
    this.sessions.set(sessionId, session);

    this.logger.info('Agent session created', {
      sessionId,
      agentId,
      userId,
      persisted: this.usePersistence,
    });

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<AgentSession | undefined> {
    // Check in-memory cache first
    const cached = this.sessions.get(sessionId);
    if (cached) {
      return cached;
    }

    // If using persistence, try to load from MongoDB
    if (this.usePersistence && this.sessionRepository) {
      try {
        const persisted = await this.sessionRepository.findById(sessionId);
        if (persisted) {
          // Cache in memory for future access
          this.sessions.set(sessionId, persisted);
          return persisted;
        }
      } catch (error) {
        this.logger.error('Failed to load session from MongoDB', {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return undefined;
  }

  /**
   * Get agent instance by key
   */
  async getAgentInstance(
    agentId: string,
    userId: string,
  ): Promise<AgentSession | undefined> {
    const instanceKey = this.generateInstanceKey(agentId, userId);

    // Check in-memory cache first
    for (const session of this.sessions.values()) {
      if (session.instanceKey === instanceKey && session.status === 'active') {
        return session;
      }
    }

    // If using persistence, try to load from MongoDB
    if (this.usePersistence && this.sessionRepository) {
      try {
        const persisted =
          await this.sessionRepository.findByInstanceKey(instanceKey);
        if (persisted) {
          // Cache in memory for future access
          this.sessions.set(persisted.sessionId, persisted);
          return persisted;
        }
      } catch (error) {
        this.logger.error('Failed to load session from MongoDB', {
          instanceKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return undefined;
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: AgentSession['status'],
  ): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (session) {
      session.status = status;
      session.lastActivityAt = new Date();

      // Persist to MongoDB if repository is available
      if (this.usePersistence && this.sessionRepository) {
        try {
          await this.sessionRepository.updateStatus(sessionId, status);
        } catch (error) {
          this.logger.error('Failed to update session status in MongoDB', {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logger.info('Session status updated', {
        sessionId,
        status,
      });
    }
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (session) {
      session.lastActivityAt = new Date();

      // Persist to MongoDB if repository is available (debounced - only update every 5 minutes)
      if (this.usePersistence && this.sessionRepository) {
        const lastUpdate = (session.metadata.lastActivityUpdate as number) || 0;
        const now = Date.now();
        if (now - lastUpdate > 5 * 60 * 1000) {
          // 5 minutes
          try {
            await this.sessionRepository.updateActivity(sessionId);
            session.metadata.lastActivityUpdate = now;
          } catch (error) {
            this.logger.error('Failed to update session activity in MongoDB', {
              sessionId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    // Delete from MongoDB if repository is available
    if (this.usePersistence && this.sessionRepository) {
      try {
        await this.sessionRepository.delete(sessionId);
      } catch (error) {
        this.logger.error('Failed to delete session from MongoDB', {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Delete from in-memory cache
    if (this.sessions.delete(sessionId)) {
      this.logger.info('Session deleted', { sessionId });
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(
    userId: string,
    status?: string,
  ): Promise<AgentSession[]> {
    // If using persistence, load from MongoDB
    if (this.usePersistence && this.sessionRepository) {
      try {
        const persisted = await this.sessionRepository.findByUserId(
          userId,
          status,
        );
        // Update in-memory cache
        for (const session of persisted) {
          this.sessions.set(session.sessionId, session);
        }
        return persisted;
      } catch (error) {
        this.logger.error('Failed to load user sessions from MongoDB', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fall back to in-memory
    return Array.from(this.sessions.values()).filter(
      (session) =>
        session.userId === userId && (!status || session.status === status),
    );
  }

  /**
   * Get all sessions for an agent
   */
  async getAgentSessions(
    agentId: string,
    status?: string,
  ): Promise<AgentSession[]> {
    // If using persistence, load from MongoDB
    if (this.usePersistence && this.sessionRepository) {
      try {
        const persisted = await this.sessionRepository.findByAgentId(
          agentId,
          status,
        );
        // Update in-memory cache
        for (const session of persisted) {
          this.sessions.set(session.sessionId, session);
        }
        return persisted;
      } catch (error) {
        this.logger.error('Failed to load agent sessions from MongoDB', {
          agentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Fall back to in-memory
    return Array.from(this.sessions.values()).filter(
      (session) =>
        session.agentId === agentId && (!status || session.status === status),
    );
  }

  /**
   * Setup user interaction handling
   */
  setupUserInteractionHandling(
    agentId: string,
    sessionId: string,
    type: UserInteraction['type'],
    prompt: string,
  ): UserInteraction {
    const interactionId = this.generateInteractionId();

    const interaction: UserInteraction = {
      interactionId,
      agentId,
      sessionId,
      type,
      prompt,
      status: 'pending',
      createdAt: new Date(),
    };

    this.interactions.set(interactionId, interaction);

    this.logger.info('User interaction created', {
      interactionId,
      agentId,
      type,
    });

    return interaction;
  }

  /**
   * Get pending user interactions for agent
   */
  getPendingUserInteractions(agentId: string): UserInteraction[] {
    return Array.from(this.interactions.values()).filter(
      (interaction) =>
        interaction.agentId === agentId && interaction.status === 'pending',
    );
  }

  /**
   * Resolve user interaction
   */
  resolveUserInteraction(interactionId: string, response: unknown): void {
    const interaction = this.interactions.get(interactionId);

    if (interaction) {
      interaction.status = 'resolved';
      interaction.response = response;
      interaction.resolvedAt = new Date();

      this.logger.info('User interaction resolved', {
        interactionId,
      });
    }
  }

  /**
   * Cancel user interaction
   */
  cancelUserInteraction(interactionId: string): void {
    const interaction = this.interactions.get(interactionId);

    if (interaction) {
      interaction.status = 'cancelled';
      interaction.resolvedAt = new Date();

      this.logger.info('User interaction cancelled', {
        interactionId,
      });
    }
  }

  /**
   * Clean up old sessions (older than specified hours, default 24)
   */
  async cleanupOldSessions(maxAgeHours: number = 24): Promise<number> {
    let cleaned = 0;

    // Clean up from MongoDB if repository is available
    if (this.usePersistence && this.sessionRepository) {
      try {
        cleaned = await this.sessionRepository.cleanupOldSessions(maxAgeHours);
        // Also clean up in-memory cache
        const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
        for (const [sessionId, session] of this.sessions.entries()) {
          if (
            session.lastActivityAt < cutoffTime &&
            (session.status === 'completed' || session.status === 'failed')
          ) {
            this.sessions.delete(sessionId);
          }
        }
      } catch (error) {
        this.logger.error('Failed to cleanup old sessions from MongoDB', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      // In-memory cleanup
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      for (const [sessionId, session] of this.sessions.entries()) {
        if (
          session.lastActivityAt < cutoffTime &&
          (session.status === 'completed' || session.status === 'failed')
        ) {
          this.sessions.delete(sessionId);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      this.logger.info('Old sessions cleaned up', { count: cleaned });
    }

    return cleaned;
  }

  // Private helper methods

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateInstanceKey(agentId: string, userId: string): string {
    return `${userId}:${agentId}`;
  }

  private generateInteractionId(): string {
    return `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
