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
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
    backoffMultiplier?: number;
  };
  timeout?: number; // milliseconds
  tags?: string[];
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
}

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
  metadata?: Record<string, unknown>;
}

export interface GraphExecutionHistoryEntry {
  nodeId: string;
  nodeName: string;
  status: NodeStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
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
