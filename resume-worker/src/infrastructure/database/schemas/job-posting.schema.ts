import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class JobPostingParsedSchema {
  @Prop({ type: Object })
  metadata: any;

  @Prop({ type: Object })
  role: any;

  @Prop({ type: Object })
  employment: any;

  @Prop({ type: Object })
  location: any;

  @Prop({ type: Object })
  compensation: any;

  @Prop({ type: Object })
  authorization: any;

  @Prop({ type: Object })
  education: any;

  @Prop({ type: Object })
  experience: any;

  @Prop({ type: Object })
  skills: any;

  @Prop({ type: [String] })
  responsibilities?: string[];

  @Prop({ type: Object })
  internship: any;

  @Prop({ type: Object })
  application: any;

  @Prop({ type: Object })
  company: any;

  @Prop({ type: Object })
  quality: any;

  @Prop({ type: [Object] })
  provenance?: any[];
}

const JobPostingParsedSchemaFactory = SchemaFactory.createForClass(JobPostingParsedSchema);

@Schema({ timestamps: true })
export class JobPostingSchema extends Document {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop()
  url?: string;

  @Prop({ required: true })
  rawText: string;

  @Prop()
  rawHtml?: string;

  @Prop({ type: JobPostingParsedSchemaFactory, required: true })
  parsed: JobPostingParsedSchema;

  @Prop({ enum: ['nlp-only', 'llm-assisted'], required: true })
  extractionMethod: string;

  @Prop({ required: true, min: 0, max: 1 })
  confidence: number;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const JobPostingSchemaFactory = SchemaFactory.createForClass(JobPostingSchema);

// Add indexes
JobPostingSchemaFactory.index({ userId: 1, createdAt: -1 });
JobPostingSchemaFactory.index({ url: 1 });
JobPostingSchemaFactory.index({ 'parsed.role.titleRaw': 'text', 'parsed.company.hiringOrganization': 'text' });

