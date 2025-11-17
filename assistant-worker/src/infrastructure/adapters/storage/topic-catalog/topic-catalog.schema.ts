/**
 * Topic Catalog MongoDB Schema
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  TopicCatalogEntry,
  TopicStatus,
  TopicSourceType,
  ICSLayer,
} from '../../../../domain/entities/topic-catalog.entity';

export type TopicCatalogDocument = TopicCatalogEntry & Document;

@Schema({ collection: 'topic_catalog', timestamps: true })
export class TopicCatalog {
  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  category!: string;

  @Prop({ type: [String], default: [] })
  subcategories!: string[];

  @Prop({
    type: Number,
    enum: Object.values(ICSLayer),
    default: ICSLayer.L3_TOPIC,
  })
  estimatedComplexity!: ICSLayer;

  @Prop({ type: [String], default: [] })
  prerequisiteTopics!: string[];

  @Prop({
    type: String,
    enum: Object.values(TopicStatus),
    default: TopicStatus.NOT_STARTED,
    index: true,
  })
  status!: TopicStatus;

  @Prop({ index: true })
  knowledgeNodeId?: string;

  @Prop()
  lastUpdated?: Date;

  @Prop({
    type: String,
    enum: Object.values(TopicSourceType),
    required: true,
  })
  sourceType!: TopicSourceType;

  @Prop({
    type: {
      wikipediaUrl: String,
      wikipediaPageId: Number,
      wikidataId: String,
    },
    required: false,
  })
  externalIds?: {
    wikipediaUrl?: string;
    wikipediaPageId?: number;
    wikidataId?: string;
  };

  @Prop({ type: [String], default: [] })
  relatedCategories!: string[];

  @Prop({ type: Number, default: 50, min: 0, max: 100, index: true })
  researchPriority!: number;

  @Prop()
  discoveredBy?: string;

  @Prop()
  discoveredAt?: Date;

  @Prop({
    type: {
      description: String,
      keywords: [String],
      estimatedResearchTime: Number,
      difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      },
    },
    required: false,
  })
  metadata?: {
    description?: string;
    keywords?: string[];
    estimatedResearchTime?: number;
    difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  };

  @Prop({ type: [Number], required: false })
  embedding?: number[];

  @Prop({ type: Number, min: 0, max: 1 })
  categorizationConfidence?: number;
}

export const TopicCatalogSchema = SchemaFactory.createForClass(TopicCatalog);

// Create indexes
TopicCatalogSchema.index({ name: 'text' }); // Text search
TopicCatalogSchema.index({ status: 1, researchPriority: -1 }); // Find high-priority unresearched
TopicCatalogSchema.index({ category: 1, status: 1 }); // Filter by category and status
TopicCatalogSchema.index({ sourceType: 1 }); // Filter by source
TopicCatalogSchema.index({ 'externalIds.wikidataId': 1 }); // Lookup by Wikidata ID
