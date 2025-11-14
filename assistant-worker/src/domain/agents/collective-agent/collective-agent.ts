/**
 * Collective Agent - Complete Multi-Agent Orchestration System
 *
 * Complete revamp with full infrastructure integration:
 * - Message-based A2A communication
 * - Task hierarchy management (8 levels)
 * - Artifact management and locking
 * - Deadlock detection and resolution
 * - PM agent orchestration
 * - Shared memory and context retrieval
 */

import { BaseAgent } from '../agent.base';
import { ExecutionContext, ExecutionResult } from '../../entities';
import { ILogger } from '../../ports/logger.port';
import { ILLMProvider } from '../../ports/llm-provider.port';
import { MessageQueueService } from '@application/services/collective/message-queue.service';
import { CommunicationService } from '@application/services/collective/communication.service';
import { SharedMemoryService } from '@application/services/collective/shared-memory.service';
import { ArtifactLockingService } from '@application/services/collective/artifact-locking.service';
import { TaskAssignmentService } from '@application/services/collective/task-assignment.service';
import { DeadlockDetectionService } from '@application/services/collective/deadlock-detection.service';
import { CoordinationValidatorService } from '@domain/services/coordination-validator.service';
import {
  CollectiveTask,
  TaskLevel,
  TaskState,
  createCollectiveTask,
} from '@domain/entities/collective-task.entity';
import {
  CollectiveArtifact,
  ArtifactType,
  createCollectiveArtifact,
} from '@domain/entities/collective-artifact.entity';
import {
  CollectiveMessage,
  MessagePriority,
  MessageType,
} from '@domain/entities/collective-message.entity';
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
  TaskQueueSnapshot,
  CollectiveStateSnapshot,
  WaitingDependency,
  DeadlockSnapshot,
} from './collective-agent.types';
import { DeadlockInfo } from '@domain/ports/deadlock-detection.port';

export interface CollectiveAgentConfig {
  collectiveId: string;
  maxSubAgents?: number;
  defaultStrategy?: TaskDistributionStrategy;
  temperature?: number;
  model?: string;
  enablePM?: boolean; // Enable PM agent
  deadlockCheckInterval?: number;
}

/**
 * Collective Agent - Complete multi-agent orchestration
 */
export class CollectiveAgent extends BaseAgent {
  private collectiveState: CollectiveAgentState;
  private tasks: Map<string, CollectiveTask> = new Map();
  private artifacts: Map<string, CollectiveArtifact> = new Map();
  private paused = false;
  private pauseReason: string | null = null;
  private pmLoopInterval?: NodeJS.Timeout;
  private deadlockCheckInterval?: NodeJS.Timeout;
  private collectiveId: string;
  private lastDetectedDeadlocks: DeadlockInfo[] = [];
  private lastDeadlockDetectedAt?: Date;

  constructor(
    llmProvider: ILLMProvider,
    logger: ILogger,
    private readonly messageQueue: MessageQueueService,
    private readonly communication: CommunicationService,
    private readonly sharedMemory: SharedMemoryService,
    private readonly artifactLocking: ArtifactLockingService,
    private readonly taskAssignment: TaskAssignmentService,
    private readonly deadlockDetection: DeadlockDetectionService,
    private readonly coordinationValidator: CoordinationValidatorService,
    private config: CollectiveAgentConfig,
  ) {
    super(llmProvider, logger);
    this.collectiveId = config.collectiveId;

    this.collectiveState = {
      subAgents: [],
      activeTasks: [],
      pendingAssignments: [],
      completedAssignments: [],
      subAgentStats: [],
      distributionStrategy:
        config.defaultStrategy || TaskDistributionStrategy.LOAD_BALANCED,
      aggregationMethod: AggregationMethod.CONSENSUS,
      coordinationPattern: CoordinationPattern.PARALLEL,
      conflicts: [],
      totalTasksProcessed: 0,
    };

    // Start PM loop if enabled
    if (config.enablePM !== false) {
      this.startPMLoop();
    }
  }

  /**
   * Get current collective state
   */
  getCollectiveState(): CollectiveAgentState {
    return { ...this.collectiveState };
  }

  getCollectiveId(): string {
    return this.collectiveId;
  }

  pause(reason?: string): void {
    const effectiveReason = reason ?? 'manual';

    if (!this.paused) {
      this.paused = true;
      this.pauseReason = effectiveReason;
      this.logger.info('Collective execution paused', {
        collectiveId: this.collectiveId,
        reason: effectiveReason,
      });
    } else if (reason) {
      this.pauseReason = effectiveReason;
    }
  }

  resume(): void {
    if (this.paused) {
      const previousReason = this.pauseReason;
      this.paused = false;
      this.pauseReason = null;
      this.lastDetectedDeadlocks = [];
      this.lastDeadlockDetectedAt = undefined;
      this.logger.info('Collective execution resumed', {
        collectiveId: this.collectiveId,
        previousReason,
      });
    }
  }

  isPaused(): boolean {
    return this.paused;
  }

  getTaskQueueSnapshot(): TaskQueueSnapshot {
    const tasks = Array.from(this.tasks.values());
    const stateCounts: Record<TaskState, number> = {
      [TaskState.UNASSIGNED]: 0,
      [TaskState.ASSIGNED]: 0,
      [TaskState.IN_PROGRESS]: 0,
      [TaskState.BLOCKED]: 0,
      [TaskState.DELEGATED]: 0,
      [TaskState.COMPLETED]: 0,
      [TaskState.FAILED]: 0,
      [TaskState.CANCELLED]: 0,
      [TaskState.REVIEW]: 0,
    };

    const levelCounts: Record<TaskLevel, number> = {
      [TaskLevel.VISION]: 0,
      [TaskLevel.PORTFOLIO]: 0,
      [TaskLevel.PROGRAM]: 0,
      [TaskLevel.EPIC]: 0,
      [TaskLevel.FEATURE]: 0,
      [TaskLevel.STORY]: 0,
      [TaskLevel.TASK]: 0,
      [TaskLevel.SUBTASK]: 0,
    };

    let priorityTotal = 0;
    let lastUpdated = tasks.length > 0 ? tasks[0].updatedAt : new Date(0);

    for (const task of tasks) {
      stateCounts[task.state] = (stateCounts[task.state] || 0) + 1;
      levelCounts[task.level] = (levelCounts[task.level] || 0) + 1;
      priorityTotal += task.priority || 0;
      if (task.updatedAt > lastUpdated) {
        lastUpdated = task.updatedAt;
      }
    }

    const backlogTasks = tasks.filter((task) =>
      [TaskState.UNASSIGNED, TaskState.BLOCKED].includes(task.state),
    );
    const inProgressTasks = tasks.filter(
      (task) => task.state === TaskState.IN_PROGRESS,
    );
    const completedTasks = tasks.filter(
      (task) => task.state === TaskState.COMPLETED,
    );

    const backlog = backlogTasks
      .sort((a, b) => {
        if (b.priority === a.priority) {
          return a.createdAt.getTime() - b.createdAt.getTime();
        }
        return b.priority - a.priority;
      })
      .slice(0, 25)
      .map((task) => ({
        taskId: task.id,
        title: task.title,
        priority: task.priority,
        state: task.state,
        blockedBy: [...task.blockedBy],
        assignedAgentId: task.assignedAgentId,
        level: task.level,
        createdAt: task.createdAt.toISOString(),
      }));

    const inProgress = inProgressTasks
      .sort((a, b) => {
        const aTime = a.startedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.startedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .slice(0, 20)
      .map((task) => ({
        taskId: task.id,
        title: task.title,
        assignedAgentId: task.assignedAgentId,
        startedAt: task.startedAt?.toISOString(),
        priority: task.priority,
      }));

    const recentCompletions = completedTasks
      .filter((task) => !!task.completedAt)
      .sort((a, b) =>
        (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0),
      )
      .slice(0, 10)
      .map((task) => ({
        taskId: task.id,
        title: task.title,
        completedAt: task.completedAt?.toISOString() || new Date().toISOString(),
        assignedAgentId: task.assignedAgentId,
      }));

    const totalTasks = tasks.length;
    const backlogCount = backlogTasks.length;
    const assignedTasks =
      (stateCounts[TaskState.ASSIGNED] || 0) +
      (stateCounts[TaskState.DELEGATED] || 0);

    return {
      collectiveId: this.collectiveId,
      totalTasks,
      backlogTasks: backlogCount,
      blockedTasks: stateCounts[TaskState.BLOCKED] || 0,
      assignedTasks,
      inProgressTasks: stateCounts[TaskState.IN_PROGRESS] || 0,
      completedTasks: stateCounts[TaskState.COMPLETED] || 0,
      failedTasks: stateCounts[TaskState.FAILED] || 0,
      reviewTasks: stateCounts[TaskState.REVIEW] || 0,
      averagePriority:
        totalTasks > 0 ? Number((priorityTotal / totalTasks).toFixed(2)) : 0,
      stateCounts,
      levelCounts,
      backlog,
      inProgress,
      recentCompletions,
      lastUpdated: (lastUpdated || new Date()).toISOString(),
    };
  }

  getStateSnapshot(): CollectiveStateSnapshot {
    return {
      collectiveId: this.collectiveId,
      subAgents: this.collectiveState.subAgents,
      activeTasks: this.getActiveCollectiveTasks(),
      pendingAssignments: this.collectiveState.pendingAssignments,
      completedAssignments: this.collectiveState.completedAssignments,
      conflicts: this.collectiveState.conflicts,
      totalTasksProcessed: this.collectiveState.totalTasksProcessed,
      waitingDependencies: this.collectWaitingDependencies(),
      deadlocks: this.formatDeadlocks(this.lastDetectedDeadlocks),
      isPaused: this.paused,
      deadlockDetectedAt: this.lastDeadlockDetectedAt
        ? this.lastDeadlockDetectedAt.toISOString()
        : null,
      pauseReason: this.pauseReason,
      lastUpdated: new Date().toISOString(),
    };
  }

  async assignTaskManually(
    taskId: string,
    agentId: string,
  ): Promise<TaskAssignment> {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found in collective ${this.collectiveId}`);
    }

    const subAgentExists = this.collectiveState.subAgents.some(
      (agent) => agent.agentId === agentId,
    );

    if (!subAgentExists) {
      throw new Error(
        `Agent ${agentId} is not registered in collective ${this.collectiveId}`,
      );
    }

    const previousAllowed = [...task.allowedAgentIds];
    const ensureAllowed = (): void => {
      if (!task.allowedAgentIds.includes(agentId)) {
        task.allowedAgentIds = [...task.allowedAgentIds, agentId];
      }
    };

    ensureAllowed();
    let assignedAgentId: string | null = null;

    try {
      assignedAgentId = await this.taskAssignment.assignTask(task, [agentId]);
    } finally {
      task.allowedAgentIds = previousAllowed;
    }

    if (!assignedAgentId) {
      throw new Error(
        `Unable to assign task ${taskId} to agent ${agentId}`,
      );
    }

    const now = new Date();
    task.assignedAgentId = assignedAgentId;
    task.state = TaskState.ASSIGNED;
    task.updatedAt = now;
    this.tasks.set(taskId, task);

    const assignment: TaskAssignment = {
      assignmentId: `manual_${now.getTime()}_${task.id}`,
      taskId: task.id,
      agentId: assignedAgentId,
      assignedAt: now,
      status: 'pending',
    };

    this.recordPendingAssignment(assignment);

    await this.communication.delegateTask(
      this.collectiveId,
      'pm_agent',
      assignedAgentId,
      task.description,
      {
        taskId: task.id,
        priority: this.getPriorityFromTask(task),
      },
    );

    return assignment;
  }

  completeTaskManually(taskId: string): CollectiveTask {
    const task = this.tasks.get(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found in collective ${this.collectiveId}`);
    }

    if (task.state === TaskState.COMPLETED) {
      return task;
    }

    if (task.assignedAgentId) {
      this.taskAssignment.releaseTask(task.assignedAgentId);
    }

    task.state = TaskState.COMPLETED;
    task.completedAt = new Date();
    task.updatedAt = new Date();
    this.tasks.set(taskId, task);

    this.markAssignmentCompleted(task.id);
    this.collectiveState = {
      ...this.collectiveState,
      totalTasksProcessed: this.collectiveState.totalTasksProcessed + 1,
    };

    return task;
  }

  getWaitingDependencies(): WaitingDependency[] {
    return this.collectWaitingDependencies();
  }

  private getActiveCollectiveTasks(): CollectiveTask[] {
    const activeStates = new Set<TaskState>([
      TaskState.UNASSIGNED,
      TaskState.ASSIGNED,
      TaskState.IN_PROGRESS,
      TaskState.BLOCKED,
      TaskState.DELEGATED,
      TaskState.REVIEW,
    ]);

    return Array.from(this.tasks.values()).filter((task) =>
      activeStates.has(task.state),
    );
  }

  private collectWaitingDependencies(): WaitingDependency[] {
    const dependencies: WaitingDependency[] = [];

    for (const task of this.tasks.values()) {
      if (!task.blockedBy?.length) {
        continue;
      }

      const waitingAgentId = task.assignedAgentId ?? null;

      for (const dependencyId of task.blockedBy) {
        const dependencyTask = this.tasks.get(dependencyId);
        dependencies.push({
          waitingAgentId,
          waitingOnAgentId: dependencyTask?.assignedAgentId ?? 'unassigned',
          taskId: task.id,
          dependencyReason: dependencyTask
            ? `Waiting on ${dependencyTask.title} (${dependencyTask.id})`
            : `Waiting on task ${dependencyId}`,
        });
      }
    }

    return dependencies;
  }

  private recordPendingAssignment(assignment: TaskAssignment): void {
    this.collectiveState = {
      ...this.collectiveState,
      pendingAssignments: [
        ...this.collectiveState.pendingAssignments,
        assignment,
      ],
    };
  }

  private markAssignmentCompleted(taskId: string): void {
    const pending = this.collectiveState.pendingAssignments;
    const index = pending.findIndex((assignment) => assignment.taskId === taskId);
    if (index === -1) {
      return;
    }

    const completedAssignment: TaskAssignment = {
      ...pending[index],
      status: 'completed',
      completedAt: new Date(),
    };

    this.collectiveState = {
      ...this.collectiveState,
      pendingAssignments: pending.filter((_, idx) => idx !== index),
      completedAssignments: [
        ...this.collectiveState.completedAssignments,
        completedAssignment,
      ],
    };
  }

  /**
   * Register a sub-agent in the collective
   */
  async registerSubAgent(subAgent: SubAgentRef): Promise<void> {
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

    // Register agent capabilities with task assignment service
    this.taskAssignment.registerAgent(subAgent.agentId, {
      agentId: subAgent.agentId,
      agentType: subAgent.type,
      currentLoad: 0,
      capabilities: [...subAgent.specialties],
      availability: subAgent.isActive,
    });

    this.logger.info('Registered sub-agent', {
      agentId: subAgent.agentId,
      type: subAgent.type,
      collectiveId: this.collectiveId,
    });
  }

  /**
   * Main execution method - implements BaseAgent.run()
   */
  protected async run(
    input: string,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    try {
      this.context = context;
      this.logger.info('CollectiveAgent: Starting coordination', {
        input,
        subAgents: this.collectiveState.subAgents.length,
        strategy: this.collectiveState.distributionStrategy,
        collectiveId: this.collectiveId,
      });

      // Create root task (Vision level)
      const rootTask = createCollectiveTask(
        this.collectiveId,
        'Root Task',
        input,
        TaskLevel.VISION,
        {
          priority: 100,
        },
      );
      this.tasks.set(rootTask.id, rootTask);
      this.sharedMemory.storeTask(rootTask);

      // Decompose task into 8-level hierarchy
      const taskHierarchy = await this.decomposeTaskHierarchy(rootTask, input);

      // Detect and handle deadlocks
      await this.checkAndResolveDeadlocks();

      // Distribute tasks to sub-agents
      const assignments =
        await this.distributeTasksIntelligently(taskHierarchy);

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
        totalTasksProcessed:
          this.collectiveState.totalTasksProcessed + taskHierarchy.length,
      };

      return {
        status: 'success',
        output: String(aggregated.finalResult),
        metadata: {
          subtasks: taskHierarchy.length,
          subAgents: this.collectiveState.subAgents.length,
          strategy: this.collectiveState.distributionStrategy,
          pattern: this.collectiveState.coordinationPattern,
          collectiveId: this.collectiveId,
        },
      };
    } catch (error) {
      this.logger.error(
        'CollectiveAgent: Coordination failed',
        error as Record<string, unknown>,
      );
      return {
        status: 'error',
        output: `Coordination failed: ${error instanceof Error ? error.message : String(error)}`,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Decompose task into 8-level hierarchy (Vision → Subtask)
   */
  private async decomposeTaskHierarchy(
    rootTask: CollectiveTask,
    input: string,
  ): Promise<CollectiveTask[]> {
    const hierarchy: CollectiveTask[] = [rootTask];

    // Use LLM to decompose into hierarchical structure
    const response = await this.llmProvider.complete({
      model: this.config.model || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a project management expert. Break down tasks into an 8-level hierarchy:
Level 0: Vision (overall goal)
Level 1: Portfolio (major initiatives)
Level 2: Program (programs within portfolio)
Level 3: Epic (large features)
Level 4: Feature (features within epic)
Level 5: Story (user stories)
Level 6: Task (specific tasks)
Level 7: Subtask (subtasks within task)

Return a JSON array of tasks with: level (0-7), title, description, dependencies (array of task indices), priority (0-100).`,
        },
        {
          role: 'user',
          content: `Decompose this task: ${input}`,
        },
      ],
      temperature: this.config.temperature || 0.5,
      maxTokens: 2000,
    });

    // Parse hierarchy from response
    try {
      const parsed = JSON.parse(response.content);
      const tasks = Array.isArray(parsed) ? parsed : parsed.tasks || [];

      for (const taskData of tasks) {
        const task = createCollectiveTask(
          this.collectiveId,
          taskData.title || taskData.name || 'Untitled Task',
          taskData.description || taskData.desc || '',
          (taskData.level || 6) as TaskLevel,
          {
            parentTaskId:
              taskData.parentIndex !== undefined
                ? hierarchy[taskData.parentIndex]?.id
                : rootTask.id,
            dependencies: taskData.dependencies
              ? taskData.dependencies
                  .map((idx: number) => hierarchy[idx]?.id)
                  .filter(Boolean)
              : [],
            priority: taskData.priority || 50,
          },
        );

        hierarchy.push(task);
        this.tasks.set(task.id, task);
        this.sharedMemory.storeTask(task);
      }
    } catch (error) {
      this.logger.warn(
        'Failed to parse task hierarchy, using simple decomposition',
        {
          error:
            error instanceof Error ? error.message : JSON.stringify(error),
        },
      );
      // Fallback to simple decomposition
      const simpleTasks = await this.decomposeTask(input);
      for (const simpleTask of simpleTasks) {
        const task = createCollectiveTask(
          this.collectiveId,
          simpleTask.description,
          simpleTask.description,
          TaskLevel.TASK,
          {
            parentTaskId: rootTask.id,
            priority: 50,
          },
        );
        hierarchy.push(task);
        this.tasks.set(task.id, task);
        this.sharedMemory.storeTask(task);
      }
    }

    return hierarchy;
  }

  /**
   * Distribute tasks intelligently using TaskAssignmentService
   */
  private async distributeTasksIntelligently(
    tasks: CollectiveTask[],
  ): Promise<TaskAssignment[]> {
    if (this.paused) {
      this.logger.debug('Skipping task distribution while paused', {
        collectiveId: this.collectiveId,
      });
      return [];
    }

    const assignments: TaskAssignment[] = [];
    const availableAgents = this.collectiveState.subAgents
      .filter((sa) => sa.isActive)
      .map((sa) => sa.agentId);

    if (availableAgents.length === 0) {
      throw new Error('No active sub-agents available');
    }

    // Sort tasks by priority (highest first)
    const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority);

    for (const task of sortedTasks) {
      // Skip if already assigned or has unmet dependencies
      if (task.assignedAgentId || task.state !== TaskState.UNASSIGNED) {
        continue;
      }

      // Check dependencies
      const canExecute = task.dependencies.every((depId) => {
        const depTask = this.tasks.get(depId);
        return depTask?.state === TaskState.COMPLETED;
      });

      if (!canExecute) {
        task.state = TaskState.BLOCKED;
        task.blockedBy = task.dependencies.filter((depId) => {
          const depTask = this.tasks.get(depId);
          return depTask?.state !== TaskState.COMPLETED;
        });
        this.tasks.set(task.id, task);
        continue;
      }

      // Assign using TaskAssignmentService
      const assignedAgentId = await this.taskAssignment.assignTask(
        task,
        availableAgents,
      );

      if (assignedAgentId) {
        task.assignedAgentId = assignedAgentId;
        task.state = TaskState.ASSIGNED;
        this.tasks.set(task.id, task);

        const assignment: TaskAssignment = {
          assignmentId: `assignment_${Date.now()}_${assignments.length}`,
          taskId: task.id,
          agentId: assignedAgentId,
          assignedAt: new Date(),
          status: 'pending',
        };

        assignments.push(assignment);
        this.recordPendingAssignment(assignment);

        // Send task assignment message to agent
        await this.communication.delegateTask(
          this.collectiveId,
          'pm_agent',
          assignedAgentId,
          task.description,
          {
            taskId: task.id,
            priority: this.getPriorityFromTask(task),
          },
        );
      }
    }

    return assignments;
  }

  /**
   * Check and resolve deadlocks
   */
  private async checkAndResolveDeadlocks(): Promise<void> {
    if (this.paused && this.pauseReason !== 'deadlock') {
      this.logger.debug('Skipping deadlock detection while manually paused', {
        collectiveId: this.collectiveId,
        reason: this.pauseReason,
      });
      return;
    }

    const tasks = Array.from(this.tasks.values());
    const deadlocks = await this.deadlockDetection.detectDeadlocks(tasks);

    if (deadlocks.length === 0) {
      this.lastDetectedDeadlocks = [];
      this.lastDeadlockDetectedAt = undefined;
      return;
    }

    this.handleDeadlockDetection(deadlocks);
    this.logger.warn(`Detected ${deadlocks.length} deadlocks`, {});

    for (const deadlock of deadlocks) {
      // Resolve by escalating to PM or breaking cycle
      if (deadlock.severity === 'high') {
        // Escalate to PM agent
        await this.communication.askPM(
          this.collectiveId,
          'pm_agent',
          `Deadlock detected: ${deadlock.cycle.join(' → ')}. Please resolve.`,
          {
            metadata: { deadlock: deadlock.cycle },
          },
        );
      } else {
        // Auto-resolve by breaking lowest priority task dependency
        this.breakDeadlockCycle(deadlock.cycle);
      }
    }
  }

  /**
   * Break deadlock cycle by removing lowest priority dependency
   */
  private breakDeadlockCycle(cycle: string[]): void {
    if (cycle.length === 0) return;

    // Find task with lowest priority
    const cycleTasks = cycle
      .map((id) => this.tasks.get(id))
      .filter((t): t is CollectiveTask => t !== undefined);

    if (cycleTasks.length === 0) return;

    const lowestPriorityTask = cycleTasks.reduce((lowest, current) =>
      current.priority < lowest.priority ? current : lowest,
    );

    // Remove one dependency to break cycle
    if (lowestPriorityTask.dependencies.length > 0) {
      const removedDep = lowestPriorityTask.dependencies[0];
      lowestPriorityTask.dependencies = lowestPriorityTask.dependencies.filter(
        (d) => d !== removedDep,
      );
      lowestPriorityTask.blockedBy = lowestPriorityTask.blockedBy.filter(
        (b) => b !== removedDep,
      );

      if (lowestPriorityTask.blockedBy.length === 0) {
        lowestPriorityTask.state = TaskState.UNASSIGNED;
      }

      this.tasks.set(lowestPriorityTask.id, lowestPriorityTask);
      this.logger.info(
        `Broke deadlock by removing dependency from task ${lowestPriorityTask.id}`,
        {},
      );
    }
  }

  private handleDeadlockDetection(deadlocks: DeadlockInfo[]): void {
    this.lastDetectedDeadlocks = deadlocks;
    this.lastDeadlockDetectedAt = new Date();
    this.pause('deadlock');
  }

  private formatDeadlocks(deadlocks: DeadlockInfo[]): DeadlockSnapshot[] {
    return deadlocks.map((info) => ({
      id: info.id,
      cycle: [...info.cycle],
      involvedAgents: [...info.involvedAgents],
      detectedAt: info.detectedAt.toISOString(),
      severity: info.severity,
    }));
  }

  /**
   * Start PM main loop (processes messages, assigns tasks, monitors)
   */
  private startPMLoop(): void {
    this.pmLoopInterval = setInterval(() => {
      this.runPMMainLoop().catch((error) => {
        this.logger.error('PM loop error', error as Record<string, unknown>);
      });
    }, 1000); // Run every second

    // Start deadlock check interval
    this.deadlockCheckInterval = setInterval(() => {
      this.checkAndResolveDeadlocks().catch((error) => {
        this.logger.error(
          'Deadlock check error',
          error as Record<string, unknown>,
        );
      });
    }, this.config.deadlockCheckInterval || 30000);
  }

  /**
   * PM main loop - processes messages and assigns tasks
   */
  private async runPMMainLoop(): Promise<void> {
    if (this.paused) {
      this.logger.debug('PM loop skipped because collective is paused', {
        collectiveId: this.collectiveId,
      });
      return;
    }

    // Process high-priority messages first
    const criticalMessage = await this.messageQueue.getNextMessage('pm_agent');
    if (criticalMessage) {
      await this.handlePMessage(criticalMessage);
      await this.messageQueue.markDelivered(criticalMessage.id);
    }

    // Assign pending tasks to available agents
    const unassignedTasks = Array.from(this.tasks.values()).filter(
      (t) => t.state === TaskState.UNASSIGNED,
    );

    if (unassignedTasks.length > 0) {
      await this.distributeTasksIntelligently(unassignedTasks);
    }

    // Process normal-priority messages
    const normalMessage = await this.messageQueue.getNextMessage('pm_agent');
    if (normalMessage && normalMessage.priority !== MessagePriority.CRITICAL) {
      await this.handlePMessage(normalMessage);
      await this.messageQueue.markDelivered(normalMessage.id);
    }
  }

  /**
   * Handle message for PM agent
   */
  private async handlePMessage(message: CollectiveMessage): Promise<void> {
    switch (message.type) {
      case MessageType.HELP_REQUEST:
        // Agent asking for help - provide guidance
        await this.handleHelpRequest(message);
        break;
      case MessageType.STATUS_UPDATE:
        // Agent status update - update task state
        await this.handleStatusUpdate(message);
        break;
      case MessageType.RESULT:
        // Task result - update task and artifacts
        await this.handleTaskResult(message);
        break;
      default:
        this.logger.debug(`PM received message type: ${message.type}`, {});
    }
  }

  /**
   * Handle help request from agent
   */
  private async handleHelpRequest(message: CollectiveMessage): Promise<void> {
    const taskId = message.taskId;
    if (!taskId) return;

    const task = this.tasks.get(taskId);
    if (!task) return;

    // Provide guidance via communication service
    await this.communication.pmDirective(
      this.collectiveId,
      message.sourceAgentId,
      `Guidance for task ${taskId}: Review related artifacts and context.`,
      {
        taskId,
      },
    );
  }

  /**
   * Handle status update from agent
   */
  private async handleStatusUpdate(message: CollectiveMessage): Promise<void> {
    const taskId = message.taskId;
    if (!taskId) return;

    const task = this.tasks.get(taskId);
    if (!task) return;

    // Update task state based on message content
    if (message.content.includes('started')) {
      task.state = TaskState.IN_PROGRESS;
      task.startedAt = new Date();
    } else if (message.content.includes('blocked')) {
      task.state = TaskState.BLOCKED;
    }

    this.tasks.set(task.id, task);
  }

  /**
   * Handle task result from agent
   */
  private async handleTaskResult(message: CollectiveMessage): Promise<void> {
    const taskId = message.taskId;
    if (!taskId) return;

    const task = this.tasks.get(taskId);
    if (!task || !task.assignedAgentId) return;

    // Mark task as completed
    task.state = TaskState.COMPLETED;
    task.completedAt = new Date();
    this.tasks.set(task.id, task);

    // Create artifact from result
    const artifact = createCollectiveArtifact(
      this.collectiveId,
      taskId,
      `Result for ${task.title}`,
      message.content,
      task.assignedAgentId,
      {
        type: ArtifactType.OTHER,
        description: `Result from task: ${task.title}`,
      },
    );

    await this.sharedMemory.createArtifact(artifact);
    this.artifacts.set(artifact.id, artifact);

    // Release agent load
    this.taskAssignment.releaseTask(task.assignedAgentId);

  this.markAssignmentCompleted(task.id);

    // Update stats
    const stats = this.collectiveState.subAgentStats.find(
      (s) => s.agentId === task.assignedAgentId,
    );
    if (stats) {
      const newStats: SubAgentStats = {
        ...stats,
        tasksCompleted: stats.tasksCompleted + 1,
        successRate:
          (stats.tasksCompleted + 1) /
          (stats.tasksCompleted + stats.tasksFailed + 1),
        lastTaskAt: new Date(),
      };
      this.collectiveState = {
        ...this.collectiveState,
        subAgentStats: this.collectiveState.subAgentStats.map((s) =>
          s.agentId === task.assignedAgentId ? newStats : s,
        ),
      };
    }

    // Unblock dependent tasks
    for (const dependentTask of this.tasks.values()) {
      if (dependentTask.dependencies.includes(taskId)) {
        dependentTask.blockedBy = dependentTask.blockedBy.filter(
          (b) => b !== taskId,
        );
        if (dependentTask.blockedBy.length === 0) {
          dependentTask.state = TaskState.UNASSIGNED;
        }
        this.tasks.set(dependentTask.id, dependentTask);
      }
    }
  }

  /**
   * Execute tasks sequentially
   */
  private async executeSequential(
    assignments: TaskAssignment[],
  ): Promise<SubAgentResult[]> {
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
  private async executeParallel(
    assignments: TaskAssignment[],
  ): Promise<SubAgentResult[]> {
    const promises = assignments.map((assignment) =>
      this.executeTask(assignment),
    );
    return Promise.all(promises);
  }

  /**
   * Execute a single task (simplified - in real implementation would delegate to agent)
   */
  private async executeTask(
    assignment: TaskAssignment,
  ): Promise<SubAgentResult> {
    const startTime = Date.now();
    const task = this.tasks.get(assignment.taskId);

    if (!task) {
      throw new Error(`Task ${assignment.taskId} not found`);
    }

    try {
      // Get task context from shared memory
      const context = await this.sharedMemory.getTaskContext(
        this.collectiveId,
        task.id,
      );
      this.logger.debug('Task context loaded for execution', {
        taskId: task.id,
        relatedArtifacts: context.relatedArtifacts.length,
        childTasks: context.childTasks.length,
      });

      // Simulate task execution (in real implementation, delegate to agent)
      // For now, we'll use LLM to simulate agent execution
      const response = await this.llmProvider.complete({
        model: this.config.model || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are executing task: ${task.title}\nDescription: ${task.description}`,
          },
          {
            role: 'user',
            content: `Execute this task with context from related artifacts.`,
          },
        ],
        temperature: 0.7,
        maxTokens: 500,
      });

      const executionTime = Date.now() - startTime;

      // Send result via communication service
      await this.communication.sendResult(
        this.collectiveId,
        assignment.agentId,
        response.content,
        {
          taskId: task.id,
        },
      );

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

    // Aggregate based on method
    let finalResult: string;
    switch (this.collectiveState.aggregationMethod) {
      case AggregationMethod.CONSENSUS:
        // Use LLM to synthesize consensus
        finalResult = successfulResults
          .map((r) => String(r.output))
          .join('\n\n');
        break;
      case AggregationMethod.ALL_RESULTS:
        finalResult = successfulResults
          .map((r, idx) => `${idx + 1}. ${String(r.output)}`)
          .join('\n\n');
        break;
      default:
        finalResult = successfulResults
          .map((r) => String(r.output))
          .join('\n\n');
    }

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

  /**
   * Decompose task (fallback method)
   */
  private async decomposeTask(input: string): Promise<Task[]> {
    const response = await this.llmProvider.complete({
      model: this.config.model || 'gpt-4',
      messages: [
        {
          role: 'system',
          content:
            'You are a task decomposition expert. Break down complex tasks into smaller subtasks.',
        },
        {
          role: 'user',
          content: `Decompose this task into 3-5 subtasks:\n${input}`,
        },
      ],
      temperature: this.config.temperature || 0.5,
      maxTokens: 500,
    });

    const subtaskLines = response.content
      .split('\n')
      .filter(
        (line: string) =>
          line.trim().length > 0 && (line.match(/^\d+\./) || line.match(/^-/)),
      )
      .slice(0, 5);

    return subtaskLines.map((line: string, idx: number) => ({
      taskId: `task_${idx}`,
      description: line
        .replace(/^\d+\.\s*/, '')
        .replace(/^-\s*/, '')
        .trim(),
      input: line,
      priority: 'medium' as const,
      timeout: 30000,
      createdAt: new Date(),
    }));
  }

  /**
   * Convert task priority to message priority
   */
  private getPriorityFromTask(task: CollectiveTask): MessagePriority {
    if (task.priority >= 80) return MessagePriority.HIGH;
    if (task.priority >= 60) return MessagePriority.NORMAL;
    if (task.priority >= 40) return MessagePriority.LOW;
    return MessagePriority.BACKGROUND;
  }

  /**
   * Streaming execution - implements BaseAgent.runStream()
   */
  protected async *runStream(
    input: string,
    context: ExecutionContext,
  ): AsyncGenerator<string> {
    yield `🤝 Collective Agent: Starting coordination for "${input}"\n\n`;

    try {
      // Execute the main run method and stream progress
      const result = await this.run(input, context);

      // Stream the result
      if (result.output) {
        const outputStr = String(result.output);
        const chunkSize = 50;
        for (let i = 0; i < outputStr.length; i += chunkSize) {
          yield outputStr.substring(i, i + chunkSize);
        }
      }

      yield `\n\n✅ Collective Agent: Coordination complete\n`;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      yield `\n\n❌ Collective Agent: Error - ${errorMsg}\n`;
      throw error;
    }
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    if (this.pmLoopInterval) {
      clearInterval(this.pmLoopInterval);
    }
    if (this.deadlockCheckInterval) {
      clearInterval(this.deadlockCheckInterval);
    }
  }
}
