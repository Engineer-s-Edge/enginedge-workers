export interface AgentSessionRecord {
  sessionId: string;
  agentId: string;
  userId: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  createdAt: Date;
  lastActivityAt: Date;
  metadata: Record<string, unknown>;
}

export interface IAgentSessionRepository {
  create(session: AgentSessionRecord): Promise<void>;
  findById(sessionId: string): Promise<AgentSessionRecord | null>;
  updateStatus(
    sessionId: string,
    status: AgentSessionRecord['status'],
  ): Promise<void>;
  updateActivity(sessionId: string, at?: Date): Promise<void>;
  delete(sessionId: string): Promise<void>;
  listByUser(userId: string, limit?: number): Promise<AgentSessionRecord[]>;
  listByAgent(agentId: string, limit?: number): Promise<AgentSessionRecord[]>;
}
