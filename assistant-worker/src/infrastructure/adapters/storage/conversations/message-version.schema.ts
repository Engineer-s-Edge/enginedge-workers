import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageVersionDocument = MessageVersion & Document;

@Schema({ timestamps: false })
export class MessageVersion {
  @Prop({ required: true, index: true })
  messageId!: string;

  @Prop({ required: true, index: true })
  conversationId!: string;

  @Prop({ required: true })
  version!: number;

  @Prop({ required: true, enum: ['user','assistant','system'] })
  role!: string;

  @Prop({ required: true })
  content!: string;

  @Prop() editedBy?: string;

  @Prop({ required: true })
  editedAt!: Date;

  @Prop() diff?: string;

  @Prop() previousRefVersion?: number;

  _id!: string;
}

export const MessageVersionSchema = SchemaFactory.createForClass(MessageVersion);

MessageVersionSchema.index({ conversationId: 1, messageId: 1, version: 1 }, { unique: true });
