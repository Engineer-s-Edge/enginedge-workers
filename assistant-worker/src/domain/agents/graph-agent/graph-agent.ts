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
import { StateMachine } from '../../services/state-machine.service';
import { ResponseParser } from '../../services/response-parser.service';
import { PromptBuilder } from '../../services/prompt-builder.service';
import {
  WorkflowGraph,
  WorkflowNode,
  NodeType,
  NodeStatus,
  ExecutedNode,
  GraphExecutionResult,
  GraphExecutionSnapshot,
  GraphExecutionHistoryEntry,
} from './graph-agent.types';

interface GraphConfig {
  maxDepth?: number;
  allowParallel?: boolean;
  temperature?: number;
  model?: string;
  maxRetries?: number;
  nodeTimeoutMs?: number;
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
}

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
      ...config,
    };
    this.graphState = this.createEmptyGraphState();
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
    };
  }

  private updateLastUpdated(): void {
    this.graphState.lastUpdated = Date.now();
  }

  private markNodeStarted(node: WorkflowNode): InternalHistoryEntry {
    const entry: InternalHistoryEntry = {
      nodeId: node.id,
      nodeName: node.name,
      status: NodeStatus.RUNNING,
      startedAt: new Date(),
    };
    this.graphState.history.push(entry);
    this.graphState.currentNodeIds = [node.id];
    this.updateLastUpdated();
    return entry;
  }

  private markNodeCompleted(
    node: WorkflowNode,
    executedNode: ExecutedNode,
    historyEntry?: InternalHistoryEntry,
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
    this.updateLastUpdated();
  }

  private markNodeFailed(
    node: WorkflowNode,
    failedNode: ExecutedNode,
    historyEntry?: InternalHistoryEntry,
    errorMessage?: string,
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
    this.updateLastUpdated();
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
        const historyEntry = this.markNodeStarted(node);

        try {
          const executedNode = await this.executeNode(
            node,
            nodeResults,
            context,
          );
          this.markNodeCompleted(node, executedNode, historyEntry);

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

          this.markNodeFailed(node, failedNode, historyEntry, errorMsg);
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
            output = { status: 'parallel_join_complete', merged: true };
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

    const llmRequest: LLMRequest = {
      model: this.config.model || 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: (this.config.temperature as number) ?? 0.5,
      maxTokens: 1000,
    };

    const response = await this.llmProvider.complete(llmRequest);
    return this.responseParser.parse(response);
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

    return {
      graph: this.graphState.graph,
      graphId: this.graphState.graph?.id,
      graphName: this.graphState.graph?.name,
      startTime: this.graphState.startTime,
      lastUpdated: this.graphState.lastUpdated,
      currentNodeIds: [...this.graphState.currentNodeIds],
      pendingNodeIds: Array.from(this.graphState.pendingNodes.keys()),
      executedNodes: [...this.graphState.executedNodes],
      failedNodes: [...this.graphState.failedNodes],
      nodeResults,
      retryAttempts,
      executionHistory,
      metadata: {
        totalNodes: this.graphState.graph?.nodes.length ?? 0,
      },
    };
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
    };
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
}
