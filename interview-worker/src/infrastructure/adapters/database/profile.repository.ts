/**
 * CandidateProfile Repository - MongoDB Implementation
 */

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, Collection } from 'mongodb';
import { CandidateProfile } from '../../../domain/entities';
import { ICandidateProfileRepository } from '../../../application/ports/repositories.port';

@Injectable()
export class MongoCandidateProfileRepository
  implements ICandidateProfileRepository, OnModuleInit
{
  private readonly logger = new Logger(MongoCandidateProfileRepository.name);
  private collection!: Collection;

  constructor(
    @Inject('MONGODB_DB') private readonly db: Db,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.collection = this.db.collection('candidate_profiles');

    // Create indexes
    await this.collection.createIndex({ profileId: 1 }, { unique: true });
    await this.collection.createIndex({ sessionId: 1 }, { unique: true });
    await this.collection.createIndex({ updatedAt: -1 });

    this.logger.log('MongoCandidateProfileRepository initialized');
  }

  async save(profile: CandidateProfile): Promise<CandidateProfile> {
    try {
      const doc = profile.toObject();
      await this.collection.updateOne(
        { sessionId: profile.sessionId },
        { $set: { ...doc, updatedAt: new Date() } },
        { upsert: true },
      );
      return profile;
    } catch (error) {
      this.logger.error(`Failed to save profile: ${error}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async findBySessionId(
    sessionId: string,
  ): Promise<CandidateProfile | null> {
    try {
      const doc = await this.collection.findOne({ sessionId });
      return doc ? CandidateProfile.fromObject(doc) : null;
    } catch (error) {
      this.logger.error(`Failed to find profile: ${error}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async update(
    sessionId: string,
    profile: Partial<CandidateProfile>,
  ): Promise<CandidateProfile | null> {
    try {
      const updateDoc = {
        ...Object.fromEntries(
          Object.entries(profile).filter(([_, v]) => v !== undefined),
        ),
        updatedAt: new Date(),
      };
      delete (updateDoc as any).sessionId; // Don't update sessionId
      delete (updateDoc as any).profileId; // Don't update profileId

      const result = await this.collection.findOneAndUpdate(
        { sessionId },
        { $set: updateDoc },
        { returnDocument: 'after' },
      );

      return result ? CandidateProfile.fromObject(result) : null;
    } catch (error) {
      this.logger.error(`Failed to update profile: ${error}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  async delete(sessionId: string): Promise<boolean> {
    try {
      const result = await this.collection.deleteOne({ sessionId });
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to delete profile: ${error}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }
}

