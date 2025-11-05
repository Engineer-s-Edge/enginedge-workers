/**
 * Conversation Types and Interfaces
 */

export type ConversationType =
  | 'base'
  | 'react'
  | 'expert'
  | 'pm'
  | 'graph'
  | 'collective'
  | 'genius';

export type ConversationStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'archived';

export interface ConversationSettingsOverrides {
  memoryType?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  reasoning?: { steps?: number };
  tools?: { allowList?: string[]; denyList?: string[] };
  custom?: Record<string, unknown>;
}

export interface BaseAgentState {
  lastTurnRole?: 'user' | 'assistant' | 'system';
  turnCount?: number;
}

export interface GraphAgentState {
  currentNodeId?: string;
  nodeStatuses?: Record<
    string,
    'pending' | 'running' | 'completed' | 'failed' | 'paused'
  >;
  pausedAtNode?: string;
  graphConfig?: Record<string, unknown>;
}

export interface CollectiveAgentState {
  pmStatus?: 'idle' | 'coordinating' | 'paused' | 'completed' | 'failed';
  workerStatuses?: Record<
    string,
    'idle' | 'working' | 'blocked' | 'completed' | 'failed'
  >;
  orchestrationConfig?: Record<string, unknown>;
}

export type ConversationAgentState =
  | { kind: 'base'; state: BaseAgentState }
  | { kind: 'react'; state: BaseAgentState }
  | { kind: 'expert'; state: BaseAgentState }
  | { kind: 'pm'; state: BaseAgentState }
  | { kind: 'graph'; state: GraphAgentState }
  | { kind: 'collective'; state: CollectiveAgentState }
  | { kind: 'genius'; state: CollectiveAgentState };

export interface ConversationSummary {
  latestSummary?: string;
  tokens?: { input?: number; output?: number; total?: number };
  messageCount?: number;
}
