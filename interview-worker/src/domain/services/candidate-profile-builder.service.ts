/**
 * Candidate Profile Builder Service
 *
 * Domain service for building candidate profiles during interviews.
 * Pure business logic for profile construction.
 */

import { CandidateProfile } from '../entities/candidate-profile.entity';

export class CandidateProfileBuilderService {
  /**
   * Append observation to profile
   */
  appendObservation(
    profile: CandidateProfile,
    category: 'strengths' | 'concerns' | 'keyInsights',
    text: string,
  ): CandidateProfile {
    profile.appendObservation(category, text);
    return profile;
  }

  /**
   * Update resume findings
   */
  updateResumeFindings(
    profile: CandidateProfile,
    type: 'verified' | 'questioned' | 'deepDived',
    finding: string,
  ): CandidateProfile {
    profile.updateResumeFindings(type, finding);
    return profile;
  }

  /**
   * Update interview flow metadata
   */
  updateInterviewFlow(
    profile: CandidateProfile,
    data: {
      pausedAt?: string[];
      skippedQuestions?: number;
      pauseDuration?: number;
    },
  ): CandidateProfile {
    profile.updateInterviewFlow(data);
    return profile;
  }

  /**
   * Get current profile summary for recall
   */
  getProfileSummary(profile: CandidateProfile): {
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
  } {
    return {
      strengths: profile.observations.strengths,
      concerns: profile.observations.concerns,
      resumeFindings: profile.observations.resumeFindings,
      keyInsights: profile.observations.keyInsights,
      interviewFlow: profile.observations.interviewFlow,
    };
  }
}
