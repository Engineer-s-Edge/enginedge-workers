/**
 * Agent Session Schema
 *
 * Mongoose schema for persisting agent sessions to MongoDB.
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AgentSessionDocument = AgentSession & Document;

@Schema({ timestamps: true, collection: 'agent_sessions' })
export class AgentSession {
  @Prop({ required: true, unique: true, index: true })
  sessionId: string;

  @Prop({ required: true, index: true })
  agentId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  instanceKey: string;

  @Prop({
    required: true,
    enum: ['active', 'paused', 'completed', 'failed'],
    default: 'active',
    index: true,
  })
  status: 'active' | 'paused' | 'completed' | 'failed';

  @Prop({ required: true, default: Date.now })
  createdAt: Date;

  @Prop({ required: true, default: Date.now, index: true })
  lastActivityAt: Date;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;

  // TTL index for automatic cleanup (sessions older than 7 days)
  @Prop({ required: true, default: Date.now, expires: 604800 }) // 7 days in seconds
  expiresAt: Date;
}

export const AgentSessionSchema = SchemaFactory.createForClass(AgentSession);

// Create indexes for efficient queries
AgentSessionSchema.index({ userId: 1, status: 1 });
AgentSessionSchema.index({ agentId: 1, status: 1 });
AgentSessionSchema.index({ lastActivityAt: 1 }); // For cleanup queries
AgentSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
