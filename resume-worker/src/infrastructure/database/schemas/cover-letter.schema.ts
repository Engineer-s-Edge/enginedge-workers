import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class CoverLetterMetadataSchema {
  @Prop()
  company!: string;

  @Prop()
  position!: string;

  @Prop({
    enum: ['professional', 'casual', 'enthusiastic'],
    default: 'professional',
  })
  tone!: string;

  @Prop({ enum: ['short', 'medium', 'long'], default: 'medium' })
  length!: string;

  @Prop({ type: [Types.ObjectId], default: [] })
  experiencesUsed!: Types.ObjectId[];
}

const CoverLetterMetadataSchemaFactory = SchemaFactory.createForClass(
  CoverLetterMetadataSchema,
);

@Schema({ timestamps: true })
export class CoverLetterSchema extends Document {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  resumeId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, index: true })
  jobPostingId?: Types.ObjectId;

  @Prop({ required: true })
  latexContent!: string;

  @Prop()
  pdfUrl?: string;

  @Prop({ type: CoverLetterMetadataSchemaFactory, required: true })
  metadata!: CoverLetterMetadataSchema;

  @Prop({ default: 1 })
  version!: number;

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const CoverLetterSchemaFactory =
  SchemaFactory.createForClass(CoverLetterSchema);

// Add indexes
CoverLetterSchemaFactory.index({ userId: 1, createdAt: -1 });
CoverLetterSchemaFactory.index({ resumeId: 1 });
CoverLetterSchemaFactory.index({ jobPostingId: 1 });
