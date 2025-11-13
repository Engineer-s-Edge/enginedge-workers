/**
 * Research Session MongoDB Schema
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  ResearchSession,
  ResearchSessionStatus,
} from '../../../../domain/entities/research-session.entity';

export type ResearchSessionDocument = ResearchSession & Document;

@Schema({ collection: 'research_sessions', timestamps: true })
export class ResearchSessionModel {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ index: true })
  agentId?: string;

  @Prop({ index: true })
  conversationId?: string;

  @Prop({ required: true })
  query!: string;

  @Prop()
  domain?: string;

  @Prop({
    type: String,
    enum: Object.values(ResearchSessionStatus),
    default: ResearchSessionStatus.PENDING,
    index: true,
  })
  status!: ResearchSessionStatus;

  @Prop({
    type: [
      {
        id: String,
        url: String,
        title: String,
        author: String,
        publishDate: Date,
        credibilityScore: Number,
      },
    ],
    default: [],
  })
  sources!: Array<{
    id: string;
    url: string;
    title: string;
    author?: string;
    publishDate?: Date;
    credibilityScore?: number;
  }>;

  @Prop({ type: Number, default: 0 })
  sourceCount!: number;

  @Prop({ type: Number, default: 0 })
  evidenceCount!: number;

  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  averageConfidence!: number;

  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  overallConfidence!: number;

  @Prop({
    type: [
      {
        phase: { type: String, enum: ['aim', 'shoot', 'skin'] },
        status: {
          type: String,
          enum: ['pending', 'in-progress', 'completed', 'failed'],
        },
        output: String,
        startedAt: Date,
        completedAt: Date,
        duration: Number,
      },
    ],
    default: [],
  })
  phases!: Array<{
    phase: 'aim' | 'shoot' | 'skin';
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    output?: string;
    startedAt?: Date;
    completedAt?: Date;
    duration?: number;
  }>;

  @Prop({
    type: {
      id: String,
      title: String,
      abstract: String,
      keyFindings: [String],
      conclusions: String,
      recommendations: String,
      generatedAt: Date,
    },
    required: false,
  })
  report?: {
    id: string;
    title: string;
    abstract: string;
    keyFindings: string[];
    conclusions: string;
    recommendations?: string;
    generatedAt: Date;
  };

  @Prop({ required: true, default: Date.now })
  startedAt!: Date;

  @Prop()
  completedAt?: Date;

  @Prop({ type: Number })
  executionTimeMs?: number;

  @Prop({
    type: {
      researchDepth: { type: String, enum: ['basic', 'advanced'] },
      maxSources: Number,
      maxTokens: Number,
      useBertScore: Boolean,
    },
    required: false,
  })
  metadata?: {
    researchDepth?: 'basic' | 'advanced';
    maxSources?: number;
    maxTokens?: number;
    useBertScore?: boolean;
  };
}

export const ResearchSessionSchema =
  SchemaFactory.createForClass(ResearchSessionModel);
