/**
 * LaTeX Project MongoDB Schema
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LaTeXProjectDocument = LaTeXProjectSchema & Document;

export interface ProjectFile {
  path: string;
  content: string;
  type: 'tex' | 'bib' | 'cls' | 'sty' | 'bst' | 'image' | 'other';
  lastModified?: Date;
}

export interface ProjectDependency {
  type: 'package' | 'font' | 'binary';
  name: string;
  version?: string;
}

@Schema({ timestamps: true })
export class LaTeXProjectSchema {
  @Prop({ required: true, index: true })
  projectId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  mainFile!: string;

  @Prop({ type: Array, default: [] })
  files!: ProjectFile[];

  @Prop({ type: Array, default: [] })
  dependencies!: ProjectDependency[];

  @Prop({ type: Object })
  settings?: {
    engine?: 'xelatex' | 'pdflatex' | 'lualatex';
    shellEscape?: boolean;
    [key: string]: unknown;
  };

  @Prop()
  pdfGridFsId?: string;

  @Prop({ index: true })
  lastCompiledAt?: Date;

  @Prop({ default: 0 })
  version!: number;

  @Prop({ default: false })
  isTemplate!: boolean;

  @Prop()
  templateCategory?: string;
}

export const LaTeXProjectSchemaFactory =
  SchemaFactory.createForClass(LaTeXProjectSchema);

// Create compound indexes
LaTeXProjectSchemaFactory.index({ userId: 1, projectId: 1 }, { unique: true });
LaTeXProjectSchemaFactory.index({ userId: 1, updatedAt: -1 });
LaTeXProjectSchemaFactory.index({ isTemplate: 1, templateCategory: 1 });
