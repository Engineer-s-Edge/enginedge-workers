/**
 * Research Session Entity
 *
 * Tracks expert agent research sessions with query, sources, evidence, and results.
 */

export enum ResearchSessionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface ResearchSession {
  id: string;
  userId: string;
  agentId?: string;
  conversationId?: string;
  query: string;
  domain?: string;
  status: ResearchSessionStatus;

  // Research metadata
  sources: Array<{
    id: string;
    url: string;
    title: string;
    author?: string;
    publishDate?: Date;
    credibilityScore?: number;
  }>;
  sourceCount: number;

  // Evidence and findings
  evidenceCount: number;
  averageConfidence: number;
  overallConfidence: number;

  // Phases (AIM-SHOOT-SKIN methodology)
  phases: Array<{
    phase: 'aim' | 'shoot' | 'skin';
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    output?: string;
    startedAt?: Date;
    completedAt?: Date;
    duration?: number;
  }>;

  // Final report
  report?: {
    id: string;
    title: string;
    abstract: string;
    keyFindings: string[];
    conclusions: string;
    recommendations?: string;
    generatedAt: Date;
  };

  // Timestamps
  startedAt: Date;
  completedAt?: Date;
  executionTimeMs?: number;

  // Metadata
  metadata?: {
    researchDepth?: 'basic' | 'advanced';
    maxSources?: number;
    maxTokens?: number;
    useBertScore?: boolean;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateResearchSessionInput {
  userId: string;
  agentId?: string;
  conversationId?: string;
  query: string;
  domain?: string;
  metadata?: ResearchSession['metadata'];
}
