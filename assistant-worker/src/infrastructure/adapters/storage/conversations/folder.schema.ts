import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FolderDocument = Folder & Document;

@Schema({ timestamps: true })
export class Folder {
  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: Number, default: 0 })
  conversationCount?: number;

  _id!: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const FolderSchema = SchemaFactory.createForClass(Folder);

FolderSchema.index({ userId: 1, createdAt: -1 });
