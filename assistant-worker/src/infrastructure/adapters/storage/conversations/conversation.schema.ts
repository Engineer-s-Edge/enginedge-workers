import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ConversationStatus,
  ConversationType,
} from '@domain/conversations/conversation.types';

export type ConversationDocument = Conversation & Document;

@Schema({ _id: false })
class MemoryConfigSchema {
  @Prop() id?: string;
  @Prop() type!: string;
  @Prop() provider?: string;
  @Prop() vectorStore?: string;
  @Prop() knowledgeGraphId?: string;
  @Prop() ragPipelineId?: string;
  @Prop({ type: Object }) metadata?: Record<string, unknown>;
  @Prop({ type: Object }) config?: Record<string, unknown>;
}

@Schema({ _id: false })
class LLMConfigSchema {
  @Prop() provider?: string;
  @Prop() model?: string;
  @Prop() temperature?: number;
  @Prop() maxTokens?: number;
  @Prop() topP?: number;
  @Prop() frequencyPenalty?: number;
  @Prop() presencePenalty?: number;
  @Prop({ type: [String] }) stopSequences?: string[];
}

@Schema({ _id: false })
class SelfConsistencySchema {
  @Prop() enabled!: boolean;
  @Prop() samples!: number;
}

@Schema({ _id: false })
class ReasoningConfigSchema {
  @Prop() enabled?: boolean;
  @Prop() maxSteps?: number;
  @Prop() temperature?: number;
  @Prop() maxTokens?: number;
  @Prop({ type: SelfConsistencySchema })
  selfConsistency?: SelfConsistencySchema;
  @Prop() promptTemplate?: string;
  @Prop({ type: [Object] }) fewShotExamples?: any[];
  @Prop() steps?: number; // Legacy support
}

@Schema({ _id: false })
class ToolsConfigSchema {
  @Prop({ type: [String] }) enabled?: string[];
  @Prop({ type: [String] }) disabled?: string[];
  @Prop({ type: Object }) configs?: Record<string, any>;
  @Prop({ type: [String] }) allowList?: string[]; // Legacy support
  @Prop({ type: [String] }) denyList?: string[]; // Legacy support
}

@Schema({ _id: false })
class AutoSaveIntervalSchema {
  @Prop() value!: number;
  @Prop({ enum: ['messages', 'turns', 'minutes'] }) unit!:
    | 'messages'
    | 'turns'
    | 'minutes';
}

@Schema({ _id: false })
class CheckpointsConfigSchema {
  @Prop() enabled?: boolean;
  @Prop() maxCheckpoints?: number;
  @Prop() autoSave?: boolean;
  @Prop({ type: AutoSaveIntervalSchema })
  autoSaveInterval?: AutoSaveIntervalSchema;
  @Prop({ type: [String] }) allowedCheckpointTypes?: string[];
}

@Schema({ _id: false })
class StreamingConfigSchema {
  @Prop() enabled?: boolean;
  @Prop() streamTokens?: boolean;
  @Prop() streamThoughts?: boolean;
  @Prop() streamToolCalls?: boolean;
  @Prop() streamEvents?: boolean;
  @Prop() bufferSize?: number;
  @Prop() chunkSize?: number;
}

@Schema({ _id: false })
class SettingsOverridesSchema {
  // Legacy fields
  @Prop() memoryType?: string;
  @Prop() model?: string;
  @Prop() temperature?: number;
  @Prop() maxTokens?: number;

  // Enhanced fields
  @Prop({ type: [MemoryConfigSchema] }) memories?: MemoryConfigSchema[];
  @Prop({ type: LLMConfigSchema }) llm?: LLMConfigSchema;
  @Prop({ type: ReasoningConfigSchema }) reasoning?: ReasoningConfigSchema;
  @Prop({ type: ToolsConfigSchema }) tools?: ToolsConfigSchema;
  @Prop({ type: StreamingConfigSchema }) streaming?: StreamingConfigSchema;
  @Prop({ type: CheckpointsConfigSchema })
  checkpoints?: CheckpointsConfigSchema;
  @Prop({ type: Object }) custom?: Record<string, unknown>;
}

@Schema({ _id: false })
class SummarySchema {
  @Prop() latestSummary?: string;
  @Prop({ type: Object }) tokens?: {
    input?: number;
    output?: number;
    total?: number;
  };
  @Prop() messageCount?: number;
}

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ type: String, index: true })
  userId!: string;

  @Prop({ type: String, index: true })
  rootAgentId!: string;

  @Prop({
    type: String,
    enum: ['base', 'react', 'expert', 'pm', 'graph', 'collective', 'genius'],
    index: true,
  })
  type!: ConversationType;

  @Prop({
    type: String,
    enum: ['active', 'paused', 'completed', 'failed', 'archived'],
    default: 'active',
    index: true,
  })
  status!: ConversationStatus;

  @Prop({ type: SettingsOverridesSchema })
  settingsOverrides?: SettingsOverridesSchema;

  @Prop({ type: [String], default: [] })
  childConversationIds!: string[];

  @Prop({ type: String })
  parentConversationId?: string;

  @Prop({ type: String })
  graphRefId?: string;

  @Prop({ type: String })
  collectiveRefId?: string;

  @Prop({ type: SummarySchema })
  summaries?: SummarySchema;

  @Prop({ type: Object })
  agentState?: Record<string, unknown>;

  @Prop({ type: Boolean, default: false })
  isPinned?: boolean;

  @Prop({ type: String })
  folderId?: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  _id!: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ userId: 1, updatedAt: -1 });
// Note: status and type indexes are defined in @Prop decorators above
