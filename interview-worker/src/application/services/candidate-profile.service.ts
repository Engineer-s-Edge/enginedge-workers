/**
 * Candidate Profile Service
 * 
 * Application service for managing candidate profiles.
 */

import { Injectable, Inject } from '@nestjs/common';
import { CandidateProfile } from '../../domain/entities';
import { ICandidateProfileRepository } from '../ports/repositories.port';
import { CandidateProfileBuilderService } from '../../domain/services/candidate-profile-builder.service';

@Injectable()
export class CandidateProfileService {
  private readonly profileBuilder = new CandidateProfileBuilderService();

  constructor(
    @Inject('ICandidateProfileRepository')
    private readonly profileRepository: ICandidateProfileRepository,
  ) {}

  async getProfile(sessionId: string): Promise<CandidateProfile | null> {
    return await this.profileRepository.findBySessionId(sessionId);
  }

  async appendObservation(
    sessionId: string,
    category: 'strengths' | 'concerns' | 'keyInsights',
    text: string,
  ): Promise<CandidateProfile> {
    let profile = await this.profileRepository.findBySessionId(sessionId);
    if (!profile) {
      throw new Error(`Profile not found for session: ${sessionId}`);
    }

    profile = this.profileBuilder.appendObservation(profile, category, text);
    await this.profileRepository.save(profile);

    return profile;
  }

  async recallProfile(sessionId: string): Promise<{
    strengths: string[];
    concerns: string[];
    resumeFindings: {
      verified: string[];
      questioned: string[];
      deepDived: string[];
    };
    keyInsights: string;
    interviewFlow: {
      pausedAt: string[];
      skippedQuestions: number;
      pauseDuration: number;
    };
  }> {
    const profile = await this.profileRepository.findBySessionId(sessionId);
    if (!profile) {
      throw new Error(`Profile not found for session: ${sessionId}`);
    }

    return this.profileBuilder.getProfileSummary(profile);
  }

  async updateResumeFindings(
    sessionId: string,
    type: 'verified' | 'questioned' | 'deepDived',
    finding: string,
  ): Promise<CandidateProfile> {
    let profile = await this.profileRepository.findBySessionId(sessionId);
    if (!profile) {
      throw new Error(`Profile not found for session: ${sessionId}`);
    }

    profile = this.profileBuilder.updateResumeFindings(profile, type, finding);
    await this.profileRepository.save(profile);

    return profile;
  }

  async updateInterviewFlow(
    sessionId: string,
    data: {
      pausedAt?: string[];
      skippedQuestions?: number;
      pauseDuration?: number;
    },
  ): Promise<CandidateProfile> {
    let profile = await this.profileRepository.findBySessionId(sessionId);
    if (!profile) {
      throw new Error(`Profile not found for session: ${sessionId}`);
    }

    profile = this.profileBuilder.updateInterviewFlow(profile, data);
    await this.profileRepository.save(profile);

    return profile;
  }
}

