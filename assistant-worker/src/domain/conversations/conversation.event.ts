/**
 * Conversation Event Types
 */

export type ConversationEventType =
  | 'message'
  | 'tool_call'
  | 'checkpoint'
  | 'state_change'
  | 'config_change'
  | 'note';

export interface BaseEvent {
  conversationId: string;
  ts: Date;
  type: ConversationEventType;
}

export interface MessageEventPayload {
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  version: number;
}

export interface ToolCallEventPayload {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'ok' | 'error';
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
}

export interface CheckpointEventPayload {
  checkpointId: string;
  name?: string;
  description?: string;
  snapshotRefId?: string;
}

export interface StateChangeEventPayload {
  from?: string;
  to: string;
  reason?: string;
}

export interface ConfigChangeEventPayload {
  path: string; // e.g., settingsOverrides.memoryType
  old?: unknown;
  new?: unknown;
}

export interface NoteEventPayload {
  text: string;
  metadata?: Record<string, unknown>;
}

export type ConversationEventPayload =
  | { kind: 'message'; data: MessageEventPayload }
  | { kind: 'tool_call'; data: ToolCallEventPayload }
  | { kind: 'checkpoint'; data: CheckpointEventPayload }
  | { kind: 'state_change'; data: StateChangeEventPayload }
  | { kind: 'config_change'; data: ConfigChangeEventPayload }
  | { kind: 'note'; data: NoteEventPayload };

export interface ConversationEvent extends BaseEvent {
  payload: ConversationEventPayload;
}
