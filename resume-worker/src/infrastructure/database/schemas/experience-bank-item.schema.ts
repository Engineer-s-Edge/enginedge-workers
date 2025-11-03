import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ExperienceBankItemSchema extends Document {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  bulletText: string;

  @Prop({ type: [Number], required: true })
  vector: number[];

  @Prop({ required: true, default: 'text-embedding-004' })
  vectorModel: string;

  @Prop({
    type: {
      technologies: [String],
      role: String,
      company: String,
      dateRange: {
        start: Date,
        end: Date,
      },
      metrics: [String],
      keywords: [String],
      reviewed: { type: Boolean, default: false },
      linkedExperienceId: { type: Types.ObjectId, default: null },
      category: String,
      impactScore: { type: Number, default: 0 },
      atsScore: { type: Number, default: 0 },
      lastUsedDate: Date,
      usageCount: { type: Number, default: 0 },
    },
    required: true,
  })
  metadata: {
    technologies: string[];
    role: string;
    company: string;
    dateRange: {
      start: Date;
      end: Date | null;
    };
    metrics: string[];
    keywords: string[];
    reviewed: boolean;
    linkedExperienceId: Types.ObjectId | null;
    category: string;
    impactScore: number;
    atsScore: number;
    lastUsedDate: Date;
    usageCount: number;
  };

  @Prop({ required: true, unique: true, index: true })
  hash: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ExperienceBankItemSchemaFactory = SchemaFactory.createForClass(
  ExperienceBankItemSchema,
);

// Add indexes for common queries
ExperienceBankItemSchemaFactory.index({ userId: 1, 'metadata.reviewed': 1 });
ExperienceBankItemSchemaFactory.index({
  userId: 1,
  'metadata.technologies': 1,
});
ExperienceBankItemSchemaFactory.index({ userId: 1, 'metadata.role': 1 });
ExperienceBankItemSchemaFactory.index({
  userId: 1,
  'metadata.impactScore': -1,
});
ExperienceBankItemSchemaFactory.index({ hash: 1 }, { unique: true });
