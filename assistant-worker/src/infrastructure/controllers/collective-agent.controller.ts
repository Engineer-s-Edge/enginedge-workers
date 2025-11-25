/**
 * Collective Agent Controller
 *
 * Specialized endpoints for Collective (multi-agent orchestration) agents.
 * Handles PM-style task decomposition and coordination.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
  BadRequestException,
  NotFoundException,
  Patch,
  Delete,
  Sse,
} from '@nestjs/common';
import { AgentService } from '@application/services/agent.service';
import { ExecuteAgentUseCase } from '@application/use-cases/execute-agent.use-case';
import { CollectiveAgent } from '@domain/agents/collective-agent/collective-agent';
import {
  SubAgentRef,
  SubAgentType,
  CollectiveStateSnapshot,
  CollectiveProgressMetrics,
} from '@domain/agents/collective-agent/collective-agent.types';
import { MessageQueueService } from '@application/services/collective/message-queue.service';
import { TaskAssignmentService } from '@application/services/collective/task-assignment.service';
import {
  SharedMemoryService,
  CollectiveArtifactEvent,
} from '@application/services/collective/shared-memory.service';
import {
  createCollectiveArtifact,
  ArtifactType,
  LockType,
  CollectiveArtifact,
} from '@domain/entities/collective-artifact.entity';
import {
  CollectiveTask,
  TaskLevel,
  TaskState,
} from '@domain/entities/collective-task.entity';
import {
  CollectiveMessage,
  MessagePriority,
  MessageType,
} from '@domain/entities/collective-message.entity';
import { AgentType } from '@domain/enums/agent-type.enum';
import { Observable, from } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

interface TaskHierarchyNode {
  task: Record<string, unknown>;
  depth: number;
  children: TaskHierarchyNode[];
  truncated: boolean;
}

/**
 * Collective Agent specialized controller
 */
@Controller('agents/collective')
export class CollectiveAgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    private readonly messageQueue: MessageQueueService,
    private readonly taskAssignment: TaskAssignmentService,
    private readonly sharedMemory: SharedMemoryService,
    @Inject('ILogger')
    private readonly logger: Logger,
  ) {}

  /**
   * POST /agents/collective/create - Create Collective orchestration agent
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createCollectiveAgent(
    @Body()
    body: {
      name: string;
      userId: string;
      maxAgents?: number;
      coordinationStrategy?: 'sequential' | 'parallel' | 'hierarchical';
    },
  ) {
    this.logger.info('Creating Collective agent', { name: body.name });

    const config = {
      maxAgents: body.maxAgents || 10,
      coordinationStrategy: body.coordinationStrategy || 'hierarchical',
    };

    const agent = await this.agentService.createAgent(
      { name: body.name, agentType: 'collective', config },
      body.userId,
    );

    return {
      id: agent.id,
      name: body.name,
      type: 'collective',
      config,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * POST /agents/collective/:id/orchestrate - Orchestrate multi-agent task
   */
  @Post(':id/orchestrate')
  @HttpCode(HttpStatus.OK)
  async orchestrateTask(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      task: string;
      subAgents?: string[];
    },
  ) {
    this.logger.info('Orchestrating task', { agentId });

    const result = await this.executeAgentUseCase.execute({
      agentId,
      userId: body.userId,
      input: body.task,
      context: {
        subAgents: body.subAgents,
      },
    });

    return result;
  }

  /**
   * GET /agents/collective/:id/sub-agents - Get sub-agent status
   */
  @Get(':id/sub-agents')
  async getSubAgents(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting sub-agents', { agentId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const state = instance.getCollectiveState();
    const statsByAgent = new Map(
      state.subAgentStats.map((stat) => [stat.agentId, stat]),
    );

    const subAgents = state.subAgents.map((subAgent) => {
      const stats = statsByAgent.get(subAgent.agentId);
      const queueMetrics = this.messageQueue.getAgentQueueMetrics(
        subAgent.agentId,
      );
      const assignedTasks = this.taskAssignment.getAgentLoad(subAgent.agentId);

      return {
        agentId: subAgent.agentId,
        name: subAgent.name,
        type: subAgent.type,
        role: this.mapSubAgentTypeToRole(subAgent.type),
        status: subAgent.isActive ? 'active' : 'inactive',
        createdAt: subAgent.createdAt.toISOString(),
        specialties: subAgent.specialties,
        loadFactor: subAgent.loadFactor,
        successRate: subAgent.successRate,
        capabilities: subAgent.specialties,
        assignedTasks,
        stats: {
          tasksCompleted: stats?.tasksCompleted ?? 0,
          tasksFailed: stats?.tasksFailed ?? 0,
          averageExecutionTime: stats?.averageExecutionTime ?? 0,
          lastTaskAt: stats?.lastTaskAt?.toISOString() ?? null,
          totalLoadHandled: stats?.totalLoadHandled ?? 0,
        },
        queue: {
          total: queueMetrics.total,
          pending: queueMetrics.pending,
          inProgress: queueMetrics.inProgress,
          failed: queueMetrics.failed,
          expired: queueMetrics.expired,
          nextMessage: queueMetrics.nextMessage
            ? {
                ...queueMetrics.nextMessage,
                createdAt: queueMetrics.nextMessage.createdAt.toISOString(),
              }
            : null,
          oldestMessageCreatedAt:
            queueMetrics.oldestMessageCreatedAt?.toISOString() ?? null,
        },
      };
    });

    const activeCount = subAgents.filter(
      (agent) => agent.status === 'active',
    ).length;

    return {
      agentId,
      total: subAgents.length,
      active: activeCount,
      inactive: subAgents.length - activeCount,
      distributionStrategy: state.distributionStrategy,
      coordinationPattern: state.coordinationPattern,
      subAgents,
    };
  }

  private mapSubAgentTypeToRole(type: SubAgentType): string {
    switch (type) {
      case SubAgentType.REACT:
        return 'Reasoning Agent';
      case SubAgentType.GRAPH:
        return 'Workflow Agent';
      case SubAgentType.EXPERT:
        return 'Expert Analyst';
      case SubAgentType.GENIUS:
        return 'Learning Orchestrator';
      default:
        return 'Agent';
    }
  }

  private mapAgentTypeToSubAgentType(
    agentType: (typeof AgentType)[keyof typeof AgentType],
  ): SubAgentType {
    switch (agentType) {
      case AgentType.GRAPH:
        return SubAgentType.GRAPH;
      case AgentType.EXPERT:
        return SubAgentType.EXPERT;
      case AgentType.GENIUS:
        return SubAgentType.GENIUS;
      default:
        return SubAgentType.REACT;
    }
  }

  private parseTags(raw: string): string[] {
    return raw
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  private serializeArtifact(artifact: CollectiveArtifact) {
    return {
      id: artifact.id,
      taskId: artifact.taskId,
      name: artifact.name,
      type: artifact.type,
      description: artifact.description,
      content: artifact.content,
      version: artifact.version,
      createdBy: artifact.createdBy,
      tags: artifact.tags,
      metadata: artifact.metadata,
      createdAt: artifact.createdAt.toISOString(),
      updatedAt: artifact.updatedAt.toISOString(),
    };
  }

  private parseLockType(raw?: string | LockType): LockType {
    if (!raw) {
      return LockType.WRITE;
    }

    if (typeof raw === 'string') {
      const normalized = raw.toUpperCase();
      return normalized === LockType.READ ? LockType.READ : LockType.WRITE;
    }

    return raw === LockType.READ ? LockType.READ : LockType.WRITE;
  }

  private parseMessagePriority(
    raw?: string | MessagePriority,
  ): MessagePriority {
    if (!raw) {
      return MessagePriority.NORMAL;
    }

    if (typeof raw !== 'string') {
      return raw;
    }

    switch (raw.toLowerCase()) {
      case 'critical':
        return MessagePriority.CRITICAL;
      case 'high':
        return MessagePriority.HIGH;
      case 'low':
        return MessagePriority.LOW;
      case 'background':
        return MessagePriority.BACKGROUND;
      default:
        return MessagePriority.NORMAL;
    }
  }

  private parseMessageType(raw?: string | MessageType): MessageType {
    if (!raw) {
      return MessageType.INFO_REQUEST;
    }

    if (typeof raw !== 'string') {
      return raw;
    }

    const normalized = raw.toLowerCase();
    const mapping: Record<string, MessageType> = {
      delegation: MessageType.DELEGATION,
      help_request: MessageType.HELP_REQUEST,
      'help-request': MessageType.HELP_REQUEST,
      help: MessageType.HELP_REQUEST,
      info: MessageType.INFO_REQUEST,
      info_request: MessageType.INFO_REQUEST,
      pm_directive: MessageType.PM_DIRECTIVE,
      directive: MessageType.PM_DIRECTIVE,
      status: MessageType.STATUS_UPDATE,
      result: MessageType.RESULT,
      human: MessageType.HUMAN_MESSAGE,
      broadcast: MessageType.BROADCAST,
    };

    return mapping[normalized] ?? MessageType.INFO_REQUEST;
  }

  private formatArtifactLock(lock: {
    agentId: string;
    lockType: LockType;
    acquiredAt: Date;
    expiresAt: Date;
  }) {
    return {
      lockedBy: lock.agentId,
      lockType: lock.lockType,
      acquiredAt: lock.acquiredAt.toISOString(),
      expiresAt: lock.expiresAt.toISOString(),
    };
  }

  private formatTaskSummary(task?: CollectiveTask | null) {
    if (!task) {
      return null;
    }

    return {
      taskId: task.id,
      title: task.title,
      description: task.description,
      level: task.level,
      state: task.state,
      assignedAgentId: task.assignedAgentId ?? null,
      parentTaskId: task.parentTaskId ?? null,
      dependencies: task.dependencies,
      blockedBy: task.blockedBy,
      priority: task.priority ?? null,
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private ensureSubAgentRegistered(
    instance: CollectiveAgent,
    targetAgentId: string,
    collectiveId: string,
  ): void {
    const state = instance.getCollectiveState();
    const exists = state.subAgents.some(
      (agent) => agent.agentId === targetAgentId,
    );

    if (!exists) {
      throw new BadRequestException(
        `Sub-agent '${targetAgentId}' is not part of collective '${collectiveId}'`,
      );
    }
  }

  private buildAgentQueueSnapshot(targetAgentId: string) {
    const queueMetrics = this.messageQueue.getAgentQueueMetrics(targetAgentId);
    const queue = this.messageQueue.getAgentQueue(targetAgentId);

    return {
      queueMetrics,
      messages: queue.map((message) => this.formatQueueMessage(message)),
    };
  }

  private formatQueueMessage(message: CollectiveMessage) {
    const task = message.taskId
      ? this.sharedMemory.getTask(message.taskId)
      : null;

    return {
      id: message.id,
      sourceAgentId: message.sourceAgentId,
      targetAgentId: message.targetAgentId,
      priority: message.priority,
      type: message.type,
      status: message.status,
      content: message.content,
      conversationId: message.conversationId ?? null,
      taskId: message.taskId ?? null,
      retries: message.retryCount,
      metadata: message.metadata ?? null,
      createdAt: message.createdAt.toISOString(),
      expiresAt: message.expiresAt?.toISOString() ?? null,
      taskSummary: this.formatTaskSummary(task),
    };
  }

  private normalizeTargetAgentId(targetAgentId: string): string {
    return targetAgentId === 'pm' ? 'pm_agent' : targetAgentId;
  }

  /**
   * POST /agents/collective/:id/sub-agents/add - Add sub-agent
   */
  @Post(':id/sub-agents/add')
  @HttpCode(HttpStatus.CREATED)
  async addSubAgent(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      subAgentId: string;
      role: string;
      displayName?: string;
      specialties?: string[];
      loadFactor?: number;
      successRate?: number;
    },
  ) {
    this.logger.info('Adding sub-agent', {
      agentId,
      subAgentId: body.subAgentId,
    });

    if (!body.userId || !body.subAgentId) {
      throw new BadRequestException('userId and subAgentId are required');
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const subAgentDefinition = await this.agentService.getAgent(
      body.subAgentId,
      body.userId,
    );

    const newSubAgent: SubAgentRef = {
      agentId: body.subAgentId,
      type: this.mapAgentTypeToSubAgentType(subAgentDefinition.agentType),
      name: body.displayName || subAgentDefinition.name,
      specialties: Object.freeze(
        body.specialties?.length
          ? body.specialties
          : body.role
            ? [body.role]
            : [],
      ),
      loadFactor: body.loadFactor ?? 1,
      successRate: body.successRate ?? 1,
      isActive: true,
      createdAt: new Date(),
    } as SubAgentRef;

    await instance.registerSubAgent(newSubAgent);

    return {
      success: true,
      subAgent: {
        agentId: newSubAgent.agentId,
        name: newSubAgent.name,
        type: newSubAgent.type,
        role: body.role,
        specialties: newSubAgent.specialties,
        loadFactor: newSubAgent.loadFactor,
        successRate: newSubAgent.successRate,
        createdAt: newSubAgent.createdAt.toISOString(),
      },
    };
  }

  /**
   * GET /agents/collective/:id/task-queue - Get task queue
   */
  @Get(':id/task-queue')
  async getTaskQueue(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting task queue', { agentId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const queueSnapshot = instance.getTaskQueueSnapshot();
    const state = instance.getCollectiveState();
    const assignmentMetrics = this.taskAssignment.getAssignmentMetrics(
      state.subAgents.map((subAgent) => subAgent.agentId),
    );
    const messageStats = await this.messageQueue.getMessageStats(
      instance.getCollectiveId(),
    );

    return {
      agentId,
      queue: queueSnapshot,
      assignments: assignmentMetrics,
      messageQueue: messageStats,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/state')
  async getCollectiveStateSnapshot(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting collective state snapshot', { agentId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const snapshot: CollectiveStateSnapshot = instance.getStateSnapshot();

    return {
      agentId,
      snapshot,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/tasks')
  async listCollectiveTasks(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Listing collective tasks', { agentId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const tasks = instance.getAllTasks();

    const formatted = tasks.map((task) => this.formatTask(task));

    return {
      agentId,
      total: tasks.length,
      tasks: formatted,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/tasks/hierarchy')
  async getTaskHierarchy(
    @Param('id') agentId: string,
    @Query()
    query: {
      userId?: string;
      maxDepth?: string;
    },
  ) {
    this.logger.info('Fetching task hierarchy view', { agentId });

    if (!query.userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      query.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const tasks = instance.getAllTasks();
    const maxDepth = Math.min(
      Math.max(parseInt(query.maxDepth ?? '8', 10) || 8, 1),
      8,
    );
    const hierarchy = this.buildTaskHierarchy(tasks, maxDepth);

    return {
      agentId,
      total: tasks.length,
      maxDepth,
      roots: hierarchy,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/tasks/level/:level')
  async getTasksByLevel(
    @Param('id') agentId: string,
    @Param('level') level: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Filtering tasks by level', { agentId, level });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const parsedLevel = this.parseTaskLevel(level);
    const tasks = instance
      .getAllTasks()
      .filter((task) => task.level === parsedLevel)
      .map((task) => this.formatTask(task));

    return {
      agentId,
      level: parsedLevel,
      label: TaskLevel[parsedLevel],
      total: tasks.length,
      tasks,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/tasks/:taskId')
  async getCollectiveTask(
    @Param('id') agentId: string,
    @Param('taskId') taskId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Fetching collective task detail', { agentId, taskId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const task = instance.getTask(taskId);

    if (!task) {
      throw new NotFoundException(`Task '${taskId}' not found`);
    }

    return {
      agentId,
      task: this.formatTask(task),
      generatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/tasks/:taskId/children')
  async getTaskChildren(
    @Param('id') agentId: string,
    @Param('taskId') taskId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Fetching child tasks', { agentId, taskId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const children = instance.getChildTasks(taskId);

    return {
      agentId,
      taskId,
      total: children.length,
      children: children.map((child) => this.formatTask(child)),
      generatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/tasks/:taskId/parent')
  async getTaskParent(
    @Param('id') agentId: string,
    @Param('taskId') taskId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Fetching parent task', { agentId, taskId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const parent = instance.getParentTask(taskId);

    return {
      agentId,
      taskId,
      parent: parent ? this.formatTask(parent) : null,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/tasks/:taskId/dependencies')
  async getTaskDependencies(
    @Param('id') agentId: string,
    @Param('taskId') taskId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Fetching task dependencies', { agentId, taskId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const task = instance.getTask(taskId);

    if (!task) {
      throw new NotFoundException(`Task '${taskId}' not found`);
    }

    const dependencyTasks = this.resolveDependencyTasks(
      instance,
      task.dependencies,
    );

    return {
      agentId,
      taskId,
      total: dependencyTasks.length,
      dependencies: dependencyTasks,
      generatedAt: new Date().toISOString(),
    };
  }

  @Post(':id/tasks/:taskId/dependencies')
  async addTaskDependency(
    @Param('id') agentId: string,
    @Param('taskId') taskId: string,
    @Body()
    body: {
      userId: string;
      dependencyTaskId: string;
    },
  ) {
    this.logger.info('Adding task dependency', { agentId, taskId });

    if (!body.userId || !body.dependencyTaskId) {
      throw new BadRequestException(
        'userId and dependencyTaskId are required to add a dependency',
      );
    }

    if (body.dependencyTaskId === taskId) {
      throw new BadRequestException('A task cannot depend on itself');
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const task = instance.getTask(taskId);
    if (!task) {
      throw new NotFoundException(`Task '${taskId}' not found`);
    }

    const dependency = instance.getTask(body.dependencyTaskId);
    if (!dependency) {
      throw new NotFoundException(
        `Dependency task '${body.dependencyTaskId}' not found`,
      );
    }

    if (task.dependencies.includes(body.dependencyTaskId)) {
      return {
        agentId,
        taskId,
        dependencies: this.resolveDependencyTasks(instance, task.dependencies),
        updated: false,
        generatedAt: new Date().toISOString(),
      };
    }

    const updated = instance.updateTask(taskId, {
      dependencies: [...task.dependencies, body.dependencyTaskId],
    });

    return {
      agentId,
      taskId,
      dependencies: this.resolveDependencyTasks(instance, updated.dependencies),
      updated: true,
      generatedAt: new Date().toISOString(),
    };
  }

  @Delete(':id/tasks/:taskId/dependencies/:dependencyId')
  async removeTaskDependency(
    @Param('id') agentId: string,
    @Param('taskId') taskId: string,
    @Param('dependencyId') dependencyId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Removing task dependency', {
      agentId,
      taskId,
      dependencyId,
    });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const task = instance.getTask(taskId);
    if (!task) {
      throw new NotFoundException(`Task '${taskId}' not found`);
    }

    if (!task.dependencies.includes(dependencyId)) {
      return {
        agentId,
        taskId,
        removed: false,
        dependencies: this.resolveDependencyTasks(instance, task.dependencies),
        generatedAt: new Date().toISOString(),
      };
    }

    const updated = instance.updateTask(taskId, {
      dependencies: task.dependencies.filter((depId) => depId !== dependencyId),
    });

    return {
      agentId,
      taskId,
      removed: true,
      dependencies: this.resolveDependencyTasks(instance, updated.dependencies),
      generatedAt: new Date().toISOString(),
    };
  }

  @Post(':id/tasks')
  @HttpCode(HttpStatus.CREATED)
  async createCollectiveTask(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      title: string;
      description?: string;
      level?: TaskLevel;
      parentTaskId?: string;
      dependencies?: string[];
      priority?: number;
      metadata?: Record<string, unknown>;
      assignedAgentId?: string;
    },
  ) {
    this.logger.info('Creating collective task', {
      agentId,
      title: body.title,
    });

    if (!body.userId || !body.title) {
      throw new BadRequestException(
        'userId and title are required to create a task',
      );
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const task = instance.createTask({
      title: body.title,
      description: body.description,
      level: body.level,
      parentTaskId: body.parentTaskId,
      dependencies: body.dependencies,
      priority: body.priority,
      metadata: body.metadata,
      assignedAgentId: body.assignedAgentId,
    });

    return {
      agentId,
      task: this.formatTask(task),
      generatedAt: new Date().toISOString(),
    };
  }

  @Patch(':id/tasks/:taskId')
  async updateCollectiveTask(
    @Param('id') agentId: string,
    @Param('taskId') taskId: string,
    @Body()
    body: {
      userId: string;
      title?: string;
      description?: string;
      level?: TaskLevel;
      parentTaskId?: string | null;
      dependencies?: string[];
      priority?: number;
      metadata?: Record<string, unknown>;
      assignedAgentId?: string | null;
      state?: TaskState;
    },
  ) {
    this.logger.info('Updating collective task', { agentId, taskId });

    if (!body.userId) {
      throw new BadRequestException('userId is required to update tasks');
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const updated = instance.updateTask(taskId, {
      title: body.title,
      description: body.description,
      level: body.level,
      parentTaskId: body.parentTaskId,
      dependencies: body.dependencies,
      priority: body.priority,
      metadata: body.metadata,
      assignedAgentId: body.assignedAgentId,
      state: body.state,
    });

    return {
      agentId,
      task: this.formatTask(updated),
      updatedAt: updated.updatedAt.toISOString(),
      generatedAt: new Date().toISOString(),
    };
  }

  @Delete(':id/tasks/:taskId')
  async deleteCollectiveTask(
    @Param('id') agentId: string,
    @Param('taskId') taskId: string,
    @Query()
    query: {
      userId?: string;
      cascade?: string;
    },
  ) {
    this.logger.info('Deleting collective task', {
      agentId,
      taskId,
      cascade: query.cascade,
    });

    if (!query.userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      query.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const cascade = this.parseBoolean(query.cascade);
    const removed = instance.deleteTask(taskId, { cascade });

    return {
      agentId,
      taskId,
      cascade,
      removedTaskIds: removed.map((task) => task.id),
      removedTasks: removed.map((task) => this.formatTask(task)),
      totalRemoved: removed.length,
      generatedAt: new Date().toISOString(),
    };
  }

  private formatTask(task: CollectiveTask) {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      level: task.level,
      state: task.state,
      priority: task.priority,
      assignedAgentId: task.assignedAgentId ?? null,
      dependencies: [...(task.dependencies ?? [])],
      blockedBy: [...(task.blockedBy ?? [])],
      parentTaskId: task.parentTaskId ?? null,
      childTaskIds: [...(task.childTaskIds ?? [])],
      conversationId: task.conversationId ?? null,
      metadata: task.metadata ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
    };
  }

  private resolveDependencyTasks(
    instance: CollectiveAgent,
    dependencyIds: string[],
  ) {
    return dependencyIds
      .map((dependencyId) => instance.getTask(dependencyId))
      .filter((dependency): dependency is CollectiveTask => !!dependency)
      .map((dependency) => this.formatTask(dependency));
  }

  private buildTaskHierarchy(
    tasks: CollectiveTask[],
    maxDepth: number,
  ): TaskHierarchyNode[] {
    const taskMap = new Map(tasks.map((task) => [task.id, task] as const));
    const childrenMap = new Map<string, CollectiveTask[]>();

    for (const task of tasks) {
      if (task.parentTaskId && taskMap.has(task.parentTaskId)) {
        const siblings = childrenMap.get(task.parentTaskId) ?? [];
        siblings.push(task);
        childrenMap.set(task.parentTaskId, siblings);
      }
    }

    const roots = tasks.filter(
      (task) => !task.parentTaskId || !taskMap.has(task.parentTaskId),
    );

    const visit = (task: CollectiveTask, depth: number): TaskHierarchyNode => {
      const formatted = this.formatTask(task);
      const children = (childrenMap.get(task.id) ?? []).sort(
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
      );

      if (depth >= maxDepth) {
        return {
          task: formatted,
          depth,
          children: [],
          truncated: children.length > 0,
        };
      }

      return {
        task: formatted,
        depth,
        children: children.map((child) => visit(child, depth + 1)),
        truncated: false,
      };
    };

    return roots
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
      .map((task) => visit(task, 0));
  }

  private parseTaskLevel(rawLevel: string): TaskLevel {
    const normalized = rawLevel.trim();
    if (normalized.length === 0) {
      throw new BadRequestException('level parameter cannot be empty');
    }

    if (/^-?\d+$/.test(normalized)) {
      const numeric = Number(normalized);
      if (TaskLevel[numeric as TaskLevel] !== undefined) {
        return numeric as TaskLevel;
      }
    }

    const upper = normalized.toUpperCase();
    if (upper in TaskLevel) {
      const value = TaskLevel[upper as keyof typeof TaskLevel];
      if (typeof value === 'number') {
        return value as TaskLevel;
      }
    }

    throw new BadRequestException(`Unknown task level '${rawLevel}'`);
  }

  private parseBoolean(value?: string | boolean): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'y', 'on'].includes(value.toLowerCase());
    }

    return false;
  }
  @Get(':id/progress')
  async getCollectiveProgress(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting collective progress metrics', { agentId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const state = instance.getCollectiveState();
    const queueSnapshot = instance.getTaskQueueSnapshot();

    const completedTasks = queueSnapshot.completedTasks;
    const inProgressTasks = queueSnapshot.inProgressTasks;
    const totalTasks = queueSnapshot.totalTasks;

    const progressPercent =
      totalTasks === 0
        ? 0
        : Math.min(
            100,
            Math.round(((completedTasks + inProgressTasks) / totalTasks) * 100),
          );

    const averageSuccessRate =
      state.subAgentStats.length > 0
        ? Number(
            (
              state.subAgentStats.reduce(
                (sum, stat) => sum + stat.successRate,
                0,
              ) / state.subAgentStats.length
            ).toFixed(2),
          )
        : 0;

    const activeAgents = state.subAgents.filter(
      (agent) => agent.isActive,
    ).length;

    const metrics: CollectiveProgressMetrics = {
      collectiveId: instance.getCollectiveId(),
      totalTasks,
      completedTasks,
      inProgressTasks,
      blockedTasks: queueSnapshot.blockedTasks,
      pendingAssignments: state.pendingAssignments.length,
      progressPercent,
      activeAgents,
      averageSuccessRate,
      lastUpdated: queueSnapshot.lastUpdated,
    };

    return {
      agentId,
      metrics,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/waiting-dependencies')
  async getWaitingDependencies(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting waiting dependencies', { agentId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const dependencies = instance.getWaitingDependencies();

    return {
      agentId,
      waitingDependencies: dependencies,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/deadlocks')
  async getDeadlocks(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Fetching detected deadlocks', { agentId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const snapshot = instance.getStateSnapshot();

    return {
      agentId,
      deadlocks: snapshot.deadlocks,
      deadlockDetectedAt: snapshot.deadlockDetectedAt,
      paused: snapshot.isPaused,
      pauseReason: snapshot.pauseReason,
      generatedAt: new Date().toISOString(),
    };
  }

  @Post(':id/deadlocks/:deadlockId/resolve')
  async resolveDeadlock(
    @Param('id') agentId: string,
    @Param('deadlockId') deadlockId: string,
    @Body() body: { userId: string },
  ) {
    this.logger.info('Resolving deadlock manually', {
      agentId,
      deadlockId,
    });

    if (!body.userId) {
      throw new BadRequestException('userId is required to resolve deadlocks');
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    try {
      const remainingDeadlocks = await instance.resolveDeadlock(deadlockId);

      return {
        agentId,
        resolvedDeadlockId: deadlockId,
        remainingDeadlocks,
        paused: instance.isPaused(),
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Deadlock resolution error', {
        agentId,
        deadlockId,
        error,
      });

      throw new BadRequestException(
        (error as Error).message || 'Unable to resolve deadlock',
      );
    }
  }

  @Get(':id/agents/:agentId/queue')
  async getAgentMessageQueue(
    @Param('id') agentId: string,
    @Param('agentId') targetAgentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting agent queue details', {
      agentId,
      targetAgentId,
    });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    this.ensureSubAgentRegistered(instance, targetAgentId, agentId);

    const { queueMetrics, messages } =
      this.buildAgentQueueSnapshot(targetAgentId);

    return {
      agentId,
      subAgentId: targetAgentId,
      queueMetrics,
      messages,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/messages/pm')
  async getPMMessageQueue(
    @Param('id') agentId: string,
    @Query('userId') userId?: string,
  ) {
    this.logger.info('Getting PM message queue', { agentId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const { queueMetrics, messages } = this.buildAgentQueueSnapshot('pm_agent');

    return {
      agentId,
      pmAgentId: 'pm_agent',
      queueMetrics,
      messages,
      generatedAt: new Date().toISOString(),
    };
  }

  @Get(':id/messages/agent/:targetAgentId')
  async getAgentMessages(
    @Param('id') agentId: string,
    @Param('targetAgentId') targetAgentId: string,
    @Query('userId') userId?: string,
  ) {
    this.logger.info('Getting agent message queue (messages namespace)', {
      agentId,
      targetAgentId,
    });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    this.ensureSubAgentRegistered(instance, targetAgentId, agentId);

    const { queueMetrics, messages } =
      this.buildAgentQueueSnapshot(targetAgentId);

    return {
      agentId,
      subAgentId: targetAgentId,
      queueMetrics,
      messages,
      generatedAt: new Date().toISOString(),
    };
  }

  @Post(':id/messages')
  async sendCollectiveMessage(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      content: string;
      targetAgentId?: string;
      sourceAgentId?: string;
      priority?: MessagePriority;
      type?: MessageType;
      taskId?: string;
      replyToMessageId?: string;
      metadata?: Record<string, unknown>;
      broadcast?: boolean;
      excludeAgentIds?: string[];
    },
  ) {
    this.logger.info('Sending collective message', { agentId });

    if (!body?.userId || !body.content) {
      throw new BadRequestException('userId and content are required');
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const collectiveId = instance.getCollectiveId();
    const sourceAgentId = this.normalizeTargetAgentId(
      body.sourceAgentId || 'pm_agent',
    );
    const priority = this.parseMessagePriority(body.priority);
    const type = this.parseMessageType(body.type);

    if (body.broadcast) {
      const messages = await this.messageQueue.broadcastMessage(
        collectiveId,
        sourceAgentId,
        body.content,
        {
          priority,
          type,
          excludeAgentIds: body.excludeAgentIds,
          metadata: body.metadata,
        },
      );

      return {
        agentId,
        broadcast: true,
        count: messages.length,
        priority,
        type,
        generatedAt: new Date().toISOString(),
      };
    }

    if (!body.targetAgentId) {
      throw new BadRequestException(
        'targetAgentId is required when broadcast is false',
      );
    }

    const normalizedTarget = this.normalizeTargetAgentId(body.targetAgentId);

    if (normalizedTarget !== 'pm_agent') {
      this.ensureSubAgentRegistered(instance, normalizedTarget, agentId);
    }

    const message = await this.messageQueue.sendMessage(
      collectiveId,
      sourceAgentId,
      normalizedTarget,
      body.content,
      {
        priority,
        type,
        taskId: body.taskId,
        replyToMessageId: body.replyToMessageId,
        metadata: body.metadata,
      },
    );

    return {
      agentId,
      message: this.formatQueueMessage(message),
      generatedAt: new Date().toISOString(),
    };
  }

  @Sse(':id/messages/live')
  streamLiveMessages(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ): Observable<MessageEvent> {
    this.logger.info('Subscribing to live messages', { agentId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const validation$ = from(
      this.agentService.getAgentInstance(agentId, userId),
    ).pipe(
      mergeMap((instance) => {
        if (!(instance instanceof CollectiveAgent)) {
          throw new BadRequestException(
            `Agent '${agentId}' is not a collective agent`,
          );
        }

        return this.messageQueue.streamMessages(instance.getCollectiveId());
      }),
      map(
        (message) =>
          new MessageEvent('collective-message', {
            data: {
              id: message.id,
              collectiveId: message.collectiveId,
              sourceAgentId: message.sourceAgentId,
              targetAgentId: message.targetAgentId,
              type: message.type,
              priority: message.priority,
              status: message.status,
              taskId: message.taskId ?? null,
              content: message.content,
              metadata: message.metadata ?? null,
              createdAt: message.createdAt.toISOString(),
            },
          }),
      ),
    );

    return validation$;
  }

  @Sse(':id/artifacts/live')
  streamLiveArtifacts(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ): Observable<MessageEvent> {
    this.logger.info('Subscribing to live artifacts', { agentId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    return from(this.agentService.getAgentInstance(agentId, userId)).pipe(
      mergeMap((instance) => {
        if (!(instance instanceof CollectiveAgent)) {
          throw new BadRequestException(
            `Agent '${agentId}' is not a collective agent`,
          );
        }

        return this.sharedMemory.streamArtifactEvents(
          instance.getCollectiveId(),
        );
      }),
      map(
        (event: CollectiveArtifactEvent) =>
          new MessageEvent('collective-artifact', {
            data: {
              action: event.action,
              artifact: this.serializeArtifact(event.artifact),
            },
          }),
      ),
    );
  }

  @Post(':id/pause')
  async pauseCollective(
    @Param('id') agentId: string,
    @Body() body: { userId: string },
  ) {
    this.logger.info('Pausing collective agent', { agentId });

    if (!body.userId) {
      throw new BadRequestException('userId is required to pause collective');
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    instance.pause();

    return {
      agentId,
      paused: true,
      updatedAt: new Date().toISOString(),
    };
  }

  @Post(':id/resume')
  async resumeCollective(
    @Param('id') agentId: string,
    @Body() body: { userId: string },
  ) {
    this.logger.info('Resuming collective agent', { agentId });

    if (!body.userId) {
      throw new BadRequestException('userId is required to resume collective');
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    instance.resume();

    return {
      agentId,
      paused: false,
      updatedAt: new Date().toISOString(),
    };
  }

  @Post(':id/tasks/:taskId/assign')
  async assignTaskManually(
    @Param('id') agentId: string,
    @Param('taskId') taskId: string,
    @Body()
    body: {
      userId: string;
      targetAgentId: string;
    },
  ) {
    this.logger.info('Manually assigning task', { agentId, taskId });

    if (!body.userId || !body.targetAgentId) {
      throw new BadRequestException(
        'userId and targetAgentId are required to assign a task',
      );
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const assignment = await instance.assignTaskManually(
      taskId,
      body.targetAgentId,
    );

    return {
      agentId,
      taskId,
      assignedAgentId: assignment.agentId,
      assignment: {
        ...assignment,
        assignedAt: assignment.assignedAt.toISOString(),
      },
    };
  }

  @Post(':id/tasks/:taskId/reassign')
  async reassignTask(
    @Param('id') agentId: string,
    @Param('taskId') taskId: string,
    @Body()
    body: {
      userId: string;
      targetAgentId: string;
    },
  ) {
    this.logger.info('Reassigning collective task', { agentId, taskId });

    if (!body.userId || !body.targetAgentId) {
      throw new BadRequestException(
        'userId and targetAgentId are required to reassign a task',
      );
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const task = instance.getTask(taskId);
    if (!task) {
      throw new NotFoundException(`Task '${taskId}' not found`);
    }

    const previousAssignee = task.assignedAgentId ?? null;
    instance.unassignTask(taskId);
    const assignment = await instance.assignTaskManually(
      taskId,
      body.targetAgentId,
    );

    return {
      agentId,
      taskId,
      previousAssignee,
      assignedAgentId: assignment.agentId,
      assignment: {
        ...assignment,
        assignedAt: assignment.assignedAt.toISOString(),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  @Post(':id/tasks/:taskId/complete')
  async completeTaskManually(
    @Param('id') agentId: string,
    @Param('taskId') taskId: string,
    @Body() body: { userId: string },
  ) {
    this.logger.info('Manually completing task', { agentId, taskId });

    if (!body.userId) {
      throw new BadRequestException('userId is required to complete a task');
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const task = instance.completeTaskManually(taskId);

    return {
      agentId,
      taskId,
      status: task.state,
      completedAt: task.completedAt?.toISOString() ?? null,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * GET /agents/collective/:id/artifacts - Get generated artifacts
   */
  @Get(':id/artifacts')
  async getArtifacts(
    @Param('id') agentId: string,
    @Query()
    query: {
      userId?: string;
      search?: string;
      type?: ArtifactType;
      tags?: string;
      taskId?: string;
      limit?: string;
      offset?: string;
    },
  ) {
    this.logger.info('Getting artifacts', { agentId });

    if (!query.userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      query.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const tags = query.tags ? this.parseTags(query.tags) : undefined;
    const limit = query.limit ? Number(query.limit) : undefined;
    const offset = query.offset ? Number(query.offset) : undefined;

    const artifactsResult = await this.sharedMemory.listArtifacts(agentId, {
      search: query.search,
      type: query.type,
      tags,
      taskId: query.taskId,
      limit,
      offset,
    });

    const memorySummary = await this.sharedMemory.getCollectiveMemory(agentId);

    return {
      agentId,
      total: artifactsResult.total,
      artifacts: artifactsResult.items.map((artifact) =>
        this.serializeArtifact(artifact),
      ),
      summary: {
        totalArtifacts: memorySummary.totalArtifacts,
        byType: memorySummary.byType,
        knowledgeAreas: memorySummary.knowledgeAreas,
        knowledgeGaps: memorySummary.knowledgeGaps,
        recentActivity: memorySummary.recentActivity,
      },
      pagination: {
        limit: artifactsResult.limit,
        offset: artifactsResult.offset,
        returned: artifactsResult.items.length,
      },
      filters: {
        search: query.search || null,
        type: query.type || null,
        tags: tags || [],
        taskId: query.taskId || null,
      },
    };
  }

  @Get(':id/artifacts/:artifactId')
  async getArtifactDetail(
    @Param('id') agentId: string,
    @Param('artifactId') artifactId: string,
    @Query('userId') userId?: string,
  ) {
    this.logger.info('Getting artifact detail', { agentId, artifactId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const artifact = await this.sharedMemory.getArtifact(artifactId);
    if (!artifact || artifact.collectiveId !== agentId) {
      throw new NotFoundException(
        `Artifact '${artifactId}' not found in collective '${agentId}'`,
      );
    }

    const versionHistory = this.sharedMemory.getArtifactVersions(artifactId);
    const lockInfo = this.sharedMemory.getArtifactLockInfo(artifactId);
    const task = artifact.taskId
      ? this.sharedMemory.getTask(artifact.taskId)
      : null;

    return {
      agentId,
      artifact: this.serializeArtifact(artifact),
      lock: lockInfo ? this.formatArtifactLock(lockInfo) : null,
      task: this.formatTaskSummary(task),
      versions: versionHistory.map((version) =>
        this.serializeArtifact(version),
      ),
      metadata: {
        hasVersions: versionHistory.length > 0,
        isLocked: Boolean(lockInfo),
      },
      retrievedAt: new Date().toISOString(),
    };
  }

  @Get(':id/artifacts/:artifactId/versions')
  async getArtifactVersions(
    @Param('id') agentId: string,
    @Param('artifactId') artifactId: string,
    @Query('userId') userId?: string,
  ) {
    this.logger.info('Getting artifact versions', { agentId, artifactId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const artifact = await this.sharedMemory.getArtifact(artifactId);
    if (!artifact || artifact.collectiveId !== agentId) {
      throw new NotFoundException(
        `Artifact '${artifactId}' not found in collective '${agentId}'`,
      );
    }

    const versions = this.sharedMemory.getArtifactVersions(artifactId);

    return {
      agentId,
      artifactId,
      currentVersion: this.serializeArtifact(artifact),
      history: versions.map((version) => this.serializeArtifact(version)),
      totalVersions: versions.length,
      generatedAt: new Date().toISOString(),
    };
  }

  @Post(':id/artifacts')
  @HttpCode(HttpStatus.CREATED)
  async createArtifact(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      taskId: string;
      name: string;
      content: string;
      description?: string;
      type?: ArtifactType;
      tags?: string[];
      metadata?: Record<string, unknown>;
    },
  ) {
    if (!body.userId || !body.taskId || !body.name || !body.content) {
      throw new BadRequestException(
        'userId, taskId, name, and content are required to create an artifact',
      );
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const artifact = createCollectiveArtifact(
      agentId,
      body.taskId,
      body.name,
      body.content,
      body.userId,
      {
        description: body.description,
        type: body.type,
        tags: body.tags,
        metadata: body.metadata,
      },
    );

    const created = await this.sharedMemory.createArtifact(artifact);

    return {
      success: true,
      artifact: this.serializeArtifact(created),
    };
  }

  @Post(':id/artifacts/:artifactId/lock')
  async lockArtifact(
    @Param('id') agentId: string,
    @Param('artifactId') artifactId: string,
    @Body()
    body: {
      userId: string;
      lockType?: LockType;
      timeoutMs?: number;
    },
  ) {
    if (!body?.userId) {
      throw new BadRequestException('userId is required to lock artifacts');
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    try {
      const result = await this.sharedMemory.lockArtifact(
        agentId,
        artifactId,
        body.userId,
        this.parseLockType(body.lockType),
        body.timeoutMs,
      );

      return {
        agentId,
        artifactId,
        artifact: this.serializeArtifact(result.artifact),
        lockToken: result.lockToken,
        lock: this.formatArtifactLock(result.lock),
      };
    } catch (error) {
      throw new BadRequestException(
        (error as Error).message || 'Unable to lock artifact',
      );
    }
  }

  @Delete(':id/artifacts/:artifactId/lock')
  async unlockArtifact(
    @Param('id') agentId: string,
    @Param('artifactId') artifactId: string,
    @Body()
    body: {
      userId: string;
      lockToken?: string;
    },
    @Query('lockToken') lockTokenQuery?: string,
  ) {
    if (!body?.userId) {
      throw new BadRequestException('userId is required to unlock artifacts');
    }

    const lockToken = body.lockToken ?? lockTokenQuery;

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    try {
      const success = await this.sharedMemory.unlockArtifact(
        agentId,
        artifactId,
        body.userId,
        lockToken,
      );

      return {
        agentId,
        artifactId,
        unlocked: success,
        unlockedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new BadRequestException(
        (error as Error).message || 'Unable to unlock artifact',
      );
    }
  }

  @Patch(':id/artifacts/:artifactId')
  async updateArtifact(
    @Param('id') agentId: string,
    @Param('artifactId') artifactId: string,
    @Body()
    body: {
      userId: string;
      name?: string;
      description?: string;
      content?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
      type?: ArtifactType;
    },
  ) {
    if (!body.userId) {
      throw new BadRequestException('userId is required');
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    const updated = await this.sharedMemory.updateArtifact(
      agentId,
      artifactId,
      body.userId,
      {
        name: body.name,
        description: body.description,
        content: body.content,
        tags: body.tags,
        metadata: body.metadata,
        type: body.type,
      },
    );

    return {
      success: true,
      artifact: this.serializeArtifact(updated),
    };
  }

  @Delete(':id/artifacts/:artifactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteArtifact(
    @Param('id') agentId: string,
    @Param('artifactId') artifactId: string,
    @Body() body: { userId: string },
  ) {
    if (!body?.userId) {
      throw new BadRequestException('userId is required');
    }

    const instance = await this.agentService.getAgentInstance(
      agentId,
      body.userId,
    );

    if (!(instance instanceof CollectiveAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a collective agent`,
      );
    }

    await this.sharedMemory.deleteArtifact(agentId, artifactId, body.userId);
    return { success: true };
  }
}
