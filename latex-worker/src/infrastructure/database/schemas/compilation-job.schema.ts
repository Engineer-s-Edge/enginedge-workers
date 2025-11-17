/**
 * LaTeX Compilation Job MongoDB Schema
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CompilationJobDocument = CompilationJobSchema & Document;

@Schema({ timestamps: true, suppressReservedKeysWarning: true })
export class CompilationJobSchema {
  @Prop({ required: true, unique: true, index: true })
  jobId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ index: true })
  documentId?: string;

  @Prop({ index: true })
  projectId?: string;

  @Prop({
    required: true,
    enum: ['pending', 'compiling', 'completed', 'failed'],
    index: true,
  })
  status!: string;

  @Prop({ type: [String], default: [] })
  errors!: string[];

  @Prop({ type: [String], default: [] })
  warnings!: string[];

  @Prop()
  compilationTime?: number;

  @Prop()
  pdfGridFsId?: string;

  @Prop()
  logContent?: string;

  @Prop({ type: Object })
  metadata?: {
    engine?: string;
    passes?: number;
    packages?: string[];
    [key: string]: unknown;
  };
}

export const CompilationJobSchemaFactory =
  SchemaFactory.createForClass(CompilationJobSchema);

// Create indexes
CompilationJobSchemaFactory.index({ userId: 1, createdAt: -1 });
CompilationJobSchemaFactory.index({ status: 1, createdAt: -1 });
CompilationJobSchemaFactory.index({ documentId: 1, createdAt: -1 });
CompilationJobSchemaFactory.index({ projectId: 1, createdAt: -1 });
