/**
 * Transcript Repository - MongoDB Implementation
 */

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, Collection } from 'mongodb';
import { Transcript, TranscriptMessage } from '../../../domain/entities';
import { ITranscriptRepository } from '../../../application/ports/repositories.port';

@Injectable()
export class MongoTranscriptRepository
  implements ITranscriptRepository, OnModuleInit
{
  private readonly logger = new Logger(MongoTranscriptRepository.name);
  private collection!: Collection;

  constructor(
    @Inject('MONGODB_DB') private readonly db: Db,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.collection = this.db.collection('transcripts');

    // Create indexes
    await this.collection.createIndex({ sessionId: 1 }, { unique: true });
    await this.collection.createIndex({ 'messages.timestamp': 1 });
    await this.collection.createIndex({ 'messages.speaker': 1 });

    this.logger.log('MongoTranscriptRepository initialized');
  }

  async save(transcript: Transcript): Promise<Transcript> {
    try {
      const doc = {
        sessionId: transcript.sessionId,
        messages: transcript.messages.map((msg) => ({
          timestamp: msg.timestamp,
          speaker: msg.speaker,
          text: msg.text,
          type: msg.type,
          followupForQuestionId: msg.followupForQuestionId,
        })),
      };

      await this.collection.updateOne(
        { sessionId: transcript.sessionId },
        { $set: doc },
        { upsert: true },
      );
      return transcript;
    } catch (error) {
      this.logger.error(`Failed to save transcript: ${error}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async findBySessionId(sessionId: string): Promise<Transcript | null> {
    try {
      const doc = await this.collection.findOne({ sessionId });
      if (!doc) return null;

      return {
        sessionId: doc.sessionId as string,
        messages: (doc.messages as Record<string, unknown>[]).map((msg) => ({
          timestamp: msg.timestamp ? new Date(msg.timestamp as string) : new Date(),
          speaker: msg.speaker as 'candidate' | 'agent',
          text: msg.text as string,
          type: msg.type as 'user-input' | 'voice-transcription' | 'agent-response' | 'followup',
          followupForQuestionId: msg.followupForQuestionId as string | undefined,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to find transcript: ${error}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async appendMessage(
    sessionId: string,
    message: TranscriptMessage,
  ): Promise<void> {
    try {
      const messageDoc = {
        timestamp: message.timestamp,
        speaker: message.speaker,
        text: message.text,
        type: message.type,
        followupForQuestionId: message.followupForQuestionId,
      };

      await this.collection.updateOne(
        { sessionId },
        {
          $push: {
            messages: messageDoc,
          } as any,
        },
        { upsert: true },
      );
    } catch (error) {
      this.logger.error(`Failed to append message: ${error}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async update(
    sessionId: string,
    transcript: Partial<Transcript>,
  ): Promise<Transcript | null> {
    try {
      const updateDoc: Record<string, unknown> = {};
      if (transcript.messages) {
        updateDoc.messages = transcript.messages.map((msg) => ({
          timestamp: msg.timestamp,
          speaker: msg.speaker,
          text: msg.text,
          type: msg.type,
          followupForQuestionId: msg.followupForQuestionId,
        }));
      }

      const result = await this.collection.findOneAndUpdate(
        { sessionId },
        { $set: updateDoc },
        { returnDocument: 'after' },
      );

      if (!result) return null;

      return {
        sessionId: result.sessionId as string,
        messages: (result.messages as Record<string, unknown>[]).map((msg) => ({
          timestamp: msg.timestamp ? new Date(msg.timestamp as string) : new Date(),
          speaker: msg.speaker as 'candidate' | 'agent',
          text: msg.text as string,
          type: msg.type as 'user-input' | 'voice-transcription' | 'agent-response' | 'followup',
          followupForQuestionId: msg.followupForQuestionId as string | undefined,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to update transcript: ${error}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }
}

