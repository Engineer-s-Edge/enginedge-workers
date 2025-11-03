/**
 * LaTeX Template MongoDB Schema
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LaTeXTemplateDocument = LaTeXTemplateSchema & Document;

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  label: string;
  description: string;
  defaultValue?: string;
  required: boolean;
}

@Schema({ timestamps: true })
export class LaTeXTemplateSchema {
  @Prop({ required: true, unique: true, index: true })
  templateId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true, index: true })
  category!: string; // resume, article, report, thesis, presentation, etc.

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ required: true })
  content!: string;

  @Prop({ type: Array, default: [] })
  variables!: TemplateVariable[];

  @Prop()
  previewImageUrl?: string;

  @Prop()
  authorId?: string;

  @Prop({ default: false })
  isPublic!: boolean;

  @Prop({ default: 0 })
  usageCount!: number;

  @Prop({ default: 0 })
  rating!: number;

  @Prop({ type: [String], default: [] })
  requiredPackages!: string[];
}

export const LaTeXTemplateSchemaFactory =
  SchemaFactory.createForClass(LaTeXTemplateSchema);

// Create indexes
LaTeXTemplateSchemaFactory.index({ category: 1, isPublic: 1 });
LaTeXTemplateSchemaFactory.index({ tags: 1 });
LaTeXTemplateSchemaFactory.index({ usageCount: -1 });
