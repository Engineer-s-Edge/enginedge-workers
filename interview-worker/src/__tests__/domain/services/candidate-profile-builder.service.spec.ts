/**
 * Candidate Profile Builder Service Unit Tests
 */

import { CandidateProfileBuilderService } from '../../../domain/services/candidate-profile-builder.service';
import { CandidateProfile } from '../../../domain/entities/candidate-profile.entity';

describe('CandidateProfileBuilderService', () => {
  let service: CandidateProfileBuilderService;
  let mockProfile: CandidateProfile;

  beforeEach(() => {
    service = new CandidateProfileBuilderService();
    mockProfile = new CandidateProfile({
      profileId: 'test-profile',
      sessionId: 'test-session',
    });
  });

  describe('appendObservation', () => {
    it('should append strength observation', () => {
      const result = service.appendObservation(
        mockProfile,
        'strengths',
        'Strong problem-solving skills',
      );

      expect(result.observations.strengths).toContain(
        'Strong problem-solving skills',
      );
      expect(result.observations.strengths).toHaveLength(1);
    });

    it('should append multiple strength observations', () => {
      let result = service.appendObservation(
        mockProfile,
        'strengths',
        'Strength 1',
      );
      result = service.appendObservation(result, 'strengths', 'Strength 2');

      expect(result.observations.strengths).toHaveLength(2);
      expect(result.observations.strengths).toContain('Strength 1');
      expect(result.observations.strengths).toContain('Strength 2');
    });

    it('should append concern observation', () => {
      const result = service.appendObservation(
        mockProfile,
        'concerns',
        'Needs improvement in communication',
      );

      expect(result.observations.concerns).toContain(
        'Needs improvement in communication',
      );
      expect(result.observations.concerns).toHaveLength(1);
    });

    it('should append key insights', () => {
      const result = service.appendObservation(
        mockProfile,
        'keyInsights',
        'Insight 1',
      );

      expect(result.observations.keyInsights).toBe('Insight 1');
    });

    it('should concatenate multiple key insights with newline', () => {
      let result = service.appendObservation(
        mockProfile,
        'keyInsights',
        'Insight 1',
      );
      result = service.appendObservation(result, 'keyInsights', 'Insight 2');

      expect(result.observations.keyInsights).toBe('Insight 1\nInsight 2');
    });
  });

  describe('updateResumeFindings', () => {
    it('should update verified findings', () => {
      const result = service.updateResumeFindings(
        mockProfile,
        'verified',
        'Confirmed 5 years of experience',
      );

      expect(result.observations.resumeFindings.verified).toContain(
        'Confirmed 5 years of experience',
      );
      expect(result.observations.resumeFindings.verified).toHaveLength(1);
    });

    it('should update questioned findings', () => {
      const result = service.updateResumeFindings(
        mockProfile,
        'questioned',
        'Claimed expert in React but struggled with basics',
      );

      expect(result.observations.resumeFindings.questioned).toContain(
        'Claimed expert in React but struggled with basics',
      );
    });

    it('should update deepDived findings', () => {
      const result = service.updateResumeFindings(
        mockProfile,
        'deepDived',
        'Strong system design skills worth exploring',
      );

      expect(result.observations.resumeFindings.deepDived).toContain(
        'Strong system design skills worth exploring',
      );
    });
  });

  describe('updateInterviewFlow', () => {
    it('should update pausedAt', () => {
      const result = service.updateInterviewFlow(mockProfile, {
        pausedAt: ['question-1'],
      });

      expect(result.observations.interviewFlow.pausedAt).toContain(
        'question-1',
      );
    });

    it('should update skippedQuestions count', () => {
      const result = service.updateInterviewFlow(mockProfile, {
        skippedQuestions: 2,
      });

      expect(result.observations.interviewFlow.skippedQuestions).toBe(2);
    });

    it('should update pauseDuration', () => {
      const result = service.updateInterviewFlow(mockProfile, {
        pauseDuration: 120,
      });

      expect(result.observations.interviewFlow.pauseDuration).toBe(120);
    });

    it('should handle multiple updates', () => {
      const result = service.updateInterviewFlow(mockProfile, {
        pausedAt: ['q1', 'q2'],
        skippedQuestions: 1,
        pauseDuration: 60,
      });

      expect(result.observations.interviewFlow.pausedAt).toHaveLength(2);
      expect(result.observations.interviewFlow.skippedQuestions).toBe(1);
      expect(result.observations.interviewFlow.pauseDuration).toBe(60);
    });
  });

  describe('getProfileSummary', () => {
    it('should return profile summary', () => {
      let profile = service.appendObservation(
        mockProfile,
        'strengths',
        'Strength 1',
      );
      profile = service.appendObservation(profile, 'concerns', 'Concern 1');
      profile = service.appendObservation(
        profile,
        'keyInsights',
        'Key insight',
      );
      profile = service.updateResumeFindings(profile, 'verified', 'Finding 1');
      profile = service.updateInterviewFlow(profile, {
        skippedQuestions: 1,
        pauseDuration: 30,
      });

      const summary = service.getProfileSummary(profile);

      expect(summary.strengths).toContain('Strength 1');
      expect(summary.concerns).toContain('Concern 1');
      expect(summary.keyInsights).toBe('Key insight');
      expect(summary.resumeFindings.verified).toContain('Finding 1');
      expect(summary.interviewFlow.skippedQuestions).toBe(1);
      expect(summary.interviewFlow.pauseDuration).toBe(30);
    });

    it('should return empty summary for new profile', () => {
      const summary = service.getProfileSummary(mockProfile);

      expect(summary.strengths).toEqual([]);
      expect(summary.concerns).toEqual([]);
      expect(summary.keyInsights).toBe('');
      expect(summary.resumeFindings.verified).toEqual([]);
      expect(summary.resumeFindings.questioned).toEqual([]);
      expect(summary.resumeFindings.deepDived).toEqual([]);
    });
  });
});
