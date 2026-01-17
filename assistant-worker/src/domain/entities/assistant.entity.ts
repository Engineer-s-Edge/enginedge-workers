/**
 * Assistant Entity - Domain representation of an Assistant
 *
 * This is the pure domain entity without infrastructure dependencies.
 * The MongoDB schema is in the infrastructure layer.
 */

export enum AssistantType {
  STUDY_HELPER = 'study_helper',
  PROBLEM_SOLVER = 'problem_solver',
  MOCK_INTERVIEWER = 'mock_interviewer',
  RESUME_CRITIQUER = 'resume_critiquer',
  CALENDAR_ASSISTANT = 'calendar_assistant',
  CODE_HELPER = 'code_helper',
  RESEARCH = 'research',
  GRAPH_AGENT = 'graph_agent',
  REACT_AGENT = 'react_agent',
  CUSTOM = 'custom',
}

export enum AssistantMode {
  PRECISE = 'precise',
  CREATIVE = 'creative',
  BALANCED = 'balanced',
  SOCRATIC = 'socratic',
  CUSTOM = 'custom',
  VISUAL_LEARNING = 'visual_learning',
}

export enum AssistantStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DISABLED = 'disabled',
  DRAFT = 'draft',
}

export interface CustomPrompt {
  name: string;
  content: string;
  priority?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface ContextBlock {
  name: string;
  content: string;
  isActive?: boolean;
  applicableTopics?: string[];
  metadata?: Record<string, any>;
}

export interface AssistantToolConfig {
  toolName: string;
  isEnabled?: boolean;
  parameters?: Record<string, any>;
  customInstructions?: string;
}

export interface NodeConfig {
  id?: string;
  type: string;
  config: Record<string, any>;
  prompt?: string;
  requiresUserInput?: boolean;
  next?: string | Record<string, string> | null;
}

export interface CoTConfig {
  enabled?: boolean;
  promptTemplate?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  fewShotExamples?: Array<{
    input: string;
    thought: string;
    action: string;
    observation: string;
    finalAnswer: string;
  }>;
  stopSequences?: string[];
  maxSteps?: number;
  selfConsistency?: {
    enabled: boolean;
    samples: number;
  };
  temperatureModifiable?: boolean;
  maxTokensModifiable?: boolean;
}

export interface IntelligenceConfig {
  llm: {
    provider: string;
    model: string;
    tokenLimit: number;
  };
  escalate?: boolean;
  providerEscalationOptions?: string[];
  modelEscalationTable?: Record<
    string,
    Array<{
      model: string;
      tokenLimit: number;
    }>
  >;
}

export interface ReActAgentConfig {
  _id?: string;
  state?: string;
  enabled?: boolean;
  cot?: CoTConfig;
  tools?: any[];
  canModifyStorage?: boolean;
  intelligence?: IntelligenceConfig;
  memory?: any;
}

export interface GraphNode {
  _id?: string;
  command?: string;
  name: string;
  description: string;
  llm: {
    provider: string;
    model: string;
    tokenLimit: number;
  };
  ReActConfig: ReActAgentConfig;
  userInteraction?: {
    mode: 'continuous_chat' | 'single_react_cycle';
    requireApproval?: boolean;
    confidenceThreshold?: number;
    approvalPrompt?: string;
    allowUserPrompting?: boolean;
    showEndChatButton?: boolean;
  };
}

export interface GraphEdge {
  _id?: string;
  from: string;
  to: string;
  condition: {
    type: 'keyword' | 'analysis';
    keyword?: string;
    analysisPrompt?: string;
    analysisProvider: {
      provider: string;
      model: string;
      tokenLimit: number;
    };
  };
  memoryOverride?: any;
  contextFrom?: string[];
}

export interface GraphAgentConfig {
  _id?: string;
  state?: string;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  memory?: any;
  checkpoints?: {
    enabled: boolean;
    allowList: 'nodes' | 'tools' | 'all';
  };
}

/**
 * Assistant Entity - Domain representation
 */
export class Assistant {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description?: string,
    public readonly type: AssistantType = AssistantType.CUSTOM,
    public readonly primaryMode: AssistantMode = AssistantMode.BALANCED,
    public readonly status: AssistantStatus = AssistantStatus.ACTIVE,
    public readonly agentType: string = 'custom',
    public readonly reactConfig?: ReActAgentConfig,
    public readonly graphConfig?: GraphAgentConfig,
    public readonly blocks: NodeConfig[] = [],
    public readonly customPrompts: CustomPrompt[] = [],
    public readonly contextBlocks: ContextBlock[] = [],
    public readonly tools: AssistantToolConfig[] = [],
    public readonly subjectExpertise: string[] = [],
    public readonly isPublic: boolean = false,
    public readonly userId?: string,
    public readonly metadata: Record<string, any> = {},
    public readonly lastExecuted?: Date,
    public readonly executionCount: number = 0,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
  ) {}

  /**
   * Create a new Assistant instance
   */
  static create(data: {
    id: string;
    name: string;
    description?: string;
    type?: AssistantType;
    primaryMode?: AssistantMode;
    status?: AssistantStatus;
    agentType?: string;
    reactConfig?: ReActAgentConfig;
    graphConfig?: GraphAgentConfig;
    blocks?: NodeConfig[];
    customPrompts?: CustomPrompt[];
    contextBlocks?: ContextBlock[];
    tools?: AssistantToolConfig[];
    subjectExpertise?: string[];
    isPublic?: boolean;
    userId?: string;
    metadata?: Record<string, any>;
    lastExecuted?: Date;
    executionCount?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }): Assistant {
    return new Assistant(
      data.id,
      data.name,
      data.description,
      data.type || AssistantType.CUSTOM,
      data.primaryMode || AssistantMode.BALANCED,
      data.status || AssistantStatus.ACTIVE,
      data.agentType || 'custom',
      data.reactConfig,
      data.graphConfig,
      data.blocks || [],
      data.customPrompts || [],
      data.contextBlocks || [],
      data.tools || [],
      data.subjectExpertise || [],
      data.isPublic || false,
      data.userId,
      data.metadata || {},
      data.lastExecuted,
      data.executionCount || 0,
      data.createdAt,
      data.updatedAt,
    );
  }

  /**
   * Check if assistant is active
   */
  isActive(): boolean {
    return this.status === AssistantStatus.ACTIVE;
  }

  /**
   * Check if assistant is public
   */
  isPublicAssistant(): boolean {
    return this.isPublic;
  }
}
