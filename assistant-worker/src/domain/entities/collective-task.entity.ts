/**
 * Collective Task Entity
 *
 * Domain entity representing tasks in a collective agent system.
 * Supports 8-level hierarchy: Vision → Portfolio → Program → Epic → Feature → Story → Task → Subtask
 */

export enum TaskLevel {
  VISION = 0,
  PORTFOLIO = 1,
  PROGRAM = 2,
  EPIC = 3,
  FEATURE = 4,
  STORY = 5,
  TASK = 6,
  SUBTASK = 7,
}

export enum TaskState {
  UNASSIGNED = 'unassigned',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  DELEGATED = 'delegated',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REVIEW = 'review',
}

export interface ErrorInfo {
  message: string;
  code?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface CollectiveTask {
  id: string;
  collectiveId: string;
  level: TaskLevel;
  parentTaskId?: string;
  childTaskIds: string[];
  title: string;
  description: string;
  state: TaskState;
  assignedAgentId?: string;
  allowedAgentIds: string[];
  dependencies: string[]; // Task IDs this task depends on
  blockedBy: string[]; // Task IDs currently blocking this task
  conversationId?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: ErrorInfo;
  priority: number; // 0-100
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new collective task
 */
export function createCollectiveTask(
  collectiveId: string,
  title: string,
  description: string,
  level: TaskLevel,
  options: {
    parentTaskId?: string;
    assignedAgentId?: string;
    allowedAgentIds?: string[];
    dependencies?: string[];
    priority?: number;
    metadata?: Record<string, any>;
  } = {},
): CollectiveTask {
  return {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    collectiveId,
    level,
    title,
    description,
    state: TaskState.UNASSIGNED,
    parentTaskId: options.parentTaskId,
    childTaskIds: [],
    assignedAgentId: options.assignedAgentId,
    allowedAgentIds: options.allowedAgentIds || [],
    dependencies: options.dependencies || [],
    blockedBy: [],
    priority: options.priority || 50,
    metadata: options.metadata,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
