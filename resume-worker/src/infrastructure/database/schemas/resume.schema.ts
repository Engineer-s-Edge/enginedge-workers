import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class ResumeVersionSchema {
  @Prop({ required: true })
  versionNumber: number;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  timestamp: Date;

  @Prop({ required: true })
  changes: string;

  @Prop({ required: true })
  hash: string;

  @Prop({ required: true })
  createdBy: string;

  @Prop()
  diff?: string;
}

const ResumeVersionSchemaFactory =
  SchemaFactory.createForClass(ResumeVersionSchema);

@Schema({ _id: false })
export class ResumeMetadataSchema {
  @Prop()
  targetRole?: string;

  @Prop()
  targetCompany?: string;

  @Prop({ type: Types.ObjectId })
  jobPostingId?: Types.ObjectId;

  @Prop()
  lastEvaluationScore?: number;

  @Prop({ type: Types.ObjectId })
  lastEvaluationReport?: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], default: [] })
  bulletPointIds: Types.ObjectId[];

  @Prop({ enum: ['draft', 'in-review', 'finalized'], default: 'draft' })
  status: string;
}

const ResumeMetadataSchemaFactory =
  SchemaFactory.createForClass(ResumeMetadataSchema);

@Schema({ timestamps: true })
export class ResumeSchema extends Document {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  latexContent: string;

  @Prop({ required: true, default: 1 })
  currentVersion: number;

  @Prop({ type: [ResumeVersionSchemaFactory], default: [] })
  versions: ResumeVersionSchema[];

  @Prop({ type: ResumeMetadataSchemaFactory, required: true })
  metadata: ResumeMetadataSchema;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ResumeSchemaFactory = SchemaFactory.createForClass(ResumeSchema);

// Add indexes
ResumeSchemaFactory.index({ userId: 1, createdAt: -1 });
ResumeSchemaFactory.index({ userId: 1, 'metadata.status': 1 });
ResumeSchemaFactory.index({ 'metadata.jobPostingId': 1 });
