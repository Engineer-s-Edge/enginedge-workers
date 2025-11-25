import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  forwardRef,
} from '@nestjs/common';
import { ILogger } from '../ports/logger.port';
import { IAgentRepository } from '../ports/agent.repository';
import { BaseAgent } from '@domain/agents/agent.base';
import {
  GraphExecutionSnapshot,
  GraphNodeExecutionDetail,
  GraphNodeExecutionSummary,
  GraphEdgeQueueState,
  GraphNodeConvergenceConfig,
  GraphNodeDataOrdering,
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
  GraphMemoryGroupState,
  WorkflowEdge,
} from '@domain/agents/graph-agent/graph-agent.types';
import { Agent, AgentId } from '@domain/entities/agent.entity';
import { AgentConfig } from '@domain/value-objects/agent-config.vo';
import { AgentCapability } from '@domain/value-objects/agent-capability.vo';
import { AgentType } from '@domain/enums/agent-type.enum';
import { ExecutionResult } from '@domain/entities';
import { AgentFactory } from '@domain/services/agent-factory.service';
import { CreateAgentDTO, UpdateAgentDTO } from '../dto';
import { AgentExecutionService } from './agent-execution.service';
import { CheckpointService } from './checkpoint.service';
import { AgentSessionService, UserInteraction } from './agent-session.service';
import { AgentEventService } from './agent-event.service';

/**
 * AgentService - Core agent management
 *
 * Responsibilities:
 * - CRUD operations for agents
 * - Agent registry (in-memory cache)
 * - Session management
 * - Instance creation and lifecycle
 */
@Injectable()
export class AgentService {
  private agentRegistry: Map<string, Agent> = new Map();
  private agentInstances: Map<string, BaseAgent> = new Map();
  private sessionAgents: Map<string, string[]> = new Map(); // sessionId -> agentIds

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
    @Inject('IAgentRepository')
    private readonly agentRepository: IAgentRepository,
    private readonly agentFactory: AgentFactory,
    @Inject(forwardRef(() => AgentExecutionService))
    private readonly execution: AgentExecutionService,
    private readonly checkpoints: CheckpointService,
    private readonly sessions: AgentSessionService,
    private readonly events: AgentEventService,
  ) {
    this.logger.info('AgentService initialized', {
      agentsInRegistry: this.agentRegistry.size,
    });
  }

  /**
   * Create new agent
   */
  async createAgent(dto: CreateAgentDTO, userId: string): Promise<Agent> {
    try {
      // Check if agent with same name exists for this user
      const existingAgent = Array.from(this.agentRegistry.values()).find(
        (a) => a.name === dto.name,
      );

      if (existingAgent) {
        throw new ConflictException(
          `Agent with name '${dto.name}' already exists`,
        );
      }

      // Create agent config
      const config = AgentConfig.create({
        model: (dto.config?.model as string) || 'gpt-4',
        provider: (dto.config?.provider as string) || 'openai',
        temperature: dto.config?.temperature as number | undefined,
        maxTokens: dto.config?.maxTokens as number | undefined,
        systemPrompt: dto.config?.systemPrompt as string | undefined,
        enableTools: dto.config?.enableTools as boolean | undefined,
        toolNames: dto.config?.toolNames as string[] | undefined,
        streamingEnabled: dto.config?.streamingEnabled as boolean | undefined,
        timeout: dto.config?.timeout as number | undefined,
      });

      // Create agent capability
      const capability = AgentCapability.create({
        executionModel: this.getExecutionModel(dto.agentType) as any,
        canUseTools: (dto.config?.enableTools as boolean) ?? false,
        canStreamResults: (dto.config?.streamingEnabled as boolean) ?? false,
        canPauseResume: dto.agentType === 'graph',
        canCoordinate: ['collective', 'manager'].includes(dto.agentType),
        supportsParallelExecution: dto.agentType === 'collective',
        maxInputTokens: 4096,
        maxOutputTokens: 2048,
        supportedMemoryTypes: ['buffer', 'buffer_window', 'summary'],
        timeoutMs: (dto.config?.timeout as number) || 30000,
      });

      // Create agent entity using factory method
      const agent = Agent.create(
        dto.name,
        this.mapAgentType(dto.agentType),
        config,
        capability,
      );

      // Persist to repository
      await this.agentRepository.save(agent);

      // Save to registry
      this.agentRegistry.set(agent.id, agent);

      this.logger.info('Agent created', {
        agentId: agent.id,
        name: agent.name,
        userId,
      });

      return agent;
    } catch (error) {
      this.logger.error(
        'Failed to create agent',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  private mapAgentType(
    type: string,
  ): (typeof AgentType)[keyof typeof AgentType] {
    const typeMap: Record<string, (typeof AgentType)[keyof typeof AgentType]> =
      {
        react: AgentType.REACT,
        graph: AgentType.GRAPH,
        expert: AgentType.EXPERT,
        genius: AgentType.GENIUS,
        collective: AgentType.COLLECTIVE,
        manager: AgentType.MANAGER,
      };
    return typeMap[type] || AgentType.REACT;
  }

  private getExecutionModel(type: string): string {
    const modelMap: Record<string, string> = {
      react: 'chain-of-thought',
      graph: 'dag',
      expert: 'research',
      genius: 'learning',
      collective: 'coordination',
      manager: 'hierarchical',
    };
    return modelMap[type] || 'chain-of-thought';
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string, userId?: string): Promise<Agent> {
    try {
      // Check registry first
      let agent = this.agentRegistry.get(agentId);

      if (!agent) {
        // Load from repository
        const foundAgent = await this.agentRepository.findById(
          agentId as AgentId,
        );
        if (foundAgent) {
          agent = foundAgent;
          this.agentRegistry.set(agentId, foundAgent);
        }
      }

      if (!agent) {
        throw new NotFoundException(`Agent '${agentId}' not found`);
      }

      return agent;
    } catch (error) {
      this.logger.error(
        'Failed to get agent',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * List agents for user
   */
  async listAgents(
    userId: string,
    filter?: { type?: string; active?: boolean },
  ): Promise<Agent[]> {
    try {
      let agents = Array.from(this.agentRegistry.values());

      // Apply filters
      if (filter?.type) {
        const agentType = this.mapAgentType(filter.type);
        agents = agents.filter((a) => a.agentType === agentType);
      }

      return agents.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    } catch (error) {
      this.logger.error(
        'Failed to list agents',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Update agent
   */
  async updateAgent(
    agentId: string,
    dto: UpdateAgentDTO,
    userId: string,
  ): Promise<Agent> {
    try {
      let agent = await this.getAgent(agentId, userId);

      // Update config if provided (Agent is immutable, so we create new instances)
      if (dto.config) {
        const updatedConfig = agent.config.update(dto.config);
        agent = agent.withConfig(updatedConfig);
      }

      // Persist to repository
      await this.agentRepository.save(agent);

      // Update registry
      this.agentRegistry.set(agentId, agent);

      this.logger.info('Agent updated', { agentId, userId });

      return agent;
    } catch (error) {
      this.logger.error(
        'Failed to update agent',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Delete agent
   */
  async deleteAgent(agentId: string, userId: string): Promise<void> {
    try {
      const agent = await this.getAgent(agentId, userId);

      // Persist deletion to repository
      await this.agentRepository.delete(agentId as AgentId);

      // Remove from registry
      this.agentRegistry.delete(agentId);

      // Remove instances
      this.agentInstances.delete(agentId);

      this.logger.info('Agent deleted', { agentId, userId });
    } catch (error) {
      this.logger.error(
        'Failed to delete agent',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Get (or create) agent instance
   */
  async getAgentInstance(agentId: string, userId: string): Promise<BaseAgent> {
    let instance = this.agentInstances.get(agentId);

    if (instance) return instance;

    try {
      // Get agent definition
      const agent = await this.getAgent(agentId, userId);

      // Create instance
      instance = this.agentFactory.createInstance(agent);

      // Cache instance
      this.agentInstances.set(agentId, instance);

      this.logger.debug('Agent instance created', {
        agentId,
        type: agent.agentType,
      });

      return instance;
    } catch (error) {
      this.logger.error(
        'Failed to get agent instance',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Execute agent (delegates to AgentExecutionService)
   */
  async executeAgent(
    agentId: string,
    userId: string,
    input: string,
    context?: any,
  ): Promise<ExecutionResult> {
    return this.execution.execute(agentId, userId, input, context);
  }

  /**
   * Stream agent execution (delegates to AgentExecutionService)
   */
  async *streamAgent(
    agentId: string,
    userId: string,
    input: string,
    context?: any,
  ): AsyncGenerator<string> {
    for await (const chunk of this.execution.stream(
      agentId,
      userId,
      input,
      context,
    )) {
      yield chunk;
    }
  }

  /**
   * Abort agent execution
   */
  async abortAgent(agentId: string): Promise<void> {
    const instance = this.agentInstances.get(agentId);
    if (!instance) {
      throw new NotFoundException(`Agent instance '${agentId}' not found`);
    }
    instance.abort();
    this.logger.info('Agent execution aborted', { agentId });
  }

  /**
   * Graph agent: pause by aborting and checkpointing
   */
  async pauseGraphAgent(
    agentId: string,
    userId: string,
    options?: { reason?: string },
  ): Promise<{ checkpointId?: string }> {
    try {
      const instance = await this.getAgentInstance(agentId, userId);
      // Attempt to get graph-specific state if available
      const state =
        this.getGraphSnapshotFromInstance(instance) ||
        ({ note: 'no_graph_state' } as Record<string, unknown>);

      // Create checkpoint
      const checkpoint = await this.checkpoints.createCheckpoint(
        agentId,
        userId,
        state,
        'Paused checkpoint',
        { reason: options?.reason || 'pause' },
      );

      // Abort execution
      try {
        instance.abort();
      } catch {}

      // Mark session(s) paused
      const sessions = await this.sessions.getAgentSessions(agentId);
      for (const s of sessions)
        await this.sessions.updateSessionStatus(s.sessionId, 'paused');

      return { checkpointId: checkpoint.id };
    } catch (e) {
      this.logger.error('Failed to pause graph agent', { agentId, userId, e });
      throw e;
    }
  }

  /**
   * Graph agent: resume (placeholder - relies on executing again)
   */
  async resumeGraphAgent(
    agentId: string,
    userId: string,
    checkpointId?: string,
  ): Promise<{ ok: boolean; message?: string }> {
    const instance = await this.getAgentInstance(agentId, userId);
    if (checkpointId) {
      const state = await this.checkpoints.restoreFromCheckpoint(checkpointId);
      this.restoreGraphSnapshotOnInstance(instance, state, agentId);
      // store in session metadata for next execution
      const sessions = await this.sessions.getAgentSessions(agentId);
      if (sessions[0]) {
        sessions[0].metadata = {
          ...(sessions[0].metadata || {}),
          restoredState: state,
        };
      }
    }
    const sessions = await this.sessions.getAgentSessions(agentId);
    for (const s of sessions)
      await this.sessions.updateSessionStatus(s.sessionId, 'active');
    return {
      ok: true,
      message: 'Resume triggered; start a new execution to continue.',
    };
  }

  /**
   * Graph agent: provide user input for pending interaction
   */
  async provideGraphAgentUserInput(
    agentId: string,
    userId: string,
    nodeId: string,
    input: unknown,
  ): Promise<void> {
    const sessions = await this.sessions.getAgentSessions(agentId);
    const interaction = this.sessions.setupUserInteractionHandling(
      agentId,
      // pick the first active session
      sessions[0]?.sessionId || `session_${Date.now()}`,
      'input',
      `node:${nodeId}`,
    );
    this.sessions.resolveUserInteraction(interaction.interactionId, input);
  }

  /**
   * Graph agent: provide approval
   */
  async provideGraphAgentUserApproval(
    agentId: string,
    userId: string,
    nodeId: string,
    approved: boolean,
  ): Promise<void> {
    const sessions = await this.sessions.getAgentSessions(agentId);
    const interaction = this.sessions.setupUserInteractionHandling(
      agentId,
      sessions[0]?.sessionId || `session_${Date.now()}`,
      'approval',
      `node:${nodeId}`,
    );
    this.sessions.resolveUserInteraction(interaction.interactionId, approved);
  }

  /**
   * Graph agent: provide chat action
   */
  async provideGraphAgentChatAction(
    agentId: string,
    userId: string,
    nodeId: string,
    action: 'continue' | 'end',
    input?: string,
  ): Promise<void> {
    const sessions = await this.sessions.getAgentSessions(agentId);
    const interaction = this.sessions.setupUserInteractionHandling(
      agentId,
      sessions[0]?.sessionId || `session_${Date.now()}`,
      'choice',
      `node:${nodeId}:${action}`,
    );
    this.sessions.resolveUserInteraction(interaction.interactionId, {
      action,
      input,
    });
  }

  /**
   * Graph agent: get pending interactions
   */
  async getGraphAgentPendingUserInteractions(
    agentId: string,
    userId: string,
  ): Promise<unknown[]> {
    return this.sessions.getPendingUserInteractions(agentId);
  }

  /**
   * Graph agent: get execution state summary
   */
  async getGraphAgentExecutionState(
    agentId: string,
    userId: string,
  ): Promise<{ isPaused: boolean } & GraphExecutionSnapshot> {
    const sessions = await this.sessions.getAgentSessions(agentId);
    const isPaused = sessions.some((s) => s.status === 'paused');
    const instance = await this.getAgentInstance(agentId, userId);
    const graphState =
      this.getGraphSnapshotFromInstance(instance) ||
      ({
        currentNodeIds: [],
        pendingNodeIds: [],
        executedNodes: [],
        failedNodes: [],
        nodeResults: [],
        retryAttempts: {},
        executionHistory: [],
      } as GraphExecutionSnapshot);
    return {
      isPaused,
      ...graphState,
    };
  }

  async getGraphAgentNodeExecutionSummaries(
    agentId: string,
    userId: string,
    nodeId: string,
    limit = 20,
  ): Promise<GraphNodeExecutionSummary[]> {
    const instance = await this.getAgentInstance(agentId, userId);
    const historyCapable = instance as GraphSnapshotCapable;
    if (typeof historyCapable.getNodeExecutionSummaries === 'function') {
      return historyCapable.getNodeExecutionSummaries(nodeId, limit) || [];
    }
    return [];
  }

  async getGraphAgentNodeExecutionDetail(
    agentId: string,
    userId: string,
    nodeId: string,
    executionId: string,
  ): Promise<GraphNodeExecutionDetail | null> {
    const instance = await this.getAgentInstance(agentId, userId);
    const historyCapable = instance as GraphSnapshotCapable;
    if (typeof historyCapable.getNodeExecutionDetail === 'function') {
      return historyCapable.getNodeExecutionDetail(nodeId, executionId) || null;
    }
    return null;
  }

  async getGraphAgentEdgeQueue(
    agentId: string,
    userId: string,
    edgeId: string,
  ): Promise<GraphEdgeQueueState | null> {
    const instance = await this.getAgentInstance(agentId, userId);
    const queueCapable = instance as GraphSnapshotCapable;
    if (typeof queueCapable.getEdgeQueueState === 'function') {
      const queueState = queueCapable.getEdgeQueueState(edgeId);
      if (queueState) {
        return queueState;
      }
    }

    const snapshot = this.getGraphSnapshotFromInstance(instance);
    return snapshot?.edgeQueues?.[edgeId] ?? null;
  }

  async getGraphEdgeHistory(
    agentId: string,
    userId: string,
    edgeId: string,
    options?: GraphEdgeHistoryQueryOptions,
  ): Promise<GraphEdgeHistoryQueryResult<GraphEdgeHistoryEntry>> {
    const instance = await this.getAgentInstance(agentId, userId);
    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.getEdgeHistory === 'function') {
      return graphCapable.getEdgeHistory(edgeId, options);
    }

    const snapshot = this.getGraphSnapshotFromInstance(instance);
    const fallback = snapshot?.edgeHistory?.[edgeId] ?? [];
    return this.buildEdgeHistoryPage(fallback, options);
  }

  async getGraphEdgeDecisionHistory(
    agentId: string,
    userId: string,
    edgeId: string,
    options?: GraphEdgeHistoryQueryOptions,
  ): Promise<GraphEdgeHistoryQueryResult<GraphEdgeDecisionEntry>> {
    const instance = await this.getAgentInstance(agentId, userId);
    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.getEdgeDecisionHistory === 'function') {
      return graphCapable.getEdgeDecisionHistory(edgeId, options);
    }

    const snapshot = this.getGraphSnapshotFromInstance(instance);
    const fallback = snapshot?.edgeDecisions?.[edgeId] ?? [];
    return this.buildEdgeHistoryPage(fallback, options);
  }

  async getGraphNodeConvergenceState(
    agentId: string,
    userId: string,
    nodeId: string,
  ): Promise<GraphNodeConvergenceState | null> {
    const instance = await this.getAgentInstance(agentId, userId);
    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.getNodeConvergenceState === 'function') {
      const state = graphCapable.getNodeConvergenceState(nodeId);
      if (state) {
        return state;
      }
    }

    const snapshot = this.getGraphSnapshotFromInstance(instance);
    return snapshot?.convergenceState?.[nodeId] ?? null;
  }

  async getGraphMemoryGroups(
    agentId: string,
    userId: string,
  ): Promise<GraphMemoryGroupState[]> {
    const instance = await this.getAgentInstance(agentId, userId);
    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.getMemoryGroups === 'function') {
      const groups = graphCapable.getMemoryGroups();
      if (groups) {
        return groups;
      }
    }

    const snapshot = this.getGraphSnapshotFromInstance(instance);
    return snapshot?.memoryGroups ?? [];
  }

  async getGraphMemoryGroup(
    agentId: string,
    userId: string,
    groupId: string,
  ): Promise<GraphMemoryGroupState | null> {
    const instance = await this.getAgentInstance(agentId, userId);
    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.getMemoryGroup === 'function') {
      const group = graphCapable.getMemoryGroup(groupId);
      if (group) {
        return group;
      }
    }

    const snapshot = this.getGraphSnapshotFromInstance(instance);
    return (
      snapshot?.memoryGroups?.find((candidate) => candidate.id === groupId) ??
      null
    );
  }

  async updateGraphNodeConvergenceConfig(
    agentId: string,
    userId: string,
    nodeId: string,
    config: GraphNodeConvergenceConfig,
  ): Promise<GraphNodeConvergenceConfig> {
    const instance = await this.getAgentInstance(agentId, userId);
    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.updateConvergenceConfig !== 'function') {
      throw new NotFoundException(
        'Graph agent does not support convergence config updates',
      );
    }
    const updated = graphCapable.updateConvergenceConfig(nodeId, config);
    if (!updated) {
      throw new NotFoundException(
        `Node '${nodeId}' not found or convergence config unavailable`,
      );
    }
    return updated;
  }

  async updateGraphNodeDataOrdering(
    agentId: string,
    userId: string,
    nodeId: string,
    ordering: GraphNodeDataOrdering,
  ): Promise<GraphNodeDataOrdering> {
    const instance = await this.getAgentInstance(agentId, userId);
    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.updateDataOrdering !== 'function') {
      throw new NotFoundException(
        'Graph agent does not support data ordering updates',
      );
    }
    const updated = graphCapable.updateDataOrdering(nodeId, ordering);
    if (!updated) {
      throw new NotFoundException(
        `Node '${nodeId}' not found or data ordering unavailable`,
      );
    }
    return updated;
  }

  async bulkUpdateGraphNodes(
    agentId: string,
    userId: string,
    filter: GraphNodeBulkUpdateFilter | undefined,
    updates: GraphNodeBulkUpdatePayload,
  ): Promise<GraphBulkUpdateResult> {
    const instance = await this.getAgentInstance(agentId, userId);
    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.bulkUpdateNodes !== 'function') {
      throw new NotFoundException(
        'Graph agent does not support node bulk updates',
      );
    }
    try {
      return graphCapable.bulkUpdateNodes(filter, updates);
    } catch (error) {
      this.logger.warn('Graph node bulk update failed', {
        agentId,
        error: error instanceof Error ? error.message : error,
      });
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Unable to process bulk node update request',
      );
    }
  }

  async bulkUpdateGraphEdges(
    agentId: string,
    userId: string,
    filter: GraphEdgeBulkUpdateFilter | undefined,
    updates: GraphEdgeBulkUpdatePayload,
  ): Promise<GraphBulkUpdateResult> {
    const instance = await this.getAgentInstance(agentId, userId);
    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.bulkUpdateEdges !== 'function') {
      throw new NotFoundException(
        'Graph agent does not support edge bulk updates',
      );
    }
    try {
      return graphCapable.bulkUpdateEdges(filter, updates);
    } catch (error) {
      this.logger.warn('Graph edge bulk update failed', {
        agentId,
        error: error instanceof Error ? error.message : error,
      });
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Unable to process bulk edge update request',
      );
    }
  }

  async updateGraphEdgeCheckpoint(
    agentId: string,
    userId: string,
    edgeId: string,
    isCheckpoint: boolean,
  ): Promise<WorkflowEdge> {
    const instance = await this.getAgentInstance(agentId, userId);
    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.updateEdgeCheckpoint !== 'function') {
      throw new NotFoundException('Graph agent does not support edge updates');
    }
    const updated = graphCapable.updateEdgeCheckpoint(edgeId, isCheckpoint);
    if (!updated) {
      throw new NotFoundException(
        `Edge '${edgeId}' not found or checkpoint flag unavailable`,
      );
    }
    return updated;
  }

  async listGraphRuntimeCheckpoints(
    agentId: string,
    userId: string,
  ): Promise<GraphRuntimeCheckpointSummary[]> {
    const instance = await this.getAgentInstance(agentId, userId);
    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.getRuntimeCheckpointSummaries !== 'function') {
      return [];
    }
    return graphCapable.getRuntimeCheckpointSummaries() || [];
  }

  async getGraphRuntimeCheckpointSnapshot(
    agentId: string,
    userId: string,
    checkpointId: string,
  ): Promise<GraphExecutionSnapshot | null> {
    const instance = await this.getAgentInstance(agentId, userId);
    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.getRuntimeCheckpointSnapshot !== 'function') {
      return null;
    }
    return graphCapable.getRuntimeCheckpointSnapshot(checkpointId);
  }

  async restoreGraphRuntimeCheckpoint(
    agentId: string,
    userId: string,
    checkpointId: string,
  ): Promise<GraphExecutionSnapshot> {
    const instance = await this.getAgentInstance(agentId, userId);
    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.getRuntimeCheckpointSnapshot !== 'function') {
      throw new NotFoundException(
        'Graph agent does not expose runtime checkpoints',
      );
    }
    if (typeof graphCapable.restoreGraphState !== 'function') {
      throw new NotFoundException(
        'Graph agent does not support checkpoint restore',
      );
    }

    const snapshot = graphCapable.getRuntimeCheckpointSnapshot(checkpointId);
    if (!snapshot) {
      throw new NotFoundException(
        `Checkpoint '${checkpointId}' not found for agent '${agentId}'`,
      );
    }

    graphCapable.restoreGraphState(snapshot);
    return snapshot;
  }

  /**
   * Get agent state
   */
  async getAgentState(agentId: string) {
    try {
      const instance = this.agentInstances.get(agentId);

      if (!instance) {
        throw new NotFoundException(`Agent instance '${agentId}' not found`);
      }

      return instance.getState();
    } catch (error) {
      this.logger.error(
        'Failed to get agent state',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Release session agents
   */
  async releaseSession(sessionId: string): Promise<void> {
    try {
      const agentIds = this.sessionAgents.get(sessionId) || [];

      for (const agentId of agentIds) {
        this.agentInstances.delete(agentId);
      }

      this.sessionAgents.delete(sessionId);

      this.logger.debug('Session released', {
        sessionId,
        agentCount: agentIds.length,
      });
    } catch (error) {
      this.logger.error(
        'Failed to release session',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Generate unique agent ID
   */
  private generateAgentId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    return {
      registeredAgents: this.agentRegistry.size,
      activeInstances: this.agentInstances.size,
      activeSessions: this.sessionAgents.size,
      // Note: execution stats would be tracked separately in a metrics system
      totalExecutions: 0,
    };
  }

  /**
   * Reconfigure agent at runtime (updates config, recreates instance)
   */
  async reconfigureAgent(
    agentId: string,
    userId: string,
    updates: Record<string, unknown>,
  ): Promise<Agent> {
    let agent = await this.getAgent(agentId, userId);

    const updatedConfig = agent.config.update(updates as any);
    agent = agent.withConfig(updatedConfig);

    await this.agentRepository.save(agent);
    this.agentRegistry.set(agentId, agent);

    // Recreate instance to apply changes immediately
    this.agentInstances.delete(agentId);
    await this.getAgentInstance(agentId, userId);

    this.logger.info('Agent reconfigured at runtime', { agentId });
    return agent;
  }

  /**
   * Switch LLM provider/model at runtime
   */
  async switchAgentProvider(
    agentId: string,
    userId: string,
    provider: string,
    model?: string,
  ): Promise<void> {
    await this.reconfigureAgent(agentId, userId, {
      provider,
      model: model || undefined,
    });
  }

  /**
   * Switch memory configuration at runtime
   */
  async switchAgentMemory(
    agentId: string,
    userId: string,
    memory: Record<string, unknown>,
  ): Promise<void> {
    await this.reconfigureAgent(agentId, userId, {
      memory,
    } as any);
  }

  /**
   * Restore agent state from checkpoint (by id or name)
   */
  async restoreAgentCheckpoint(
    agentId: string,
    userId: string,
    search: { id?: string; name?: string; description?: string },
  ): Promise<{ success: boolean; data: any | undefined }> {
    let data: any | undefined;

    if (search.id) {
      const cp = await this.checkpoints.getCheckpoint(search.id);
      data = cp?.state;
    } else if (search.name) {
      const list = await this.checkpoints.listCheckpoints(agentId);
      const cp = list.find((c) => c.name === search.name);
      data = cp?.state;
    } else {
      const latest = await this.checkpoints.getLatestCheckpoint(agentId);
      data = latest?.state;
    }

    // Store into the first session's metadata for next execution
    const sessions = await this.sessions.getAgentSessions(agentId);
    if (sessions[0] && data) {
      sessions[0].metadata = {
        ...(sessions[0].metadata || {}),
        restoredState: data,
      };
    }

    return { success: !!data, data };
  }

  /**
   * Send a correction/interruption to an agent
   */
  async correctAgent(
    agentId: string,
    userId: string,
    correctionInput: string,
    context?: string,
  ): Promise<void> {
    // Emit correction event; consumers can incorporate it on next execution
    this.events.emitEvent({
      type: 'agent.message',
      agentId,
      userId,
      timestamp: new Date(),
      data: { kind: 'correction', input: correctionInput, context },
    });
  }

  /**
   * Remove an agent instance from memory
   */
  async removeAgent(agentId: string, userId?: string): Promise<void> {
    const instance = this.agentInstances.get(agentId);
    if (instance) {
      try {
        instance.abort();
      } catch {}
      this.agentInstances.delete(agentId);
    }

    // Close sessions for this agent
    const sessions = await this.sessions.getAgentSessions(agentId);
    for (const s of sessions) {
      await this.sessions.updateSessionStatus(s.sessionId, 'completed');
      await this.sessions.deleteSession(s.sessionId);
    }

    // Emit aborted/cleanup event
    if (userId) {
      this.events.emitEvent({
        type: 'agent.aborted',
        agentId,
        userId,
        timestamp: new Date(),
        data: { reason: 'removed' },
      });
    }

    this.logger.info('Agent instance removed', { agentId });
  }

  /**
   * Clear all agent instances from memory
   */
  async clearAllAgents(): Promise<void> {
    for (const [agentId, instance] of this.agentInstances.entries()) {
      try {
        instance.abort();
      } catch {}
      this.agentInstances.delete(agentId);
    }
  }

  /**
   * Continue Graph agent with new input (after checkpoint)
   * If stream is true, returns an async generator.
   */
  async continueGraphAgentWithInput(
    agentId: string,
    userId: string,
    newInput: string,
    options?: { checkpointId?: string; stream?: boolean },
  ): Promise<AsyncIterable<string> | ExecutionResult> {
    if (options?.checkpointId) {
      const state = await this.checkpoints.restoreFromCheckpoint(
        options.checkpointId,
      );
      const instance = await this.getAgentInstance(agentId, userId);
      this.restoreGraphSnapshotOnInstance(instance, state, agentId);
      const sessions = await this.sessions.getAgentSessions(agentId);
      if (sessions[0]) {
        sessions[0].metadata = {
          ...(sessions[0].metadata || {}),
          restoredState: state,
        };
      }
    }

    if (options?.stream) {
      return this.execution.stream(agentId, userId, newInput, {});
    }

    return this.execution.execute(agentId, userId, newInput, {});
  }

  /**
   * Get Graph node conversation history (if supported by instance)
   */
  async getGraphAgentNodeConversationHistory(
    agentId: string,
    userId: string,
    nodeId: string,
  ): Promise<Array<{
    message: string;
    isUser: boolean;
    timestamp: Date;
  }> | null> {
    const instance = await this.getAgentInstance(agentId, userId);
    const anyInstance = instance as any;
    if (typeof anyInstance.getNodeConversationHistory === 'function') {
      return (await anyInstance.getNodeConversationHistory(nodeId)) || null;
    }
    return null;
  }

  /**
   * Check if any pending user interactions exist for Graph agent
   */
  async hasGraphAgentAwaitingUserInteraction(
    agentId: string,
  ): Promise<boolean> {
    const pending = this.sessions.getPendingUserInteractions(agentId);
    return pending.length > 0;
  }

  async getGraphAgentHitlQueue(
    agentId: string,
    userId: string,
    options?: { hitlType?: HitlSeverity },
  ): Promise<GraphHitlQueueEntry[]> {
    const pending = this.sessions.getPendingUserInteractions(agentId);
    if (pending.length === 0) {
      return [];
    }

    const nodeMeta = await this.buildNodeMetadata(agentId, userId);

    return pending
      .map((interaction) => this.toHitlQueueEntry(interaction, nodeMeta))
      .filter((entry) =>
        options?.hitlType ? entry.hitlType === options.hitlType : true,
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  private async buildNodeMetadata(
    agentId: string,
    userId: string,
  ): Promise<Map<string, GraphHitlNodeMetadata>> {
    const metadata = new Map<string, GraphHitlNodeMetadata>();
    try {
      const instance = await this.getAgentInstance(agentId, userId);
      const graphState = this.getGraphSnapshotFromInstance(instance);
      const nodes = graphState?.graph?.nodes || [];
      for (const node of nodes) {
        metadata.set(node.id, { nodeId: node.id, nodeName: node.name });
      }
    } catch (error) {
      this.logger.debug('Failed to build node metadata for HITL queue', {
        agentId,
        error,
      });
    }
    return metadata;
  }

  private toHitlQueueEntry(
    interaction: UserInteraction,
    nodeMeta: Map<string, GraphHitlNodeMetadata>,
  ): GraphHitlQueueEntry {
    const parsed = this.parseInteractionPrompt(interaction.prompt);
    const nodeData =
      (parsed.nodeId && nodeMeta.get(parsed.nodeId)) ||
      (parsed.nodeId ? { nodeId: parsed.nodeId } : {});
    const createdAt = interaction.createdAt || new Date();
    return {
      interactionId: interaction.interactionId,
      sessionId: interaction.sessionId,
      hitlType: this.mapHitlType(interaction.type),
      interactionType: interaction.type,
      prompt: interaction.prompt,
      description: parsed.description,
      createdAt,
      waitingMs: Date.now() - createdAt.getTime(),
      ...nodeData,
    };
  }

  private parseInteractionPrompt(prompt: string): {
    nodeId?: string;
    description?: string;
  } {
    if (!prompt?.startsWith('node:')) {
      return { description: prompt };
    }
    const parts = prompt.split(':');
    const nodeId = parts[1];
    if (!nodeId) {
      return { description: prompt };
    }
    const remainder = parts.slice(2).join(':');
    return {
      nodeId,
      description: remainder
        ? `Awaiting ${remainder}`
        : 'Awaiting user interaction',
    };
  }

  private mapHitlType(type: UserInteraction['type']): HitlSeverity {
    switch (type) {
      case 'approval':
        return 'yellow';
      case 'choice':
        return 'red';
      case 'input':
      default:
        return 'green';
    }
  }

  private getGraphSnapshotFromInstance(
    instance: BaseAgent,
  ): GraphExecutionSnapshot | null {
    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.getGraphState === 'function') {
      return graphCapable.getGraphState();
    }
    return null;
  }

  private restoreGraphSnapshotOnInstance(
    instance: BaseAgent,
    snapshot: unknown,
    agentId: string,
  ): void {
    if (!this.isGraphSnapshot(snapshot)) {
      this.logger.warn('Attempted to restore invalid graph snapshot', {
        agentId,
      });
      return;
    }

    const graphCapable = instance as GraphSnapshotCapable;
    if (typeof graphCapable.restoreGraphState === 'function') {
      graphCapable.restoreGraphState(snapshot);
    } else {
      this.logger.warn('Graph agent does not support checkpoint restore', {
        agentId,
      });
    }
  }

  private isGraphSnapshot(
    snapshot: unknown,
  ): snapshot is GraphExecutionSnapshot {
    if (!snapshot || typeof snapshot !== 'object') {
      return false;
    }
    const candidate = snapshot as Record<string, unknown>;
    return (
      'currentNodeIds' in candidate ||
      'pendingNodeIds' in candidate ||
      'executionHistory' in candidate
    );
  }

  private buildEdgeHistoryPage<T extends { timestamp: string }>(
    entries: T[],
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

    const maxWindow = entries.length;
    const limit =
      options?.limit && options.limit > 0
        ? Math.min(options.limit, maxWindow)
        : maxWindow;
    const direction = options?.direction === 'forward' ? 'forward' : 'backward';

    const startBound = this.parseTimestamp(options?.start);
    const endBound = this.parseTimestamp(options?.end);
    const cursorTs = this.parseTimestamp(options?.cursor);

    const getTimestamp = (entry: T): number =>
      this.parseTimestamp(entry.timestamp) ?? 0;

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

  private parseTimestamp(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
}

interface GraphSnapshotCapable {
  getGraphState?: () => GraphExecutionSnapshot;
  restoreGraphState?: (snapshot: GraphExecutionSnapshot) => void;
  getNodeExecutionSummaries?: (
    nodeId: string,
    limit?: number,
  ) => GraphNodeExecutionSummary[];
  getNodeExecutionDetail?: (
    nodeId: string,
    executionId: string,
  ) => GraphNodeExecutionDetail | null;
  getEdgeQueueState?: (edgeId: string) => GraphEdgeQueueState | null;
  updateConvergenceConfig?: (
    nodeId: string,
    config: GraphNodeConvergenceConfig,
  ) => GraphNodeConvergenceConfig | null;
  updateDataOrdering?: (
    nodeId: string,
    ordering: GraphNodeDataOrdering,
  ) => GraphNodeDataOrdering | null;
  updateEdgeCheckpoint?: (
    edgeId: string,
    isCheckpoint: boolean,
  ) => WorkflowEdge | null;
  getRuntimeCheckpointSummaries?: () => GraphRuntimeCheckpointSummary[];
  getRuntimeCheckpointSnapshot?: (
    checkpointId: string,
  ) => GraphExecutionSnapshot | null;
  getNodeConvergenceState?: (
    nodeId: string,
  ) => GraphNodeConvergenceState | null;
  getMemoryGroups?: () => GraphMemoryGroupState[];
  getMemoryGroup?: (groupId: string) => GraphMemoryGroupState | null;
  bulkUpdateNodes?: (
    filter: GraphNodeBulkUpdateFilter | undefined,
    updates: GraphNodeBulkUpdatePayload,
  ) => GraphBulkUpdateResult;
  bulkUpdateEdges?: (
    filter: GraphEdgeBulkUpdateFilter | undefined,
    updates: GraphEdgeBulkUpdatePayload,
  ) => GraphBulkUpdateResult;
  getEdgeHistory?: (
    edgeId: string,
    options?: GraphEdgeHistoryQueryOptions,
  ) => GraphEdgeHistoryQueryResult<GraphEdgeHistoryEntry>;
  getEdgeDecisionHistory?: (
    edgeId: string,
    options?: GraphEdgeHistoryQueryOptions,
  ) => GraphEdgeHistoryQueryResult<GraphEdgeDecisionEntry>;
}

type HitlSeverity = 'green' | 'yellow' | 'red';

interface GraphHitlNodeMetadata {
  nodeId?: string;
  nodeName?: string;
}

export interface GraphHitlQueueEntry extends GraphHitlNodeMetadata {
  interactionId: string;
  sessionId: string;
  hitlType: HitlSeverity;
  interactionType: UserInteraction['type'];
  prompt: string;
  description?: string;
  createdAt: Date;
  waitingMs: number;
}
