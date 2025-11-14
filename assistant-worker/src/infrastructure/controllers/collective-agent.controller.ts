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
  CollectiveArtifact,
} from '@domain/entities/collective-artifact.entity';
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
      const assignedTasks = this.taskAssignment.getAgentLoad(
        subAgent.agentId,
      );

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
                createdAt:
                  queueMetrics.nextMessage.createdAt.toISOString(),
              }
            : null,
          oldestMessageCreatedAt:
            queueMetrics.oldestMessageCreatedAt?.toISOString() ?? null,
        },
      };
    });

    const activeCount = subAgents.filter((agent) => agent.status === 'active')
      .length;

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
            Math.round(
              ((completedTasks + inProgressTasks) / totalTasks) * 100,
            ),
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

    const activeAgents = state.subAgents.filter((agent) => agent.isActive)
      .length;

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

    const state = instance.getCollectiveState();
    const subAgentExists = state.subAgents.some(
      (agent) => agent.agentId === targetAgentId,
    );

    if (!subAgentExists) {
      throw new BadRequestException(
        `Sub-agent '${targetAgentId}' is not part of collective '${agentId}'`,
      );
    }

    const queueMetrics = this.messageQueue.getAgentQueueMetrics(targetAgentId);
    const queue = this.messageQueue.getAgentQueue(targetAgentId);

    const detailedMessages = queue.map((message) => {
      const task = message.taskId
        ? this.sharedMemory.getTask(message.taskId)
        : null;

      return {
        id: message.id,
        sourceAgentId: message.sourceAgentId,
        priority: message.priority,
        type: message.type,
        status: message.status,
        content: message.content,
        conversationId: message.conversationId ?? null,
        taskId: message.taskId ?? null,
        retries: message.retryCount,
        dependencyStatus: task
          ? {
              taskState: task.state,
              blockedBy: task.blockedBy,
              dependencies: task.dependencies,
              assignedAgentId: task.assignedAgentId ?? null,
            }
          : null,
        metadata: message.metadata ?? null,
        createdAt: message.createdAt.toISOString(),
        expiresAt: message.expiresAt?.toISOString() ?? null,
      };
    });

    return {
      agentId,
      subAgentId: targetAgentId,
      queueMetrics,
      messages: detailedMessages,
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
      map((message) =>
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

    return from(
      this.agentService.getAgentInstance(agentId, userId),
    ).pipe(
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
      map((event: CollectiveArtifactEvent) =>
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

  @Post(':id/tasks/:taskId/complete')
  async completeTaskManually(
    @Param('id') agentId: string,
    @Param('taskId') taskId: string,
    @Body() body: { userId: string },
  ) {
    this.logger.info('Manually completing task', { agentId, taskId });

    if (!body.userId) {
      throw new BadRequestException(
        'userId is required to complete a task',
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
