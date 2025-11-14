/**
 * Genius Agent Controller
 *
 * Specialized endpoints for Genius (learning) agents.
 * Handles expert pool management and learning modes.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AgentService } from '@application/services/agent.service';
import { ExecuteAgentUseCase } from '@application/use-cases/execute-agent.use-case';
import { GeniusAgent } from '@domain/agents/genius-agent/genius-agent';
import {
  LearningMode,
  GeniusAgentState,
  LearningHistoryEntry,
} from '@domain/agents/genius-agent/genius-agent.types';
import { ExpertPoolManager } from '@domain/services/expert-pool-manager.service';
import { AgentId } from '@domain/entities/agent.entity';
import {
  KGModification,
  ActiveExecution,
  ExpertPoolStats,
} from '@domain/services/expert-pool.types';
import {
  GeniusExpertRuntimeService,
  ExpertTopicAssignment,
} from '@application/services/genius/genius-expert-runtime.service';
import { GeniusAgentOrchestrator } from '@application/services/genius-agent.orchestrator';
import { LearningModeAdapter } from '@infrastructure/adapters/implementations/learning-mode.adapter';
import { ValidationAdapter } from '@infrastructure/adapters/implementations/validation.adapter';
import { TopicCatalogAdapter } from '@infrastructure/adapters/implementations/topic-catalog.adapter';
import { UserId } from '../decorators/user-id.decorator';

// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

type TrainingDataSample = Record<string, unknown>;

interface TrainingRequestBody {
  userId: string;
  trainingData: TrainingDataSample[];
  mode: 'supervised' | 'unsupervised' | 'reinforcement';
}

interface ExpertTopicInput {
  topicId?: string;
  title: string;
  summary?: string;
  priority?: number;
}

interface ExpertResponse {
  expertId: string;
  name: string;
  specialization: string;
  complexity: number;
  availability: boolean;
  status: 'available' | 'active' | 'paused';
  assignedTopics: Array<
    Omit<ExpertTopicAssignment, 'lastUpdated'> & { lastUpdated: string }
  >;
  researchProgress: number;
  validationStatus: string;
  aimShootSkinStage: 'AIM' | 'SHOOT' | 'SKIN' | 'IDLE';
  metrics: {
    sourcesUsed: number;
    avgConfidence: number;
    durationMs: number;
  };
  runtime: {
    paused: boolean;
    startedAt: string | null;
    lastUpdated: string | null;
    notes: string[];
  };
}

interface ValidationResultEntry {
  validation?: { score?: number } & Record<string, unknown>;
  validationScore?: number;
  [key: string]: unknown;
}

interface LearningProgressResponse {
  agentId: string;
  userId: string;
  currentMode: LearningMode;
  progress: {
    percentage: number;
    averagePerformance: number;
    totalIterations: number;
    lastUpdated: string | null;
  };
  trainingTimeline: SerializedLearningHistoryEntry[];
  recommendations: GeniusAgentState['recommendations'];
  orchestratorStats: Record<string, unknown>;
}

interface NormalizedTrainingTopic {
  topic: string;
  complexity: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
}

type SerializedLearningHistoryEntry = Omit<LearningHistoryEntry, 'timestamp'> & {
  timestamp: string;
};

/**
 * Genius Agent specialized controller
 */
@Controller('agents/genius')
export class GeniusAgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    private readonly expertPoolManager: ExpertPoolManager,
    private readonly expertRuntime: GeniusExpertRuntimeService,
    private readonly geniusOrchestrator: GeniusAgentOrchestrator,
    private readonly learningModeAdapter: LearningModeAdapter,
    private readonly validationAdapter: ValidationAdapter,
    private readonly topicCatalogAdapter: TopicCatalogAdapter,
    @Inject('ILogger')
    private readonly logger: Logger,
  ) {}

  /**
   * POST /agents/genius/create - Create Genius learning agent
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createGeniusAgent(
    @Body()
    body: {
      name: string;
      userId: string;
      learningMode?: 'user-directed' | 'autonomous' | 'scheduled';
      expertPoolSize?: number;
    },
  ) {
    this.logger.info('Creating Genius agent', { name: body.name });

    const config = {
      learningMode: body.learningMode || 'user-directed',
      expertPoolSize: body.expertPoolSize || 5,
    };

    const agent = await this.agentService.createAgent(
      { name: body.name, agentType: 'genius', config },
      body.userId,
    );

    return {
      id: agent.id,
      name: body.name,
      type: 'genius',
      config,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * POST /agents/genius/:id/train - Train on data
   */
  @Post(':id/train')
  @HttpCode(HttpStatus.OK)
  async trainAgent(
    @Param('id') agentId: string,
    @Body() body: TrainingRequestBody,
  ) {
    if (!Array.isArray(body.trainingData) || body.trainingData.length === 0) {
      throw new BadRequestException('trainingData must include at least one sample');
    }

    const mode = this.mapLearningMode(body.mode);
    const instance = await this.ensureGeniusInstance(agentId, body.userId);
    instance.switchMode(mode);

    const topics = this.extractTrainingTopics(body.trainingData);
    const trainingInput = this.buildTrainingPrompt(body.trainingData, mode);

    const [agentExecution, learningModeResult, orchestratorResult] =
      await Promise.all([
        this.executeAgentUseCase.execute({
          agentId,
          userId: body.userId,
          input: trainingInput,
          context: {
            metadata: {
              trainingData: body.trainingData,
              mode,
            },
          },
        }),
        this.learningModeAdapter.executeLearningMode({
          userId: body.userId,
          mode: this.mapLearningModeToExecutionMode(mode),
          topics: topics.map((t) => t.topic),
        }),
        mode === LearningMode.SUPERVISED
          ? this.geniusOrchestrator.executeUserDirectedLearning(
              body.userId,
              topics.map((t) => ({ topic: t.topic, complexity: t.complexity })),
            )
          : this.geniusOrchestrator.executeAutonomousLearning(body.userId, {
              maxTopics: Math.max(topics.length, 1),
              minPriority: 0,
            }),
      ]);

    return {
      agentId,
      trainingId: `training_${Date.now()}`,
      mode,
      status: agentExecution.status,
      learningMode: learningModeResult,
      orchestrator: orchestratorResult,
      agentResult: agentExecution,
      topicsScheduled: topics.length,
      startedAt: learningModeResult.timestamp,
    };
  }

  /**
   * GET /agents/genius/:id/experts - Get expert pool
   */
  @Get(':id/experts')
  async getExpertPool(@Param('id') agentId: string, @UserId() userId: string) {
    await this.agentService.getAgent(agentId, userId);

    const [availableExperts, poolStats] = await Promise.all([
      this.expertPoolManager.getAvailableExperts(),
      this.expertPoolManager.getPoolStats(),
    ]);
    const activeExecutions = this.expertPoolManager.getActiveExecutions();
    const runtimeSnapshots = this.expertRuntime.getExperts(agentId);
    const runtimeMap = new Map(runtimeSnapshots.map((s) => [s.expertId, s]));
    const executionMap = new Map(
      activeExecutions.map((exec) => [exec.expertId, exec]),
    );

    const expertIds = new Set<string>([
      ...availableExperts.map((e) => e.id),
      ...activeExecutions.map((e) => e.expertId),
    ]);

    const experts: ExpertResponse[] = [];

    for (const expertId of expertIds) {
      const baseExpert =
        availableExperts.find((expert) => expert.id === expertId) ||
        (await this.expertPoolManager.getExpert(expertId as AgentId));

      if (!baseExpert) {
        continue;
      }

      const runtime = runtimeMap.get(expertId);
  const execution = executionMap.get(expertId as AgentId);
      const workLog = this.expertPoolManager.getExpertWorkLog(
        expertId as AgentId,
      );
      const stage = this.deriveStageFromWorkLog(workLog, runtime?.currentPhase);
      const researchProgress = this.estimateResearchProgress(
        stage,
        runtime?.researchProgress,
        execution,
      );
      const assignedTopics = this.serializeAssignments(
        runtime?.assignedTopics?.length
          ? runtime.assignedTopics
          : this.buildAssignmentsFromExecution(execution, researchProgress),
      );

      const sourcesUsed = workLog.filter(
        (entry) => entry.operationType === 'add-research',
      ).length;
      const confidenceValues = workLog
        .map((entry) => entry.metadata?.confidence as number | undefined)
        .filter((value): value is number => typeof value === 'number');

      const response: ExpertResponse = {
        expertId,
        name: `${baseExpert.specialization} Expert`,
        specialization: baseExpert.specialization,
        complexity: baseExpert.complexity,
        availability: baseExpert.availability,
        status: runtime?.paused
          ? 'paused'
          : execution
            ? 'active'
            : 'available',
        assignedTopics,
        researchProgress,
        validationStatus: runtime?.validationStatus || 'not-started',
        aimShootSkinStage: stage.toUpperCase() as ExpertResponse['aimShootSkinStage'],
        metrics: {
          sourcesUsed,
          avgConfidence:
            confidenceValues.length > 0
              ? confidenceValues.reduce((sum, value) => sum + value, 0) /
                confidenceValues.length
              : 0.72,
          durationMs: execution
            ? Date.now() - execution.startTime.getTime()
            : 0,
        },
        runtime: {
          paused: runtime?.paused ?? false,
          startedAt: this.toIso(execution?.startTime),
          lastUpdated: this.toIso(runtime?.updatedAt),
          notes: runtime?.notes ?? [],
        },
      };

      experts.push(response);
    }

    return {
      agentId,
      poolSize: experts.length,
      stats: this.serializePoolStats(poolStats),
      experts,
    };
  }

  /**
   * POST /agents/genius/:id/experts/add - Add expert to pool
   */
  @Post(':id/experts/add')
  @HttpCode(HttpStatus.CREATED)
  async addExpert(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      specialty: string;
      expertise?: string[];
      complexity?: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
      initialTopics?: ExpertTopicInput[];
    },
  ) {
    await this.agentService.getAgent(agentId, body.userId);

    const allocation = await this.expertPoolManager.allocateExperts({
      count: 1,
      specialization: body.specialty,
      expertise: body.expertise || [],
      complexity: body.complexity,
    });

    const expert = allocation.allocated[0];
    if (!expert) {
      throw new BadRequestException('Unable to allocate expert');
    }

    this.expertRuntime.registerExpert(agentId, expert.id, {
      specialization: expert.specialization,
      assignedTopics: [],
    });

    if (body.initialTopics?.length) {
      const assignments = body.initialTopics.map((topic, index) => ({
        topicId: topic.topicId || `manual-${Date.now()}-${index}`,
        title: topic.title,
        summary: topic.summary,
        priority: topic.priority,
        progress: 0,
        status: 'pending' as const,
        lastUpdated: new Date(),
      }));
      this.expertRuntime.assignTopics(agentId, expert.id, assignments);
    }

    return {
      success: true,
      expert: {
        expertId: expert.id,
        specialization: expert.specialization,
        expertise: expert.expertise,
        complexity: expert.complexity,
      },
    };
  }

  /**
   * GET /agents/genius/:id/learning-progress - Get learning progress
   */
  @Get(':id/learning-progress')
  async getLearningProgress(
    @Param('id') agentId: string,
    @UserId() userId: string,
  ): Promise<LearningProgressResponse> {
    const instance = await this.ensureGeniusInstance(agentId, userId);
    const [stats] = await Promise.all([
      this.geniusOrchestrator.getStatistics(userId),
    ]);

    const state = instance.getGeniusState();
    const progress = this.calculateLearningProgress(state);
    const trainingTimeline: SerializedLearningHistoryEntry[] =
      state.learningHistory.map((entry) => {
        const { timestamp, ...rest } = entry;
        return {
          ...rest,
          timestamp: timestamp.toISOString(),
        };
      });

    return {
      agentId,
      userId,
      currentMode: state.currentMode,
      progress,
      trainingTimeline,
      recommendations: state.recommendations,
      orchestratorStats: stats,
    };
  }

  /**
   * POST /agents/genius/:id/validate - Validate quality
   */
  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  async validateQuality(
    @Param('id') agentId: string,
    @Body()
    body: {
      userId: string;
      testData: Array<{ topic?: string; sources?: string[]; findings?: string[]; confidence?: number }>;
      integrate?: boolean;
    },
  ) {
    if (!Array.isArray(body.testData) || body.testData.length === 0) {
      throw new BadRequestException('testData must include at least one report');
    }

    await this.agentService.getAgent(agentId, body.userId);

    const reports = body.testData.map((report, idx) => ({
      topic: report.topic || `topic-${idx + 1}`,
      sources: report.sources || [],
      findings: report.findings || [],
      confidence: report.confidence ?? 0.7,
    }));

    const validation = await this.geniusOrchestrator.validateResearchReports(
      reports,
    );

    let integration: Record<string, unknown> | null = null;
    if (body.integrate) {
      integration = await this.geniusOrchestrator.integrateResearchResults(
        validation.results,
      );
    }

    const validationResults =
      (validation.results as ValidationResultEntry[]) || [];
    const summaryScore =
      validation.totalReports > 0
        ?
          validationResults.reduce(
            (sum: number, entry: ValidationResultEntry) => {
              const score =
                entry.validation?.score ?? entry.validationScore ?? 0;
              const normalizedScore =
                typeof score === 'number' ? score : Number(score) || 0;
              return sum + normalizedScore;
            },
            0,
          ) / validation.totalReports
        : 0;

    return {
      agentId,
      summary: {
        reports: validation.totalReports,
        passed: validation.passed,
        failed: validation.failed,
        successRate: validation.successRate,
        averageScore: summaryScore,
      },
      validation,
      integration,
    };
  }

  /**
   * POST /agents/genius/:id/experts/:expertId/reassign-topics - Reassign expert topics
   */
  @Post(':id/experts/:expertId/reassign-topics')
  async reassignExpertTopics(
    @Param('id') agentId: string,
    @Param('expertId') expertId: string,
    @Body()
    body: { userId: string; topics: ExpertTopicInput[] },
  ) {
    if (!body.topics?.length) {
      throw new BadRequestException('topics are required');
    }

    await this.agentService.getAgent(agentId, body.userId);
    const expert = await this.expertPoolManager.getExpert(expertId as AgentId);
    if (!expert) {
      throw new NotFoundException(`Expert '${expertId}' not found`);
    }

    const assignments = body.topics.map((topic, index) => ({
      topicId: topic.topicId || `topic-${Date.now()}-${index}`,
      title: topic.title,
      summary: topic.summary,
      priority: topic.priority,
      status: 'pending' as const,
      progress: 0,
      lastUpdated: new Date(),
    }));

    const snapshot = this.expertRuntime.assignTopics(
      agentId,
      expertId,
      assignments,
    );
    await this.expertPoolManager.markExpertBusy(expertId as AgentId);

    await Promise.all(
      assignments.map((assignment) =>
        this.topicCatalogAdapter
          .addTopic(assignment.title, {
            description:
              assignment.summary || `Assignment for expert ${expertId}`,
            complexity: `L${assignment.priority ?? 3}` as NormalizedTrainingTopic['complexity'],
            relatedTopics: [],
            lastResearched: new Date(),
            researchCount: 1,
            confidence: 0.75,
          })
          .catch(() => null),
      ),
    );

    return {
      expertId,
      assignments: this.serializeAssignments(snapshot.assignedTopics),
    };
  }

  /**
   * POST /agents/genius/:id/experts/:expertId/pause - Pause expert research
   */
  @Post(':id/experts/:expertId/pause')
  async pauseExpert(
    @Param('id') agentId: string,
    @Param('expertId') expertId: string,
    @Body() body: { userId: string; reason?: string },
  ) {
    await this.agentService.getAgent(agentId, body.userId);
    const expert = await this.expertPoolManager.getExpert(expertId as AgentId);
    if (!expert) {
      throw new NotFoundException(`Expert '${expertId}' not found`);
    }

    const snapshot = this.expertRuntime.pauseExpert(
      agentId,
      expertId,
      body.reason,
    );
    await this.expertPoolManager.markExpertBusy(expertId as AgentId);

    return {
      expertId,
      paused: true,
      assignments: this.serializeAssignments(snapshot.assignedTopics),
    };
  }

  /**
   * POST /agents/genius/:id/experts/:expertId/resume - Resume expert research
   */
  @Post(':id/experts/:expertId/resume')
  async resumeExpert(
    @Param('id') agentId: string,
    @Param('expertId') expertId: string,
    @Body() body: { userId: string; note?: string },
  ) {
    await this.agentService.getAgent(agentId, body.userId);
    const expert = await this.expertPoolManager.getExpert(expertId as AgentId);
    if (!expert) {
      throw new NotFoundException(`Expert '${expertId}' not found`);
    }

    const snapshot = this.expertRuntime.resumeExpert(
      agentId,
      expertId,
      body.note,
    );
    await this.expertPoolManager.markExpertAvailable(expertId as AgentId);

    return {
      expertId,
      paused: false,
      assignments: this.serializeAssignments(snapshot.assignedTopics),
    };
  }

  private async ensureGeniusInstance(
    agentId: string,
    userId: string,
  ): Promise<GeniusAgent> {
    const instance = await this.agentService.getAgentInstance(agentId, userId);
    if (!(instance instanceof GeniusAgent)) {
      throw new BadRequestException(`Agent '${agentId}' is not a Genius agent`);
    }
    return instance;
  }

  private mapLearningMode(mode: string): LearningMode {
    switch (mode) {
      case 'supervised':
        return LearningMode.SUPERVISED;
      case 'unsupervised':
        return LearningMode.UNSUPERVISED;
      case 'reinforcement':
        return LearningMode.REINFORCEMENT;
      default:
        throw new BadRequestException(`Unsupported learning mode '${mode}'`);
    }
  }

  private mapLearningModeToExecutionMode(
    mode: LearningMode,
  ): 'user-directed' | 'autonomous' | 'scheduled' {
    if (mode === LearningMode.SUPERVISED) {
      return 'user-directed';
    }
    if (mode === LearningMode.REINFORCEMENT) {
      return 'scheduled';
    }
    return 'autonomous';
  }

  private buildTrainingPrompt(
    trainingData: TrainingDataSample[],
    mode: LearningMode,
  ): string {
    const preview = trainingData
      .slice(0, 3)
      .map((sample, index) =>
        `Sample ${index + 1}: ${JSON.stringify(sample).substring(0, 200)}`,
      )
      .join('\n');

    return `Run ${mode.toLowerCase()} learning on ${trainingData.length} samples.\nPreview:\n${preview}`;
  }

  private extractTrainingTopics(
    trainingData: TrainingDataSample[],
  ): NormalizedTrainingTopic[] {
    const topics = trainingData.map((sample) => {
      const topic =
        sample.topic || sample.label || sample.title || 'General Research';
      const complexity = (sample.complexity || 'L3') as NormalizedTrainingTopic['complexity'];
      return { topic: String(topic), complexity };
    });

    const unique = new Map<string, NormalizedTrainingTopic>();
    topics.forEach((topic) => {
      if (!unique.has(topic.topic)) {
        unique.set(topic.topic, topic);
      }
    });
    return Array.from(unique.values());
  }

  private deriveStageFromWorkLog(
    workLog: KGModification[],
    runtimeStage?: string,
  ): 'aim' | 'shoot' | 'skin' | 'idle' {
    if (runtimeStage && ['aim', 'shoot', 'skin'].includes(runtimeStage)) {
      return runtimeStage as 'aim' | 'shoot' | 'skin';
    }

    const latest = workLog[workLog.length - 1];
    if (!latest) {
      return 'idle';
    }

    switch (latest.operationType) {
      case 'create-node':
      case 'create-edge':
        return 'aim';
      case 'update-node':
        return 'shoot';
      case 'add-research':
      case 'skin':
        return 'skin';
      default:
        return 'idle';
    }
  }

  private estimateResearchProgress(
    stage: 'aim' | 'shoot' | 'skin' | 'idle',
    runtimeProgress?: number,
    execution?: ActiveExecution,
  ): number {
    if (typeof runtimeProgress === 'number') {
      return runtimeProgress;
    }

    const base =
      stage === 'aim'
        ? 0.33
        : stage === 'shoot'
          ? 0.66
          : stage === 'skin'
            ? 0.95
            : 0;

    if (!execution) {
      return Math.round(base * 100);
    }

    const durationMs = Date.now() - execution.startTime.getTime();
    const incremental = Math.min(durationMs / (10 * 60 * 1000), 0.05);
    return Math.round(Math.min(1, base + incremental) * 100);
  }

  private buildAssignmentsFromExecution(
    execution: ActiveExecution | undefined,
    progress: number,
  ): ExpertTopicAssignment[] {
    if (!execution) {
      return [];
    }

    return [
      {
        topicId: execution.topicId || execution.topic,
        title: execution.topic,
        status: progress >= 100 ? 'completed' : 'in-progress',
        progress,
        lastUpdated: new Date(),
      },
    ];
  }

  private serializeAssignments(
    assignments: ExpertTopicAssignment[] | undefined,
  ) {
    return (assignments || []).map((assignment) => ({
      topicId: assignment.topicId,
      title: assignment.title,
      status: assignment.status,
      progress: assignment.progress,
      priority: assignment.priority,
      summary: assignment.summary,
      lastUpdated: assignment.lastUpdated.toISOString(),
    }));
  }

  private serializePoolStats(stats: ExpertPoolStats) {
    return {
      activeExperts: stats.activeExperts,
      totalExpertsSpawned: stats.totalExpertsSpawned,
      totalTopicsCompleted: stats.totalTopicsCompleted,
      totalTopicsFailed: stats.totalTopicsFailed,
      averageCompletionTimeMs: stats.averageCompletionTimeMs,
      collisionCount: stats.collisionCount,
      queuedRequests: stats.queuedRequests,
    };
  }

  private calculateLearningProgress(
    state: GeniusAgentState,
  ): LearningProgressResponse['progress'] {
    if (!state.learningHistory.length) {
      return {
        percentage: 0,
        averagePerformance: 0,
        totalIterations: 0,
        lastUpdated: null,
      };
    }

    const averagePerformance =
      state.learningHistory.reduce(
        (sum, entry) => sum + (entry.performance ?? 0),
        0,
      ) / state.learningHistory.length;

    const completed = state.learningHistory.filter(
      (entry) => entry.performance >= 0.8,
    ).length;

    return {
      percentage: Math.round((completed / state.learningHistory.length) * 100),
      averagePerformance: Number(averagePerformance.toFixed(2)),
      totalIterations: state.learningHistory.length,
      lastUpdated:
        state.learningHistory[state.learningHistory.length - 1]?.timestamp.toISOString() ||
        null,
    };
  }

  private toIso(date?: Date | null): string | null {
    return date ? date.toISOString() : null;
  }
}
