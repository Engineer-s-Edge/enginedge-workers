import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class EvaluationScoresSchema {
  @Prop({ required: true })
  atsParseability: number;

  @Prop({ required: true })
  bulletQuality: number;

  @Prop({ required: true })
  roleJdAlignment: number;

  @Prop({ required: true })
  repetitionCoverage: number;

  @Prop({ required: true })
  scanability: number;

  @Prop({ required: true })
  mechanics: number;

  @Prop({ required: true })
  overall: number;
}

const EvaluationScoresSchemaFactory = SchemaFactory.createForClass(EvaluationScoresSchema);

@Schema({ _id: false })
export class EvaluationGatesSchema {
  @Prop({ required: true })
  atsFail: boolean;

  @Prop({ required: true })
  contactMissing: boolean;

  @Prop({ required: true })
  pageOver: boolean;
}

const EvaluationGatesSchemaFactory = SchemaFactory.createForClass(EvaluationGatesSchema);

@Schema({ timestamps: true })
export class EvaluationReportSchema extends Document {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  resumeId: Types.ObjectId;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ enum: ['standalone', 'role-guided', 'jd-match'], required: true })
  mode: string;

  @Prop({ type: Types.ObjectId })
  jobPostingId?: Types.ObjectId;

  @Prop()
  targetRole?: string;

  @Prop({ type: EvaluationScoresSchemaFactory, required: true })
  scores: EvaluationScoresSchema;

  @Prop({ type: EvaluationGatesSchemaFactory, required: true })
  gates: EvaluationGatesSchema;

  @Prop({ type: [Object], default: [] })
  findings: any[];

  @Prop({ type: Object, required: true })
  coverage: any;

  @Prop({ type: Object, required: true })
  repetition: any;

  @Prop({ type: [Object], default: [] })
  suggestedSwaps: any[];

  @Prop()
  createdAt: Date;
}

export const EvaluationReportSchemaFactory = SchemaFactory.createForClass(EvaluationReportSchema);

// Add indexes
EvaluationReportSchemaFactory.index({ resumeId: 1, createdAt: -1 });
EvaluationReportSchemaFactory.index({ userId: 1, createdAt: -1 });
EvaluationReportSchemaFactory.index({ jobPostingId: 1 });

