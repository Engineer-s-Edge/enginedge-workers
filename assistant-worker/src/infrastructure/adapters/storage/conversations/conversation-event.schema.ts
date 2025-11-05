import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConversationEventDocument = ConversationEvent & Document;

@Schema({ _id: false })
class MessagePayloadSchema {
  @Prop({ required: true }) messageId!: string;
  @Prop({ required: true, enum: ['user', 'assistant', 'system'] })
  role!: string;
  @Prop({ required: true }) content!: string;
  @Prop({ type: Object }) metadata?: Record<string, unknown>;
  @Prop({ required: true }) version!: number;
}

@Schema({ _id: false })
class ToolCallPayloadSchema {
  @Prop({ required: true }) name!: string;
  @Prop({ type: Object, required: true }) args!: Record<string, unknown>;
  @Prop() result?: unknown;
  @Prop({ required: true, enum: ['ok', 'error'] }) status!: string;
  @Prop() latencyMs?: number;
  @Prop() tokensIn?: number;
  @Prop() tokensOut?: number;
  @Prop() cost?: number;
}

@Schema({ _id: false })
class CheckpointPayloadSchema {
  @Prop({ required: true }) checkpointId!: string;
  @Prop() name?: string;
  @Prop() description?: string;
  @Prop() snapshotRefId?: string;
}

@Schema({ _id: false })
class StateChangePayloadSchema {
  @Prop() from?: string;
  @Prop({ required: true }) to!: string;
  @Prop() reason?: string;
}

@Schema({ _id: false })
class ConfigChangePayloadSchema {
  @Prop({ required: true }) path!: string;
  @Prop() old?: unknown;
  @Prop() new?: unknown;
}

@Schema({ _id: false })
class NotePayloadSchema {
  @Prop({ required: true }) text!: string;
  @Prop({ type: Object }) metadata?: Record<string, unknown>;
}

@Schema({ _id: false, discriminatorKey: 'kind' })
class PayloadSchema {
  @Prop({ required: true }) kind!: string;
  @Prop({ type: Object }) data!: unknown;
}

@Schema({ timestamps: false })
export class ConversationEvent {
  @Prop({ type: String, index: true, required: true })
  conversationId!: string;

  @Prop({ type: Date, index: true, required: true })
  ts!: Date;

  @Prop({
    type: String,
    enum: [
      'message',
      'tool_call',
      'checkpoint',
      'state_change',
      'config_change',
      'note',
    ],
    required: true,
  })
  type!: string;

  @Prop({ type: PayloadSchema, required: true })
  payload!: unknown;

  _id!: string;
}

export const ConversationEventSchema =
  SchemaFactory.createForClass(ConversationEvent);

ConversationEventSchema.index({ conversationId: 1, ts: 1 });
