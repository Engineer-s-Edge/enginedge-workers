/**
 * Communication Service
 *
 * High-level communication patterns for Collective Agent system.
 * Provides A2A (Agent-to-Agent) communication patterns.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import { MessageQueueService } from './message-queue.service';
import {
  MessageType,
  MessagePriority,
} from '@domain/entities/collective-message.entity';

@Injectable()
export class CommunicationService {
  constructor(
    private readonly messageQueue: MessageQueueService,
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * Agent asks PM a question (HIGH priority)
   */
  async askPM(
    collectiveId: string,
    agentId: string,
    question: string,
    options: {
      taskId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<void> {
    await this.messageQueue.sendMessage(
      collectiveId,
      agentId,
      'pm_agent',
      question,
      {
        type: MessageType.HELP_REQUEST,
        priority: MessagePriority.HIGH,
        taskId: options.taskId,
        metadata: options.metadata,
      },
    );

    this.logger.info(
      `Agent ${agentId} asked PM: ${question.substring(0, 50)}...`,
      {},
    );
  }

  /**
   * PM sends directive to an agent (HIGH priority)
   */
  async pmDirective(
    collectiveId: string,
    targetAgentId: string,
    directive: string,
    options: {
      taskId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<void> {
    await this.messageQueue.sendMessage(
      collectiveId,
      'pm_agent',
      targetAgentId,
      directive,
      {
        type: MessageType.PM_DIRECTIVE,
        priority: MessagePriority.HIGH,
        taskId: options.taskId,
        metadata: options.metadata,
      },
    );

    this.logger.info(
      `PM sent directive to ${targetAgentId}: ${directive.substring(0, 50)}...`,
      {},
    );
  }

  /**
   * PM broadcasts message to all agents
   */
  async pmBroadcast(
    collectiveId: string,
    message: string,
    options: {
      priority?: MessagePriority;
      excludeAgentIds?: string[];
      metadata?: Record<string, any>;
    } = {},
  ): Promise<void> {
    await this.messageQueue.broadcastMessage(
      collectiveId,
      'pm_agent',
      message,
      {
        type: MessageType.BROADCAST,
        priority: options.priority || MessagePriority.NORMAL,
        excludeAgentIds: options.excludeAgentIds,
        metadata: options.metadata,
      },
    );

    this.logger.info(`PM broadcasted to collective ${collectiveId}`, {});
  }

  /**
   * Agent sends message to another agent
   */
  async agentToAgent(
    collectiveId: string,
    fromAgentId: string,
    toAgentId: string,
    message: string,
    options: {
      type?: MessageType;
      priority?: MessagePriority;
      taskId?: string;
      replyToMessageId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<void> {
    await this.messageQueue.sendMessage(
      collectiveId,
      fromAgentId,
      toAgentId,
      message,
      {
        type: options.type || MessageType.INFO_REQUEST,
        priority: options.priority || MessagePriority.NORMAL,
        taskId: options.taskId,
        replyToMessageId: options.replyToMessageId,
        metadata: options.metadata,
      },
    );

    this.logger.info(
      `Agent ${fromAgentId} → ${toAgentId}: ${message.substring(0, 50)}...`,
      {},
    );
  }

  /**
   * Agent sends delegation request (creates subtask for another agent)
   */
  async delegateTask(
    collectiveId: string,
    fromAgentId: string,
    toAgentId: string,
    taskDescription: string,
    options: {
      taskId?: string;
      priority?: MessagePriority;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<void> {
    await this.messageQueue.sendMessage(
      collectiveId,
      fromAgentId,
      toAgentId,
      taskDescription,
      {
        type: MessageType.DELEGATION,
        priority: options.priority || MessagePriority.NORMAL,
        taskId: options.taskId,
        metadata: options.metadata,
      },
    );

    this.logger.info(`Agent ${fromAgentId} delegated task to ${toAgentId}`, {});
  }

  /**
   * Agent sends status update
   */
  async statusUpdate(
    collectiveId: string,
    agentId: string,
    status: string,
    options: {
      taskId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<void> {
    await this.messageQueue.sendMessage(
      collectiveId,
      agentId,
      'pm_agent',
      status,
      {
        type: MessageType.STATUS_UPDATE,
        priority: MessagePriority.NORMAL,
        taskId: options.taskId,
        metadata: options.metadata,
      },
    );
  }

  /**
   * Agent sends task result
   */
  async sendResult(
    collectiveId: string,
    agentId: string,
    result: string,
    options: {
      taskId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<void> {
    await this.messageQueue.sendMessage(
      collectiveId,
      agentId,
      'pm_agent',
      result,
      {
        type: MessageType.RESULT,
        priority: MessagePriority.NORMAL,
        taskId: options.taskId,
        metadata: options.metadata,
      },
    );
  }

  /**
   * Human sends message to agent (CRITICAL priority)
   */
  async humanMessage(
    collectiveId: string,
    agentId: string,
    message: string,
    options: {
      taskId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<void> {
    await this.messageQueue.sendMessage(
      collectiveId,
      'user',
      agentId,
      message,
      {
        type: MessageType.HUMAN_MESSAGE,
        priority: MessagePriority.CRITICAL,
        taskId: options.taskId,
        metadata: options.metadata,
      },
    );

    this.logger.info(`Human message sent to agent ${agentId}`, {});
  }
}
