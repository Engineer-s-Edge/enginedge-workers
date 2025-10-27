/**
 * LaTeX Document MongoDB Schema
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LaTeXDocumentDocument = LaTeXDocumentSchema & Document;

@Schema({ timestamps: true })
export class LaTeXDocumentSchema {
  @Prop({ required: true, index: true })
  documentId!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ type: Object })
  metadata!: {
    title?: string;
    author?: string;
    date?: string;
    documentClass?: string;
    [key: string]: unknown;
  };

  @Prop({ type: [String], default: [] })
  packages!: string[];

  @Prop({ default: false })
  requiresBibliography!: boolean;

  @Prop()
  mainFile?: string;

  @Prop({ type: Object })
  compilationSettings?: {
    engine?: 'xelatex' | 'pdflatex' | 'lualatex';
    shellEscape?: boolean;
    passes?: number;
    [key: string]: unknown;
  };

  @Prop({ index: true })
  lastCompiledAt?: Date;

  @Prop()
  pdfGridFsId?: string;

  @Prop({ default: 1 })
  version!: number;
}

export const LaTeXDocumentSchemaFactory = SchemaFactory.createForClass(LaTeXDocumentSchema);

// Create compound indexes
LaTeXDocumentSchemaFactory.index({ userId: 1, documentId: 1 }, { unique: true });
LaTeXDocumentSchemaFactory.index({ userId: 1, lastCompiledAt: -1 });
