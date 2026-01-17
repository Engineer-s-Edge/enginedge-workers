/**
 * Expert Pool Types
 *
 * Type definitions for Expert Pool Manager execution tracking,
 * collision detection, and reporting.
 */

import { AgentId } from '../entities/agent.entity';

/**
 * Knowledge Graph modification record
 */
export interface KGModification {
  timestamp: Date;
  expertId: AgentId;
  operationType:
    | 'create-node'
    | 'update-node'
    | 'create-edge'
    | 'add-research'
    | 'skin';
  nodeId?: string;
  edgeId?: string;
  success: boolean;
  conflictResolution?: 'skipped' | 'merged' | 'overwritten' | 'retried';
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Expert execution report
 */
export interface ExpertReport {
  expertId: AgentId;
  topicResearched: string;
  topicId?: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  modifications: KGModification[];
  sourcesUsed: number;
  avgConfidence: number;
  issuesEncountered: string[];
  escalationRequired: boolean;
  escalationReason?: string;
  status: 'completed' | 'failed' | 'timeout' | 'escalated';
  result?: any;
}

/**
 * Active expert execution tracking
 */
export interface ActiveExecution {
  expertId: AgentId;
  topic: string;
  topicId?: string;
  startTime: Date;
  abortController: AbortController;
  timeoutHandle: NodeJS.Timeout;
  promise: Promise<ExpertReport>;
}

/**
 * Collision handling result
 */
export interface CollisionResult {
  handled: boolean;
  action: 'skipped' | 'waited' | 'merged' | 'failed';
  message: string;
}

/**
 * Expert Pool configuration
 */
export interface ExpertPoolConfig {
  /** Maximum number of experts that can run concurrently */
  maxConcurrentExperts: number;

  /** Maximum time an expert can run before timing out (ms) */
  expertTimeout: number;

  /** Maximum retry attempts for a topic before escalating */
  maxRetriesPerTopic: number;

  /** Maximum concurrent knowledge graph writes */
  knowledgeGraphWriteSemaphore: number;

  /** Enable detailed logging for debugging */
  verbose: boolean;

  /** Enable work logging (KG modifications) */
  enableWorkLogging: boolean;

  /** Stale lock threshold (ms) - locks older than this are considered stale */
  staleLockThreshold: number;
}

/**
 * Expert Pool statistics
 */
export interface ExpertPoolStats {
  activeExperts: number;
  totalExpertsSpawned: number;
  totalTopicsCompleted: number;
  totalTopicsFailed: number;
  totalTimeout: number;
  totalEscalations: number;
  averageCompletionTimeMs: number;
  collisionCount: number;
  queuedRequests: number;
  totalModifications: number;
  totalSourcesUsed: number;
}
