import { Injectable } from '@nestjs/common';

export type ExpertPhase = 'aim' | 'shoot' | 'skin' | 'idle';
export type ValidationStatus =
  | 'not-started'
  | 'validating'
  | 'passed'
  | 'failed';

export interface ExpertTopicAssignment {
  topicId: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'paused';
  progress: number; // 0-100
  priority?: number;
  lastUpdated: Date;
  summary?: string;
}

export interface ExpertRuntimeSnapshot {
  expertId: string;
  agentId: string;
  specialization?: string;
  assignedTopics: ExpertTopicAssignment[];
  validationStatus: ValidationStatus;
  currentPhase: ExpertPhase;
  researchProgress: number; // 0-100
  paused: boolean;
  notes: string[];
  metrics: {
    iterations: number;
    findings: number;
    avgConfidence: number;
    lastValidationScore?: number;
    updatedAt: Date;
  };
  updatedAt: Date;
}

export type ExpertRuntimeUpdate = Partial<
  Omit<
    ExpertRuntimeSnapshot,
    'agentId' | 'expertId' | 'metrics' | 'assignedTopics'
  >
> & {
  assignedTopics?: ExpertTopicAssignment[];
  metrics?: Partial<ExpertRuntimeSnapshot['metrics']>;
  appendNotes?: string | string[];
};

@Injectable()
export class GeniusExpertRuntimeService {
  private readonly agentExperts = new Map<
    string,
    Map<string, ExpertRuntimeSnapshot>
  >();

  registerExpert(
    agentId: string,
    expertId: string,
    partial?: Partial<Omit<ExpertRuntimeSnapshot, 'agentId' | 'expertId'>>,
  ): ExpertRuntimeSnapshot {
    const existing = this.getExpert(agentId, expertId);
    if (existing) {
      return this.updateExpertState(agentId, expertId, partial ?? {});
    }

    const snapshot: ExpertRuntimeSnapshot = {
      expertId,
      agentId,
      specialization: partial?.specialization,
      assignedTopics: partial?.assignedTopics || [],
      validationStatus: partial?.validationStatus || 'not-started',
      currentPhase: partial?.currentPhase || 'idle',
      researchProgress: partial?.researchProgress ?? 0,
      paused: partial?.paused ?? false,
      notes: partial?.notes ? [...partial.notes] : [],
      metrics: {
        iterations: partial?.metrics?.iterations ?? 0,
        findings: partial?.metrics?.findings ?? 0,
        avgConfidence: partial?.metrics?.avgConfidence ?? 0,
        lastValidationScore: partial?.metrics?.lastValidationScore,
        updatedAt: partial?.metrics?.updatedAt ?? new Date(),
      },
      updatedAt: partial?.updatedAt ?? new Date(),
    };

    const agentMap = this.getAgentMap(agentId);
    agentMap.set(expertId, snapshot);
    return snapshot;
  }

  getExperts(agentId: string): ExpertRuntimeSnapshot[] {
    return Array.from(this.getAgentMap(agentId).values());
  }

  getExpert(
    agentId: string,
    expertId: string,
  ): ExpertRuntimeSnapshot | undefined {
    return this.getAgentMap(agentId).get(expertId);
  }

  assignTopics(
    agentId: string,
    expertId: string,
    topics: ExpertTopicAssignment[],
  ): ExpertRuntimeSnapshot {
    const normalized = topics.map((topic) => ({
      ...topic,
      status: topic.status || 'pending',
      progress: Math.max(0, Math.min(100, topic.progress ?? 0)),
      lastUpdated: topic.lastUpdated || new Date(),
    }));

    return this.updateExpertState(agentId, expertId, {
      assignedTopics: normalized,
      updatedAt: new Date(),
    });
  }

  pauseExpert(
    agentId: string,
    expertId: string,
    note?: string,
  ): ExpertRuntimeSnapshot {
    const snapshot = this.ensureExpert(agentId, expertId);
    const assignedTopics = snapshot.assignedTopics.map((topic) => ({
      ...topic,
      status: 'paused' as const,
      lastUpdated: new Date(),
    }));

    return this.updateExpertState(agentId, expertId, {
      paused: true,
      assignedTopics,
      currentPhase: 'idle',
      appendNotes: note ? [`Paused: ${note}`] : undefined,
    });
  }

  resumeExpert(
    agentId: string,
    expertId: string,
    note?: string,
  ): ExpertRuntimeSnapshot {
    const snapshot = this.ensureExpert(agentId, expertId);
    const assignedTopics = snapshot.assignedTopics.map((topic) => ({
      ...topic,
      status: (topic.progress >= 100 ? 'completed' : 'in-progress') as
        | 'completed'
        | 'in-progress',
      lastUpdated: new Date(),
    }));

    return this.updateExpertState(agentId, expertId, {
      paused: false,
      assignedTopics,
      currentPhase: assignedTopics.some((t) => t.status === 'in-progress')
        ? 'shoot'
        : snapshot.currentPhase,
      appendNotes: note ? [`Resumed: ${note}`] : undefined,
    });
  }

  updateExpertState(
    agentId: string,
    expertId: string,
    updates: ExpertRuntimeUpdate,
  ): ExpertRuntimeSnapshot {
    const snapshot = this.ensureExpert(agentId, expertId);
    const merged: ExpertRuntimeSnapshot = {
      ...snapshot,
      specialization: updates.specialization ?? snapshot.specialization,
      validationStatus: updates.validationStatus ?? snapshot.validationStatus,
      currentPhase: updates.currentPhase ?? snapshot.currentPhase,
      researchProgress:
        updates.researchProgress !== undefined
          ? Math.max(0, Math.min(100, updates.researchProgress))
          : snapshot.researchProgress,
      paused: updates.paused ?? snapshot.paused,
      updatedAt: updates.updatedAt ?? new Date(),
      assignedTopics: updates.assignedTopics
        ? updates.assignedTopics.map((topic) => ({
            ...topic,
            progress: Math.max(0, Math.min(100, topic.progress ?? 0)),
            lastUpdated: topic.lastUpdated || new Date(),
          }))
        : snapshot.assignedTopics,
      notes: this.mergeNotes(snapshot.notes, updates.appendNotes),
      metrics: {
        ...snapshot.metrics,
        ...(updates.metrics || {}),
        updatedAt: updates.metrics?.updatedAt || new Date(),
      },
    };

    this.getAgentMap(agentId).set(expertId, merged);
    return merged;
  }

  clearAgent(agentId: string): void {
    this.agentExperts.delete(agentId);
  }

  private ensureExpert(
    agentId: string,
    expertId: string,
  ): ExpertRuntimeSnapshot {
    const existing = this.getExpert(agentId, expertId);
    if (existing) {
      return existing;
    }
    return this.registerExpert(agentId, expertId);
  }

  private getAgentMap(agentId: string): Map<string, ExpertRuntimeSnapshot> {
    if (!this.agentExperts.has(agentId)) {
      this.agentExperts.set(agentId, new Map());
    }
    return this.agentExperts.get(agentId)!;
  }

  private mergeNotes(existing: string[], append?: string | string[]): string[] {
    if (!append) {
      return existing;
    }

    const additions = Array.isArray(append) ? append : [append];
    return [...existing, ...additions];
  }
}
