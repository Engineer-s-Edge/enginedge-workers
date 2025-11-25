/**
 * Manager Agent Controller
 *
 * Specialized endpoints for Manager (task coordination) agents.
 * Handles task breakdown and sub-agent coordination.
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
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AgentService } from '@application/services/agent.service';
import { ExecuteAgentUseCase } from '@application/use-cases/execute-agent.use-case';
import { ManagerAgent } from '@domain/agents/manager-agent/manager-agent';
import {
  ManagerRuntimeService,
  ManagerRuntimeSubtask,
  ManagerRuntimeAssignment,
  ManagerDecompositionRequest,
} from '@application/services/manager/manager-runtime.service';
import { AgentEventService } from '@application/services/agent-event.service';
import {
  AggregatedTaskResult,
  DecompositionStrategy,
} from '@domain/agents/manager-agent/manager-agent.types';
// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

type NormalizedMasterTask = {
  id?: string;
  title: string;
  description: string;
  objective?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  constraints?: string[];
  dependencies?: string[];
};

interface ManagerDecomposeBody {
  userId: string;
  masterTask:
    | string
    | {
        id?: string;
        title: string;
        description?: string;
        objective?: string;
        priority?: 'critical' | 'high' | 'medium' | 'low';
        constraints?: string[];
        dependencies?: string[];
      };
  strategy?: DecompositionStrategy;
  subtasks?: Array<{
    id?: string;
    title: string;
    description: string;
    objective?: string;
    priority?: 'critical' | 'high' | 'medium' | 'low';
    dependencies?: string[];
    requiredCapabilities?: string[];
    estimatedDuration?: number;
  }>;
  hints?: string[];
  preferredAgents?: string[];
  metadata?: Record<string, unknown>;
}

interface CoordinateExecutionBody {
  userId: string;
  task: string;
  strategy?: DecompositionStrategy | 'sequential' | 'parallel' | 'hierarchical';
  preferredAgents?: string[];
}

interface AggregateBody {
  userId: string;
  notes?: string;
  summaryOverride?: string;
}

interface ReassignBody {
  userId: string;
  targetAgentId: string;
  reason?: string;
}

interface RetryBody {
  userId: string;
}

interface PauseBody {
  userId: string;
  reason?: string;
}

/**
 * Manager Agent specialized controller
 */
@Controller('agents/manager')
export class ManagerAgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    private readonly managerRuntime: ManagerRuntimeService,
    private readonly agentEvents: AgentEventService,
    @Inject('ILogger')
    private readonly logger: Logger,
  ) {}

  /**
   * POST /agents/manager/create - Create Manager coordination agent
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createManagerAgent(
    @Body()
    body: {
      name: string;
      userId: string;
      decompositionStrategy?: 'functional' | 'hierarchical' | 'temporal';
      maxSubAgents?: number;
    },
  ) {
    this.logger.info('Creating Manager agent', { name: body.name });

    const config = {
      decompositionStrategy: body.decompositionStrategy || 'functional',
      maxSubAgents: body.maxSubAgents || 5,
    };

    const agent = await this.agentService.createAgent(
      { name: body.name, agentType: 'manager', config },
      body.userId,
    );

    return {
      id: agent.id,
      name: body.name,
      type: 'manager',
      config,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * POST /agents/manager/:id/decompose - Decompose task
   */
  @Post(':id/decompose')
  @HttpCode(HttpStatus.OK)
  async decomposeTask(
    @Param('id') agentId: string,
    @Body() body: ManagerDecomposeBody,
  ) {
    this.logger.info('Decomposing task', { agentId });

    if (!body.userId) {
      throw new BadRequestException('userId is required to decompose task');
    }

    await this.ensureManagerAgent(agentId, body.userId);

    const normalizedMasterTask = this.normalizeMasterTask(body.masterTask);
    const request: ManagerDecompositionRequest = {
      masterTask: normalizedMasterTask,
      strategy: body.strategy,
      manualSubtasks: body.subtasks,
      hints: body.hints,
      preferredAgents: body.preferredAgents,
      metadata: body.metadata,
    };

    const snapshot = this.managerRuntime.decomposeTask(
      agentId,
      body.userId,
      request,
    );

    return {
      agentId,
      masterTask: snapshot.masterTask,
      strategy: snapshot.strategy,
      decomposition: {
        id: snapshot.decomposition.decompositionId,
        rationale: snapshot.decomposition.rationale,
        confidence: snapshot.decomposition.confidence,
        createdAt: snapshot.generatedAt.toISOString(),
      },
      metrics: snapshot.metrics,
      subtasks: snapshot.subtasks.map((subtask) =>
        this.serializeSubtask(subtask),
      ),
      executionPlan: {
        planId: snapshot.executionPlan.planId,
        strategy: snapshot.executionPlan.strategy,
        estimatedDuration: snapshot.executionPlan.estimatedDuration,
        assignments: snapshot.executionPlan.assignments.map((assignment) => ({
          id: assignment.id,
          subtaskId: assignment.subtaskId,
          agentId: assignment.agentId,
          status: assignment.status,
          assignedAt: assignment.assignedAt.toISOString(),
        })),
      },
    };
  }

  /**
   * POST /agents/manager/:id/coordinate - Coordinate execution
   */
  @Post(':id/coordinate')
  @HttpCode(HttpStatus.OK)
  async coordinateExecution(
    @Param('id') agentId: string,
    @Body() body: CoordinateExecutionBody,
  ) {
    this.logger.info('Coordinating execution', { agentId });

    if (!body.userId) {
      throw new BadRequestException('userId is required to coordinate');
    }

    await this.ensureManagerAgent(agentId, body.userId);

    const result = await this.executeAgentUseCase.execute({
      agentId,
      userId: body.userId,
      input: body.task,
      context: {
        strategy: body.strategy || 'hierarchical',
      },
    });

    const coordination = this.managerRuntime.coordinateExecution(
      agentId,
      body.userId,
      {
        strategy: body.strategy,
        orchestratedTask: body.task,
        preferredAgents: body.preferredAgents,
      },
    );

    return {
      agentId,
      execution: result,
      strategy: coordination.strategy,
      assignments: coordination.assignments.map((assignment) =>
        this.serializeAssignment(assignment),
      ),
      metrics: coordination.metrics,
      startedSubtasks: coordination.startedSubtasks,
      completedSubtasks: coordination.completedSubtasks,
      updatedAt: coordination.updatedAt.toISOString(),
    };
  }

  /**
   * GET /agents/manager/:id/subtasks - Get subtask status
   */
  @Get(':id/subtasks')
  async getSubtasks(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Getting subtasks', { agentId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    await this.ensureManagerAgent(agentId, userId);
    const overview = this.managerRuntime.getSubtasks(agentId);

    return {
      agentId,
      metrics: overview.metrics,
      waitingDependencies: overview.waitingDependencies,
      subtasks: overview.subtasks.map((subtask) =>
        this.serializeSubtask(subtask),
      ),
    };
  }

  /**
   * POST /agents/manager/:id/aggregate - Aggregate results
   */
  @Post(':id/aggregate')
  @HttpCode(HttpStatus.OK)
  async aggregateResults(
    @Param('id') agentId: string,
    @Body() body: AggregateBody,
  ) {
    this.logger.info('Aggregating results', { agentId });

    if (!body.userId) {
      throw new BadRequestException('userId is required for aggregation');
    }

    await this.ensureManagerAgent(agentId, body.userId);
    const summary = this.managerRuntime.aggregateResults(agentId, body.userId, {
      notes: body.notes,
      summaryOverride: body.summaryOverride,
    });

    return {
      agentId,
      metrics: summary.metrics,
      aggregatedResult: this.serializeAggregation(summary.aggregatedResult),
      generatedAt: summary.generatedAt.toISOString(),
    };
  }

  /**
   * GET /agents/manager/:id/state - runtime + domain state snapshot
   */
  @Get(':id/state')
  async getManagerState(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    this.logger.info('Fetching manager state snapshot', { agentId });

    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const instance = await this.ensureManagerAgent(agentId, userId);
    const runtime = this.managerRuntime.getSnapshot(agentId);
    const domainState =
      typeof instance.getManagerState === 'function'
        ? instance.getManagerState()
        : null;

    return {
      agentId,
      runtime: {
        metrics: runtime.metrics,
        subtasks: runtime.subtasks.map((subtask) =>
          this.serializeSubtask(subtask),
        ),
        assignments: runtime.assignments.map((assignment) =>
          this.serializeAssignment(assignment),
        ),
        aggregatedResult: runtime.aggregatedResult
          ? this.serializeAggregation(runtime.aggregatedResult)
          : null,
        waitingDependencies: runtime.waitingDependencies,
        statusHistory: runtime.statusHistory.map((event) => ({
          type: event.type,
          timestamp: event.timestamp.toISOString(),
          data: event.data,
          state: event.state,
        })),
        paused: runtime.paused,
        pauseReason: runtime.pauseReason ?? null,
        lastUpdated: runtime.lastUpdated.toISOString(),
        version: runtime.version,
      },
      domain: this.serializeDomainState(domainState),
    };
  }

  /**
   * GET /agents/manager/:id/progress - progress + metrics
   */
  @Get(':id/progress')
  async getProgress(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    await this.ensureManagerAgent(agentId, userId);
    const progress = this.managerRuntime.getProgress(agentId);

    return {
      agentId,
      progressPercent: progress.progressPercent,
      metrics: progress.metrics,
      waitingDependencies: progress.waitingDependencies,
      paused: progress.paused,
      lastUpdated: progress.lastUpdated.toISOString(),
    };
  }

  /**
   * GET /agents/manager/:id/assignments - list assignments (optional filters)
   */
  @Get(':id/assignments')
  async listAssignments(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
    @Query('status') status?: string,
    @Query('agentId') targetAgentId?: string,
    @Query('includeCompleted') includeCompleted?: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    await this.ensureManagerAgent(agentId, userId);

    const filter = this.buildAssignmentFilter(
      status,
      targetAgentId,
      includeCompleted,
    );
    const snapshot = this.managerRuntime.getAssignments(agentId, filter);

    return {
      agentId,
      metrics: snapshot.metrics,
      assignments: snapshot.assignments.map((assignment) =>
        this.serializeAssignment(assignment),
      ),
    };
  }

  /**
   * GET /agents/manager/:id/assignments/:assignmentId - assignment details
   */
  @Get(':id/assignments/:assignmentId')
  async getAssignment(
    @Param('id') agentId: string,
    @Param('assignmentId') assignmentId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    await this.ensureManagerAgent(agentId, userId);
    const assignment = this.managerRuntime.getAssignment(agentId, assignmentId);

    return this.serializeAssignment(assignment);
  }

  /**
   * GET /agents/manager/:id/available-agents - helper for manual assignment UI
   */
  @Get(':id/available-agents')
  async listAvailableAgents(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ) {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    const agents = await this.agentService.listAgents(userId);
    const response = agents
      .filter((agent) => agent.id !== agentId)
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        type: agent.agentType,
        createdAt: agent.createdAt.toISOString(),
        executionModel: agent.capability.executionModel,
        canCoordinate: agent.capability.canCoordinate,
        canPauseResume: agent.capability.canPauseResume,
      }));

    return {
      agentId,
      total: response.length,
      agents: response,
    };
  }

  /**
   * POST /agents/manager/:id/assignments/:assignmentId/reassign - manual reassignment
   */
  @Post(':id/assignments/:assignmentId/reassign')
  async reassignAssignment(
    @Param('id') agentId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() body: ReassignBody,
  ) {
    if (!body.userId) {
      throw new BadRequestException('userId is required to reassign');
    }

    if (!body.targetAgentId) {
      throw new BadRequestException('targetAgentId is required');
    }

    await this.ensureManagerAgent(agentId, body.userId);
    await this.agentService.getAgent(body.targetAgentId, body.userId);

    const assignment = this.managerRuntime.reassignAssignment(
      agentId,
      body.userId,
      assignmentId,
      body.targetAgentId,
    );

    return this.serializeAssignment(assignment);
  }

  /**
   * POST /agents/manager/:id/subtasks/:subtaskId/retry - retry subtask execution
   */
  @Post(':id/subtasks/:subtaskId/retry')
  async retrySubtask(
    @Param('id') agentId: string,
    @Param('subtaskId') subtaskId: string,
    @Body() body: RetryBody,
  ) {
    if (!body.userId) {
      throw new BadRequestException('userId is required to retry');
    }

    await this.ensureManagerAgent(agentId, body.userId);
    const assignment = this.managerRuntime.retrySubtask(
      agentId,
      body.userId,
      subtaskId,
    );

    return this.serializeAssignment(assignment);
  }

  /**
   * POST /agents/manager/:id/pause - pause manager coordination
   */
  @Post(':id/pause')
  async pauseManager(@Param('id') agentId: string, @Body() body: PauseBody) {
    if (!body.userId) {
      throw new BadRequestException('userId is required to pause manager');
    }

    await this.ensureManagerAgent(agentId, body.userId);
    const state = this.managerRuntime.pause(agentId, body.userId, body.reason);

    return {
      agentId,
      paused: state.paused,
      pauseReason: state.pauseReason,
      timestamp: state.timestamp.toISOString(),
    };
  }

  /**
   * POST /agents/manager/:id/resume - resume manager coordination
   */
  @Post(':id/resume')
  async resumeManager(@Param('id') agentId: string, @Body() body: PauseBody) {
    if (!body.userId) {
      throw new BadRequestException('userId is required to resume manager');
    }

    await this.ensureManagerAgent(agentId, body.userId);
    const state = this.managerRuntime.resume(agentId, body.userId);

    return {
      agentId,
      paused: state.paused,
      timestamp: state.timestamp.toISOString(),
    };
  }

  /**
   * POST /agents/manager/:id/trigger-aggregation - manual aggregation trigger
   */
  @Post(':id/trigger-aggregation')
  async triggerAggregation(
    @Param('id') agentId: string,
    @Body() body: AggregateBody,
  ) {
    if (!body.userId) {
      throw new BadRequestException(
        'userId is required to trigger aggregation',
      );
    }

    await this.ensureManagerAgent(agentId, body.userId);
    const summary = this.managerRuntime.triggerAggregation(
      agentId,
      body.userId,
      {
        notes: body.notes,
        summaryOverride: body.summaryOverride,
      },
    );

    return {
      agentId,
      metrics: summary.metrics,
      aggregatedResult: this.serializeAggregation(summary.aggregatedResult),
      generatedAt: summary.generatedAt.toISOString(),
    };
  }

  /**
   * SSE /agents/manager/:id/events/stream - live manager events
   */
  @Sse(':id/events/stream')
  streamManagerEvents(
    @Param('id') agentId: string,
    @Query('userId') userId: string,
  ): Observable<MessageEvent> {
    if (!userId) {
      throw new BadRequestException('userId query parameter is required');
    }

    return new Observable<MessageEvent>((subscriber) => {
      let cancelled = false;

      (async () => {
        try {
          for await (const event of this.agentEvents.getAgentActivityStream(
            agentId,
          )) {
            if (cancelled) {
              break;
            }

            subscriber.next(
              new MessageEvent('manager-event', {
                data: {
                  agentId: event.agentId,
                  type: (event.data?.eventType as string) || event.type,
                  userId: event.userId,
                  timestamp: event.timestamp.toISOString(),
                  payload: event.data,
                },
              }),
            );
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();

      return () => {
        cancelled = true;
      };
    });
  }

  private normalizeMasterTask(
    input: ManagerDecomposeBody['masterTask'],
  ): NormalizedMasterTask {
    if (typeof input === 'string') {
      return {
        title: input.substring(0, 140) || 'Manager Task',
        description: input,
        objective: input,
      };
    }

    if (!input.description) {
      return {
        ...input,
        description: input.title,
      };
    }

    return {
      ...input,
      description: input.description,
    };
  }

  private async ensureManagerAgent(agentId: string, userId: string) {
    const instance = await this.agentService.getAgentInstance(agentId, userId);

    if (!(instance instanceof ManagerAgent)) {
      throw new BadRequestException(
        `Agent '${agentId}' is not a manager agent`,
      );
    }

    return instance;
  }

  private serializeSubtask(subtask: ManagerRuntimeSubtask) {
    return {
      id: subtask.id,
      taskId: subtask.taskId,
      title: subtask.title,
      description: subtask.description,
      objective: subtask.objective,
      priority: subtask.priority ?? 'medium',
      status: subtask.status,
      dependencies: subtask.dependencies ?? [],
      assignedAgentId: subtask.assignedAgentId,
      waitingOn: subtask.waitingOn,
      estimatedDuration: subtask.estimatedDuration ?? null,
      progressPercent: Number((subtask.progress * 100).toFixed(1)),
      lastUpdated: subtask.lastUpdated.toISOString(),
    };
  }

  private serializeAssignment(assignment: ManagerRuntimeAssignment) {
    return {
      id: assignment.id,
      subtaskId: assignment.subtaskId,
      agentId: assignment.agentId,
      status: assignment.status,
      priority: assignment.priority,
      workloadEstimate: assignment.workloadEstimate,
      taskTitle: assignment.taskTitle,
      taskObjective: assignment.taskObjective,
      dependencies: assignment.taskDependencies,
      source: assignment.source,
      assignedAt: assignment.assignedAt.toISOString(),
      completedAt: assignment.completedAt
        ? assignment.completedAt.toISOString()
        : null,
      result: assignment.result || null,
    };
  }

  private serializeAggregation(result: AggregatedTaskResult) {
    return {
      ...result,
      subtaskResults: result.subtaskResults,
      failedSubtasks: result.failedSubtasks,
      executionTime: result.executionTime,
    };
  }

  private serializeDomainState(
    state: ReturnType<ManagerAgent['getManagerState']> | null,
  ) {
    if (!state) {
      return null;
    }

    return {
      currentState: state.currentState,
      masterTask: state.masterTask,
      executionPlan: state.executionPlan,
      assignments: state.assignments,
      completedAssignments: state.completedAssignments,
      failedAssignments: state.failedAssignments,
      aggregatedResult: state.aggregatedResult,
      startTime: state.startTime
        ? new Date(state.startTime).toISOString()
        : null,
      endTime: state.endTime ? new Date(state.endTime).toISOString() : null,
    };
  }

  private buildAssignmentFilter(
    status: string | undefined,
    agentId: string | undefined,
    includeCompleted?: string,
  ) {
    const statuses = status
      ? status
          .split(',')
          .map((token) => token.trim())
          .filter((token) => token.length > 0)
      : undefined;

    return {
      statuses: statuses as ManagerRuntimeAssignment['status'][] | undefined,
      agentId,
      includeCompleted:
        includeCompleted !== undefined ? includeCompleted !== 'false' : true,
    };
  }
}
