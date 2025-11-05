import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ConversationStatus,
  ConversationType,
} from '@domain/conversations/conversation.types';

export type ConversationDocument = Conversation & Document;

@Schema({ _id: false })
class SettingsOverridesSchema {
  @Prop() memoryType?: string;
  @Prop() model?: string;
  @Prop() temperature?: number;
  @Prop() maxTokens?: number;
  @Prop({ type: Object }) reasoning?: { steps?: number };
  @Prop({ type: Object }) tools?: { allowList?: string[]; denyList?: string[] };
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
    index: true,
    default: 'active',
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

  _id!: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ userId: 1, updatedAt: -1 });
ConversationSchema.index({ status: 1 });
ConversationSchema.index({ type: 1 });
