/**
 * CandidateProfile Entity Unit Tests
 */

import { CandidateProfile } from '../../../domain/entities/candidate-profile.entity';

describe('CandidateProfile Entity', () => {
  it('should create profile with required fields', () => {
    const profile = new CandidateProfile({
      profileId: 'test-profile',
      sessionId: 'test-session',
    });

    expect(profile.profileId).toBe('test-profile');
    expect(profile.sessionId).toBe('test-session');
    expect(profile.observations.strengths).toEqual([]);
    expect(profile.observations.concerns).toEqual([]);
  });

  it('should append strength observation', () => {
    const profile = new CandidateProfile({
      profileId: 'test-profile',
      sessionId: 'test-session',
    });

    profile.appendObservation('strengths', 'Strong problem-solving');
    expect(profile.observations.strengths).toContain('Strong problem-solving');
    expect(profile.observations.strengths).toHaveLength(1);
  });

  it('should append concern observation', () => {
    const profile = new CandidateProfile({
      profileId: 'test-profile',
      sessionId: 'test-session',
    });

    profile.appendObservation('concerns', 'Needs improvement in communication');
    expect(profile.observations.concerns).toContain('Needs improvement in communication');
  });

  it('should append key insights', () => {
    const profile = new CandidateProfile({
      profileId: 'test-profile',
      sessionId: 'test-session',
    });

    profile.appendObservation('keyInsights', 'Insight 1');
    expect(profile.observations.keyInsights).toBe('Insight 1');

    profile.appendObservation('keyInsights', 'Insight 2');
    expect(profile.observations.keyInsights).toBe('Insight 1\nInsight 2');
  });

  it('should update resume findings', () => {
    const profile = new CandidateProfile({
      profileId: 'test-profile',
      sessionId: 'test-session',
    });

    profile.updateResumeFindings('verified', '5 years confirmed');
    expect(profile.observations.resumeFindings.verified).toContain('5 years confirmed');

    profile.updateResumeFindings('questioned', 'Claimed expert but struggled');
    expect(profile.observations.resumeFindings.questioned).toContain('Claimed expert but struggled');
  });

  it('should update interview flow', () => {
    const profile = new CandidateProfile({
      profileId: 'test-profile',
      sessionId: 'test-session',
    });

    profile.updateInterviewFlow({
      pausedAt: ['q1'],
      skippedQuestions: 2,
      pauseDuration: 120,
    });

    expect(profile.observations.interviewFlow.pausedAt).toContain('q1');
    expect(profile.observations.interviewFlow.skippedQuestions).toBe(2);
    expect(profile.observations.interviewFlow.pauseDuration).toBe(120);
  });

  it('should convert to object for MongoDB', () => {
    const profile = new CandidateProfile({
      profileId: 'test-profile',
      sessionId: 'test-session',
    });

    profile.appendObservation('strengths', 'Test strength');

    const obj = profile.toObject();
    expect(obj.profileId).toBe('test-profile');
    expect(obj.sessionId).toBe('test-session');
    expect((obj.observations as any).strengths).toContain('Test strength');
  });

  it('should create from MongoDB object', () => {
    const data = {
      profileId: 'test-profile',
      sessionId: 'test-session',
      observations: {
        strengths: ['Strength 1'],
        concerns: ['Concern 1'],
        resumeFindings: {
          verified: ['Finding 1'],
          questioned: [],
          deepDived: [],
        },
        adaptability: '',
        communicationStyle: '',
        interviewFlow: {
          pausedAt: [],
          skippedQuestions: 0,
          pauseDuration: 0,
        },
        keyInsights: '',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const profile = CandidateProfile.fromObject(data);
    expect(profile.profileId).toBe('test-profile');
    expect(profile.observations.strengths).toContain('Strength 1');
  });
});

