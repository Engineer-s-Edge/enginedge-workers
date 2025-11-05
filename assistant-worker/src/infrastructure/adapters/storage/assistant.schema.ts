/**
 * Assistant MongoDB Schema
 *
 * Infrastructure layer - MongoDB schema definition using Mongoose
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  AssistantType,
  AssistantMode,
  AssistantStatus,
} from '@domain/entities/assistant.entity';

@Schema()
export class CustomPromptSchema {
  @Prop()
  name!: string;

  @Prop()
  content!: string;

  @Prop({ default: 0 })
  priority!: number;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, any>;
}

@Schema()
export class ContextBlockSchema {
  @Prop()
  name!: string;

  @Prop()
  content!: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ type: [String], default: [] })
  applicableTopics!: string[];

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, any>;
}

@Schema()
export class AssistantToolConfigSchema {
  @Prop()
  toolName!: string;

  @Prop({ default: true })
  isEnabled!: boolean;

  @Prop({ type: Object, default: {} })
  parameters!: Record<string, any>;

  @Prop()
  customInstructions?: string;
}

@Schema()
export class NodeConfigSchema {
  @Prop()
  id?: string;

  @Prop()
  type!: string;

  @Prop({ type: Object })
  config!: Record<string, any>;

  @Prop()
  prompt?: string;

  @Prop({ default: false })
  requiresUserInput!: boolean;

  @Prop({ type: Object })
  next?: string | Record<string, string> | null;
}

@Schema()
export class CoTConfigSchema {
  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ default: "Question: {input}\nThought: Let's think step by step…" })
  promptTemplate!: string;

  @Prop({ default: 512 })
  maxTokens!: number;

  @Prop({ default: 0.7 })
  temperature!: number;

  @Prop({ default: 0.9 })
  topP!: number;

  @Prop({ default: 0.0 })
  frequencyPenalty!: number;

  @Prop({ default: 0.0 })
  presencePenalty!: number;

  @Prop({ type: [Object], default: [] })
  fewShotExamples!: Array<{
    input: string;
    thought: string;
    action: string;
    observation: string;
    finalAnswer: string;
  }>;

  @Prop({ type: [String], default: [] })
  stopSequences!: string[];

  @Prop({ default: 5 })
  maxSteps!: number;

  @Prop({
    type: {
      enabled: { type: Boolean, default: true },
      samples: { type: Number, default: 3 },
    },
    default: { enabled: true, samples: 3 },
  })
  selfConsistency!: {
    enabled: boolean;
    samples: number;
  };

  @Prop({ default: true })
  temperatureModifiable!: boolean;

  @Prop({ default: true })
  maxTokensModifiable!: boolean;
}

@Schema()
export class IntelligenceConfigSchema {
  @Prop({
    type: {
      provider: { type: String },
      model: { type: String },
      tokenLimit: { type: Number },
    },
  })
  llm!: {
    provider: string;
    model: string;
    tokenLimit: number;
  };

  @Prop({ default: false })
  escalate!: boolean;

  @Prop({ type: [String], default: [] })
  providerEscalationOptions!: string[];

  @Prop({ type: Object, default: {} })
  modelEscalationTable!: Record<
    string,
    Array<{
      model: string;
      tokenLimit: number;
    }>
  >;
}

@Schema()
export class ReActAgentConfigSchema {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id!: string;

  @Prop({
    type: String,
    enum: ['initializing', 'ready', 'running', 'paused', 'stopped', 'errored'],
    default: 'initializing',
  })
  state!: string;

  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ type: CoTConfigSchema, default: () => ({}) })
  cot!: CoTConfigSchema;

  @Prop({ type: [Object], default: [] })
  tools!: any[];

  @Prop({ default: false })
  canModifyStorage!: boolean;

  @Prop({ type: IntelligenceConfigSchema })
  intelligence!: IntelligenceConfigSchema;

  @Prop({ type: Object })
  memory?: any;
}

@Schema()
export class GraphNodeSchema {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id!: string;

  @Prop()
  command?: string;

  @Prop()
  name!: string;

  @Prop()
  description!: string;

  @Prop({
    type: {
      provider: { type: String },
      model: { type: String },
      tokenLimit: { type: Number },
    },
  })
  llm!: {
    provider: string;
    model: string;
    tokenLimit: number;
  };

  @Prop({ type: ReActAgentConfigSchema })
  ReActConfig!: ReActAgentConfigSchema;

  @Prop({ type: Object })
  userInteraction?: {
    mode: 'continuous_chat' | 'single_react_cycle';
    requireApproval?: boolean;
    confidenceThreshold?: number;
    approvalPrompt?: string;
    allowUserPrompting?: boolean;
    showEndChatButton?: boolean;
  };
}

@Schema()
export class GraphEdgeSchema {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id!: string;

  @Prop()
  from!: string;

  @Prop()
  to!: string;

  @Prop({
    type: {
      type: { type: String, enum: ['keyword', 'analysis'] },
      keyword: String,
      analysisPrompt: String,
      analysisProvider: {
        provider: { type: String },
        model: { type: String },
        tokenLimit: { type: Number },
      },
    },
  })
  condition!: {
    type: 'keyword' | 'analysis';
    keyword?: string;
    analysisPrompt?: string;
    analysisProvider: {
      provider: string;
      model: string;
      tokenLimit: number;
    };
  };

  @Prop({ type: Object })
  memoryOverride?: any;

  @Prop({ type: [String], default: [] })
  contextFrom!: string[];
}

@Schema()
export class GraphAgentConfigSchema {
  @Prop({ type: String, default: () => new Types.ObjectId().toString() })
  _id!: string;

  @Prop({
    type: String,
    enum: ['initializing', 'ready', 'running', 'paused', 'stopped', 'errored'],
    default: 'initializing',
  })
  state?: string;

  @Prop({ type: [GraphNodeSchema], default: [] })
  nodes!: GraphNodeSchema[];

  @Prop({ type: [GraphEdgeSchema], default: [] })
  edges!: GraphEdgeSchema[];

  @Prop({ type: Object })
  memory?: any;

  @Prop({
    type: {
      enabled: { type: Boolean, default: true },
      allowList: {
        type: String,
        enum: ['nodes', 'tools', 'all'],
        default: 'nodes',
      },
    },
  })
  checkpoints!: {
    enabled: boolean;
    allowList: 'nodes' | 'tools' | 'all';
  };
}

@Schema({ timestamps: true })
export class AssistantDocument extends Document {
  @Prop({ unique: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop({
    type: String,
    enum: Object.values(AssistantType),
    default: AssistantType.CUSTOM,
  })
  type!: AssistantType;

  @Prop({
    type: String,
    enum: Object.values(AssistantMode),
    default: AssistantMode.BALANCED,
  })
  primaryMode!: AssistantMode;

  @Prop({
    type: String,
    enum: Object.values(AssistantStatus),
    default: AssistantStatus.ACTIVE,
  })
  status!: AssistantStatus;

  @Prop({
    type: String,
    enum: ['react', 'graph', 'custom'],
    default: 'custom',
  })
  agentType!: string;

  @Prop({ type: ReActAgentConfigSchema })
  reactConfig?: ReActAgentConfigSchema;

  @Prop({ type: GraphAgentConfigSchema })
  graphConfig?: GraphAgentConfigSchema;

  @Prop({ type: [NodeConfigSchema], default: [] })
  blocks!: NodeConfigSchema[];

  @Prop({ type: [CustomPromptSchema], default: [] })
  customPrompts!: CustomPromptSchema[];

  @Prop({ type: [ContextBlockSchema], default: [] })
  contextBlocks!: ContextBlockSchema[];

  @Prop({ type: [AssistantToolConfigSchema], default: [] })
  tools!: AssistantToolConfigSchema[];

  @Prop({ type: [String], default: [] })
  subjectExpertise!: string[];

  @Prop({ default: false })
  isPublic!: boolean;

  @Prop()
  userId?: string;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, any>;

  @Prop({ type: Date })
  lastExecuted?: Date;

  @Prop({ type: Number, default: 0 })
  executionCount!: number;

  _id!: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const AssistantSchema = SchemaFactory.createForClass(AssistantDocument);

// Add indexes for performance
AssistantSchema.index({ type: 1 });
AssistantSchema.index({ agentType: 1 });
AssistantSchema.index({ userId: 1 });
AssistantSchema.index({ isPublic: 1 });
AssistantSchema.index({ status: 1 });
AssistantSchema.index({ name: 1 });
