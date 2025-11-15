/**
 * Graph Agent - Type Definitions
 *
 * Defines types for DAG-based workflow execution with node,
 * edge, and execution tracking
 */

/**
 * Types of workflow nodes
 */
export enum NodeType {
  TASK = 'task',
  DECISION = 'decision',
  PARALLEL_SPLIT = 'parallel_split',
  PARALLEL_JOIN = 'parallel_join',
  ERROR_HANDLER = 'error_handler',
  START = 'start',
  END = 'end',
}

/**
 * Node execution status
 */
export enum NodeStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  RETRYING = 'retrying',
}

/**
 * Workflow node configuration
 */
export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  memoryGroupId?: string;
  memoryConfig?: GraphNodeMemoryConfig;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
    backoffMultiplier?: number;
  };
  timeout?: number; // milliseconds
  tags?: string[];
  convergence?: GraphNodeConvergenceConfig;
  dataOrdering?: GraphNodeDataOrdering;
}

/**
 * Edge connecting two nodes with optional conditions
 */
export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  condition?: (output: unknown) => boolean;
  conditionScript?: string; // For serialization
  queue?: EdgeQueueConfig;
  isCheckpoint?: boolean;
}

export type JoinWaitStrategy = 'all' | 'count' | 'subset';

export interface GraphNodeConvergenceConfig {
  strategy: JoinWaitStrategy;
  count?: number;
  edgeIds?: string[];
  nodeIds?: string[];
}

export type GraphNodeDataOrderingMode = 'arrival' | 'explicit';

export interface GraphNodeDataOrdering {
  mode: GraphNodeDataOrderingMode;
  order?: string[];
  includeDuplicates?: boolean;
}

export interface GraphNodeMemoryConfig {
  groupId?: string;
  memoryType?: string;
  vectorStore?: string;
  knowledgeGraphId?: string;
  ragPipelineId?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphMemoryGroup {
  id: string;
  name: string;
  description?: string;
  memoryType?: string;
  provider?: string;
  vectorStore?: string;
  knowledgeGraphId?: string;
  ragPipelineId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface GraphMemoryGroupState extends GraphMemoryGroup {
  nodeIds: string[];
  nodeNames: string[];
  nodeCount: number;
  firstAccessedAt?: string;
  lastAccessedAt?: string;
}

export interface GraphNodeBulkUpdateFilter {
  provider?: string;
  model?: string;
  type?: NodeType;
  tags?: string[];
}

export interface GraphNodeBulkUpdatePayload {
  provider?: string;
  model?: string;
  memoryType?: string;
  vectorStore?: string;
  config?: Record<string, unknown>;
}

export interface GraphEdgeBulkUpdateFilter {
  fromNodeId?: string;
  toNodeId?: string;
  label?: string;
  isCheckpoint?: boolean;
}

export interface GraphEdgeBulkUpdatePayload {
  label?: string;
  isCheckpoint?: boolean;
  queue?: EdgeQueueConfig;
}

export interface GraphBulkUpdateResult {
  updatedCount: number;
  ids: string[];
}

export interface GraphEdgeHistoryEntry {
  edgeId: string;
  fromNodeId: string;
  fromNodeName?: string;
  toNodeId: string;
  toNodeName?: string;
  payload?: unknown;
  sourceExecutionId?: string;
  timestamp: string;
}

export interface GraphEdgeDecisionEntry {
  edgeId: string;
  nodeId: string;
  nodeName?: string;
  decisionResult?: unknown;
  conditionLabel?: string;
  matched?: boolean | null;
  reason?: string;
  sourceExecutionId?: string;
  timestamp: string;
}

export type GraphEdgeHistoryDirection = 'forward' | 'backward';

export interface GraphEdgeHistoryQueryOptions {
  limit?: number;
  cursor?: string;
  direction?: GraphEdgeHistoryDirection;
  start?: string;
  end?: string;
}

export interface GraphEdgeHistoryPageInfo {
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  startCursor?: string;
  endCursor?: string;
  totalCount: number;
}

export interface GraphEdgeHistoryQueryResult<TEntry> {
  entries: TEntry[];
  pageInfo: GraphEdgeHistoryPageInfo;
}

export interface GraphNodeConvergenceInputSnapshot {
  edgeId: string;
  nodeId: string;
  nodeName?: string;
  output?: unknown;
}

export interface GraphNodeConvergenceState {
  nodeId: string;
  strategy: JoinWaitStrategy;
  requiredCount: number;
  satisfiedCount: number;
  pendingSources: string[];
  ordering?: string[];
  inputs: GraphNodeConvergenceInputSnapshot[];
  updatedAt: string;
}

export interface EdgeQueueConfig {
  enabled?: boolean;
  strategy?: EdgeQueueStrategy;
  maxDepth?: number;
}

export type EdgeQueueStrategy = 'fifo' | 'lifo';

/**
 * Complete workflow DAG definition
 */
export interface WorkflowGraph {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  startNode: string;
  endNodes: string[];
  timeout?: number;
  memoryGroups?: GraphMemoryGroup[];
}

/**
 * Record of a node that has been executed
 */
export interface ExecutedNode {
  nodeId: string;
  nodeName: string;
  status: NodeStatus;
  input: unknown;
  output?: unknown;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  startTime: Date;
  endTime?: Date;
  duration?: number;
  retryCount: number;
}

/**
 * Result of traversing an edge
 */
export interface EdgeTraversal {
  from: string;
  to: string;
  edgeId?: string;
  timestamp: Date;
  conditionMet: boolean;
}

/**
 * Graph agent execution state
 */
export interface GraphAgentState {
  graphDefinition: WorkflowGraph;
  currentNode: WorkflowNode | null;
  executedNodes: readonly ExecutedNode[];
  activeNodes: readonly WorkflowNode[];
  completedNodes: readonly WorkflowNode[];
  failedNodes: readonly ExecutedNode[];
  pendingEdges: readonly EdgeTraversal[];
  parallelGroups: readonly string[][];
  executionStartTime?: Date;
  executionEndTime?: Date;
}

/**
 * Serialized snapshot of graph execution state for checkpoints & APIs
 */
export interface GraphExecutionSnapshot {
  graph?: WorkflowGraph;
  graphDefinition?: WorkflowGraph;
  graphId?: string;
  graphName?: string;
  startTime?: number;
  lastUpdated?: number;
  currentNodeIds?: string[];
  pendingNodeIds?: string[];
  executedNodes?: ExecutedNode[];
  failedNodes?: ExecutedNode[];
  nodeResults?: Array<{ nodeId: string; output: unknown }>;
  retryAttempts?: Record<string, number>;
  executionHistory?: GraphExecutionHistoryEntry[];
  nodeExecutions?: Record<string, GraphNodeExecutionDetail[]>;
  metadata?: Record<string, unknown>;
  edgeQueues?: Record<string, GraphEdgeQueueState>;
  convergenceState?: Record<string, GraphNodeConvergenceState>;
  edgeHistory?: Record<string, GraphEdgeHistoryEntry[]>;
  edgeDecisions?: Record<string, GraphEdgeDecisionEntry[]>;
  memoryGroups?: GraphMemoryGroupState[];
}

export interface GraphEdgeQueueItem {
  id: string;
  payload: unknown;
  enqueuedAt: string;
  sourceNodeId: string;
  sourceNodeName?: string;
  sourceExecutionId?: string;
}

export interface GraphEdgeQueueState {
  edgeId: string;
  from: string;
  to: string;
  depth: number;
  maxDepth: number;
  strategy: EdgeQueueStrategy;
  isCyclic: boolean;
  processedCount: number;
  droppedCount: number;
  lastUpdated?: string;
  items: GraphEdgeQueueItem[];
}

export interface GraphRuntimeCheckpointSummary {
  id: string;
  type: 'edge';
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  createdAt: string;
}

export interface GraphExecutionHistoryEntry {
  nodeId: string;
  nodeName: string;
  status: NodeStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface GraphNodeExecutionSummary {
  executionId: string;
  nodeId: string;
  nodeName: string;
  status: NodeStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  retryCount: number;
  error?: string;
}

export interface GraphNodeExecutionDetail extends GraphNodeExecutionSummary {
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Node execution result
 */
export interface NodeExecutionResult {
  nodeId: string;
  status: NodeStatus;
  output?: unknown;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  duration: number;
  retryCount: number;
}

/**
 * Result of parallel execution
 */
export interface ParallelExecutionResult {
  groupId: string;
  nodeResults: NodeExecutionResult[];
  allSucceeded: boolean;
  failedNodes: string[];
  duration: number;
}

/**
 * Complete graph execution result
 */
export interface GraphExecutionResult {
  graphId: string;
  status: 'success' | 'partial' | 'failed';
  startTime: Date;
  endTime: Date;
  duration: number;
  executedNodes: ExecutedNode[];
  failedNodes: ExecutedNode[];
  finalOutput?: unknown;
  errors: Array<{
    nodeId: string;
    message: string;
    code?: string;
  }>;
}

/**
 * State update for streaming graph execution
 */
export interface GraphStateUpdate {
  type:
    | 'node_started'
    | 'node_completed'
    | 'node_failed'
    | 'edge_traversed'
    | 'parallel_group_started'
    | 'parallel_group_completed'
    | 'execution_completed';
  timestamp: Date;
  nodeId?: string;
  nodeName?: string;
  output?: unknown;
  error?: string;
  duration?: number;
  // StateUpdate compat fields (required)
  state: string;
  agent_id: string;
  data: Record<string, unknown>;
}
