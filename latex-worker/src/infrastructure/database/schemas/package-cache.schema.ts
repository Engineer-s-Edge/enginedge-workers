/**
 * LaTeX Package Cache MongoDB Schema
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PackageCacheDocument = PackageCacheSchema & Document;

@Schema({ timestamps: true })
export class PackageCacheSchema {
  @Prop({ required: true, unique: true, index: true })
  packageName!: string;

  @Prop()
  version?: string;

  @Prop({ required: true })
  installedAt!: Date;

  @Prop()
  lastUsedAt!: Date;

  @Prop({ default: 0 })
  usageCount!: number;

  @Prop({ type: Object })
  metadata?: {
    size?: number;
    dependencies?: string[];
    description?: string;
    [key: string]: unknown;
  };

  @Prop({ default: true })
  isAvailable!: boolean;
}

export const PackageCacheSchemaFactory =
  SchemaFactory.createForClass(PackageCacheSchema);

// Create indexes
PackageCacheSchemaFactory.index({ lastUsedAt: 1 }); // For cleanup of stale packages
PackageCacheSchemaFactory.index({ usageCount: -1 }); // For popular packages
