/**
 * Manager Agent - Task Decomposition & Sub-Agent Coordination
 *
 * Implements task breakdown and orchestration:
 * - Master task decomposition into subtasks
 * - Capability-based agent matching
 * - Parallel and sequential execution coordination
 * - Result aggregation and synthesis
 * - Dependency and constraint management
 */

import { BaseAgent } from '../agent.base';
import { ExecutionContext, ExecutionResult, AgentState } from '../../entities';
import { ILogger } from '@application/ports/logger.port';
import { ILLMProvider, LLMRequest } from '@application/ports/llm-provider.port';
import { MemoryManager } from '../../services/memory-manager.service';
import { StateMachine } from '../../services/state-machine.service';
import { ResponseParser } from '../../services/response-parser.service';
import { PromptBuilder } from '../../services/prompt-builder.service';
import {
  MasterTask,
  SubTask,
  SubTaskAssignment,
  SubTaskResult,
  ExecutionPlan,
  AggregatedTaskResult,
  ManagerExecutionResult,
  ManagerStateUpdate,
  ManagerAgentStateData,
  DecompositionStrategy,
  ManagerAgentState,
  DecompositionResult,
} from './manager-agent.types';

interface ManagerConfig {
  maxSubtasks?: number;
  maxConcurrentTasks?: number;
  decompositionStrategy?: DecompositionStrategy;
  temperature?: number;
  model?: string;
  [key: string]: any;
}

/**
 * Manager Agent - Orchestrates complex tasks through decomposition and coordination
 *
 * Responsibilities:
 * - Break complex tasks into manageable subtasks
 * - Match subtasks to available agents
 * - Coordinate parallel and sequential execution
 * - Aggregate and synthesize results
 * - Handle dependencies and constraints
 */
export class ManagerAgent extends BaseAgent {
  private config: ManagerConfig;
  private managerState: ManagerAgentStateData;

  constructor(
    llmProvider: ILLMProvider,
    logger: ILogger,
    private memoryManager: MemoryManager,
    private stateMachine: typeof StateMachine,
    private responseParser: ResponseParser,
    private promptBuilder: PromptBuilder,
    config: ManagerConfig,
  ) {
    super(llmProvider, logger);
    this.config = {
      maxSubtasks: 50,
      maxConcurrentTasks: 5,
      decompositionStrategy: DecompositionStrategy.HIERARCHICAL,
      temperature: 0.7,
      model: 'gpt-4',
      ...config,
    };
    this.managerState = {
      currentState: ManagerAgentState.IDLE,
      masterTask: null,
      executionPlan: null,
      assignments: [],
      completedAssignments: [],
      failedAssignments: [],
      subtaskResults: [],
      aggregatedResult: null,
      startTime: 0,
    };
  }

  protected async run(
    input: string,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    try {
      this.managerState.currentState = ManagerAgentState.PLANNING;
      this.addThinkingStep('Starting Manager Agent - Planning phase');

      // Parse master task
      const masterTask = this.parseMasterTask(input);
      this.managerState.masterTask = masterTask;
      this.managerState.startTime = Date.now();

      // Decompose task
      this.managerState.currentState = ManagerAgentState.DECOMPOSING;
      const decompositionResult = await this.decomposeTask(masterTask, context);
      this.addThinkingStep(
        `Decomposed task into ${decompositionResult.subtasks.length} subtasks`,
      );

      // Create execution plan
      const executionPlan = this.createExecutionPlan(
        masterTask,
        decompositionResult.subtasks,
        decompositionResult.strategy,
      );
      this.managerState.executionPlan = executionPlan;

      // Coordinate execution
      this.managerState.currentState = ManagerAgentState.COORDINATING;
      const assignments = await this.coordinateExecution(
        executionPlan,
        context,
      );
      this.managerState.assignments = assignments;
      this.managerState.completedAssignments = assignments.filter(
        (a) => a.status === 'completed',
      );
      this.managerState.failedAssignments = assignments.filter(
        (a) => a.status === 'failed',
      );

      // Aggregate results
      this.managerState.currentState = ManagerAgentState.AGGREGATING;
      const subtaskResults = assignments
        .filter((a) => a.result)
        .map((a) => a.result!);
      const aggregatedResult = await this.aggregateResults(
        masterTask,
        subtaskResults,
        decompositionResult,
      );
      this.managerState.aggregatedResult = aggregatedResult;
      this.managerState.currentState = ManagerAgentState.COMPLETE;

      const totalDuration = Date.now() - this.managerState.startTime;

      this.addThinkingStep(
        `Manager Agent completed - ${subtaskResults.length} subtasks completed`,
      );

      return {
        status: aggregatedResult.status === 'success' ? 'success' : 'error',
        output: {
          managerId: 'manager-agent',
          status: aggregatedResult.status,
          finalOutput: aggregatedResult.finalOutput,
          summary: aggregatedResult.summary,
          subtasksCompleted: aggregatedResult.subtaskResults.length,
          subtasksFailed: aggregatedResult.failedSubtasks.length,
          confidence: aggregatedResult.confidence,
        },
        metadata: {
          totalDuration,
          masterTask: masterTask.id,
          subtaskCount: subtaskResults.length,
          executionPlan: executionPlan.planId,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('Manager Agent execution failed', { error: errorMsg });

      return {
        status: 'error',
        output: `Manager Agent failed: ${errorMsg}`,
        metadata: {
          error: errorMsg,
          state: this.managerState.currentState,
        },
      };
    }
  }

  protected async *runStream(
    input: string,
    context: ExecutionContext,
  ): AsyncGenerator<string> {
    try {
      yield 'Manager Agent Starting\n';

      const masterTask = this.parseMasterTask(input);
      yield `Master Task: ${masterTask.title}\n`;

      yield 'Decomposing task...\n';
      const decompositionResult = await this.decomposeTask(masterTask, context);
      yield `Created ${decompositionResult.subtasks.length} subtasks\n`;

      const executionPlan = this.createExecutionPlan(
        masterTask,
        decompositionResult.subtasks,
        decompositionResult.strategy,
      );
      yield `Execution Plan: ${executionPlan.planId}\n`;

      yield 'Coordinating sub-agent execution...\n';
      const assignments = await this.coordinateExecution(
        executionPlan,
        context,
      );
      yield `Executed ${assignments.length} assignments\n`;

      const subtaskResults = assignments
        .filter((a) => a.result)
        .map((a) => a.result!);
      const aggregatedResult = await this.aggregateResults(
        masterTask,
        subtaskResults,
        decompositionResult,
      );

      yield `\nAggregation complete - Status: ${aggregatedResult.status}\n`;
      yield `Summary: ${aggregatedResult.summary}\n`;
      yield `Confidence: ${(aggregatedResult.confidence * 100).toFixed(1)}%\n`;
      yield 'Manager Agent Completed\n';
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      yield `Manager Agent Error: ${errorMsg}\n`;
    }
  }

  /**
   * Parse master task from input
   */
  private parseMasterTask(input: string): MasterTask {
    try {
      const parsed = JSON.parse(input);
      if (parsed.title && parsed.objective) {
        return parsed as MasterTask;
      }
    } catch {
      // Not JSON
    }

    // Create default task from string
    return {
      id: `task-${Date.now()}`,
      title: 'Complex Task',
      description: input,
      objective: input,
      priority: 'medium',
    };
  }

  /**
   * Decompose master task into subtasks
   */
  private async decomposeTask(
    masterTask: MasterTask,
    context: ExecutionContext,
  ): Promise<DecompositionResult> {
    const systemPrompt = this.promptBuilder.buildSystemPrompt(
      'task_decomposition',
      {
        taskTitle: masterTask.title,
        strategy: this.config.decompositionStrategy,
      },
    );

    const userPrompt = `Decompose this task into subtasks:\n${masterTask.description}`;

    const llmRequest: LLMRequest = {
      model: this.config.model || 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: (this.config.temperature as number) ?? 0.7,
      maxTokens: 2000,
    };

    const response = await this.llmProvider.complete(llmRequest);
    const parsed = this.responseParser.parse(response);

    // Extract subtasks from response
    const subtasks: SubTask[] = this.extractSubtasks(masterTask, parsed);

    return {
      decompositionId: `decomp-${Date.now()}`,
      masterTask,
      subtasks: subtasks.slice(0, this.config.maxSubtasks),
      strategy: this.config.decompositionStrategy as DecompositionStrategy,
      rationale: String(parsed) || 'Decomposition based on task analysis',
      confidence: 0.8,
    };
  }

  /**
   * Extract subtasks from LLM response
   */
  private extractSubtasks(
    masterTask: MasterTask,
    response: unknown,
  ): SubTask[] {
    const subtasks: SubTask[] = [];

    // Simple extraction - in production use more sophisticated parsing
    if (typeof response === 'string') {
      const lines = response.split('\n').filter((l) => l.trim());
      let index = 1;

      for (const line of lines) {
        if (line.trim()) {
          subtasks.push({
            id: `subtask-${Date.now()}-${index}`,
            taskId: masterTask.id,
            title: `Subtask ${index}`,
            description: line.trim(),
            objective: line.trim(),
            priority: 'medium',
            estimatedDuration: 30000, // 30 seconds default
            retryPolicy: { maxRetries: 2, backoffMs: 1000 },
          });
          index++;
        }
      }
    }

    // Ensure at least one subtask
    if (subtasks.length === 0) {
      subtasks.push({
        id: `subtask-${Date.now()}-1`,
        taskId: masterTask.id,
        title: 'Main Task',
        description: masterTask.description,
        objective: masterTask.objective,
        priority: masterTask.priority || 'medium',
        estimatedDuration: 30000,
        retryPolicy: { maxRetries: 2, backoffMs: 1000 },
      });
    }

    return subtasks;
  }

  /**
   * Create execution plan
   */
  private createExecutionPlan(
    masterTask: MasterTask,
    subtasks: SubTask[],
    strategy: DecompositionStrategy,
  ): ExecutionPlan {
    const estimatedDuration = subtasks.reduce(
      (total, st) => total + (st.estimatedDuration || 30000),
      0,
    );

    return {
      planId: `plan-${Date.now()}`,
      taskId: masterTask.id,
      masterTask,
      subtasks,
      assignments: subtasks.map((st) => ({
        id: `assign-${st.id}`,
        subtaskId: st.id,
        agentId: `agent-default`, // Placeholder
        assignedAt: new Date(),
        status: 'pending' as const,
      })),
      strategy,
      estimatedDuration,
      priority: masterTask.priority || 'medium',
    };
  }

  /**
   * Coordinate execution of subtasks
   */
  private async coordinateExecution(
    plan: ExecutionPlan,
    context: ExecutionContext,
  ): Promise<SubTaskAssignment[]> {
    const assignments: SubTaskAssignment[] = [];

    // Execute subtasks based on strategy
    switch (plan.strategy) {
      case DecompositionStrategy.SEQUENTIAL:
        for (const subtask of plan.subtasks) {
          const assignment = await this.executeSubtask(plan, subtask, context);
          assignments.push(assignment);
        }
        break;

      case DecompositionStrategy.PARALLEL:
        const parallelPromises = plan.subtasks.map((st) =>
          this.executeSubtask(plan, st, context),
        );
        const parallelResults = await Promise.all(parallelPromises);
        assignments.push(...parallelResults);
        break;

      case DecompositionStrategy.HIERARCHICAL:
        // Group and execute hierarchically
        const grouped = this.groupSubtasksByDependency(plan.subtasks);
        for (const group of grouped) {
          const groupPromises = group.map((st) =>
            this.executeSubtask(plan, st, context),
          );
          const groupResults = await Promise.all(groupPromises);
          assignments.push(...groupResults);
        }
        break;

      case DecompositionStrategy.GUIDED:
        // Execute with LLM guidance
        for (const subtask of plan.subtasks) {
          const assignment = await this.executeSubtask(plan, subtask, context);
          assignments.push(assignment);
          // Could update strategy based on results
        }
        break;
    }

    return assignments;
  }

  /**
   * Execute a single subtask
   */
  private async executeSubtask(
    plan: ExecutionPlan,
    subtask: SubTask,
    context: ExecutionContext,
  ): Promise<SubTaskAssignment> {
    const assignment: SubTaskAssignment = {
      id: `assign-${Date.now()}`,
      subtaskId: subtask.id,
      agentId: 'agent-executor',
      assignedAt: new Date(),
      status: 'assigned',
    };

    try {
      // Simulate sub-agent execution with LLM
      const systemPrompt = this.promptBuilder.buildSystemPrompt('subtask', {
        subtaskTitle: subtask.title,
      });

      const llmRequest: LLMRequest = {
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: subtask.description },
        ],
        temperature: (this.config.temperature as number) ?? 0.7,
        maxTokens: 1000,
      };

      const response = await this.llmProvider.complete(llmRequest);
      const output = this.responseParser.parse(response);

      assignment.status = 'completed';
      assignment.completedAt = new Date();
      assignment.result = {
        subtaskId: subtask.id,
        agentId: assignment.agentId,
        status: 'success',
        output,
        executionTime:
          assignment.completedAt.getTime() - assignment.assignedAt.getTime(),
        confidence: 0.85,
      };
    } catch (error) {
      assignment.status = 'failed';
      assignment.completedAt = new Date();
      assignment.error = {
        message: error instanceof Error ? error.message : String(error),
        code: 'EXECUTION_ERROR',
      };
    }

    return assignment;
  }

  /**
   * Group subtasks by dependencies
   */
  private groupSubtasksByDependency(subtasks: SubTask[]): SubTask[][] {
    const groups: SubTask[][] = [];
    const processed = new Set<string>();

    for (const subtask of subtasks) {
      if (!processed.has(subtask.id)) {
        const group: SubTask[] = [subtask];
        processed.add(subtask.id);

        // Find independent subtasks
        for (const other of subtasks) {
          if (!processed.has(other.id)) {
            const hasDependency = (other.dependencies || []).some((d) =>
              group.some((s) => s.id === d),
            );
            if (!hasDependency) {
              group.push(other);
              processed.add(other.id);
            }
          }
        }

        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * Aggregate results from all subtasks
   */
  private async aggregateResults(
    masterTask: MasterTask,
    subtaskResults: SubTaskResult[],
    decompositionResult: DecompositionResult,
  ): Promise<AggregatedTaskResult> {
    const failedSubtasks = subtaskResults
      .filter((r) => r.status !== 'success')
      .map((r) => r.subtaskId);

    const completedCount = subtaskResults.filter(
      (r) => r.status === 'success',
    ).length;
    const totalCount = subtaskResults.length;
    const successRate = totalCount > 0 ? completedCount / totalCount : 0;
    const confidence = decompositionResult.confidence * successRate;

    // Synthesize final output
    const finalOutput = this.synthesizeOutput(subtaskResults);
    const summary = this.generateSummary(
      masterTask,
      subtaskResults,
      decompositionResult,
    );

    return {
      resultId: `result-${Date.now()}`,
      taskId: masterTask.id,
      status:
        failedSubtasks.length === 0
          ? 'success'
          : failedSubtasks.length === totalCount
            ? 'failed'
            : 'partial',
      subtaskResults,
      failedSubtasks,
      finalOutput,
      executionTime: subtaskResults.reduce(
        (sum, r) => sum + r.executionTime,
        0,
      ),
      confidence,
      summary,
    };
  }

  /**
   * Synthesize final output from subtask results
   */
  private synthesizeOutput(results: SubTaskResult[]): unknown {
    return {
      subtaskOutputs: results.map((r) => ({
        subtaskId: r.subtaskId,
        output: r.output,
        confidence: r.confidence,
      })),
      combinedInsights: results
        .filter((r) => typeof r.output === 'string')
        .map((r) => r.output)
        .join('\n'),
    };
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    masterTask: MasterTask,
    results: SubTaskResult[],
    decomposition: DecompositionResult,
  ): string {
    const successful = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status !== 'success').length;

    return (
      `Completed master task "${masterTask.title}" using ${decomposition.strategy} decomposition. ` +
      `Executed ${results.length} subtasks: ${successful} successful, ${failed} failed. ` +
      `Average confidence: ${((results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length) * 100).toFixed(1)}%.`
    );
  }

  override getState(): AgentState {
    return super.getState();
  }

  /**
   * Get Manager-specific state
   */
  getManagerState() {
    return this.managerState;
  }
}
