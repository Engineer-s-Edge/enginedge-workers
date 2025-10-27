/**
 * Collective Agent Types - Multi-Agent Orchestration
 * 
 * Defines types for coordinating multiple agents, distributing tasks,
 * aggregating results, and managing sub-agent lifecycle.
 */

/**
 * Sub-agent type enum - Kind of agent in the collective
 */
export enum SubAgentType {
  REACT = 'REACT',
  GRAPH = 'GRAPH',
  EXPERT = 'EXPERT',
  GENIUS = 'GENIUS',
}

/**
 * Task distribution strategy
 */
export enum TaskDistributionStrategy {
  ROUND_ROBIN = 'ROUND_ROBIN',
  LOAD_BALANCED = 'LOAD_BALANCED',
  PRIORITY_BASED = 'PRIORITY_BASED',
  SKILL_BASED = 'SKILL_BASED',
}

/**
 * Result aggregation method
 */
export enum AggregationMethod {
  CONSENSUS = 'CONSENSUS',
  WEIGHTED_AVERAGE = 'WEIGHTED_AVERAGE',
  MAJORITY_VOTE = 'MAJORITY_VOTE',
  FIRST_SUCCESS = 'FIRST_SUCCESS',
  ALL_RESULTS = 'ALL_RESULTS',
}

/**
 * Coordination pattern for sub-agents
 */
export enum CoordinationPattern {
  SEQUENTIAL = 'SEQUENTIAL',
  PARALLEL = 'PARALLEL',
  PIPELINE = 'PIPELINE',
  FORK_JOIN = 'FORK_JOIN',
}

/**
 * Sub-agent reference with metadata
 */
export interface SubAgentRef {
  readonly agentId: string;
  readonly type: SubAgentType;
  readonly name: string;
  readonly specialties: readonly string[];
  readonly loadFactor: number;
  readonly successRate: number;
  readonly isActive: boolean;
  readonly createdAt: Date;
}

/**
 * Task for distribution to sub-agents
 */
export interface Task {
  readonly taskId: string;
  readonly description: string;
  readonly input: unknown;
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
  readonly requiredSpecialty?: string;
  readonly timeout: number;
  readonly retryPolicy?: {
    readonly maxRetries: number;
    readonly backoffMultiplier: number;
  };
  readonly createdAt: Date;
}

/**
 * Task assignment to a specific agent
 */
export interface TaskAssignment {
  readonly assignmentId: string;
  readonly taskId: string;
  readonly agentId: string;
  readonly assignedAt: Date;
  readonly status: 'pending' | 'running' | 'completed' | 'failed';
  readonly completedAt?: Date;
  readonly result?: unknown;
  readonly error?: string;
}

/**
 * Sub-agent work statistics
 */
export interface SubAgentStats {
  readonly agentId: string;
  readonly tasksCompleted: number;
  readonly tasksFailed: number;
  readonly averageExecutionTime: number;
  readonly successRate: number;
  readonly lastTaskAt: Date | null;
  readonly totalLoadHandled: number;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  readonly conflictId: string;
  readonly conflictType: 'contradiction' | 'disagreement' | 'timeout' | 'failure';
  readonly involvedAgents: readonly string[];
  readonly resolution: 'consensus' | 'voting' | 'escalation' | 'fallback';
  readonly selectedResult: unknown;
  readonly rationale: string;
  readonly timestamp: Date;
}

/**
 * Result from a sub-agent execution
 */
export interface SubAgentResult {
  readonly resultId: string;
  readonly agentId: string;
  readonly taskId: string;
  readonly status: 'success' | 'failure' | 'timeout';
  readonly output: unknown;
  readonly error?: string;
  readonly executionTime: number;
  readonly timestamp: Date;
}

/**
 * Aggregated results from multiple agents
 */
export interface AggregatedResult {
  readonly aggregationId: string;
  readonly individualResults: readonly SubAgentResult[];
  readonly aggregationMethod: AggregationMethod;
  readonly finalResult: unknown;
  readonly confidence: number;
  readonly conflicts: readonly ConflictResolution[];
  readonly timestamp: Date;
}

/**
 * Distribution plan for a task
 */
export interface DistributionPlan {
  readonly planId: string;
  readonly taskId: string;
  readonly strategy: TaskDistributionStrategy;
  readonly assignments: readonly TaskAssignment[];
  readonly parallelGroups?: readonly (readonly string[])[];
  readonly fallbackAgent?: string;
  readonly aggregationMethod: AggregationMethod;
  readonly coordinationPattern: CoordinationPattern;
}

/**
 * Coordination instruction for sub-agents
 */
export interface CoordinationInstruction {
  readonly instructionId: string;
  readonly pattern: CoordinationPattern;
  readonly groups: readonly (readonly string[])[];
  readonly dependencies?: Record<string, readonly string[]>;
  readonly timeoutPerPhase: number;
  readonly maxConcurrent: number;
}

/**
 * Collective agent state
 */
export interface CollectiveAgentState {
  readonly subAgents: readonly SubAgentRef[];
  readonly activeTasks: readonly Task[];
  readonly pendingAssignments: readonly TaskAssignment[];
  readonly completedAssignments: readonly TaskAssignment[];
  readonly subAgentStats: readonly SubAgentStats[];
  readonly distributionStrategy: TaskDistributionStrategy;
  readonly aggregationMethod: AggregationMethod;
  readonly coordinationPattern: CoordinationPattern;
  readonly conflicts: readonly ConflictResolution[];
  readonly totalTasksProcessed: number;
}

/**
 * Execution result for collective coordination
 */
export interface CollectiveExecutionResult {
  readonly collectiveId: string;
  readonly status: 'success' | 'partial' | 'failed';
  readonly output: unknown;
  readonly aggregatedResult: AggregatedResult;
  readonly totalDuration: number;
  readonly subAgentResults: readonly SubAgentResult[];
  readonly failedAgents: readonly string[];
  readonly conflicts: readonly ConflictResolution[];
  readonly timestamp: Date;
}

/**
 * State update for collective streaming
 */
export interface CollectiveStateUpdate {
  readonly state: 'coordinating' | 'distributing' | 'aggregating' | 'resolving' | 'complete' | 'error';
  readonly agent_id: string;
  readonly data: {
    readonly phase: string;
    readonly progress: number;
    readonly activeAssignments?: number;
    readonly completedAssignments?: number;
    readonly pendingAssignments?: number;
    readonly conflicts?: ConflictResolution[];
    readonly error?: string;
  };
  readonly timestamp: Date;
}

/**
 * Load balancing metrics
 */
export interface LoadMetrics {
  readonly agentId: string;
  readonly currentLoad: number;
  readonly capacity: number;
  readonly utilizationPercent: number;
  readonly averageWaitTime: number;
  readonly queuedTasks: number;
}

/**
 * Capability matcher for skill-based distribution
 */
export interface CapabilityMatch {
  readonly agentId: string;
  readonly matchScore: number;
  readonly matchedSpecialties: readonly string[];
  readonly unmatchedSpecialties: readonly string[];
}

/**
 * Coordination configuration
 */
export interface CollectiveConfig {
  readonly maxConcurrentTasks: number;
  readonly taskTimeout: number;
  readonly conflictResolutionStrategy: 'consensus' | 'voting' | 'escalation';
  readonly enableLoadBalancing: boolean;
  readonly enableHealthCheck: boolean;
  readonly healthCheckInterval: number;
}
