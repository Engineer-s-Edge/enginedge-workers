/**
 * Collective Message Entity
 *
 * Domain entity representing messages between agents in a collective.
 */

export enum MessagePriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
  BACKGROUND = 'background',
}

export enum MessageType {
  DELEGATION = 'delegation',
  HELP_REQUEST = 'help_request',
  INFO_REQUEST = 'info_request',
  PM_DIRECTIVE = 'pm_directive',
  STATUS_UPDATE = 'status_update',
  RESULT = 'result',
  HUMAN_MESSAGE = 'human_message',
  BROADCAST = 'broadcast',
}

export enum MessageStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

export interface CollectiveMessage {
  id: string;
  collectiveId: string;
  sourceAgentId: string;
  targetAgentId: string;
  priority: MessagePriority;
  type: MessageType;
  content: string;
  status: MessageStatus;
  conversationId?: string;
  taskId?: string;
  replyToMessageId?: string; // For threading
  metadata?: Record<string, any>;
  retryCount: number;
  expiresAt?: Date;
  deliveredAt?: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new collective message
 */
export function createCollectiveMessage(
  collectiveId: string,
  sourceAgentId: string,
  targetAgentId: string,
  content: string,
  options: {
    priority?: MessagePriority;
    type?: MessageType;
    conversationId?: string;
    taskId?: string;
    replyToMessageId?: string;
    metadata?: Record<string, any>;
    expiresAt?: Date;
  } = {},
): CollectiveMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    collectiveId,
    sourceAgentId,
    targetAgentId,
    content,
    priority: options.priority || MessagePriority.NORMAL,
    type: options.type || MessageType.INFO_REQUEST,
    status: MessageStatus.PENDING,
    conversationId: options.conversationId,
    taskId: options.taskId,
    replyToMessageId: options.replyToMessageId,
    metadata: options.metadata,
    retryCount: 0,
    expiresAt: options.expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
