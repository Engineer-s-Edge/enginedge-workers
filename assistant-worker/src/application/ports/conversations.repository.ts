import {
  ConversationType,
  ConversationStatus,
  ConversationSettingsOverrides,
} from '@domain/conversations/conversation.types';

export interface CreateConversationInput {
  userId: string;
  rootAgentId: string;
  type: ConversationType;
  settingsOverrides?: ConversationSettingsOverrides;
  parentConversationId?: string;
}

export interface ConversationRecord {
  id: string;
  userId: string;
  rootAgentId: string;
  type: ConversationType;
  status: ConversationStatus;
  settingsOverrides?: ConversationSettingsOverrides;
  childConversationIds: string[];
  parentConversationId?: string;
  graphRefId?: string;
  collectiveRefId?: string;
  summaries?: {
    latestSummary?: string;
    tokens?: { input?: number; output?: number; total?: number };
    messageCount?: number;
  };
  agentState?: Record<string, unknown>;
  folderId?: string;
  tags?: string[];
  isPinned?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MessageAppend {
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface MessageEdit {
  messageId: string;
  version: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  editedBy?: string;
  diff?: string;
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'ok' | 'error';
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
}

export interface CheckpointRecord {
  checkpointId: string;
  name?: string;
  description?: string;
  snapshotRefId?: string;
  // Full conversation state snapshot for restore
  conversationState?: {
    messages?: Array<{
      messageId: string;
      role: string;
      content: string;
      metadata?: Record<string, unknown>;
      version: number;
    }>;
    agentState?: Record<string, unknown>;
    settingsOverrides?: ConversationSettingsOverrides;
  };
}

export interface IConversationsRepository {
  create(input: CreateConversationInput): Promise<ConversationRecord>;
  findById(id: string): Promise<ConversationRecord | null>;
  listByUser(userId: string, limit?: number): Promise<ConversationRecord[]>;
  updateSettings(
    id: string,
    overrides: ConversationSettingsOverrides,
  ): Promise<void>;
  updateStatus(id: string, status: ConversationStatus): Promise<void>;
  delete(id: string): Promise<void>;
  addChild(parentId: string, childId: string): Promise<void>;
  updateAgentState(id: string, state: Record<string, unknown>): Promise<void>;
  updatePinned(id: string, isPinned: boolean): Promise<void>;
  updateFolder(id: string, folderId: string | null): Promise<void>;
  updateTags(id: string, tags: string[]): Promise<void>;

  appendMessage(
    conversationId: string,
    message: MessageAppend,
    ts?: Date,
  ): Promise<{ version: number }>;
  editMessage(conversationId: string, edit: MessageEdit): Promise<void>;
  recordToolCall(
    conversationId: string,
    call: ToolCallRecord,
    ts?: Date,
  ): Promise<void>;
  createCheckpoint(
    conversationId: string,
    checkpoint: CheckpointRecord,
    ts?: Date,
  ): Promise<void>;

  getEvents(
    conversationId: string,
    sinceTs?: Date,
    limit?: number,
  ): Promise<any[]>;

  // Checkpoint methods
  getCheckpoints(conversationId: string): Promise<CheckpointRecord[]>;
  getCheckpointById(
    conversationId: string,
    checkpointId: string,
  ): Promise<CheckpointRecord | null>;
  restoreCheckpoint(
    conversationId: string,
    checkpointId: string,
  ): Promise<void>;

  // Conversation search methods
  getMessagesByUser(
    userId: string,
    conversationIds?: string[],
  ): Promise<
    Array<{
      id: string;
      conversationId: string;
      role: string;
      content: string;
      timestamp: Date;
    }>
  >;
  getSnippetsByUser(
    userId: string,
    conversationIds?: string[],
  ): Promise<
    Array<{
      id: string;
      conversationId: string;
      content: string;
      timestamp: Date;
    }>
  >;
}
