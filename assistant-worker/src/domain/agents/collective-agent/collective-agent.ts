/**
 * Collective Agent - Multi-Agent Orchestration
 * 
 * Implements multi-agent coordination with task distribution,
 * result aggregation, and conflict resolution.
 */

import { BaseAgent } from '../agent.base';
import { ExecutionContext, ExecutionResult } from '../../entities';
import { ILogger } from '@application/ports/logger.port';
import { ILLMProvider } from '@application/ports/llm-provider.port';
import {
  TaskDistributionStrategy,
  AggregationMethod,
  CoordinationPattern,
  CollectiveAgentState,
  SubAgentRef,
  Task,
  TaskAssignment,
  SubAgentResult,
  AggregatedResult,
  SubAgentStats,
  SubAgentType,
} from './collective-agent.types';

/**
 * Collective Agent - Orchestrates multiple sub-agents
 */
export class CollectiveAgent extends BaseAgent {
  private collectiveState: CollectiveAgentState;

  constructor(
    llmProvider: ILLMProvider,
    logger: ILogger,
    private config: {
      maxSubAgents?: number;
      defaultStrategy?: TaskDistributionStrategy;
      temperature?: number;
      model?: string;
    } = {},
  ) {
    super(llmProvider, logger);
    this.collectiveState = {
      subAgents: [],
      activeTasks: [],
      pendingAssignments: [],
      completedAssignments: [],
      subAgentStats: [],
      distributionStrategy: config.defaultStrategy || TaskDistributionStrategy.LOAD_BALANCED,
      aggregationMethod: AggregationMethod.CONSENSUS,
      coordinationPattern: CoordinationPattern.PARALLEL,
      conflicts: [],
      totalTasksProcessed: 0,
    };
  }

  /**
   * Get current collective state
   */
  getCollectiveState(): CollectiveAgentState {
    return { ...this.collectiveState };
  }

  /**
   * Register a sub-agent in the collective
   */
  registerSubAgent(subAgent: SubAgentRef): void {
    this.collectiveState = {
      ...this.collectiveState,
      subAgents: [...this.collectiveState.subAgents, subAgent],
      subAgentStats: [
        ...this.collectiveState.subAgentStats,
        {
          agentId: subAgent.agentId,
          tasksCompleted: 0,
          tasksFailed: 0,
          averageExecutionTime: 0,
          successRate: 1.0,
          lastTaskAt: null,
          totalLoadHandled: 0,
        },
      ],
    };
    this.logger.info('Registered sub-agent', { agentId: subAgent.agentId, type: subAgent.type });
  }

  /**
   * Set distribution strategy
   */
  setDistributionStrategy(strategy: TaskDistributionStrategy): void {
    this.collectiveState = {
      ...this.collectiveState,
      distributionStrategy: strategy,
    };
    this.logger.info('Updated distribution strategy', { strategy });
  }

  /**
   * Set coordination pattern
   */
  setCoordinationPattern(pattern: CoordinationPattern): void {
    this.collectiveState = {
      ...this.collectiveState,
      coordinationPattern: pattern,
    };
    this.logger.info('Updated coordination pattern', { pattern });
  }

  /**
   * Main execution method - implements BaseAgent.run()
   */
  protected async run(
    input: string,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    try {
      this.logger.info('CollectiveAgent: Starting coordination', {
        input,
        subAgents: this.collectiveState.subAgents.length,
        strategy: this.collectiveState.distributionStrategy,
      });

      // Break down task into subtasks
      const subtasks = await this.decomposeTask(input);

      // Distribute tasks to sub-agents
      const assignments = this.distributeTasks(subtasks);

      // Execute based on coordination pattern
      let results: SubAgentResult[];
      switch (this.collectiveState.coordinationPattern) {
        case CoordinationPattern.SEQUENTIAL:
          results = await this.executeSequential(assignments);
          break;
        case CoordinationPattern.PARALLEL:
          results = await this.executeParallel(assignments);
          break;
        default:
          results = await this.executeParallel(assignments);
      }

      // Aggregate results
      const aggregated = this.aggregateResults(results);

      // Update statistics
      this.collectiveState = {
        ...this.collectiveState,
        totalTasksProcessed: this.collectiveState.totalTasksProcessed + subtasks.length,
      };

      return {
        status: 'success',
        output: String(aggregated.finalResult),
        metadata: {
          subtasks: subtasks.length,
          subAgents: this.collectiveState.subAgents.length,
          strategy: this.collectiveState.distributionStrategy,
          pattern: this.collectiveState.coordinationPattern,
        },
      };
    } catch (error) {
      this.logger.error('CollectiveAgent: Coordination failed', error as Record<string, unknown>);
      return {
        status: 'error',
        output: `Coordination failed: ${error instanceof Error ? error.message : String(error)}`,
        error: { message: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  /**
   * Streaming execution - implements BaseAgent.runStream()
   */
  protected async *runStream(
    input: string,
    context: ExecutionContext,
  ): AsyncGenerator<string> {
    yield `🤝 Collective Agent: Starting coordination\n`;
    yield `Sub-agents: ${this.collectiveState.subAgents.length}\n`;
    yield `Strategy: ${this.collectiveState.distributionStrategy}\n\n`;

    // Decompose task
    yield `📋 Decomposing task into subtasks...\n`;
    const subtasks = await this.decomposeTask(input);
    yield `Created ${subtasks.length} subtasks\n\n`;

    // Distribute tasks
    yield `📤 Distributing tasks to sub-agents...\n`;
    const assignments = this.distributeTasks(subtasks);
    for (const assignment of assignments) {
      yield `- Assigned task to ${assignment.agentId}\n`;
    }
    yield `\n`;

    // Execute
    yield `⚙️ Executing tasks...\n`;
    const results = await this.executeParallel(assignments);
    yield `Completed ${results.length} tasks\n\n`;

    // Aggregate
    yield `📊 Aggregating results...\n`;
    const aggregated = this.aggregateResults(results);
    yield `\n${String(aggregated.finalResult)}\n`;
  }

  /**
   * Decompose task into subtasks using LLM
   */
  private async decomposeTask(input: string): Promise<Task[]> {
    const response = await this.llmProvider.complete({
      model: this.config.model || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a task decomposition expert. Break down complex tasks into smaller subtasks.',
        },
        {
          role: 'user',
          content: `Decompose this task into 3-5 subtasks:\n${input}`,
        },
      ],
      temperature: this.config.temperature || 0.5,
      maxTokens: 500,
    });

    // Parse subtasks from response
    const subtaskLines = response.content
      .split('\n')
      .filter((line) => line.trim().length > 0 && (line.match(/^\d+\./) || line.match(/^-/)))
      .slice(0, 5);

    return subtaskLines.map((line, idx) => ({
      taskId: `task_${idx}`,
      description: line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').trim(),
      input: line,
      priority: 'medium' as const,
      timeout: 30000,
      createdAt: new Date(),
    }));
  }

  /**
   * Distribute tasks to sub-agents
   */
  private distributeTasks(tasks: Task[]): TaskAssignment[] {
    const activeAgents = this.collectiveState.subAgents.filter((sa) => sa.isActive);
    
    if (activeAgents.length === 0) {
      throw new Error('No active sub-agents available');
    }

    const assignments: TaskAssignment[] = [];

    // Simple round-robin distribution
    tasks.forEach((task, idx) => {
      const agent = activeAgents[idx % activeAgents.length];
      assignments.push({
        assignmentId: `assignment_${idx}`,
        taskId: task.taskId,
        agentId: agent.agentId,
        assignedAt: new Date(),
        status: 'pending',
      });
    });

    return assignments;
  }

  /**
   * Execute tasks sequentially
   */
  private async executeSequential(assignments: TaskAssignment[]): Promise<SubAgentResult[]> {
    const results: SubAgentResult[] = [];
    
    for (const assignment of assignments) {
      const result = await this.executeTask(assignment);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute tasks in parallel
   */
  private async executeParallel(assignments: TaskAssignment[]): Promise<SubAgentResult[]> {
    const promises = assignments.map((assignment) => this.executeTask(assignment));
    return Promise.all(promises);
  }

  /**
   * Execute a single task
   */
  private async executeTask(assignment: TaskAssignment): Promise<SubAgentResult> {
    const startTime = Date.now();

    try {
      // Simulate task execution using LLM
      const response = await this.llmProvider.complete({
        model: this.config.model || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant executing a subtask.',
          },
          {
            role: 'user',
            content: `Execute task: ${assignment.taskId}`,
          },
        ],
        temperature: 0.7,
        maxTokens: 300,
      });

      const executionTime = Date.now() - startTime;

      // Update stats immutably
      const stats = this.collectiveState.subAgentStats.find(
        (s) => s.agentId === assignment.agentId,
      );
      if (stats) {
        const newStats: SubAgentStats = {
          ...stats,
          tasksCompleted: stats.tasksCompleted + 1,
          averageExecutionTime:
            (stats.averageExecutionTime * stats.tasksCompleted + executionTime) /
            (stats.tasksCompleted + 1),
          successRate: (stats.tasksCompleted + 1) / (stats.tasksCompleted + stats.tasksFailed + 1),
          lastTaskAt: new Date(),
        };
        this.collectiveState = {
          ...this.collectiveState,
          subAgentStats: this.collectiveState.subAgentStats.map((s) =>
            s.agentId === assignment.agentId ? newStats : s,
          ),
        };
      }

      return {
        resultId: `result_${Date.now()}`,
        agentId: assignment.agentId,
        taskId: assignment.taskId,
        status: 'success',
        output: response.content,
        executionTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const stats = this.collectiveState.subAgentStats.find(
        (s) => s.agentId === assignment.agentId,
      );
      if (stats) {
        const newStats: SubAgentStats = {
          ...stats,
          tasksFailed: stats.tasksFailed + 1,
        };
        this.collectiveState = {
          ...this.collectiveState,
          subAgentStats: this.collectiveState.subAgentStats.map((s) =>
            s.agentId === assignment.agentId ? newStats : s,
          ),
        };
      }

      return {
        resultId: `result_${Date.now()}`,
        agentId: assignment.agentId,
        taskId: assignment.taskId,
        status: 'failure',
        output: null,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Aggregate results from sub-agents
   */
  private aggregateResults(results: SubAgentResult[]): AggregatedResult {
    const successfulResults = results.filter((r) => r.status === 'success');

    if (successfulResults.length === 0) {
      return {
        aggregationId: `agg_${Date.now()}`,
        individualResults: results,
        aggregationMethod: this.collectiveState.aggregationMethod,
        finalResult: 'All subtasks failed',
        confidence: 0,
        conflicts: [],
        timestamp: new Date(),
      };
    }

    // Simple concatenation
    const finalResult = successfulResults
      .map((r, idx) => `${idx + 1}. ${String(r.output)}`)
      .join('\n\n');

    return {
      aggregationId: `agg_${Date.now()}`,
      individualResults: results,
      aggregationMethod: this.collectiveState.aggregationMethod,
      finalResult,
      confidence: successfulResults.length / results.length,
      conflicts: [],
      timestamp: new Date(),
      
    };
  }
}
