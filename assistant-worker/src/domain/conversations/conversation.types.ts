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

/**
 * Memory configuration for conversation settings
 */
export interface MemoryConfig {
  id?: string;
  type: string;
  provider?: string;
  vectorStore?: string;
  knowledgeGraphId?: string;
  ragPipelineId?: string;
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

/**
 * Enhanced conversation settings overrides
 * Supports multiple memory types, full LLM config, tool config, streaming, checkpoints, and reasoning
 */
export interface ConversationSettingsOverrides {
  // Legacy: single memory type (deprecated, use memories array instead)
  memoryType?: string;

  // Multiple memory types support
  memories?: MemoryConfig[];

  // Legacy: simple model string (deprecated, use llm object instead)
  model?: string;

  // Full LLM configuration
  llm?: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
  };

  // Legacy: simple temperature/maxTokens (deprecated, use llm object instead)
  temperature?: number;
  maxTokens?: number;

  // Enhanced reasoning/CoT configuration (supports legacy steps property)
  reasoning?: {
    enabled?: boolean;
    maxSteps?: number;
    temperature?: number;
    maxTokens?: number;
    selfConsistency?: {
      enabled: boolean;
      samples: number;
    };
    promptTemplate?: string;
    fewShotExamples?: any[];
    steps?: number; // Legacy support for simple steps
  };

  // Enhanced tool configuration (supports legacy allowList/denyList)
  tools?: {
    enabled?: string[];
    disabled?: string[];
    configs?: Record<string, any>;
    allowList?: string[]; // Legacy support
    denyList?: string[]; // Legacy support
  };

  // Streaming configuration
  streaming?: {
    enabled?: boolean;
    streamTokens?: boolean;
    streamThoughts?: boolean;
    streamToolCalls?: boolean;
    streamEvents?: boolean;
    bufferSize?: number;
    chunkSize?: number;
  };

  // Checkpoint configuration
  checkpoints?: {
    enabled?: boolean;
    maxCheckpoints?: number;
    autoSave?: boolean;
    autoSaveInterval?: {
      value: number;
      unit: 'messages' | 'turns' | 'minutes';
    };
    allowedCheckpointTypes?: string[];
  };

  // Agent-specific custom settings
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

export interface ConversationStatistics {
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  messageCount: number;
  duration: {
    start: Date | null;
    end: Date | null;
    seconds: number | null;
  };
  agentType: ConversationType;
}
