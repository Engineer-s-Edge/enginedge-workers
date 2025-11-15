/**
 * Graph Agent - DAG-based Workflow Execution
 *
 * Implements execution of directed acyclic graph (DAG) workflows with:
 * - Node-based task execution
 * - Edge conditions and branching
 * - Parallel and sequential execution
 * - Error handling and retries
 * - Real-time streaming updates
 */

import { BaseAgent } from '../agent.base';
import { ExecutionContext, ExecutionResult, AgentState } from '../../entities';
import { ILogger } from '../../ports/logger.port';
import { ILLMProvider, LLMRequest } from '../../ports/llm-provider.port';
import { MemoryManager } from '../../services/memory-manager.service';
import { GraphMemoryRouter } from '../../services/graph-memory-router.service';
import { StateMachine } from '../../services/state-machine.service';
import { ResponseParser } from '../../services/response-parser.service';
import { PromptBuilder } from '../../services/prompt-builder.service';
import { Message } from '../../value-objects/message.vo';
import {
  WorkflowGraph,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  NodeStatus,
  ExecutedNode,
  GraphExecutionResult,
  GraphExecutionSnapshot,
  GraphExecutionHistoryEntry,
  GraphNodeExecutionDetail,
  GraphNodeExecutionSummary,
  GraphEdgeQueueState,
  GraphEdgeQueueItem,
  EdgeQueueStrategy,
  GraphNodeConvergenceConfig,
  GraphNodeDataOrdering,
  JoinWaitStrategy,
  GraphRuntimeCheckpointSummary,
  GraphNodeConvergenceState,
  GraphNodeBulkUpdateFilter,
  GraphNodeBulkUpdatePayload,
  GraphEdgeBulkUpdateFilter,
  GraphEdgeBulkUpdatePayload,
  GraphBulkUpdateResult,
  GraphEdgeHistoryEntry,
  GraphEdgeDecisionEntry,
  GraphEdgeHistoryQueryOptions,
  GraphEdgeHistoryQueryResult,
  GraphMemoryGroup,
  GraphMemoryGroupState,
  GraphNodeMemoryConfig,
} from './graph-agent.types';

interface GraphConfig {
  maxDepth?: number;
  allowParallel?: boolean;
  temperature?: number;
  model?: string;
  maxRetries?: number;
  nodeTimeoutMs?: number;
  memoryContextWindow?: number;
  [key: string]: unknown;
}

type InternalHistoryEntry = {
  nodeId: string;
  nodeName: string;
  status: NodeStatus;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
};

type InternalNodeExecutionRecord = {
  executionId: string;
  nodeId: string;
  nodeName: string;
  status: NodeStatus;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  retryCount: number;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  error?: string;
};

type EdgeQueueItemInternal = {
  id: string;
  payload: unknown;
  enqueuedAt: Date;
  sourceNodeId: string;
  sourceNodeName?: string;
  sourceExecutionId?: string;
};

interface EdgeQueueInternalState {
  edgeId: string;
  from: string;
  to: string;
  depth: number;
  maxDepth: number;
  strategy: EdgeQueueStrategy;
  isCyclic: boolean;
  processedCount: number;
  droppedCount: number;
  lastUpdated?: Date;
  items: EdgeQueueItemInternal[];
}

interface ConvergenceInput {
  edgeId: string;
  nodeId: string;
  nodeName?: string;
  output: unknown;
}

interface ConvergenceResolution {
  inputs: ConvergenceInput[];
  ordering: string[];
  strategy: JoinWaitStrategy;
  requiredCount: number;
  satisfiedCount: number;
  pendingSources: string[];
}

interface RuntimeCheckpointRecord {
  id: string;
  type: 'edge';
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  createdAt: Date;
  snapshot: GraphExecutionSnapshot;
}

interface GraphExecutionState {
  graph?: WorkflowGraph;
  executedNodes: ExecutedNode[];
  failedNodes: ExecutedNode[];
  pendingNodes: Map<string, WorkflowNode>;
  nodeResults: Map<string, unknown>;
  retryAttempts: Map<string, number>;
  currentNodeIds: string[];
  startTime?: number;
  lastUpdated?: number;
  history: InternalHistoryEntry[];
  nodeExecutions: Map<string, InternalNodeExecutionRecord[]>;
  edgeQueues: Map<string, EdgeQueueInternalState>;
  runtimeCheckpoints: RuntimeCheckpointRecord[];
  convergenceState: Map<string, GraphNodeConvergenceState>;
  edgeHistory: Map<string, GraphEdgeHistoryEntry[]>;
  edgeDecisions: Map<string, GraphEdgeDecisionEntry[]>;
}

type NodeConfigPreview = Record<string, unknown> & {
  provider?: string;
  model?: string;
  memoryType?: string;
  vectorStore?: string;
};

const RUNTIME_NODE_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  NodeType.TASK,
  NodeType.DECISION,
  NodeType.ERROR_HANDLER,
]);

const EDGE_HISTORY_LIMIT = 100;
const EDGE_DECISION_LIMIT = 100;

/**
 * GraphAgent - DAG-based Workflow Execution
 *
 * Implements directed acyclic graph (DAG) execution:
 * - Node types: task, condition, user_input, approval, parallel
 * - Conditional branching
 * - Parallel execution
 * - User interaction support
 * - Checkpointing for long-running workflows
 */
export class GraphAgent extends BaseAgent {
  private config: GraphConfig;
  private graphState: GraphExecutionState;
  private readonly memoryRouter: GraphMemoryRouter;

  constructor(
    llmProvider: ILLMProvider,
    logger: ILogger,
    private memoryManager: MemoryManager,
    private stateMachine: typeof StateMachine,
    private responseParser: ResponseParser,
    private promptBuilder: PromptBuilder,
    config: GraphConfig,
  ) {
    super(llmProvider, logger);
    this.config = {
      maxDepth: 20,
      allowParallel: true,
      temperature: 0.5,
      model: 'gpt-4',
      maxRetries: 3,
      nodeTimeoutMs: 30000,
      memoryContextWindow: 8,
      ...config,
    };
    this.graphState = this.createEmptyGraphState();
    this.memoryRouter = new GraphMemoryRouter(memoryManager);
  }

  private createEmptyGraphState(): GraphExecutionState {
    return {
      graph: undefined,
      executedNodes: [],
      failedNodes: [],
      pendingNodes: new Map(),
      nodeResults: new Map(),
      retryAttempts: new Map(),
      currentNodeIds: [],
      startTime: undefined,
      lastUpdated: undefined,
      history: [],
      nodeExecutions: new Map(),
      edgeQueues: new Map(),
      runtimeCheckpoints: [],
      convergenceState: new Map<string, GraphNodeConvergenceState>(),
      edgeHistory: new Map(),
      edgeDecisions: new Map(),
    };
  }

  private resetGraphState(graph: WorkflowGraph): void {
    this.graphState = {
      ...this.createEmptyGraphState(),
      graph,
      pendingNodes: new Map(graph.nodes.map((node) => [node.id, node] as const)),
      currentNodeIds: graph.startNode ? [graph.startNode] : [],
      startTime: Date.now(),
      lastUpdated: Date.now(),
      nodeExecutions: new Map(),
      edgeQueues: this.initializeEdgeQueues(graph),
      runtimeCheckpoints: [],
      convergenceState: new Map<string, GraphNodeConvergenceState>(),
      edgeHistory: new Map(),
      edgeDecisions: new Map(),
    };
    this.initializeGraphMemoryGroups(graph);
  }

  private updateLastUpdated(): void {
    this.graphState.lastUpdated = Date.now();
  }

  private beginNodeExecution(node: WorkflowNode): {
    historyEntry: InternalHistoryEntry;
    executionRecord: InternalNodeExecutionRecord;
  } {
    const historyEntry: InternalHistoryEntry = {
      nodeId: node.id,
      nodeName: node.name,
      status: NodeStatus.RUNNING,
      startedAt: new Date(),
    };

    const executionRecord: InternalNodeExecutionRecord = {
      executionId: this.generateNodeExecutionId(node.id),
      nodeId: node.id,
      nodeName: node.name,
      status: NodeStatus.RUNNING,
      startedAt: new Date(),
      retryCount: this.graphState.retryAttempts.get(node.id) ?? 0,
      input: node.config,
    };

    const executions = this.graphState.nodeExecutions.get(node.id);
    if (executions) {
      executions.push(executionRecord);
    } else {
      this.graphState.nodeExecutions.set(node.id, [executionRecord]);
    }

    this.graphState.history.push(historyEntry);
    this.graphState.currentNodeIds = [node.id];
    this.updateLastUpdated();

    return { historyEntry, executionRecord };
  }

  private markNodeCompleted(
    node: WorkflowNode,
    executedNode: ExecutedNode,
    historyEntry?: InternalHistoryEntry,
    executionRecord?: InternalNodeExecutionRecord,
  ): void {
    this.graphState.executedNodes.push(executedNode);
    this.graphState.nodeResults.set(node.id, executedNode.output);
    this.graphState.pendingNodes.delete(node.id);
    this.graphState.currentNodeIds = [];
    if (historyEntry) {
      historyEntry.status = NodeStatus.COMPLETED;
      historyEntry.completedAt = executedNode.endTime || new Date();
      historyEntry.error = undefined;
    }
    if (executionRecord) {
      executionRecord.status = NodeStatus.COMPLETED;
      executionRecord.completedAt = executedNode.endTime || new Date();
      executionRecord.durationMs = executedNode.duration;
      executionRecord.retryCount = executedNode.retryCount;
      executionRecord.output = executedNode.output;
      executionRecord.error = undefined;
    }
    this.updateLastUpdated();
  }

  private markNodeFailed(
    node: WorkflowNode,
    failedNode: ExecutedNode,
    historyEntry?: InternalHistoryEntry,
    errorMessage?: string,
    executionRecord?: InternalNodeExecutionRecord,
  ): void {
    this.graphState.executedNodes.push(failedNode);
    this.graphState.failedNodes.push(failedNode);
    this.graphState.pendingNodes.delete(node.id);
    this.graphState.currentNodeIds = [];
    if (historyEntry) {
      historyEntry.status = NodeStatus.FAILED;
      historyEntry.completedAt = failedNode.endTime || new Date();
      historyEntry.error = errorMessage;
    }
    if (executionRecord) {
      executionRecord.status = NodeStatus.FAILED;
      executionRecord.completedAt = failedNode.endTime || new Date();
      executionRecord.durationMs = failedNode.duration;
      executionRecord.retryCount = failedNode.retryCount;
      executionRecord.error = errorMessage;
      executionRecord.output = failedNode.output;
    }
    this.updateLastUpdated();
  }

  private generateNodeExecutionId(nodeId: string): string {
    return `${nodeId}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  protected async run(
    input: string,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    try {
      this.addThinkingStep('Starting Graph Agent execution');

      // Parse workflow graph from input or context
      const graph = this.parseGraphDefinition(input, context);
      this.resetGraphState(graph);

      this.logger.info('GraphAgent: Executing workflow', {
        graphId: graph.id,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      });

      // Execute the graph
      const executionResult = await this.executeWorkflow(graph, context);

      // Return final result
      return {
        status: executionResult.status === 'success' ? 'success' : 'error',
        output: {
          graphId: executionResult.graphId,
          status: executionResult.status,
          executedNodes: executionResult.executedNodes.length,
          failedNodes: executionResult.failedNodes.length,
          duration: executionResult.duration,
          result: executionResult.finalOutput,
        },
        metadata: {
          totalNodes: graph.nodes.length,
          executedCount: executionResult.executedNodes.length,
          failedCount: executionResult.failedNodes.length,
          errors: executionResult.errors,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('Graph execution failed', { error: errorMsg });

      return {
        status: 'error',
        output: `Graph execution failed: ${errorMsg}`,
        metadata: {
          error: errorMsg,
          executedNodes: this.graphState.executedNodes.length,
        },
      };
    }
  }

  protected async *runStream(
    input: string,
    context: ExecutionContext,
  ): AsyncGenerator<string> {
    try {
      yield 'Graph Agent Starting\n';

      const graph = this.parseGraphDefinition(input, context);
  this.resetGraphState(graph);

      yield `Executing workflow: ${graph.name}\n`;
      yield `Total nodes: ${graph.nodes.length}\n`;

      // Execute with streaming updates
      for (const node of graph.nodes) {
        if (node.id === graph.startNode) {
          yield `Starting at node: ${node.name}\n`;
        }
      }

      const executionResult = await this.executeWorkflow(graph, context);

      yield `\nWorkflow completed with status: ${executionResult.status}\n`;
      yield `Executed nodes: ${executionResult.executedNodes.length}/${graph.nodes.length}\n`;

      if (executionResult.failedNodes.length > 0) {
        yield `Failed nodes: ${executionResult.failedNodes.length}\n`;
      }

      yield `Total duration: ${executionResult.duration}ms\n`;
      yield 'Graph Agent Completed\n';
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      yield `Graph Agent Error: ${errorMsg}\n`;
    }
  }

  /**
   * Parse workflow graph definition from input
   */
  private parseGraphDefinition(
    input: string,
    context: ExecutionContext,
  ): WorkflowGraph {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(input);
      if (parsed.nodes && parsed.edges) {
        return parsed as WorkflowGraph;
      }
    } catch {
      // Not JSON, continue
    }

    // Check execution context overrides
    const contextWorkflow = (context.config as Record<string, unknown> | undefined)?.workflow;
    if (
      contextWorkflow &&
      typeof contextWorkflow === 'object' &&
      'nodes' in contextWorkflow &&
      'edges' in contextWorkflow
    ) {
      return contextWorkflow as WorkflowGraph;
    }

    // Create a simple default graph for demonstration
    return {
      id: `graph-${Date.now()}`,
      name: 'Workflow',
      version: '1.0.0',
      nodes: [
        {
          id: 'start',
          type: NodeType.START,
          name: 'Start',
          config: {},
        },
        {
          id: 'process',
          type: NodeType.TASK,
          name: 'Process Input',
          config: { prompt: input },
        },
        {
          id: 'end',
          type: NodeType.END,
          name: 'End',
          config: {},
        },
      ],
      edges: [
        { id: 'e1', from: 'start', to: 'process' },
        { id: 'e2', from: 'process', to: 'end' },
      ],
      startNode: 'start',
      endNodes: ['end'],
    };
  }

  /**
   * Execute the complete workflow
   */
  private async executeWorkflow(
    graph: WorkflowGraph,
    context: ExecutionContext,
  ): Promise<GraphExecutionResult> {
    const startTime = Date.now();
    this.graphState.executedNodes = [];
    this.graphState.failedNodes = [];
    this.graphState.nodeResults = new Map();
    this.graphState.retryAttempts = new Map();
    this.graphState.history = [];
    this.graphState.nodeExecutions = new Map();
    this.graphState.pendingNodes = new Map(
      graph.nodes.map((node) => [node.id, node] as const),
    );
    this.graphState.currentNodeIds = graph.startNode ? [graph.startNode] : [];
    this.graphState.lastUpdated = startTime;

    const executedNodes = this.graphState.executedNodes;
    const failedNodes = this.graphState.failedNodes;
    const nodeResults = this.graphState.nodeResults;
    const errors: Array<{ nodeId: string; message: string; code?: string }> =
      [];

    try {
      // Topological sort of nodes
      const executionOrder = this.topologicalSort(graph);

      this.logger.info('GraphAgent: Execution order', {
        order: executionOrder,
      });

      // Execute nodes
      for (const nodeId of executionOrder) {
        const node = graph.nodes.find((n) => n.id === nodeId);
        if (!node) continue;
        const { historyEntry, executionRecord } =
          this.beginNodeExecution(node);

        try {
          const executedNode = await this.executeNode(
            node,
            nodeResults,
            context,
          );
          this.markNodeCompleted(
            node,
            executedNode,
            historyEntry,
            executionRecord,
          );
          this.routeEdgeOutputs(node, executedNode, executionRecord);

          this.addThinkingStep(
            `Node ${node.name} completed with status ${executedNode.status}`,
          );
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          const failedNode: ExecutedNode = {
            nodeId: node.id,
            nodeName: node.name,
            status: NodeStatus.FAILED,
            input: node.config,
            error: {
              message: errorMsg,
              code: 'EXECUTION_ERROR',
            },
            startTime: new Date(),
            endTime: new Date(),
            retryCount: 0,
          };

          this.markNodeFailed(
            node,
            failedNode,
            historyEntry,
            errorMsg,
            executionRecord,
          );
          errors.push({
            nodeId: node.id,
            message: errorMsg,
            code: 'EXECUTION_ERROR',
          });

          // Stop execution on error unless configured otherwise
          if (!this.config.allowParallel) {
            break;
          }
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      return {
        graphId: graph.id,
        status:
          failedNodes.length === 0
            ? 'success'
            : failedNodes.length === executedNodes.length
              ? 'failed'
              : 'partial',
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        duration,
        executedNodes,
        failedNodes,
        finalOutput: nodeResults.get(graph.endNodes[0]),
        errors,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        graphId: graph.id,
        status: 'failed',
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        executedNodes,
        failedNodes,
        errors: [{ nodeId: 'workflow', message: errorMsg }],
      };
    } finally {
      this.graphState.lastUpdated = Date.now();
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: WorkflowNode,
    previousResults: Map<string, unknown>,
    context: ExecutionContext,
  ): Promise<ExecutedNode> {
    const startTime = new Date();
    let retryCount = 0;
    const maxRetries =
      node.retryPolicy?.maxRetries ?? this.config.maxRetries ?? 3;
    const queuedEdgePayloads = this.drainIncomingEdgeQueues(node.id);
    if (queuedEdgePayloads.length > 0) {
      this.logger.debug('GraphAgent: draining edge queue payloads', {
        nodeId: node.id,
        drainedCount: queuedEdgePayloads.length,
      });
    }

    while (retryCount <= maxRetries) {
      this.graphState.retryAttempts.set(node.id, retryCount);
      try {
        let output: unknown;

        switch (node.type) {
          case NodeType.START:
            output = { status: 'started' };
            break;

          case NodeType.END:
            output = { status: 'ended', result: previousResults };
            break;

          case NodeType.TASK:
            output = await this.executeTaskNode(node, previousResults, context);
            break;

          case NodeType.DECISION:
            output = await this.executeDecisionNode(
              node,
              previousResults,
              context,
            );
            break;

          case NodeType.PARALLEL_SPLIT:
            output = { status: 'parallel_split_started', branches: [] };
            break;

          case NodeType.PARALLEL_JOIN:
            output = this.buildConvergenceOutput(node);
            break;

          case NodeType.ERROR_HANDLER:
            output = { status: 'error_handler', handled: true };
            break;

          default:
            throw new Error(`Unknown node type: ${node.type}`);
        }

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        return {
          nodeId: node.id,
          nodeName: node.name,
          status: NodeStatus.COMPLETED,
          input: node.config,
          output,
          startTime,
          endTime,
          duration,
          retryCount,
        };
      } catch (error) {
        retryCount++;
        this.graphState.retryAttempts.set(node.id, retryCount);

        if (retryCount > maxRetries) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          throw new Error(
            `Node execution failed after ${retryCount} attempts: ${errorMsg}`,
          );
        }

        // Exponential backoff
        const backoffMs =
          (node.retryPolicy?.backoffMs ?? 100) *
          Math.pow(node.retryPolicy?.backoffMultiplier ?? 2, retryCount - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw new Error(`Node execution failed after maximum retries`);
  }

  /**
   * Execute a task node
   */
  private async executeTaskNode(
    node: WorkflowNode,
    previousResults: Map<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    this.logger.debug('Executing task node', {
      nodeId: node.id,
      previousResultCount: previousResults.size,
      contextId: context.contextId,
    });
    // Use LLM to process the task
    const prompt =
      (node.config.prompt as string) || `Execute task: ${node.name}`;

    const systemPrompt = this.promptBuilder.buildSystemPrompt('task', {
      taskName: node.name,
      taskDescription: node.description,
    });

    const graphId = this.getCurrentGraphId();
    const memoryGroupId = this.resolveNodeMemoryGroupId(node);
    let sharedMemoryContext: string | undefined;

    if (memoryGroupId) {
      this.ensureMemoryGroup(graphId, memoryGroupId, node);
      const windowSize = this.getMemoryContextWindowSize();
      if (windowSize > 0) {
        const recentMessages = this.memoryRouter.getRecentMessages(
          graphId,
          memoryGroupId,
          windowSize,
        );
        sharedMemoryContext = this.formatSharedMemoryContext(
          memoryGroupId,
          recentMessages,
        );
      }
    }

    const messages: LLMRequest['messages'] = [
      { role: 'system', content: systemPrompt },
    ];

    if (sharedMemoryContext) {
      messages.push({ role: 'system', content: sharedMemoryContext });
    }

    messages.push({ role: 'user', content: prompt });

    const llmRequest: LLMRequest = {
      model: this.config.model || 'gpt-4',
      messages,
      temperature: (this.config.temperature as number) ?? 0.5,
      maxTokens: 1000,
    };

    const response = await this.llmProvider.complete(llmRequest);
    const parsedOutput = this.responseParser.parse(response);

    if (memoryGroupId) {
      this.memoryRouter.appendRecords(graphId, memoryGroupId, [
        {
          role: 'user',
          content: this.buildMemoryInputContent(node, prompt),
          metadata: this.buildMemoryMetadata(node, 'input'),
        },
        {
          role: 'assistant',
          content: this.stringifyMemoryPayload(parsedOutput),
          metadata: this.buildMemoryMetadata(node, 'output'),
        },
      ]);
    }

    return parsedOutput;
  }

  /**
   * Execute a decision node (conditional branching)
   */
  private async executeDecisionNode(
    node: WorkflowNode,
    previousResults: Map<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    this.logger.debug('Executing decision node', {
      nodeId: node.id,
      previousResultCount: previousResults.size,
      contextId: context.contextId,
    });
    const condition = (node.config.condition as string) || '';

    // Evaluate condition
    try {
      // Simple evaluation - in production use a safe evaluator
      const result = eval(condition);
      return { decision: result, condition };
    } catch {
      return {
        decision: false,
        condition,
        error: 'Failed to evaluate condition',
      };
    }
  }

  /**
   * Topological sort of graph nodes
   */
  private topologicalSort(graph: WorkflowGraph): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const adjacency = new Map<string, string[]>();

    // Build adjacency list
    for (const node of graph.nodes) {
      adjacency.set(node.id, []);
    }

    for (const edge of graph.edges) {
      const neighbors = adjacency.get(edge.from) || [];
      adjacency.set(edge.from, [...neighbors, edge.to]);
    }

    // DFS
    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      for (const neighbor of adjacency.get(nodeId) || []) {
        visit(neighbor);
      }

      order.push(nodeId);
    };

    // Start from beginning
    visit(graph.startNode);

    // Visit remaining nodes
    for (const node of graph.nodes) {
      visit(node.id);
    }

    return order.reverse();
  }

  override getState(): AgentState {
    return super.getState();
  }

  /**
   * Get Graph-specific state
   */
  getGraphState(): GraphExecutionSnapshot {
    const nodeResults = Array.from(this.graphState.nodeResults.entries()).map(
      ([nodeId, output]) => ({ nodeId, output }),
    );
    const retryAttempts: Record<string, number> = {};
    for (const [nodeId, attempts] of this.graphState.retryAttempts.entries()) {
      retryAttempts[nodeId] = attempts;
    }
    const executionHistory: GraphExecutionHistoryEntry[] =
      this.graphState.history.map((entry) => ({
        nodeId: entry.nodeId,
        nodeName: entry.nodeName,
        status: entry.status,
        startedAt: entry.startedAt.toISOString(),
        completedAt: entry.completedAt
          ? entry.completedAt.toISOString()
          : undefined,
        error: entry.error,
      }));
    const nodeExecutions: Record<string, GraphNodeExecutionDetail[]> = {};
    for (const [nodeId, executions] of this.graphState.nodeExecutions.entries()) {
      nodeExecutions[nodeId] = executions.map((record) =>
        this.serializeExecutionRecord(record),
      );
    }

    return {
      graph: this.graphState.graph,
      graphId: this.graphState.graph?.id,
      graphName: this.graphState.graph?.name,
      graphDefinition: this.graphState.graph,
      startTime: this.graphState.startTime,
      lastUpdated: this.graphState.lastUpdated,
      currentNodeIds: [...this.graphState.currentNodeIds],
      pendingNodeIds: Array.from(this.graphState.pendingNodes.keys()),
      executedNodes: [...this.graphState.executedNodes],
      failedNodes: [...this.graphState.failedNodes],
      nodeResults,
      retryAttempts,
      executionHistory,
      nodeExecutions,
      metadata: {
        totalNodes: this.graphState.graph?.nodes.length ?? 0,
      },
      edgeQueues: this.serializeEdgeQueues(),
      convergenceState: this.serializeConvergenceState(),
      edgeHistory: this.serializeEdgeHistory(),
      edgeDecisions: this.serializeEdgeDecisions(),
      memoryGroups: this.computeMemoryGroupStates(),
    };
  }

  getEdgeQueueState(edgeId: string): GraphEdgeQueueState | null {
    const queue = this.graphState.edgeQueues.get(edgeId);
    if (!queue) {
      return null;
    }
    return this.toEdgeQueueSnapshot(queue);
  }

  getEdgeHistory(
    edgeId: string,
    options?: GraphEdgeHistoryQueryOptions,
  ): GraphEdgeHistoryQueryResult<GraphEdgeHistoryEntry> {
    const entries = this.graphState.edgeHistory.get(edgeId) || [];
    return this.paginateEdgeEntries(entries, EDGE_HISTORY_LIMIT, options);
  }

  getEdgeDecisionHistory(
    edgeId: string,
    options?: GraphEdgeHistoryQueryOptions,
  ): GraphEdgeHistoryQueryResult<GraphEdgeDecisionEntry> {
    const entries = this.graphState.edgeDecisions.get(edgeId) || [];
    return this.paginateEdgeEntries(entries, EDGE_DECISION_LIMIT, options);
  }

  getNodeConvergenceState(nodeId: string): GraphNodeConvergenceState | null {
    return this.graphState.convergenceState.get(nodeId) || null;
  }

  getMemoryGroups(): GraphMemoryGroupState[] {
    return this.computeMemoryGroupStates();
  }

  getMemoryGroup(groupId: string): GraphMemoryGroupState | null {
    if (!groupId) {
      return null;
    }
    return this.computeMemoryGroupStates().find((group) => group.id === groupId) || null;
  }

  private computeMemoryGroupStates(): GraphMemoryGroupState[] {
    const graph = this.graphState.graph;
    if (!graph) {
      return [];
    }

    const groupMap = new Map<string, GraphMemoryGroupState>();
    for (const definition of graph.memoryGroups ?? []) {
      groupMap.set(definition.id, {
        ...definition,
        nodeIds: [],
        nodeNames: [],
        nodeCount: 0,
      });
    }

    for (const node of graph.nodes ?? []) {
      const groupId = this.resolveNodeMemoryGroupId(node);
      if (!groupId) {
        continue;
      }
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, this.buildGroupFromNode(groupId, node));
      }
      const group = groupMap.get(groupId)!;
      if (!group.nodeIds.includes(node.id)) {
        group.nodeIds.push(node.id);
        group.nodeNames.push(node.name);
        group.nodeCount = group.nodeIds.length;
      }
      this.mergeNodeMemoryDetails(group, node);
      this.registerGroupAccessFromNode(group, node.id);
    }

    return Array.from(groupMap.values()).map((group) => ({
      ...group,
      nodeIds: [...group.nodeIds],
      nodeNames: [...group.nodeNames],
      nodeCount: group.nodeIds.length,
    }));
  }

  private buildGroupFromNode(
    groupId: string,
    node: WorkflowNode,
  ): GraphMemoryGroupState {
    const memoryConfig = this.extractNodeMemoryConfig(node);
    return {
      id: groupId,
      name: memoryConfig?.metadata?.name
        ? String(memoryConfig.metadata.name)
        : groupId,
      description: memoryConfig?.metadata?.description
        ? String(memoryConfig.metadata.description)
        : undefined,
      memoryType: memoryConfig?.memoryType,
      provider: memoryConfig?.provider,
      vectorStore: memoryConfig?.vectorStore,
      knowledgeGraphId: memoryConfig?.knowledgeGraphId,
      ragPipelineId: memoryConfig?.ragPipelineId,
      metadata: memoryConfig?.metadata,
      nodeIds: [],
      nodeNames: [],
      nodeCount: 0,
    };
  }

  private mergeNodeMemoryDetails(
    group: GraphMemoryGroupState,
    node: WorkflowNode,
  ): void {
    const memoryConfig = this.extractNodeMemoryConfig(node);
    if (!memoryConfig) {
      return;
    }

    if (!group.memoryType && memoryConfig.memoryType) {
      group.memoryType = memoryConfig.memoryType;
    }
    if (!group.provider && memoryConfig.provider) {
      group.provider = memoryConfig.provider;
    }
    if (!group.vectorStore && memoryConfig.vectorStore) {
      group.vectorStore = memoryConfig.vectorStore;
    }
    if (!group.knowledgeGraphId && memoryConfig.knowledgeGraphId) {
      group.knowledgeGraphId = memoryConfig.knowledgeGraphId;
    }
    if (!group.ragPipelineId && memoryConfig.ragPipelineId) {
      group.ragPipelineId = memoryConfig.ragPipelineId;
    }
    if (memoryConfig.metadata) {
      group.metadata = {
        ...(group.metadata ?? {}),
        ...memoryConfig.metadata,
      };
    }
  }

  private registerGroupAccessFromNode(
    group: GraphMemoryGroupState,
    nodeId: string,
  ): void {
    const executions = this.graphState.nodeExecutions.get(nodeId);
    if (!executions || executions.length === 0) {
      return;
    }

    let earliest: number | undefined;
    let latest: number | undefined;
    for (const record of executions) {
      const timestamps = [record.startedAt, record.completedAt]
        .filter((value): value is Date => value instanceof Date)
        .map((date) => date.getTime());
      for (const timestamp of timestamps) {
        if (earliest === undefined || timestamp < earliest) {
          earliest = timestamp;
        }
        if (latest === undefined || timestamp > latest) {
          latest = timestamp;
        }
      }
    }

    if (earliest !== undefined) {
      const iso = new Date(earliest).toISOString();
      if (!group.firstAccessedAt || Date.parse(group.firstAccessedAt) > earliest) {
        group.firstAccessedAt = iso;
      }
    }
    if (latest !== undefined) {
      const iso = new Date(latest).toISOString();
      if (!group.lastAccessedAt || Date.parse(group.lastAccessedAt) < latest) {
        group.lastAccessedAt = iso;
      }
    }
  }

  private initializeGraphMemoryGroups(graph: WorkflowGraph): void {
    if (!graph?.memoryGroups?.length) {
      return;
    }
    const graphId = this.resolveGraphId(graph);
    for (const group of graph.memoryGroups) {
      this.memoryRouter.ensureGroup(graphId, group);
    }
  }

  private getCurrentGraphId(): string {
    return this.resolveGraphId(this.graphState.graph);
  }

  private resolveGraphId(graph?: WorkflowGraph): string {
    const candidate = graph?.id ?? this.graphState.graph?.id ?? 'graph';
    return candidate && candidate.trim().length > 0 ? candidate : 'graph';
  }

  private ensureMemoryGroup(
    graphId: string,
    groupId: string,
    node: WorkflowNode,
  ): void {
    const definition = this.resolveMemoryGroupDefinition(groupId);
    if (definition) {
      this.memoryRouter.ensureGroup(graphId, definition);
      return;
    }

    const memoryConfig = this.extractNodeMemoryConfig(node);
    this.memoryRouter.ensureGroup(graphId, {
      id: groupId,
      name:
        memoryConfig?.metadata?.name && typeof memoryConfig.metadata.name === 'string'
          ? memoryConfig.metadata.name
          : node.name ?? groupId,
      memoryType: memoryConfig?.memoryType,
      provider: memoryConfig?.provider,
      vectorStore: memoryConfig?.vectorStore,
      ragPipelineId: memoryConfig?.ragPipelineId,
      knowledgeGraphId: memoryConfig?.knowledgeGraphId,
    });
  }

  private resolveMemoryGroupDefinition(
    groupId: string,
  ): GraphMemoryGroup | undefined {
    const graph = this.graphState.graph;
    if (!graph?.memoryGroups?.length) {
      return undefined;
    }
    return graph.memoryGroups.find((group) => group.id === groupId);
  }

  private getMemoryContextWindowSize(): number {
    const raw = Number(this.config.memoryContextWindow ?? 8);
    if (!Number.isFinite(raw) || raw <= 0) {
      return 0;
    }
    return Math.floor(raw);
  }

  private formatSharedMemoryContext(
    groupId: string,
    messages: Message[],
  ): string | undefined {
    if (!messages.length) {
      return undefined;
    }

    const formatted = messages
      .map((message) => {
        const metadata = message.metadata ?? {};
        const origin =
          (metadata['nodeName'] as string) ||
          (metadata['nodeId'] as string) ||
          (metadata['stage'] as string) ||
          message.role;
        return `[${origin}] ${message.content}`.trim();
      })
      .join('\n');

    return `Shared memory (${groupId}) recent entries:\n${formatted}`;
  }

  private buildMemoryInputContent(node: WorkflowNode, prompt: string): string {
    return `Prompt from ${node.name || node.id}: ${prompt}`;
  }

  private stringifyMemoryPayload(payload: unknown): string {
    if (payload === null || payload === undefined) {
      return '';
    }
    if (typeof payload === 'string') {
      return payload;
    }
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }

  private buildMemoryMetadata(
    node: WorkflowNode,
    stage: 'input' | 'output',
  ): Record<string, unknown> {
    return {
      nodeId: node.id,
      nodeName: node.name,
      stage,
      timestamp: new Date().toISOString(),
    };
  }

  private resolveNodeMemoryGroupId(node: WorkflowNode): string | undefined {
    if (node.memoryGroupId) {
      return node.memoryGroupId;
    }
    if (node.memoryConfig?.groupId) {
      return node.memoryConfig.groupId;
    }

    const config = node.config || {};
    const directGroupId = config['memoryGroupId'];
    if (typeof directGroupId === 'string' && directGroupId.trim().length > 0) {
      return directGroupId.trim();
    }

    const nestedConfig = config['memoryConfig'];
    if (
      nestedConfig &&
      typeof nestedConfig === 'object' &&
      'groupId' in (nestedConfig as Record<string, unknown>)
    ) {
      const groupId = (nestedConfig as Record<string, unknown>).groupId;
      if (typeof groupId === 'string' && groupId.trim().length > 0) {
        return groupId.trim();
      }
    }

    return undefined;
  }

  private extractNodeMemoryConfig(
    node: WorkflowNode,
  ): GraphNodeMemoryConfig | undefined {
    if (node.memoryConfig) {
      return node.memoryConfig;
    }

    const config = node.config || {};
    const nestedConfig =
      config['memoryConfig'] && typeof config['memoryConfig'] === 'object'
        ? (config['memoryConfig'] as Record<string, unknown>)
        : undefined;

    const candidate: GraphNodeMemoryConfig = {};
    const groupId = this.resolveNodeMemoryGroupId(node);
    if (groupId) {
      candidate.groupId = groupId;
    }

    const memoryType =
      (nestedConfig?.memoryType as string | undefined) ||
      (config['memoryType'] as string | undefined);
    if (typeof memoryType === 'string') {
      candidate.memoryType = memoryType;
    }

    const vectorStore =
      (nestedConfig?.vectorStore as string | undefined) ||
      (config['vectorStore'] as string | undefined);
    if (typeof vectorStore === 'string') {
      candidate.vectorStore = vectorStore;
    }

    const knowledgeGraphId =
      (nestedConfig?.knowledgeGraphId as string | undefined) ||
      (config['knowledgeGraphId'] as string | undefined);
    if (typeof knowledgeGraphId === 'string') {
      candidate.knowledgeGraphId = knowledgeGraphId;
    }

    const ragPipelineId =
      (nestedConfig?.ragPipelineId as string | undefined) ||
      (config['ragPipelineId'] as string | undefined);
    if (typeof ragPipelineId === 'string') {
      candidate.ragPipelineId = ragPipelineId;
    }

    const provider =
      (nestedConfig?.provider as string | undefined) ||
      (config['provider'] as string | undefined);
    if (typeof provider === 'string') {
      candidate.provider = provider;
    }

    if (nestedConfig?.metadata && typeof nestedConfig.metadata === 'object') {
      candidate.metadata = nestedConfig.metadata as Record<string, unknown>;
    }

    return Object.keys(candidate).length > 0 ? candidate : undefined;
  }

  private serializeConvergenceState():
    | Record<string, GraphNodeConvergenceState>
    | undefined {
    if (this.graphState.convergenceState.size === 0) {
      return undefined;
    }
    const serialized: Record<string, GraphNodeConvergenceState> = {};
    for (const [nodeId, state] of this.graphState.convergenceState.entries()) {
      serialized[nodeId] = {
        ...state,
        pendingSources: [...state.pendingSources],
        ordering: state.ordering ? [...state.ordering] : undefined,
        inputs: state.inputs.map((input) => ({ ...input })),
      };
    }
    return serialized;
  }

  private reviveConvergenceState(
    snapshot?: Record<string, GraphNodeConvergenceState>,
  ): Map<string, GraphNodeConvergenceState> {
    if (!snapshot) {
      return new Map();
    }
    const revived = new Map<string, GraphNodeConvergenceState>();
    for (const [nodeId, state] of Object.entries(snapshot)) {
      revived.set(nodeId, {
        ...state,
        pendingSources: [...(state.pendingSources || [])],
        ordering: state.ordering ? [...state.ordering] : undefined,
        inputs: (state.inputs || []).map((input) => ({ ...input })),
      });
    }
    return revived;
  }

  private serializeEdgeHistory():
    | Record<string, GraphEdgeHistoryEntry[]>
    | undefined {
    if (this.graphState.edgeHistory.size === 0) {
      return undefined;
    }
    const serialized: Record<string, GraphEdgeHistoryEntry[]> = {};
    for (const [edgeId, entries] of this.graphState.edgeHistory.entries()) {
      serialized[edgeId] = entries.map((entry) => ({ ...entry }));
    }
    return serialized;
  }

  private serializeEdgeDecisions():
    | Record<string, GraphEdgeDecisionEntry[]>
    | undefined {
    if (this.graphState.edgeDecisions.size === 0) {
      return undefined;
    }
    const serialized: Record<string, GraphEdgeDecisionEntry[]> = {};
    for (const [edgeId, entries] of this.graphState.edgeDecisions.entries()) {
      serialized[edgeId] = entries.map((entry) => ({ ...entry }));
    }
    return serialized;
  }

  private reviveEdgeHistory(
    snapshot?: Record<string, GraphEdgeHistoryEntry[]>,
  ): Map<string, GraphEdgeHistoryEntry[]> {
    if (!snapshot) {
      return new Map();
    }
    const revived = new Map<string, GraphEdgeHistoryEntry[]>();
    for (const [edgeId, entries] of Object.entries(snapshot)) {
      revived.set(edgeId, entries.map((entry) => ({ ...entry })));
    }
    return revived;
  }

  private reviveEdgeDecisions(
    snapshot?: Record<string, GraphEdgeDecisionEntry[]>,
  ): Map<string, GraphEdgeDecisionEntry[]> {
    if (!snapshot) {
      return new Map();
    }
    const revived = new Map<string, GraphEdgeDecisionEntry[]>();
    for (const [edgeId, entries] of Object.entries(snapshot)) {
      revived.set(edgeId, entries.map((entry) => ({ ...entry })));
    }
    return revived;
  }

  restoreGraphState(snapshot: GraphExecutionSnapshot): void {
    const revivedExecutedNodes = (snapshot.executedNodes || []).map((node) =>
      this.reviveExecutedNode(node),
    );
    const revivedFailedNodes = (snapshot.failedNodes || []).map((node) =>
      this.reviveExecutedNode(node),
    );
    const history: InternalHistoryEntry[] =
      (snapshot.executionHistory || []).map((entry) => ({
        nodeId: entry.nodeId,
        nodeName: entry.nodeName,
        status: entry.status,
        startedAt: new Date(entry.startedAt),
        completedAt: entry.completedAt ? new Date(entry.completedAt) : undefined,
        error: entry.error,
      }));
    const nodeExecutions = new Map<string, InternalNodeExecutionRecord[]>();
    if (snapshot.nodeExecutions) {
      for (const [nodeId, records] of Object.entries(snapshot.nodeExecutions)) {
        nodeExecutions.set(
          nodeId,
          records.map((record) => this.reviveNodeExecutionRecord(record)),
        );
      }
    }

    const graphDefinition = snapshot.graph || this.graphState.graph;
    const pendingNodes = new Map<string, WorkflowNode>();
    if (graphDefinition) {
      const nodesById = new Map(
        graphDefinition.nodes.map((node) => [node.id, node] as const),
      );
      for (const nodeId of snapshot.pendingNodeIds || []) {
        const node = nodesById.get(nodeId);
        if (node) {
          pendingNodes.set(nodeId, node);
        }
      }
    }

    this.graphState = {
      graph: graphDefinition,
      executedNodes: revivedExecutedNodes,
      failedNodes: revivedFailedNodes,
      pendingNodes,
      nodeResults: new Map(
        (snapshot.nodeResults || []).map((entry) =>
          [entry.nodeId, entry.output] as const,
        ),
      ),
      retryAttempts: new Map(
        Object.entries(snapshot.retryAttempts || {}),
      ),
      currentNodeIds: [...(snapshot.currentNodeIds || [])],
      startTime:
        snapshot.startTime ??
        this.graphState.startTime ??
        (graphDefinition ? Date.now() : undefined),
      lastUpdated: snapshot.lastUpdated || Date.now(),
      history,
      nodeExecutions,
      edgeQueues: this.restoreEdgeQueues(
        snapshot.edgeQueues,
        graphDefinition,
      ),
      runtimeCheckpoints: [],
      convergenceState: this.reviveConvergenceState(
        snapshot.convergenceState,
      ),
      edgeHistory: this.reviveEdgeHistory(snapshot.edgeHistory),
      edgeDecisions: this.reviveEdgeDecisions(snapshot.edgeDecisions),
    };
  }

  getRuntimeCheckpointSummaries(): GraphRuntimeCheckpointSummary[] {
    return this.graphState.runtimeCheckpoints.map((record) => ({
      id: record.id,
      type: record.type,
      edgeId: record.edgeId,
      fromNodeId: record.fromNodeId,
      toNodeId: record.toNodeId,
      label: record.label,
      createdAt: record.createdAt.toISOString(),
    }));
  }

  getRuntimeCheckpointSnapshot(
    checkpointId: string,
  ): GraphExecutionSnapshot | null {
    const record = this.graphState.runtimeCheckpoints.find(
      (entry) => entry.id === checkpointId,
    );
    if (!record) {
      return null;
    }
    return record.snapshot;
  }

  updateEdgeCheckpoint(
    edgeId: string,
    isCheckpoint: boolean,
  ): WorkflowEdge | null {
    const graph = this.graphState.graph;
    if (!graph) {
      return null;
    }
    const edge = graph.edges.find((candidate) => candidate.id === edgeId);
    if (!edge) {
      return null;
    }
    edge.isCheckpoint = isCheckpoint;
    return edge;
  }

  private reviveExecutedNode(node: ExecutedNode): ExecutedNode {
    const startTime =
      node.startTime instanceof Date
        ? node.startTime
        : new Date(node.startTime as unknown as string);
    const endTime = node.endTime
      ? node.endTime instanceof Date
        ? node.endTime
        : new Date(node.endTime as unknown as string)
      : undefined;

    return {
      ...node,
      startTime,
      endTime,
    };
  }

  private reviveNodeExecutionRecord(
    record: GraphNodeExecutionDetail,
  ): InternalNodeExecutionRecord {
    return {
      executionId: record.executionId,
      nodeId: record.nodeId,
      nodeName: record.nodeName,
      status: record.status,
      startedAt: new Date(record.startedAt),
      completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
      durationMs: record.durationMs,
      retryCount: record.retryCount,
      input: record.input,
      output: record.output,
      metadata: record.metadata,
      error: record.error,
    };
  }

  private initializeEdgeQueues(
    graph?: WorkflowGraph,
  ): Map<string, EdgeQueueInternalState> {
    if (!graph) {
      return new Map();
    }
    const queues = new Map<string, EdgeQueueInternalState>();
    const cyclicEdges = this.findCyclicEdges(graph);

    for (const edge of graph.edges) {
      const requiresQueue = cyclicEdges.has(edge.id) || edge.queue?.enabled;
      if (!requiresQueue) {
        continue;
      }
      queues.set(edge.id, {
        edgeId: edge.id,
        from: edge.from,
        to: edge.to,
        depth: 0,
        maxDepth: edge.queue?.maxDepth ?? 50,
        strategy: edge.queue?.strategy ?? 'fifo',
        isCyclic: cyclicEdges.has(edge.id),
        processedCount: 0,
        droppedCount: 0,
        lastUpdated: undefined,
        items: [],
      });
    }

    return queues;
  }

  private findCyclicEdges(graph: WorkflowGraph): Set<string> {
    const adjacency = this.buildAdjacencyMap(graph);
    const reachability = this.computeReachability(graph, adjacency);
    const cyclicEdges = new Set<string>();

    for (const edge of graph.edges) {
      const reachable = reachability.get(edge.to);
      if (reachable?.has(edge.from)) {
        cyclicEdges.add(edge.id);
      }
    }

    return cyclicEdges;
  }

  private buildAdjacencyMap(
    graph: WorkflowGraph,
  ): Map<string, string[]> {
    const adjacency = new Map<string, string[]>();
    for (const node of graph.nodes) {
      adjacency.set(node.id, []);
    }
    for (const edge of graph.edges) {
      const neighbors = adjacency.get(edge.from) ?? [];
      neighbors.push(edge.to);
      adjacency.set(edge.from, neighbors);
    }
    return adjacency;
  }

  private computeReachability(
    graph: WorkflowGraph,
    adjacency: Map<string, string[]>,
  ): Map<string, Set<string>> {
    const cache = new Map<string, Set<string>>();

    const dfs = (nodeId: string, stack: Set<string>): Set<string> => {
      if (cache.has(nodeId)) {
        return cache.get(nodeId)!;
      }
      const reachable = new Set<string>();
      for (const neighbor of adjacency.get(nodeId) || []) {
        reachable.add(neighbor);
        if (!stack.has(neighbor)) {
          stack.add(neighbor);
          const nested = dfs(neighbor, stack);
          nested.forEach((n) => reachable.add(n));
          stack.delete(neighbor);
        }
      }
      cache.set(nodeId, reachable);
      return reachable;
    };

    for (const node of graph.nodes) {
      dfs(node.id, new Set([node.id]));
    }

    return cache;
  }

  private routeEdgeOutputs(
    node: WorkflowNode,
    executedNode: ExecutedNode,
    executionRecord?: InternalNodeExecutionRecord,
  ): void {
    const graph = this.graphState.graph;
    if (!graph) {
      return;
    }

    for (const edge of graph.edges) {
      if (edge.from !== node.id) {
        continue;
      }
      this.recordEdgeHistory(edge, executedNode, executionRecord);
      this.recordEdgeDecision(edge, node, executedNode, executionRecord);

      const queue = this.graphState.edgeQueues.get(edge.id);
      if (queue) {
        this.enqueueEdgeQueueItem(queue, executedNode, executionRecord);
      }

      if (edge.isCheckpoint) {
        this.recordEdgeCheckpoint(edge);
      }
    }
  }

  private recordEdgeCheckpoint(edge: WorkflowEdge): void {
    const checkpoint: RuntimeCheckpointRecord = {
      id: `edge_cp_${edge.id}_${Date.now().toString(36)}`,
      type: 'edge',
      edgeId: edge.id,
      fromNodeId: edge.from,
      toNodeId: edge.to,
      label: edge.label,
      createdAt: new Date(),
      snapshot: this.getGraphState(),
    };
    this.graphState.runtimeCheckpoints.push(checkpoint);
  }

  private recordEdgeHistory(
    edge: WorkflowEdge,
    executedNode: ExecutedNode,
    executionRecord?: InternalNodeExecutionRecord,
  ): void {
    const entry: GraphEdgeHistoryEntry = {
      edgeId: edge.id,
      fromNodeId: edge.from,
      fromNodeName: this.getNodeName(edge.from),
      toNodeId: edge.to,
      toNodeName: this.getNodeName(edge.to),
      payload: executedNode.output,
      sourceExecutionId: executionRecord?.executionId,
      timestamp: new Date().toISOString(),
    };

    this.pushBoundedEdgeEntry(
      this.graphState.edgeHistory,
      edge.id,
      entry,
      EDGE_HISTORY_LIMIT,
    );
  }

  private recordEdgeDecision(
    edge: WorkflowEdge,
    node: WorkflowNode,
    executedNode: ExecutedNode,
    executionRecord?: InternalNodeExecutionRecord,
  ): void {
    if (
      node.type !== NodeType.DECISION &&
      typeof edge.condition !== 'function' &&
      !edge.conditionScript
    ) {
      return;
    }

    const evaluation = this.evaluateEdgeDecision(edge, executedNode.output);

    const entry: GraphEdgeDecisionEntry = {
      edgeId: edge.id,
      nodeId: node.id,
      nodeName: node.name,
      decisionResult: evaluation.result,
      conditionLabel: edge.label,
      matched: evaluation.matched,
      reason: evaluation.reason,
      sourceExecutionId: executionRecord?.executionId,
      timestamp: new Date().toISOString(),
    };

    this.pushBoundedEdgeEntry(
      this.graphState.edgeDecisions,
      edge.id,
      entry,
      EDGE_DECISION_LIMIT,
    );
  }

  private evaluateEdgeDecision(
    edge: WorkflowEdge,
    nodeOutput: unknown,
  ): { result: unknown; matched: boolean | null; reason?: string } {
    const decisionResult = this.extractDecisionValue(nodeOutput);

    if (typeof edge.condition === 'function') {
      try {
        const matched = Boolean(edge.condition(nodeOutput));
        return { result: decisionResult, matched, reason: 'edge_condition' };
      } catch (error) {
        const reason =
          error instanceof Error
            ? `edge_condition_error: ${error.message}`
            : 'edge_condition_error';
        return { result: decisionResult, matched: null, reason };
      }
    }

    if (typeof decisionResult === 'boolean' && edge.label) {
      const matched = this.matchesBooleanLabel(edge.label, decisionResult);
      if (matched !== null) {
        return {
          result: decisionResult,
          matched,
          reason: 'decision_boolean_label',
        };
      }
    }

    if (typeof decisionResult === 'string' && edge.label) {
      return {
        result: decisionResult,
        matched: decisionResult === edge.label,
        reason: 'decision_string_label',
      };
    }

    if (edge.conditionScript) {
      return {
        result: decisionResult,
        matched: null,
        reason: 'condition_script_not_executed',
      };
    }

    return {
      result: decisionResult,
      matched: null,
    };
  }

  private extractDecisionValue(output: unknown): unknown {
    if (output && typeof output === 'object') {
      const record = output as Record<string, unknown>;
      if ('decision' in record) {
        return record.decision;
      }
      if ('result' in record) {
        return record.result;
      }
    }
    return output;
  }

  private matchesBooleanLabel(label: string, value: boolean): boolean | null {
    const normalized = label.trim().toLowerCase();
    if (['true', 'yes', 'success'].includes(normalized)) {
      return value === true;
    }
    if (['false', 'no', 'failure'].includes(normalized)) {
      return value === false;
    }
    return null;
  }

  private pushBoundedEdgeEntry<T>(
    store: Map<string, T[]>,
    edgeId: string,
    entry: T,
    limit: number,
  ): void {
    const entries = store.get(edgeId) || [];
    entries.push(entry);
    if (entries.length > limit) {
      entries.splice(0, entries.length - limit);
    }
    store.set(edgeId, entries);
  }

  private paginateEdgeEntries<T extends { timestamp: string }>(
    entries: T[],
    hardLimit: number,
    options?: GraphEdgeHistoryQueryOptions,
  ): GraphEdgeHistoryQueryResult<T> {
    if (!entries || entries.length === 0) {
      return {
        entries: [],
        pageInfo: {
          hasPreviousPage: false,
          hasNextPage: false,
          totalCount: 0,
        },
      };
    }

    const limit =
      options?.limit && options.limit > 0
        ? Math.min(options.limit, hardLimit)
        : hardLimit;
    const direction:
      | 'forward'
      | 'backward' = options?.direction === 'forward' ? 'forward' : 'backward';

    const startBound = this.safeTimestamp(options?.start);
    const endBound = this.safeTimestamp(options?.end);
    const cursorTs = this.safeTimestamp(options?.cursor);

    const getTimestamp = (entry: T): number =>
      this.safeTimestamp(entry.timestamp) ?? 0;

    let filtered = entries;
    if (startBound !== undefined) {
      filtered = filtered.filter((entry) => getTimestamp(entry) >= startBound);
    }
    if (endBound !== undefined) {
      filtered = filtered.filter((entry) => getTimestamp(entry) <= endBound);
    }

    const filteredCount = filtered.length;
    if (filteredCount === 0) {
      return {
        entries: [],
        pageInfo: {
          hasPreviousPage: false,
          hasNextPage: false,
          totalCount: 0,
        },
      };
    }

    let sliceStart = 0;
    let sliceEnd = filteredCount;

    if (direction === 'backward') {
      if (cursorTs !== undefined) {
        const boundary = filtered.findIndex(
          (entry) => getTimestamp(entry) >= cursorTs,
        );
        sliceEnd = boundary === -1 ? filteredCount : boundary;
      }
      sliceStart = Math.max(0, sliceEnd - limit);
    } else {
      if (cursorTs !== undefined) {
        const boundary = filtered.findIndex(
          (entry) => getTimestamp(entry) > cursorTs,
        );
        sliceStart = boundary === -1 ? filteredCount : boundary;
      }
      sliceEnd = Math.min(filteredCount, sliceStart + limit);
    }

    const windowEntries = filtered
      .slice(sliceStart, sliceEnd)
      .map((entry) => ({ ...entry }));

    return {
      entries: windowEntries,
      pageInfo: {
        hasPreviousPage: sliceStart > 0,
        hasNextPage: sliceEnd < filteredCount,
        startCursor: windowEntries[0]?.timestamp,
        endCursor: windowEntries[windowEntries.length - 1]?.timestamp,
        totalCount: filteredCount,
      },
    };
  }

  private safeTimestamp(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private enqueueEdgeQueueItem(
    queue: EdgeQueueInternalState,
    executedNode: ExecutedNode,
    executionRecord?: InternalNodeExecutionRecord,
  ): void {
    if (queue.items.length >= queue.maxDepth) {
      this.dropEdgeQueueItem(queue);
    }

    const item: EdgeQueueItemInternal = {
      id: `${queue.edgeId}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      payload: executedNode.output,
      enqueuedAt: new Date(),
      sourceNodeId: executedNode.nodeId,
      sourceNodeName: executedNode.nodeName,
      sourceExecutionId: executionRecord?.executionId,
    };

    if (queue.strategy === 'lifo') {
      queue.items.unshift(item);
    } else {
      queue.items.push(item);
    }

    queue.depth = queue.items.length;
    queue.lastUpdated = item.enqueuedAt;
  }

  private dropEdgeQueueItem(queue: EdgeQueueInternalState): void {
    if (!queue.items.length) {
      return;
    }

    if (queue.strategy === 'lifo') {
      queue.items.pop();
    } else {
      queue.items.shift();
    }

    queue.droppedCount += 1;
  }

  private drainIncomingEdgeQueues(nodeId: string): EdgeQueueItemInternal[] {
    const drained: EdgeQueueItemInternal[] = [];
    for (const queue of this.graphState.edgeQueues.values()) {
      if (queue.to !== nodeId || queue.items.length === 0) {
        continue;
      }
      while (queue.items.length > 0) {
        const item = this.popEdgeQueueItem(queue);
        if (!item) {
          break;
        }
        drained.push(item);
      }
    }
    return drained;
  }

  private buildConvergenceOutput(node: WorkflowNode): Record<string, unknown> {
    const resolution = this.resolveConvergenceInputs(node);
    this.recordConvergenceState(node, resolution);
    return {
      status: 'parallel_join_complete',
      merged: true,
      strategy: resolution.strategy,
      requiredCount: resolution.requiredCount,
      satisfiedCount: resolution.satisfiedCount,
      pendingSources: resolution.pendingSources,
      ordering: resolution.ordering,
      inputs: resolution.inputs.map((input: ConvergenceInput) => ({
        edgeId: input.edgeId,
        nodeId: input.nodeId,
        nodeName: input.nodeName,
        output: input.output,
      })),
    };
  }

  private recordConvergenceState(
    node: WorkflowNode,
    resolution: ConvergenceResolution,
  ): void {
    this.graphState.convergenceState.set(node.id, {
      nodeId: node.id,
      strategy: resolution.strategy,
      requiredCount: resolution.requiredCount,
      satisfiedCount: resolution.satisfiedCount,
      pendingSources: [...resolution.pendingSources],
      ordering: [...resolution.ordering],
      inputs: resolution.inputs.map((input) => ({
        edgeId: input.edgeId,
        nodeId: input.nodeId,
        nodeName: input.nodeName,
        output: input.output,
      })),
      updatedAt: new Date().toISOString(),
    });
  }

  private resolveConvergenceInputs(node: WorkflowNode): ConvergenceResolution {
    if (!this.graphState.graph) {
      throw new Error('Graph definition is not loaded');
    }

    const incomingEdges = this.getIncomingEdges(node.id);
    const convergenceConfig = this.normalizeConvergenceConfig(node, incomingEdges);
    const orderingConfig = this.normalizeDataOrdering(node);

    const availableInputs = this.collectConvergenceInputs(incomingEdges);
    const orderedInputs = this.applyDataOrderingConfig(
      orderingConfig,
      incomingEdges,
      availableInputs,
    );

    switch (convergenceConfig.strategy) {
      case 'count':
        return this.resolveCountStrategy(convergenceConfig, orderedInputs, incomingEdges);
      case 'subset':
        return this.resolveSubsetStrategy(convergenceConfig, orderedInputs, incomingEdges);
      case 'all':
      default:
        return this.resolveAllStrategy(orderedInputs, incomingEdges);
    }
  }

  private getIncomingEdges(nodeId: string): WorkflowEdge[] {
    if (!this.graphState.graph) {
      return [];
    }
    return this.graphState.graph.edges.filter((edge) => edge.to === nodeId);
  }

  private collectConvergenceInputs(
    incomingEdges: WorkflowEdge[],
  ): ConvergenceInput[] {
    const inputs: ConvergenceInput[] = [];
    for (const edge of incomingEdges) {
      if (!this.graphState.nodeResults.has(edge.from)) {
        continue;
      }
      inputs.push({
        edgeId: edge.id,
        nodeId: edge.from,
        nodeName: this.getNodeName(edge.from),
        output: this.graphState.nodeResults.get(edge.from),
      });
    }
    return inputs;
  }

  private resolveAllStrategy(
    orderedInputs: ConvergenceInput[],
    incomingEdges: WorkflowEdge[],
  ): ConvergenceResolution {
    const requiredCount = incomingEdges.length;
    if (orderedInputs.length < requiredCount) {
      const missing = this.describePendingEdges(incomingEdges, orderedInputs);
      throw new Error(
        `Join node is waiting for ${missing.length} additional predecessor(s): ${missing.join(', ')}`,
      );
    }
    return {
      inputs: orderedInputs,
      ordering: orderedInputs.map((input) => input.nodeId),
      strategy: 'all',
      requiredCount,
      satisfiedCount: orderedInputs.length,
      pendingSources: [],
    };
  }

  private resolveCountStrategy(
    config: GraphNodeConvergenceConfig,
    orderedInputs: ConvergenceInput[],
    incomingEdges: WorkflowEdge[],
  ): ConvergenceResolution {
    const requiredCount = this.clampCount(config.count, incomingEdges.length);
    if (orderedInputs.length < requiredCount) {
      throw new Error(
        `Join node requires ${requiredCount} predecessor outputs but only received ${orderedInputs.length}`,
      );
    }
    const selected = orderedInputs.slice(0, requiredCount);
    return {
      inputs: selected,
      ordering: selected.map((input) => input.nodeId),
      strategy: 'count',
      requiredCount,
      satisfiedCount: selected.length,
      pendingSources: [],
    };
  }

  private resolveSubsetStrategy(
    config: GraphNodeConvergenceConfig,
    orderedInputs: ConvergenceInput[],
    incomingEdges: WorkflowEdge[],
  ): ConvergenceResolution {
    const targetEdgeIds = new Set((config.edgeIds || []).filter(Boolean));
    const targetNodeIds = new Set((config.nodeIds || []).filter(Boolean));

    if (targetEdgeIds.size === 0 && targetNodeIds.size === 0) {
      return this.resolveAllStrategy(orderedInputs, incomingEdges);
    }

    const selected = orderedInputs.filter(
      (input) => targetEdgeIds.has(input.edgeId) || targetNodeIds.has(input.nodeId),
    );

    const missingSources: string[] = [];
    targetEdgeIds.forEach((edgeId) => {
      if (!selected.some((input) => input.edgeId === edgeId)) {
        missingSources.push(this.describeEdgeById(edgeId, incomingEdges));
      }
    });
    targetNodeIds.forEach((nodeId) => {
      if (!selected.some((input) => input.nodeId === nodeId)) {
        missingSources.push(this.describeNodeSource(nodeId));
      }
    });

    if (missingSources.length > 0) {
      throw new Error(
        `Join node missing required predecessors: ${missingSources.join(', ')}`,
      );
    }

    return {
      inputs: selected,
      ordering: selected.map((input) => input.nodeId),
      strategy: 'subset',
      requiredCount: targetEdgeIds.size + targetNodeIds.size,
      satisfiedCount: selected.length,
      pendingSources: [],
    };
  }

  private describePendingEdges(
    incomingEdges: WorkflowEdge[],
    availableInputs: ConvergenceInput[],
  ): string[] {
    const availableEdgeIds = new Set(availableInputs.map((input) => input.edgeId));
    return incomingEdges
      .filter((edge) => !availableEdgeIds.has(edge.id))
      .map((edge) => this.describeEdgeSource(edge));
  }

  private describeEdgeSource(edge: WorkflowEdge): string {
    const nodeName = this.getNodeName(edge.from);
    return nodeName ? `${edge.from} (${nodeName})` : edge.from;
  }

  private describeEdgeById(
    edgeId: string,
    incomingEdges: WorkflowEdge[],
  ): string {
    const edge = incomingEdges.find((candidate) => candidate.id === edgeId);
    if (edge) {
      return this.describeEdgeSource(edge);
    }
    return `edge:${edgeId}`;
  }

  private describeNodeSource(nodeId: string): string {
    const name = this.getNodeName(nodeId);
    return name ? `${nodeId} (${name})` : nodeId;
  }

  private applyDataOrderingConfig(
    config: GraphNodeDataOrdering,
    incomingEdges: WorkflowEdge[],
    availableInputs: ConvergenceInput[],
  ): ConvergenceInput[] {
    if (config.mode === 'explicit' && config.order && config.order.length > 0) {
      return this.applyExplicitOrdering(config, availableInputs);
    }
    return this.applyArrivalOrdering(incomingEdges, availableInputs);
  }

  private applyArrivalOrdering(
    incomingEdges: WorkflowEdge[],
    availableInputs: ConvergenceInput[],
  ): ConvergenceInput[] {
    const byEdge = new Map(availableInputs.map((input) => [input.edgeId, input] as const));
    const ordered: ConvergenceInput[] = [];
    for (const edge of incomingEdges) {
      const input = byEdge.get(edge.id);
      if (input) {
        ordered.push(input);
        byEdge.delete(edge.id);
      }
    }
    for (const leftover of byEdge.values()) {
      ordered.push(leftover);
    }
    return ordered;
  }

  private applyExplicitOrdering(
    config: GraphNodeDataOrdering,
    availableInputs: ConvergenceInput[],
  ): ConvergenceInput[] {
    const ordered: ConvergenceInput[] = [];
    const used = new Set<number>();
    const orderList = config.order || [];

    for (const key of orderList) {
      for (let index = 0; index < availableInputs.length; index += 1) {
        if (!config.includeDuplicates && used.has(index)) {
          continue;
        }
        const candidate = availableInputs[index];
        if (this.matchesOrderingKey(key, candidate)) {
          ordered.push(candidate);
          if (!config.includeDuplicates) {
            used.add(index);
          }
          break;
        }
      }
    }

    for (let index = 0; index < availableInputs.length; index += 1) {
      if (!config.includeDuplicates && used.has(index)) {
        continue;
      }
      ordered.push(availableInputs[index]);
    }

    return ordered;
  }

  private matchesOrderingKey(key: string, input: ConvergenceInput): boolean {
    if (!key) {
      return false;
    }
    const normalized = key.trim();
    if (normalized.length === 0) {
      return false;
    }
    if (normalized.startsWith('edge:')) {
      return input.edgeId === normalized.slice(5);
    }
    if (normalized.startsWith('node:')) {
      return input.nodeId === normalized.slice(5);
    }
    return input.edgeId === normalized || input.nodeId === normalized;
  }

  private normalizeConvergenceConfig(
    node: WorkflowNode,
    incomingEdges: WorkflowEdge[],
  ): GraphNodeConvergenceConfig {
    const raw = node.convergence || { strategy: 'all' };
    let strategy: JoinWaitStrategy = raw.strategy || 'all';
    if (!['all', 'count', 'subset'].includes(strategy)) {
      strategy = 'all';
    }

    let normalized: GraphNodeConvergenceConfig = { strategy };
    if (strategy === 'count') {
      normalized = {
        strategy,
        count: this.clampCount(raw.count, incomingEdges.length),
      };
    } else if (strategy === 'subset') {
      const edgeIds = raw.edgeIds?.filter(Boolean) || [];
      const nodeIds = raw.nodeIds?.filter(Boolean) || [];
      if (edgeIds.length === 0 && nodeIds.length === 0) {
        normalized = { strategy: 'all' };
      } else {
        normalized = { strategy, edgeIds, nodeIds };
      }
    }

    node.convergence = normalized;
    const pendingNode = this.graphState.pendingNodes.get(node.id);
    if (pendingNode) {
      pendingNode.convergence = normalized;
    }
    return normalized;
  }

  private normalizeDataOrdering(node: WorkflowNode): GraphNodeDataOrdering {
    const raw = node.dataOrdering || { mode: 'arrival' };
    const mode: 'arrival' | 'explicit' =
      raw.mode === 'explicit' ? 'explicit' : 'arrival';
    const normalized: GraphNodeDataOrdering = {
      mode,
      order: mode === 'explicit' ? raw.order?.filter(Boolean) : undefined,
      includeDuplicates: raw.includeDuplicates ?? false,
    };
    node.dataOrdering = normalized;
    const pendingNode = this.graphState.pendingNodes.get(node.id);
    if (pendingNode) {
      pendingNode.dataOrdering = normalized;
    }
    return normalized;
  }

  private clampCount(value: number | undefined, maxValue: number): number {
    if (!value || Number.isNaN(value)) {
      return Math.max(1, maxValue);
    }
    if (value < 1) {
      return 1;
    }
    if (value > maxValue) {
      return maxValue;
    }
    return value;
  }

  private getNodeName(nodeId: string): string {
    const graph = this.graphState.graph;
    if (!graph) {
      return nodeId;
    }
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    return node?.name || nodeId;
  }

  private getWorkflowNode(nodeId: string): WorkflowNode | undefined {
    return this.graphState.graph?.nodes.find((node) => node.id === nodeId);
  }

  updateConvergenceConfig(
    nodeId: string,
    config: GraphNodeConvergenceConfig,
  ): GraphNodeConvergenceConfig | null {
    const node = this.getWorkflowNode(nodeId);
    if (!node) {
      return null;
    }
    node.convergence = {
      ...node.convergence,
      ...config,
    };
    return this.normalizeConvergenceConfig(node, this.getIncomingEdges(nodeId));
  }

  updateDataOrdering(
    nodeId: string,
    ordering: GraphNodeDataOrdering,
  ): GraphNodeDataOrdering | null {
    const node = this.getWorkflowNode(nodeId);
    if (!node) {
      return null;
    }
    node.dataOrdering = {
      ...node.dataOrdering,
      ...ordering,
    };
    return this.normalizeDataOrdering(node);
  }

  bulkUpdateNodes(
    filter: GraphNodeBulkUpdateFilter | undefined,
    updates: GraphNodeBulkUpdatePayload,
  ): GraphBulkUpdateResult {
    const graph = this.graphState.graph;
    if (!graph) {
      return { updatedCount: 0, ids: [] };
    }

    this.assertNodeBulkUpdatePayload(updates);

    const predicate = this.createNodeFilterPredicate(filter);
    const updatedIds: string[] = [];

    for (const node of graph.nodes) {
      if (!predicate(node)) {
        continue;
      }
      const previewConfig = this.createNodeConfigPreview(node, updates);
      this.ensureNodeBulkUpdateSafe(node, previewConfig);
      node.config = previewConfig;
      const pending = this.graphState.pendingNodes.get(node.id);
      if (pending && pending !== node) {
        pending.config = { ...previewConfig };
      }
      updatedIds.push(node.id);
    }

    return {
      updatedCount: updatedIds.length,
      ids: updatedIds,
    };
  }

  bulkUpdateEdges(
    filter: GraphEdgeBulkUpdateFilter | undefined,
    updates: GraphEdgeBulkUpdatePayload,
  ): GraphBulkUpdateResult {
    const graph = this.graphState.graph;
    if (!graph) {
      return { updatedCount: 0, ids: [] };
    }

    this.assertEdgeBulkUpdatePayload(updates);

    const predicate = this.createEdgeFilterPredicate(filter);
    const updatedIds: string[] = [];

    for (const edge of graph.edges) {
      if (!predicate(edge)) {
        continue;
      }
      const queueState = this.graphState.edgeQueues.get(edge.id);
      this.ensureEdgeBulkUpdateSafe(edge, updates, queueState);
      this.applyEdgeBulkUpdates(edge, updates);
      if (queueState && updates.queue) {
        queueState.maxDepth = updates.queue.maxDepth ?? queueState.maxDepth;
        queueState.strategy = updates.queue.strategy ?? queueState.strategy;
      }
      updatedIds.push(edge.id);
    }

    return {
      updatedCount: updatedIds.length,
      ids: updatedIds,
    };
  }

  private popEdgeQueueItem(
    queue: EdgeQueueInternalState,
  ): EdgeQueueItemInternal | undefined {
    if (!queue.items.length) {
      return undefined;
    }
    const item = queue.items.shift();
    if (!item) {
      return undefined;
    }
    queue.depth = queue.items.length;
    queue.processedCount += 1;
    queue.lastUpdated = new Date();
    return item;
  }

  private serializeEdgeQueues():
    | Record<string, GraphEdgeQueueState>
    | undefined {
    if (this.graphState.edgeQueues.size === 0) {
      return undefined;
    }
    const serialized: Record<string, GraphEdgeQueueState> = {};
    for (const [edgeId, queue] of this.graphState.edgeQueues.entries()) {
      serialized[edgeId] = this.toEdgeQueueSnapshot(queue);
    }
    return serialized;
  }

  private toEdgeQueueSnapshot(
    queue: EdgeQueueInternalState,
  ): GraphEdgeQueueState {
    return {
      edgeId: queue.edgeId,
      from: queue.from,
      to: queue.to,
      depth: queue.depth,
      maxDepth: queue.maxDepth,
      strategy: queue.strategy,
      isCyclic: queue.isCyclic,
      processedCount: queue.processedCount,
      droppedCount: queue.droppedCount,
      lastUpdated: queue.lastUpdated?.toISOString(),
      items: queue.items.map((item) => this.toEdgeQueueItemSnapshot(item)),
    };
  }

  private toEdgeQueueItemSnapshot(
    item: EdgeQueueItemInternal,
  ): GraphEdgeQueueItem {
    return {
      id: item.id,
      payload: item.payload,
      enqueuedAt: item.enqueuedAt.toISOString(),
      sourceNodeId: item.sourceNodeId,
      sourceNodeName: item.sourceNodeName,
      sourceExecutionId: item.sourceExecutionId,
    };
  }

  private restoreEdgeQueues(
    snapshotQueues?: Record<string, GraphEdgeQueueState>,
    graphDefinition?: WorkflowGraph,
  ): Map<string, EdgeQueueInternalState> {
    const queues = this.initializeEdgeQueues(graphDefinition);
    if (!snapshotQueues) {
      return queues;
    }

    for (const [edgeId, queueSnapshot] of Object.entries(snapshotQueues)) {
      const targetQueue =
        queues.get(edgeId) ||
        this.createDetachedEdgeQueueState(queueSnapshot, graphDefinition);

      targetQueue.items = queueSnapshot.items.map((item) => ({
        id: item.id,
        payload: item.payload,
        enqueuedAt: new Date(item.enqueuedAt),
        sourceNodeId: item.sourceNodeId,
        sourceNodeName: item.sourceNodeName,
        sourceExecutionId: item.sourceExecutionId,
      }));
      targetQueue.depth = targetQueue.items.length;
      targetQueue.processedCount = queueSnapshot.processedCount;
      targetQueue.droppedCount = queueSnapshot.droppedCount;
      targetQueue.lastUpdated = queueSnapshot.lastUpdated
        ? new Date(queueSnapshot.lastUpdated)
        : targetQueue.lastUpdated;

      queues.set(edgeId, targetQueue);
    }

    return queues;
  }

  private createDetachedEdgeQueueState(
    queue: GraphEdgeQueueState,
    graphDefinition?: WorkflowGraph,
  ): EdgeQueueInternalState {
    const fallbackEdge = graphDefinition?.edges.find(
      (edge) => edge.id === queue.edgeId,
    );

    return {
      edgeId: queue.edgeId,
      from: fallbackEdge?.from ?? queue.from,
      to: fallbackEdge?.to ?? queue.to,
      depth: queue.depth,
      maxDepth: queue.maxDepth,
      strategy: queue.strategy,
      isCyclic: queue.isCyclic,
      processedCount: queue.processedCount,
      droppedCount: queue.droppedCount,
      lastUpdated: queue.lastUpdated ? new Date(queue.lastUpdated) : undefined,
      items: [],
    };
  }

  private toExecutionSummary(
    record: InternalNodeExecutionRecord,
  ): GraphNodeExecutionSummary {
    return {
      executionId: record.executionId,
      nodeId: record.nodeId,
      nodeName: record.nodeName,
      status: record.status,
      startedAt: record.startedAt.toISOString(),
      completedAt: record.completedAt?.toISOString(),
      durationMs: record.durationMs,
      retryCount: record.retryCount,
      error: record.error,
    };
  }

  private serializeExecutionRecord(
    record: InternalNodeExecutionRecord,
  ): GraphNodeExecutionDetail {
    return {
      ...this.toExecutionSummary(record),
      input: record.input,
      output: record.output,
      metadata: record.metadata,
    };
  }

  getNodeExecutionSummaries(
    nodeId: string,
    limit = 20,
  ): GraphNodeExecutionSummary[] {
    const executions = this.graphState.nodeExecutions.get(nodeId) || [];
    if (executions.length === 0) {
      return [];
    }
    const selected =
      limit > 0
        ? executions.slice(Math.max(executions.length - limit, 0))
        : [...executions];
    return selected
      .map((record) => this.toExecutionSummary(record))
      .reverse();
  }

  getNodeExecutionDetail(
    nodeId: string,
    executionId: string,
  ): GraphNodeExecutionDetail | null {
    const executions = this.graphState.nodeExecutions.get(nodeId) || [];
    const record = executions.find((entry) => entry.executionId === executionId);
    return record ? this.serializeExecutionRecord(record) : null;
  }

  private createNodeFilterPredicate(
    filter?: GraphNodeBulkUpdateFilter,
  ): (node: WorkflowNode) => boolean {
    if (!filter || Object.keys(filter).length === 0) {
      return () => true;
    }
    return (node) => {
      if (filter.type && node.type !== filter.type) {
        return false;
      }
      if (
        filter.provider &&
        (node.config?.provider as string | undefined) !== filter.provider
      ) {
        return false;
      }
      if (
        filter.model &&
        (node.config?.model as string | undefined) !== filter.model
      ) {
        return false;
      }
      if (filter.tags && filter.tags.length > 0) {
        const nodeTags = node.tags || [];
        const hasAllTags = filter.tags.every((tag) => nodeTags.includes(tag));
        if (!hasAllTags) {
          return false;
        }
      }
      return true;
    };
  }

  private createNodeConfigPreview(
    node: WorkflowNode,
    updates: GraphNodeBulkUpdatePayload,
  ): NodeConfigPreview {
    const config: NodeConfigPreview = {
      ...((node.config as NodeConfigPreview) || {}),
    };
    if (updates.provider !== undefined) {
      config.provider = updates.provider;
    }
    if (updates.model !== undefined) {
      config.model = updates.model;
    }
    if (updates.memoryType !== undefined) {
      config.memoryType = updates.memoryType;
    }
    if (updates.vectorStore !== undefined) {
      config.vectorStore = updates.vectorStore;
    }
    if (updates.config) {
      Object.assign(config, updates.config);
    }
    return config;
  }

  private ensureNodeBulkUpdateSafe(
    node: WorkflowNode,
    previewConfig: NodeConfigPreview,
  ): void {
    if (this.graphState.currentNodeIds.includes(node.id)) {
      throw new Error(
        `Cannot update node '${node.name}' while it is actively executing`,
      );
    }

    const graph = this.graphState.graph;
    if (!graph) {
      return;
    }

    const downstreamEdges = graph.edges.filter((edge) => edge.from === node.id);
    if (
      downstreamEdges.length > 0 &&
      this.nodeRequiresRuntimeConfig(node.type)
    ) {
      this.assertNonEmptyRuntimeField(
        previewConfig.provider,
        'provider',
        node,
      );
      this.assertNonEmptyRuntimeField(previewConfig.model, 'model', node);
    }
  }

  private nodeRequiresRuntimeConfig(nodeType: NodeType): boolean {
    return RUNTIME_NODE_TYPES.has(nodeType);
  }

  private assertNodeBulkUpdatePayload(
    updates: GraphNodeBulkUpdatePayload,
  ): void {
    this.assertOptionalStringValue(updates.provider, 'provider');
    this.assertOptionalStringValue(updates.model, 'model');
    this.assertOptionalStringValue(updates.memoryType, 'memoryType');
    this.assertOptionalStringValue(updates.vectorStore, 'vectorStore');
  }

  private assertOptionalStringValue(
    value: unknown,
    field: string,
    allowEmpty = false,
  ): void {
    if (value === undefined) {
      return;
    }
    if (typeof value !== 'string') {
      throw new Error(
        `Bulk update field '${field}' must be a string when provided`,
      );
    }
    if (!allowEmpty && value.trim().length === 0) {
      throw new Error(
        `Bulk update field '${field}' cannot be empty when provided`,
      );
    }
  }

  private assertNonEmptyRuntimeField(
    value: unknown,
    field: string,
    node: WorkflowNode,
  ): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(
        `Node '${node.name}' (${node.id}) has downstream dependencies and must retain a valid ${field}`,
      );
    }
  }

  private createEdgeFilterPredicate(
    filter?: GraphEdgeBulkUpdateFilter,
  ): (edge: WorkflowEdge) => boolean {
    if (!filter || Object.keys(filter).length === 0) {
      return () => true;
    }
    return (edge) => {
      if (filter.fromNodeId && edge.from !== filter.fromNodeId) {
        return false;
      }
      if (filter.toNodeId && edge.to !== filter.toNodeId) {
        return false;
      }
      if (filter.label && edge.label !== filter.label) {
        return false;
      }
      if (
        filter.isCheckpoint !== undefined &&
        edge.isCheckpoint !== filter.isCheckpoint
      ) {
        return false;
      }
      return true;
    };
  }

  private assertEdgeBulkUpdatePayload(
    updates: GraphEdgeBulkUpdatePayload,
  ): void {
    this.assertOptionalStringValue(updates.label, 'label', true);
    if (!updates.queue) {
      return;
    }
    const { maxDepth } = updates.queue;
    if (maxDepth !== undefined) {
      if (!Number.isInteger(maxDepth) || maxDepth <= 0) {
        throw new Error('Edge queue maxDepth must be a positive integer');
      }
    }
  }

  private ensureEdgeBulkUpdateSafe(
    edge: WorkflowEdge,
    updates: GraphEdgeBulkUpdatePayload,
    queueState?: EdgeQueueInternalState,
  ): void {
    if (!updates.queue || !queueState) {
      return;
    }

    if (updates.queue.maxDepth !== undefined) {
      const maxDepth = updates.queue.maxDepth;
      if (typeof maxDepth === 'number' && maxDepth < queueState.depth) {
        throw new Error(
          `Cannot set maxDepth (${maxDepth}) below current depth (${queueState.depth}) for edge '${edge.id}'`,
        );
      }
    }

    if (updates.queue.enabled === false && queueState.depth > 0) {
      throw new Error(
        `Cannot disable queue on edge '${edge.id}' while items are pending`,
      );
    }
  }

  private applyEdgeBulkUpdates(
    edge: WorkflowEdge,
    updates: GraphEdgeBulkUpdatePayload,
  ): void {
    if (updates.label !== undefined) {
      edge.label = updates.label;
    }
    if (updates.isCheckpoint !== undefined) {
      edge.isCheckpoint = updates.isCheckpoint;
    }
    if (updates.queue) {
      edge.queue = {
        ...(edge.queue || {}),
        ...updates.queue,
      };
    }
  }
}
