/**
 * Agent Session Service
 * 
 * Manages agent sessions, instance tracking, and user interaction handling.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';

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
 */
@Injectable()
export class AgentSessionService {
  private sessions: Map<string, AgentSession>;
  private interactions: Map<string, UserInteraction>;

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {
    this.sessions = new Map();
    this.interactions = new Map();
  }

  /**
   * Create a new session
   */
  createSession(
    agentId: string,
    userId: string,
    metadata: Record<string, unknown> = {},
  ): AgentSession {
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

    this.sessions.set(sessionId, session);

    this.logger.info('Agent session created', {
      sessionId,
      agentId,
      userId,
    });

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get agent instance by key
   */
  getAgentInstance(agentId: string, userId: string): AgentSession | undefined {
    const instanceKey = this.generateInstanceKey(agentId, userId);
    
    for (const session of this.sessions.values()) {
      if (session.instanceKey === instanceKey && session.status === 'active') {
        return session;
      }
    }

    return undefined;
  }

  /**
   * Update session status
   */
  updateSessionStatus(
    sessionId: string,
    status: AgentSession['status'],
  ): void {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      session.status = status;
      session.lastActivityAt = new Date();

      this.logger.info('Session status updated', {
        sessionId,
        status,
      });
    }
  }

  /**
   * Update session activity timestamp
   */
  updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      session.lastActivityAt = new Date();
    }
  }

  /**
   * Delete session
   */
  deleteSession(sessionId: string): void {
    if (this.sessions.delete(sessionId)) {
      this.logger.info('Session deleted', { sessionId });
    }
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): AgentSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.userId === userId,
    );
  }

  /**
   * Get all sessions for an agent
   */
  getAgentSessions(agentId: string): AgentSession[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.agentId === agentId,
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
  resolveUserInteraction(
    interactionId: string,
    response: unknown,
  ): void {
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
   * Clean up old sessions (older than 24 hours)
   */
  cleanupOldSessions(): number {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivityAt < cutoffTime) {
        this.sessions.delete(sessionId);
        cleaned++;
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

