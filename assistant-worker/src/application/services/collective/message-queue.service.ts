/**
 * Message Queue Service
 *
 * In-memory message queue for agent-to-agent communication.
 * Priority-based delivery with retry logic and timeout handling.
 */

import { Injectable, Inject } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ILogger } from '@application/ports/logger.port';
import {
  CollectiveMessage,
  MessagePriority,
  MessageStatus,
  MessageType,
  createCollectiveMessage,
} from '@domain/entities/collective-message.entity';

/**
 * Message timeout configuration (milliseconds)
 */
const MESSAGE_TIMEOUTS: Record<MessagePriority, number> = {
  [MessagePriority.CRITICAL]: 60000, // 1 minute
  [MessagePriority.HIGH]: 300000, // 5 minutes
  [MessagePriority.NORMAL]: 900000, // 15 minutes
  [MessagePriority.LOW]: 3600000, // 1 hour
  [MessagePriority.BACKGROUND]: 86400000, // 24 hours
};

const MAX_RETRY_ATTEMPTS = 3;

@Injectable()
export class MessageQueueService {
  // In-memory message storage
  private messages: Map<string, CollectiveMessage> = new Map();
  private messageQueues: Map<string, CollectiveMessage[]> = new Map(); // Key: targetAgentId
  private timeoutHandles: Map<string, NodeJS.Timeout> = new Map();
  private readonly messageSubject = new Subject<CollectiveMessage>();

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {
    // Start periodic cleanup
    this.startTimeoutCheck();
  }

  /**
   * Send a message to a specific agent
   */
  async sendMessage(
    collectiveId: string,
    fromAgentId: string,
    toAgentId: string,
    content: string,
    options: {
      type?: MessageType;
      priority?: MessagePriority;
      conversationId?: string;
      taskId?: string;
      replyToMessageId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<CollectiveMessage> {
    const priority = options.priority || MessagePriority.NORMAL;
    const timeout = MESSAGE_TIMEOUTS[priority];
    const expiresAt = new Date(Date.now() + timeout);

    const message = createCollectiveMessage(
      collectiveId,
      fromAgentId,
      toAgentId,
      content,
      {
        priority,
        type: options.type || MessageType.INFO_REQUEST,
        conversationId: options.conversationId,
        taskId: options.taskId,
        replyToMessageId: options.replyToMessageId,
        metadata: options.metadata,
        expiresAt,
      },
    );

    // Store message
    this.messages.set(message.id, message);

    this.publishMessage(message);

    // Add to recipient's queue (priority-sorted)
    const queue = this.messageQueues.get(toAgentId) || [];
    queue.push(message);
    queue.sort((a, b) => {
      const priorityOrder = {
        [MessagePriority.CRITICAL]: 0,
        [MessagePriority.HIGH]: 1,
        [MessagePriority.NORMAL]: 2,
        [MessagePriority.LOW]: 3,
        [MessagePriority.BACKGROUND]: 4,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    this.messageQueues.set(toAgentId, queue);

    // Set timeout
    const timeoutHandle = setTimeout(() => {
      this.handleTimeout(message.id);
    }, timeout);
    this.timeoutHandles.set(message.id, timeoutHandle);

    this.logger.info(
      `Message sent: ${fromAgentId} → ${toAgentId} (${priority})`,
      { messageId: message.id },
    );

    return message;
  }

  /**
   * Broadcast message to all agents in collective
   */
  async broadcastMessage(
    collectiveId: string,
    fromAgentId: string,
    content: string,
    options: {
      type?: MessageType;
      priority?: MessagePriority;
      excludeAgentIds?: string[];
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<CollectiveMessage[]> {
    // Get all agent IDs in collective (this would come from collective registry)
    // For now, we'll track this via messages
    const agentIds = new Set<string>();
    for (const message of this.messages.values()) {
      if (message.collectiveId === collectiveId) {
        agentIds.add(message.targetAgentId);
        agentIds.add(message.sourceAgentId);
      }
    }

    const excludeSet = new Set(options.excludeAgentIds || []);
    excludeSet.add(fromAgentId); // Don't send to sender

    const sentMessages: CollectiveMessage[] = [];

    for (const agentId of agentIds) {
      if (!excludeSet.has(agentId)) {
        const message = await this.sendMessage(
          collectiveId,
          fromAgentId,
          agentId,
          content,
          {
            type: options.type || MessageType.BROADCAST,
            priority: options.priority || MessagePriority.NORMAL,
            metadata: options.metadata,
          },
        );
        sentMessages.push(message);
      }
    }

    this.logger.info(
      `Broadcast sent: ${fromAgentId} → ${sentMessages.length} agents`,
      {},
    );

    return sentMessages;
  }

  /**
   * Get next message for an agent (highest priority first)
   */
  async getNextMessage(agentId: string): Promise<CollectiveMessage | null> {
    const queue = this.messageQueues.get(agentId) || [];

    // Find first pending message
    for (let i = 0; i < queue.length; i++) {
      const message = queue[i];
      if (message.status === MessageStatus.PENDING) {
        // Mark as in progress
        message.status = MessageStatus.IN_PROGRESS;
        message.processedAt = new Date();
        this.messages.set(message.id, message);
        return message;
      }
    }

    return null;
  }

  /**
   * Mark message as delivered
   */
  async markDelivered(messageId: string): Promise<boolean> {
    const message = this.messages.get(messageId);
    if (!message) {
      return false;
    }

    message.status = MessageStatus.COMPLETED;
    message.deliveredAt = new Date();
    this.messages.set(messageId, message);

    // Remove from queue
    const queue = this.messageQueues.get(message.targetAgentId) || [];
    const index = queue.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      queue.splice(index, 1);
      this.messageQueues.set(message.targetAgentId, queue);
    }

    // Clear timeout
    const timeoutHandle = this.timeoutHandles.get(messageId);
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.timeoutHandles.delete(messageId);
    }

    return true;
  }

  /**
   * Retry failed message
   */
  async retryMessage(messageId: string): Promise<boolean> {
    const message = this.messages.get(messageId);
    if (!message) {
      return false;
    }

    if (message.retryCount >= MAX_RETRY_ATTEMPTS) {
      message.status = MessageStatus.FAILED;
      this.messages.set(messageId, message);
      return false;
    }

    message.retryCount++;
    message.status = MessageStatus.PENDING;
    message.updatedAt = new Date();

    // Re-add to queue
    const queue = this.messageQueues.get(message.targetAgentId) || [];
    if (!queue.find((m) => m.id === messageId)) {
      queue.push(message);
      queue.sort((a, b) => {
        const priorityOrder = {
          [MessagePriority.CRITICAL]: 0,
          [MessagePriority.HIGH]: 1,
          [MessagePriority.NORMAL]: 2,
          [MessagePriority.LOW]: 3,
          [MessagePriority.BACKGROUND]: 4,
        };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
      this.messageQueues.set(message.targetAgentId, queue);
    }

    this.logger.info(
      `Retrying message ${messageId} (attempt ${message.retryCount})`,
      {},
    );

    return true;
  }

  /**
   * Get message thread (reply chain)
   */
  async getMessageThread(messageId: string): Promise<CollectiveMessage[]> {
    const message = this.messages.get(messageId);
    if (!message) {
      return [];
    }

    const thread: CollectiveMessage[] = [message];

    // Find all replies
    for (const msg of this.messages.values()) {
      if (msg.replyToMessageId === messageId) {
        thread.push(msg);
      }
    }

    // Follow chain backwards
    if (message.replyToMessageId) {
      const parentThread = await this.getMessageThread(
        message.replyToMessageId,
      );
      thread.unshift(...parentThread);
    }

    return thread;
  }

  /**
   * Get message statistics for a collective
   */
  async getMessageStats(collectiveId: string): Promise<{
    total: number;
    byStatus: Record<MessageStatus, number>;
    byPriority: Record<MessagePriority, number>;
    byType: Record<MessageType, number>;
    averageDeliveryTime: number;
    failedMessages: number;
  }> {
    const messages = Array.from(this.messages.values()).filter(
      (m) => m.collectiveId === collectiveId,
    );

    const byStatus: Record<MessageStatus, number> = {
      [MessageStatus.PENDING]: 0,
      [MessageStatus.IN_PROGRESS]: 0,
      [MessageStatus.COMPLETED]: 0,
      [MessageStatus.FAILED]: 0,
      [MessageStatus.EXPIRED]: 0,
    };

    const byPriority: Record<MessagePriority, number> = {
      [MessagePriority.CRITICAL]: 0,
      [MessagePriority.HIGH]: 0,
      [MessagePriority.NORMAL]: 0,
      [MessagePriority.LOW]: 0,
      [MessagePriority.BACKGROUND]: 0,
    };

    const byType: Record<MessageType, number> = {
      [MessageType.DELEGATION]: 0,
      [MessageType.HELP_REQUEST]: 0,
      [MessageType.INFO_REQUEST]: 0,
      [MessageType.PM_DIRECTIVE]: 0,
      [MessageType.STATUS_UPDATE]: 0,
      [MessageType.RESULT]: 0,
      [MessageType.HUMAN_MESSAGE]: 0,
      [MessageType.BROADCAST]: 0,
    };

    let totalDeliveryTime = 0;
    let deliveredCount = 0;
    let failedCount = 0;

    for (const msg of messages) {
      byStatus[msg.status]++;
      byPriority[msg.priority]++;
      byType[msg.type]++;

      if (msg.status === MessageStatus.COMPLETED && msg.deliveredAt) {
        const deliveryTime =
          msg.deliveredAt.getTime() - msg.createdAt.getTime();
        totalDeliveryTime += deliveryTime;
        deliveredCount++;
      }

      if (msg.status === MessageStatus.FAILED) {
        failedCount++;
      }
    }

    return {
      total: messages.length,
      byStatus,
      byPriority,
      byType,
      averageDeliveryTime:
        deliveredCount > 0 ? totalDeliveryTime / deliveredCount : 0,
      failedMessages: failedCount,
    };
  }

  /**
   * Check for expired messages
   */
  async checkMessageTimeouts(collectiveId: string): Promise<void> {
    const now = Date.now();
    let expiredCount = 0;

    for (const message of this.messages.values()) {
      if (
        message.collectiveId === collectiveId &&
        message.status === MessageStatus.PENDING &&
        message.expiresAt &&
        message.expiresAt.getTime() < now
      ) {
        message.status = MessageStatus.EXPIRED;
        this.messages.set(message.id, message);
        expiredCount++;

        // Remove from queue
        const queue = this.messageQueues.get(message.targetAgentId) || [];
        const index = queue.findIndex((m) => m.id === message.id);
        if (index !== -1) {
          queue.splice(index, 1);
          this.messageQueues.set(message.targetAgentId, queue);
        }

        // Clear timeout
        const timeoutHandle = this.timeoutHandles.get(message.id);
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          this.timeoutHandles.delete(message.id);
        }
      }
    }

    if (expiredCount > 0) {
      this.logger.warn(
        `Expired ${expiredCount} messages in collective ${collectiveId}`,
        {},
      );
    }
  }

  /**
   * Get queue metrics for a specific agent
   */
  getAgentQueueMetrics(agentId: string): {
    total: number;
    pending: number;
    inProgress: number;
    failed: number;
    expired: number;
    nextMessage: {
      id: string;
      priority: MessagePriority;
      type: MessageType;
      taskId?: string;
      createdAt: Date;
    } | null;
    oldestMessageCreatedAt?: Date;
  } {
    const queue = this.messageQueues.get(agentId) || [];

    let pending = 0;
    let inProgress = 0;
    let failed = 0;
    let expired = 0;
    let oldestMessage: CollectiveMessage | undefined;

    for (const message of queue) {
      if (!oldestMessage || message.createdAt < oldestMessage.createdAt) {
        oldestMessage = message;
      }

      switch (message.status) {
        case MessageStatus.PENDING:
          pending++;
          break;
        case MessageStatus.IN_PROGRESS:
          inProgress++;
          break;
        case MessageStatus.FAILED:
          failed++;
          break;
        case MessageStatus.EXPIRED:
          expired++;
          break;
        default:
          break;
      }
    }

    const nextMessage = queue[0]
      ? {
          id: queue[0].id,
          priority: queue[0].priority,
          type: queue[0].type,
          taskId: queue[0].taskId,
          createdAt: queue[0].createdAt,
        }
      : null;

    return {
      total: queue.length,
      pending,
      inProgress,
      failed,
      expired,
      nextMessage,
      oldestMessageCreatedAt: oldestMessage?.createdAt,
    };
  }

  getAgentQueue(agentId: string): CollectiveMessage[] {
    const queue = this.messageQueues.get(agentId) || [];
    return [...queue];
  }

  streamMessages(collectiveId: string): Observable<CollectiveMessage> {
    return this.messageSubject
      .asObservable()
      .pipe(filter((message) => message.collectiveId === collectiveId));
  }

  private publishMessage(message: CollectiveMessage): void {
    this.messageSubject.next(message);
  }

  /**
   * Handle message timeout
   */
  private handleTimeout(messageId: string): void {
    const message = this.messages.get(messageId);
    if (!message || message.status !== MessageStatus.PENDING) {
      return;
    }

    // Try to retry if not exceeded max attempts
    if (message.retryCount < MAX_RETRY_ATTEMPTS) {
      this.retryMessage(messageId);
    } else {
      message.status = MessageStatus.EXPIRED;
      this.messages.set(messageId, message);

      // Remove from queue
      const queue = this.messageQueues.get(message.targetAgentId) || [];
      const index = queue.findIndex((m) => m.id === messageId);
      if (index !== -1) {
        queue.splice(index, 1);
        this.messageQueues.set(message.targetAgentId, queue);
      }

      this.logger.warn(
        `Message ${messageId} expired after ${message.retryCount} retries`,
        {},
      );
    }
  }

  /**
   * Start periodic timeout check
   */
  private startTimeoutCheck(): void {
    setInterval(() => {
      // Check all collectives
      const collectiveIds = new Set(
        Array.from(this.messages.values()).map((m) => m.collectiveId),
      );
      for (const collectiveId of collectiveIds) {
        this.checkMessageTimeouts(collectiveId);
      }
    }, 60000); // Check every minute
  }
}
