/**
 * Manager Agent - Type Definitions
 *
 * Defines types for task decomposition and sub-agent coordination
 */

/**
 * Task decomposition strategy
 */
export enum DecompositionStrategy {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  HIERARCHICAL = 'hierarchical',
  GUIDED = 'guided',
}

/**
 * Manager agent state
 */
export enum ManagerAgentState {
  IDLE = 'idle',
  PLANNING = 'planning',
  DECOMPOSING = 'decomposing',
  COORDINATING = 'coordinating',
  AGGREGATING = 'aggregating',
  COMPLETE = 'complete',
}

/**
 * Original task to be decomposed
 */
export interface MasterTask {
  id: string;
  title: string;
  description: string;
  objective: string;
  constraints?: string[];
  dependencies?: string[];
  priority?: 'critical' | 'high' | 'medium' | 'low';
  deadline?: Date;
  context?: Record<string, unknown>;
}

/**
 * Decomposed subtask
 */
export interface SubTask {
  id: string;
  taskId: string; // Reference to master task
  title: string;
  description: string;
  objective: string;
  requiredCapabilities?: string[];
  dependencies?: string[];
  priority?: 'critical' | 'high' | 'medium' | 'low';
  estimatedDuration?: number; // milliseconds
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
    backoffMultiplier?: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Assignment of subtask to agent
 */
export interface SubTaskAssignment {
  id: string;
  subtaskId: string;
  agentId: string;
  assignedAt: Date;
  status: 'pending' | 'assigned' | 'started' | 'completed' | 'failed';
  result?: SubTaskResult;
  completedAt?: Date;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Result of completed subtask
 */
export interface SubTaskResult {
  subtaskId: string;
  agentId: string;
  status: 'success' | 'failure' | 'partial';
  output: unknown;
  artifacts?: Array<{
    name: string;
    type: string;
    content: unknown;
  }>;
  executionTime: number;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Plan for decomposing and executing tasks
 */
export interface ExecutionPlan {
  planId: string;
  taskId: string;
  masterTask: MasterTask;
  subtasks: SubTask[];
  assignments: SubTaskAssignment[];
  strategy: DecompositionStrategy;
  estimatedDuration: number;
  priority: string;
  metadata?: Record<string, unknown>;
}

/**
 * Aggregated result from all subtasks
 */
export interface AggregatedTaskResult {
  resultId: string;
  taskId: string;
  status: 'success' | 'partial' | 'failed';
  subtaskResults: SubTaskResult[];
  failedSubtasks: string[];
  finalOutput: unknown;
  artifacts?: Array<{
    name: string;
    type: string;
    content: unknown;
  }>;
  executionTime: number;
  confidence: number;
  summary: string;
  metadata?: Record<string, unknown>;
}

/**
 * Manager agent execution result
 */
export interface ManagerExecutionResult {
  managerId: string;
  status: 'success' | 'partial' | 'failed';
  masterTask: MasterTask;
  executionPlan: ExecutionPlan;
  assignments: SubTaskAssignment[];
  aggregatedResult: AggregatedTaskResult;
  totalDuration: number;
  timestamp: Date;
}

/**
 * Manager agent state update for streaming
 */
export interface ManagerStateUpdate {
  type:
    | 'planning_started'
    | 'plan_created'
    | 'subtask_assigned'
    | 'subtask_started'
    | 'subtask_completed'
    | 'subtask_failed'
    | 'aggregation_started'
    | 'aggregation_completed'
    | 'execution_completed'
    | 'execution_paused'
    | 'execution_resumed';
  timestamp: Date;
  taskId?: string;
  subtaskId?: string;
  agentId?: string;
  progress?: number;
  details?: Record<string, unknown>;
  state: string;
  agent_id: string;
  data: Record<string, unknown>;
}

/**
 * Manager agent internal state
 */
export interface ManagerAgentStateData {
  currentState: ManagerAgentState;
  masterTask: MasterTask | null;
  executionPlan: ExecutionPlan | null;
  assignments: SubTaskAssignment[];
  completedAssignments: SubTaskAssignment[];
  failedAssignments: SubTaskAssignment[];
  subtaskResults: SubTaskResult[];
  aggregatedResult: AggregatedTaskResult | null;
  startTime: number;
  endTime?: number;
}

/**
 * Decomposition result
 */
export interface DecompositionResult {
  decompositionId: string;
  masterTask: MasterTask;
  subtasks: SubTask[];
  strategy: DecompositionStrategy;
  rationale: string;
  confidence: number;
}

/**
 * Sub-agent capability reference
 */
export interface SubAgentCapability {
  agentId: string;
  agentType: string;
  specialties: string[];
  maxConcurrentTasks: number;
  averageExecutionTime?: number;
  successRate?: number;
}

/**
 * Agent matching result
 */
export interface AgentMatchingResult {
  matchId: string;
  subtaskId: string;
  candidates: Array<{
    agentId: string;
    matchScore: number;
    matchedCapabilities: string[];
    unmetRequirements: string[];
  }>;
  recommendation: string;
  selectedAgent?: string;
}
