import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongooseDocument } from 'mongoose';

/**
 * MongoDB Document Schema
 * 
 * Stores processed documents with optional vector embeddings.
 * Supports MongoDB Atlas Vector Search.
 */
@Schema({ collection: 'documents', timestamps: true })
export class DocumentModel extends MongooseDocument {
  @Prop({ required: true, unique: true })
  documentId!: string;

  @Prop({ required: true, type: String })
  content!: string;

  @Prop({ type: Object })
  metadata!: Record<string, unknown>;

  @Prop({ type: [Number] })
  embedding?: number[];

  @Prop()
  embeddingModel?: string;

  @Prop()
  userId?: string;

  @Prop()
  conversationId?: string;

  @Prop()
  parentDocumentId?: string;

  @Prop()
  chunkIndex?: number;

  @Prop()
  totalChunks?: number;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const DocumentSchema = SchemaFactory.createForClass(DocumentModel);

// Create text index for full-text search
DocumentSchema.index({ content: 'text', 'metadata.source': 'text' });

// Create index for user and conversation filtering
DocumentSchema.index({ userId: 1, conversationId: 1 });

// Create index for parent-child relationships
DocumentSchema.index({ parentDocumentId: 1, chunkIndex: 1 });

// Vector search index (requires MongoDB Atlas with vector search enabled)
// This is created manually in MongoDB Atlas:
// {
//   "fields": [{
//     "type": "vector",
//     "path": "embedding",
//     "numDimensions": 1536,
//     "similarity": "cosine"
//   }]
// }
