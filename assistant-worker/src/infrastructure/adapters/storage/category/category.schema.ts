/**
 * Category MongoDB Schema
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Category } from '../../../../domain/entities/category.entity';

export type CategoryDocument = Category & Document;

@Schema({ collection: 'categories', timestamps: true })
export class CategoryModel {
  @Prop({ required: true, unique: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop({ type: [Number], required: true })
  embedding!: number[];

  @Prop({ type: [String], default: [] })
  topicIds!: string[];

  @Prop()
  parentCategoryId?: string;

  @Prop({ type: [String], default: [] })
  childCategoryIds!: string[];

  @Prop({ type: [String], default: [] })
  keywords!: string[];

  @Prop({ type: [String], default: [] })
  entityTypes!: string[];

  @Prop({ type: Number, default: 0 })
  topicCount!: number;

  @Prop()
  lastTopicAddedAt?: Date;
}

export const CategorySchema = SchemaFactory.createForClass(CategoryModel);

// Create indexes
// Note: name already has a unique index from @Prop({ unique: true }), so no need to add it again
CategorySchema.index({ parentCategoryId: 1 });
CategorySchema.index({ topicIds: 1 });
