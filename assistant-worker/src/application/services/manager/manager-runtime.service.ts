/**
 * Manager Runtime Service
 *
 * Provides in-memory orchestration data for Manager agents so the UI can query
 * decomposition results, execution plans, assignments, and aggregated output
 * without waiting for a full agent run.
 */

import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ILogger } from '@application/ports/logger.port';
import {
  AggregatedTaskResult,
  DecompositionResult,
  DecompositionStrategy,
  ExecutionPlan,
  ManagerStateUpdate,
  MasterTask,
  SubTask,
  SubTaskAssignment,
  SubTaskResult,
} from '@domain/agents/manager-agent/manager-agent.types';
import { AgentEventService } from '../agent-event.service';

type AssignmentStatus = SubTaskAssignment['status'];
export type ManagerSubtaskStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'failed';

export interface ManagerRuntimeSubtask extends SubTask {
  status: ManagerSubtaskStatus;
  assignedAgentId: string | null;
  progress: number; // 0 - 1
  waitingOn: string[];
  lastUpdated: Date;
}

export interface ManagerRuntimeAssignment extends SubTaskAssignment {
  priority: string;
  taskTitle: string;
  taskObjective: string;
  taskDependencies: string[];
  workloadEstimate: number;
  source: 'manager' | 'manual' | 'retry';
}

export interface ManagerRuntimeMetrics {
  totalSubtasks: number;
  completed: number;
  inProgress: number;
  pending: number;
  failed: number;
  blocked: number;
  progressPercent: number;
  avgConfidence: number;
  totalAssignments: number;
}

export interface ManagerWaitingDependency {
  waitingAgentId: string;
  waitingOnAgentId: string;
  taskId: string;
  dependencyReason: string;
  subtaskId: string;
}

export interface ManagerRuntimeSnapshot {
  agentId: string;
  masterTask: MasterTask | null;
  decomposition: DecompositionResult | null;
  executionPlan: ExecutionPlan | null;
  subtasks: ManagerRuntimeSubtask[];
  assignments: ManagerRuntimeAssignment[];
  aggregatedResult: AggregatedTaskResult | null;
  metrics: ManagerRuntimeMetrics;
  waitingDependencies: ManagerWaitingDependency[];
  statusHistory: ManagerStateUpdate[];
  paused: boolean;
  pauseReason?: string;
  lastUpdated: Date;
  version: number;
}

export interface ManagerDecompositionRequest {
  masterTask: Partial<MasterTask> & {
    title: string;
    description: string;
    objective?: string;
  };
  strategy?: DecompositionStrategy;
  manualSubtasks?: Array<
    Partial<SubTask> & {
      title: string;
      description: string;
    }
  >;
  hints?: string[];
  preferredAgents?: string[];
  metadata?: Record<string, unknown>;
}

export interface ManagerDecompositionSnapshot {
  agentId: string;
  masterTask: MasterTask;
  strategy: DecompositionStrategy;
  decomposition: DecompositionResult;
  executionPlan: ExecutionPlan;
  subtasks: ManagerRuntimeSubtask[];
  metrics: ManagerRuntimeMetrics;
  generatedAt: Date;
}

export interface ManagerCoordinateOptions {
  strategy?: DecompositionStrategy | string;
  orchestratedTask?: string;
  preferredAgents?: string[];
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

export interface ManagerCoordinationResult {
  agentId: string;
  strategy: DecompositionStrategy;
  assignments: ManagerRuntimeAssignment[];
  metrics: ManagerRuntimeMetrics;
  startedSubtasks: string[];
  completedSubtasks: string[];
  updatedAt: Date;
}

export interface ManagerAggregationOptions {
  notes?: string;
  summaryOverride?: string;
}

export interface ManagerAggregationSummary {
  agentId: string;
  aggregatedResult: AggregatedTaskResult;
  metrics: ManagerRuntimeMetrics;
  generatedAt: Date;
}

export interface ManagerAssignmentFilter {
  statuses?: AssignmentStatus[];
  agentId?: string;
  includeCompleted?: boolean;
}

interface ManagerRuntimeState {
  agentId: string;
  masterTask: MasterTask | null;
  decomposition: DecompositionResult | null;
  executionPlan: ExecutionPlan | null;
  subtasks: ManagerRuntimeSubtask[];
  assignments: ManagerRuntimeAssignment[];
  aggregatedResult: AggregatedTaskResult | null;
  metrics: ManagerRuntimeMetrics;
  waitingDependencies: ManagerWaitingDependency[];
  statusHistory: ManagerStateUpdate[];
  paused: boolean;
  pauseReason?: string;
  version: number;
  lastUpdated: Date;
}

interface DescriptionSection {
  id: string;
  title: string;
  text: string;
  raw: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
}

const DEFAULT_METRICS: ManagerRuntimeMetrics = {
  totalSubtasks: 0,
  completed: 0,
  inProgress: 0,
  pending: 0,
  failed: 0,
  blocked: 0,
  progressPercent: 0,
  avgConfidence: 0,
  totalAssignments: 0,
};

@Injectable()
export class ManagerRuntimeService {
  private readonly stateByAgent = new Map<string, ManagerRuntimeState>();
  private sequence = 0;

  constructor(
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly agentEvents: AgentEventService,
  ) {}

  decomposeTask(
    agentId: string,
    userId: string,
    request: ManagerDecompositionRequest,
  ): ManagerDecompositionSnapshot {
    if (!request.masterTask?.title || !request.masterTask?.description) {
      throw new BadRequestException(
        'masterTask.title and masterTask.description are required',
      );
    }

    const state = this.ensureState(agentId);
    const strategy =
      request.strategy ||
      state.executionPlan?.strategy ||
      DecompositionStrategy.HIERARCHICAL;

    const masterTask: MasterTask = {
      id: request.masterTask.id || this.createId('master-task'),
      title: request.masterTask.title,
      description: request.masterTask.description,
      objective: request.masterTask.objective || request.masterTask.description,
      constraints: request.masterTask.constraints || [],
      dependencies: request.masterTask.dependencies || [],
      priority: request.masterTask.priority || 'high',
      deadline: request.masterTask.deadline,
      context: request.masterTask.context || {},
    };

    const subtasks = request.manualSubtasks?.length
      ? this.normalizeManualSubtasks(masterTask.id, request.manualSubtasks)
      : this.generateSubtasksFromDescription(masterTask, request.hints);

    const executionPlan = this.buildExecutionPlan(
      masterTask,
      subtasks,
      strategy,
    );

    state.masterTask = masterTask;
    state.decomposition = {
      decompositionId: this.createId('decomp'),
      masterTask,
      subtasks,
      strategy,
      rationale:
        (request.metadata?.rationale as string) ||
        'Decomposition generated via heuristics',
      confidence: 0.82,
    };
    state.executionPlan = executionPlan;
    state.subtasks = this.bootstrapRuntimeSubtasks(
      subtasks,
      request.preferredAgents,
    );
    state.assignments = this.bootstrapAssignments(state.subtasks);
    state.aggregatedResult = null;
    state.paused = false;
    state.pauseReason = undefined;
    state.waitingDependencies = this.computeWaitingDependencies(
      state.subtasks,
      state.assignments,
    );
    state.version += 1;
    state.lastUpdated = new Date();

    this.recomputeMetrics(state);
    this.recordStateEvent(state, userId, 'planning_started', {
      masterTaskId: masterTask.id,
      subtaskCount: state.subtasks.length,
    });
    this.recordStateEvent(state, userId, 'plan_created', {
      planId: executionPlan.planId,
      strategy,
    });

    return {
      agentId,
      masterTask,
      strategy,
      decomposition: state.decomposition,
      executionPlan,
      subtasks: state.subtasks,
      metrics: state.metrics,
      generatedAt: state.lastUpdated,
    };
  }

  coordinateExecution(
    agentId: string,
    userId: string,
    options: ManagerCoordinateOptions,
  ): ManagerCoordinationResult {
    const state = this.ensureState(agentId);

    if (!state.subtasks.length) {
      this.decomposeTask(agentId, userId, {
        masterTask: {
          title: 'Auto-generated task',
          description:
            options.orchestratedTask || 'Coordinate current workload',
        },
        strategy:
          (options.strategy as DecompositionStrategy) ||
          DecompositionStrategy.HIERARCHICAL,
      });
    }

    const strategy =
      (options.strategy as DecompositionStrategy) ||
      state.executionPlan?.strategy ||
      DecompositionStrategy.HIERARCHICAL;

    const started: string[] = [];
    const completed: string[] = [];
    const now = new Date();

    state.subtasks.forEach((subtask, index) => {
      if (state.paused) {
        return;
      }

      if (subtask.status === 'pending') {
        const dependenciesResolved = (subtask.dependencies || []).every((dep) =>
          this.isSubtaskComplete(state, dep),
        );

        if (!dependenciesResolved) {
          subtask.status = 'blocked';
          subtask.waitingOn = (subtask.dependencies || []).filter(
            (dep) => !this.isSubtaskComplete(state, dep),
          );
          subtask.lastUpdated = now;
          return;
        }

        subtask.status = 'in_progress';
        subtask.progress = 0.35;
        subtask.lastUpdated = now;
        started.push(subtask.id);
        this.recordStateEvent(state, userId, 'subtask_started', {
          subtaskId: subtask.id,
        });
      }

      if (subtask.status === 'in_progress' && index % 2 === 0) {
        subtask.status = 'completed';
        subtask.progress = 1;
        subtask.waitingOn = [];
        subtask.lastUpdated = now;
        completed.push(subtask.id);

        const assignment = state.assignments.find(
          (a) => a.subtaskId === subtask.id,
        );

        if (assignment) {
          assignment.status = 'completed';
          assignment.completedAt = now;
          assignment.result =
            assignment.result ||
            this.synthesizeSubtaskResult(subtask, assignment);
        }

        this.recordStateEvent(state, userId, 'subtask_completed', {
          subtaskId: subtask.id,
        });
      }
    });

    state.assignments.forEach((assignment) => {
      if (
        started.includes(assignment.subtaskId) &&
        assignment.status === 'pending'
      ) {
        assignment.status = 'started';
        assignment.assignedAt = now;
      }
    });

    state.waitingDependencies = this.computeWaitingDependencies(
      state.subtasks,
      state.assignments,
    );
    state.lastUpdated = now;
    this.recomputeMetrics(state);

    if (this.isExecutionComplete(state)) {
      this.recordStateEvent(state, userId, 'execution_completed', {
        completedSubtasks: completed.length,
      });
    }

    return {
      agentId,
      strategy,
      assignments: state.assignments,
      metrics: state.metrics,
      startedSubtasks: started,
      completedSubtasks: completed,
      updatedAt: now,
    };
  }

  aggregateResults(
    agentId: string,
    userId: string,
    options?: ManagerAggregationOptions,
  ): ManagerAggregationSummary {
    const state = this.ensureState(agentId);

    if (!state.subtasks.length) {
      throw new BadRequestException(
        'No subtasks available to aggregate. Run decomposition first.',
      );
    }

    const completedAssignments = state.assignments.filter(
      (assignment) => assignment.status === 'completed',
    );

    const subtaskResults: SubTaskResult[] = completedAssignments.map(
      (assignment) =>
        assignment.result ||
        this.synthesizeSubtaskResult(
          this.getSubtask(state, assignment.subtaskId),
          assignment,
        ),
    );

    const aggregated: AggregatedTaskResult = {
      resultId: this.createId('aggregation'),
      taskId: state.masterTask?.id || 'unknown-task',
      status:
        completedAssignments.length === state.subtasks.length
          ? 'success'
          : completedAssignments.length > 0
            ? 'partial'
            : 'failed',
      subtaskResults,
      failedSubtasks: state.subtasks
        .filter((s) => s.status === 'failed')
        .map((s) => s.id),
      finalOutput: {
        summary:
          options?.summaryOverride ||
          `${completedAssignments.length} of ${state.subtasks.length} subtasks complete`,
        insights: subtaskResults.map((result) => result.output),
      },
      executionTime: subtaskResults.reduce(
        (sum, result) => sum + result.executionTime,
        0,
      ),
      confidence: subtaskResults.length
        ? subtaskResults.reduce(
            (sum, result) => sum + (result.confidence || 0.75),
            0,
          ) / subtaskResults.length
        : 0.5,
      summary:
        options?.notes ||
        'Aggregated results generated from current subtask completions.',
      metadata: {
        totalAssignments: state.assignments.length,
        completedAssignments: completedAssignments.length,
      },
    };

    state.aggregatedResult = aggregated;
    state.lastUpdated = new Date();
    this.recomputeMetrics(state);

    this.recordStateEvent(state, userId, 'aggregation_started', {});
    this.recordStateEvent(state, userId, 'aggregation_completed', {
      resultId: aggregated.resultId,
    });

    return {
      agentId,
      aggregatedResult: aggregated,
      metrics: state.metrics,
      generatedAt: state.lastUpdated,
    };
  }

  triggerAggregation(
    agentId: string,
    userId: string,
    options?: ManagerAggregationOptions,
  ): ManagerAggregationSummary {
    return this.aggregateResults(agentId, userId, options);
  }

  pause(agentId: string, userId: string, reason?: string) {
    const state = this.ensureState(agentId);

    state.paused = true;
    state.pauseReason = reason || 'manual_pause';
    state.lastUpdated = new Date();
    this.logger.info('Manager agent paused', {
      agentId,
      reason: state.pauseReason,
    });

    this.recordStateEvent(state, userId, 'execution_paused', {
      reason: state.pauseReason,
    });

    return {
      agentId,
      paused: state.paused,
      pauseReason: state.pauseReason,
      timestamp: state.lastUpdated,
    };
  }

  resume(agentId: string, userId: string) {
    const state = this.ensureState(agentId);

    state.paused = false;
    state.pauseReason = undefined;
    state.lastUpdated = new Date();
    this.logger.info('Manager agent resumed', { agentId });

    this.recordStateEvent(state, userId, 'execution_resumed', {});

    return {
      agentId,
      paused: state.paused,
      timestamp: state.lastUpdated,
    };
  }

  getSnapshot(agentId: string): ManagerRuntimeSnapshot {
    const state = this.ensureState(agentId);

    return {
      agentId,
      masterTask: state.masterTask,
      decomposition: state.decomposition,
      executionPlan: state.executionPlan,
      subtasks: [...state.subtasks],
      assignments: [...state.assignments],
      aggregatedResult: state.aggregatedResult,
      metrics: state.metrics,
      waitingDependencies: [...state.waitingDependencies],
      statusHistory: [...state.statusHistory],
      paused: state.paused,
      pauseReason: state.pauseReason,
      lastUpdated: state.lastUpdated,
      version: state.version,
    };
  }

  getProgress(agentId: string) {
    const snapshot = this.getSnapshot(agentId);

    return {
      agentId,
      progressPercent: snapshot.metrics.progressPercent,
      metrics: snapshot.metrics,
      waitingDependencies: snapshot.waitingDependencies,
      paused: snapshot.paused,
      lastUpdated: snapshot.lastUpdated,
    };
  }

  getSubtasks(agentId: string) {
    const snapshot = this.getSnapshot(agentId);

    return {
      agentId,
      subtasks: snapshot.subtasks,
      metrics: snapshot.metrics,
      waitingDependencies: snapshot.waitingDependencies,
    };
  }

  getAssignments(agentId: string, filter?: ManagerAssignmentFilter) {
    const snapshot = this.getSnapshot(agentId);

    const assignments = snapshot.assignments.filter((assignment) => {
      if (filter?.agentId && assignment.agentId !== filter.agentId) {
        return false;
      }

      if (filter?.statuses && !filter.statuses.includes(assignment.status)) {
        return false;
      }

      if (
        filter?.includeCompleted === false &&
        assignment.status === 'completed'
      ) {
        return false;
      }

      return true;
    });

    return {
      agentId,
      assignments,
      metrics: snapshot.metrics,
    };
  }

  getAssignment(agentId: string, assignmentId: string) {
    const snapshot = this.getSnapshot(agentId);
    const assignment = snapshot.assignments.find(
      (item) => item.id === assignmentId,
    );

    if (!assignment) {
      throw new BadRequestException(
        `Assignment '${assignmentId}' not found for agent '${agentId}'`,
      );
    }

    return assignment;
  }

  reassignAssignment(
    agentId: string,
    userId: string,
    assignmentId: string,
    targetAgentId: string,
  ) {
    const state = this.ensureState(agentId);
    const assignment = state.assignments.find(
      (item) => item.id === assignmentId,
    );

    if (!assignment) {
      throw new BadRequestException(
        `Assignment '${assignmentId}' not found for agent '${agentId}'`,
      );
    }

    assignment.agentId = targetAgentId;
    assignment.status = 'assigned';
    assignment.completedAt = undefined;
    assignment.result = undefined;
    assignment.workloadEstimate += 5;
    assignment.source = 'manual';

    const subtask = this.getSubtask(state, assignment.subtaskId);
    subtask.assignedAgentId = targetAgentId;
    subtask.status = 'pending';
    subtask.progress = 0;
    subtask.lastUpdated = new Date();

    this.recordStateEvent(state, userId, 'subtask_assigned', {
      subtaskId: subtask.id,
      assignmentId,
      agentId: targetAgentId,
    });

    this.recomputeMetrics(state);

    return assignment;
  }

  retrySubtask(agentId: string, userId: string, subtaskId: string) {
    const state = this.ensureState(agentId);
    const subtask = this.getSubtask(state, subtaskId);

    subtask.status = 'in_progress';
    subtask.progress = 0.2;
    subtask.waitingOn = [];
    subtask.lastUpdated = new Date();

    const assignment: ManagerRuntimeAssignment = {
      id: this.createId('assign'),
      subtaskId,
      agentId: subtask.assignedAgentId || 'manager-runtime',
      assignedAt: new Date(),
      status: 'started',
      priority: subtask.priority || 'medium',
      taskTitle: subtask.title,
      taskObjective: subtask.objective,
      taskDependencies: subtask.dependencies || [],
      workloadEstimate: subtask.estimatedDuration || 60,
      source: 'retry',
    };

    state.assignments.push(assignment);
    this.recordStateEvent(state, userId, 'subtask_started', {
      subtaskId,
      retry: true,
    });

    this.recomputeMetrics(state);

    return assignment;
  }

  private ensureState(agentId: string): ManagerRuntimeState {
    if (!this.stateByAgent.has(agentId)) {
      this.stateByAgent.set(agentId, {
        agentId,
        masterTask: null,
        decomposition: null,
        executionPlan: null,
        subtasks: [],
        assignments: [],
        aggregatedResult: null,
        metrics: { ...DEFAULT_METRICS },
        waitingDependencies: [],
        statusHistory: [],
        paused: false,
        pauseReason: undefined,
        version: 1,
        lastUpdated: new Date(),
      });
    }

    return this.stateByAgent.get(agentId)!;
  }

  private createId(prefix: string) {
    this.sequence += 1;
    return `${prefix}-${Date.now()}-${this.sequence}`;
  }

  private normalizeManualSubtasks(
    masterTaskId: string,
    subtasks: ManagerDecompositionRequest['manualSubtasks'],
  ): SubTask[] {
    return (subtasks || []).map((subtask, index) => ({
      id: subtask.id || this.createId('subtask'),
      taskId: masterTaskId,
      title: subtask.title,
      description: subtask.description,
      objective: subtask.objective || subtask.description,
      requiredCapabilities: subtask.requiredCapabilities || [],
      dependencies: subtask.dependencies || [],
      priority: subtask.priority || 'medium',
      estimatedDuration: subtask.estimatedDuration || 45 + index * 15,
      retryPolicy: subtask.retryPolicy || { maxRetries: 2, backoffMs: 1000 },
      metadata: subtask.metadata || {},
    }));
  }

  private generateSubtasksFromDescription(
    masterTask: MasterTask,
    hints?: string[],
  ): SubTask[] {
    const sections = this.splitDescription(masterTask.description, hints);
    const subtasks: SubTask[] = [];

    sections.forEach((section, index) => {
      const subtaskId = this.createId('subtask');
      const dependency = index === 0 ? [] : [subtasks[index - 1].id];

      subtasks.push({
        id: subtaskId,
        taskId: masterTask.id,
        title: `Subtask ${index + 1}: ${section.title}`,
        description: section.text,
        objective: section.text,
        requiredCapabilities: section.tags,
        dependencies: dependency,
        priority: section.priority,
        estimatedDuration: 45 + index * 10,
        retryPolicy: { maxRetries: 2, backoffMs: 1000 },
        metadata: {
          derivedFrom: section.raw,
        },
      });
    });

    return subtasks;
  }

  private splitDescription(
    description: string,
    hints?: string[],
  ): DescriptionSection[] {
    const lines = description
      .split(/\n|\.|\-|\*/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const derivedHints = hints || [];

    const sections = lines.length
      ? lines
      : ['Research requirements', 'Design execution plan', 'Validate outputs'];

    return sections.slice(0, 8).map((raw, index) => ({
      id: this.createId('section'),
      title: raw.substring(0, 40) || `Phase ${index + 1}`,
      text: raw,
      raw,
      priority: (index === 0
        ? 'critical'
        : index < 2
          ? 'high'
          : 'medium') as DescriptionSection['priority'],
      tags: derivedHints,
    }));
  }

  private buildExecutionPlan(
    masterTask: MasterTask,
    subtasks: SubTask[],
    strategy: DecompositionStrategy,
  ): ExecutionPlan {
    return {
      planId: this.createId('plan'),
      taskId: masterTask.id,
      masterTask,
      subtasks,
      assignments: subtasks.map((subtask) => ({
        id: this.createId('assignment'),
        subtaskId: subtask.id,
        agentId: 'unassigned',
        assignedAt: new Date(),
        status: 'pending',
      })),
      strategy,
      estimatedDuration: subtasks.reduce(
        (sum, task) => sum + (task.estimatedDuration || 30),
        0,
      ),
      priority: masterTask.priority || 'medium',
    };
  }

  private bootstrapRuntimeSubtasks(
    subtasks: SubTask[],
    preferredAgents?: string[],
  ): ManagerRuntimeSubtask[] {
    return subtasks.map((subtask, index) => ({
      ...subtask,
      status: 'pending',
      assignedAgentId: preferredAgents?.[index] || null,
      progress: 0,
      waitingOn: [],
      lastUpdated: new Date(),
    }));
  }

  private bootstrapAssignments(
    subtasks: ManagerRuntimeSubtask[],
  ): ManagerRuntimeAssignment[] {
    return subtasks.map((subtask) => ({
      id: this.createId('assign'),
      subtaskId: subtask.id,
      agentId: subtask.assignedAgentId || 'manager-runtime',
      assignedAt: new Date(),
      status: 'pending',
      priority: subtask.priority || 'medium',
      taskTitle: subtask.title,
      taskObjective: subtask.objective,
      taskDependencies: subtask.dependencies || [],
      workloadEstimate: subtask.estimatedDuration || 60,
      source: 'manager',
    }));
  }

  private recomputeMetrics(state: ManagerRuntimeState) {
    const metrics: ManagerRuntimeMetrics = {
      totalSubtasks: state.subtasks.length,
      completed: state.subtasks.filter(
        (subtask) => subtask.status === 'completed',
      ).length,
      inProgress: state.subtasks.filter(
        (subtask) => subtask.status === 'in_progress',
      ).length,
      pending: state.subtasks.filter((subtask) => subtask.status === 'pending')
        .length,
      failed: state.subtasks.filter((subtask) => subtask.status === 'failed')
        .length,
      blocked: state.subtasks.filter((subtask) => subtask.status === 'blocked')
        .length,
      progressPercent: 0,
      avgConfidence: state.assignments.length
        ? state.assignments.reduce((sum, assignment) => {
            if (assignment.result?.confidence) {
              return sum + assignment.result.confidence;
            }
            return sum + 0.7;
          }, 0) / state.assignments.length
        : 0,
      totalAssignments: state.assignments.length,
    };

    metrics.progressPercent = metrics.totalSubtasks
      ? Math.round((metrics.completed / metrics.totalSubtasks) * 100)
      : 0;

    state.metrics = metrics;
  }

  private computeWaitingDependencies(
    subtasks: ManagerRuntimeSubtask[],
    assignments: ManagerRuntimeAssignment[],
  ): ManagerWaitingDependency[] {
    const completed = new Set(
      subtasks
        .filter((task) => task.status === 'completed')
        .map((task) => task.id),
    );

    const agentBySubtask = new Map(
      assignments.map((assignment) => [
        assignment.subtaskId,
        assignment.agentId,
      ]),
    );

    const waiting: ManagerWaitingDependency[] = [];

    subtasks.forEach((subtask) => {
      if (!subtask.dependencies?.length) {
        return;
      }

      const unresolved = subtask.dependencies.filter(
        (dep) => !completed.has(dep),
      );

      unresolved.forEach((dep) => {
        waiting.push({
          waitingAgentId: subtask.assignedAgentId || 'manager-runtime',
          waitingOnAgentId: agentBySubtask.get(dep) || 'unknown',
          taskId: subtask.taskId,
          dependencyReason: 'dependency_unresolved',
          subtaskId: subtask.id,
        });
      });
    });

    return waiting;
  }

  private recordStateEvent(
    state: ManagerRuntimeState,
    userId: string,
    type: ManagerStateUpdate['type'],
    details: Record<string, unknown>,
  ) {
    const timestamp = new Date();
    const lifecycleState = state.paused
      ? 'paused'
      : state.metrics.progressPercent >= 100
        ? 'complete'
        : 'running';

    state.statusHistory.push({
      type,
      timestamp,
      state: lifecycleState,
      agent_id: state.agentId,
      data: details,
    });

    this.agentEvents.emitEvent({
      type: 'agent.state_changed',
      agentId: state.agentId,
      userId,
      timestamp,
      data: {
        eventType: type,
        details,
        paused: state.paused,
        metrics: state.metrics,
      },
    });
  }

  private isSubtaskComplete(state: ManagerRuntimeState, subtaskId: string) {
    return state.subtasks.some(
      (subtask) => subtask.id === subtaskId && subtask.status === 'completed',
    );
  }

  private isExecutionComplete(state: ManagerRuntimeState) {
    return (
      state.subtasks.length > 0 &&
      state.subtasks.every((subtask) => subtask.status === 'completed')
    );
  }

  private getSubtask(state: ManagerRuntimeState, subtaskId: string) {
    const subtask = state.subtasks.find((item) => item.id === subtaskId);

    if (!subtask) {
      throw new BadRequestException(
        `Subtask '${subtaskId}' not found for agent '${state.agentId}'`,
      );
    }

    return subtask;
  }

  private synthesizeSubtaskResult(
    subtask: ManagerRuntimeSubtask,
    assignment: ManagerRuntimeAssignment,
  ): SubTaskResult {
    return {
      subtaskId: subtask.id,
      agentId: assignment.agentId,
      status: 'success',
      output: `Completed ${subtask.title}`,
      executionTime: 2000 + (subtask.estimatedDuration || 60) * 10,
      confidence: 0.75,
      metadata: {
        priority: subtask.priority,
        dependencies: subtask.dependencies,
      },
    };
  }
}
