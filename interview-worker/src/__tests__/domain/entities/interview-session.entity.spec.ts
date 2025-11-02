/**
 * InterviewSession Entity Unit Tests
 */

import { InterviewSession } from '../../../domain/entities/interview-session.entity';

describe('InterviewSession', () => {
  it('should create session with required fields', () => {
    const session = new InterviewSession({
      sessionId: 's1',
      interviewId: 'i1',
      candidateId: 'c1',
      communicationMode: 'text',
    });

    expect(session.sessionId).toBe('s1');
    expect(session.interviewId).toBe('i1');
    expect(session.candidateId).toBe('c1');
    expect(session.status).toBe('in-progress');
    expect(session.currentPhase).toBe(0);
    expect(session.communicationMode).toBe('text');
    expect(session.pausedCount).toBe(0);
    expect(session.totalPauseDuration).toBe(0);
    expect(session.skippedQuestions).toEqual([]);
    expect(session.timeElapsed).toBe(0);
  });

  it('should create session with optional fields', () => {
    const session = new InterviewSession({
      sessionId: 's1',
      interviewId: 'i1',
      candidateId: 'c1',
      communicationMode: 'voice',
      status: 'paused',
      currentPhase: 1,
      currentQuestion: 'q1',
      pausedAt: new Date(),
      pausedCount: 2,
      totalPauseDuration: 120,
      skippedQuestions: ['q2'],
    });

    expect(session.status).toBe('paused');
    expect(session.currentPhase).toBe(1);
    expect(session.currentQuestion).toBe('q1');
    expect(session.pausedAt).toBeDefined();
    expect(session.pausedCount).toBe(2);
    expect(session.totalPauseDuration).toBe(120);
    expect(session.skippedQuestions).toContain('q2');
  });

  it('should calculate time elapsed correctly when in progress', () => {
    const startTime = new Date(Date.now() - 10000); // 10 seconds ago
    const session = new InterviewSession({
      sessionId: 's1',
      interviewId: 'i1',
      candidateId: 'c1',
      communicationMode: 'text',
      startedAt: startTime,
      timeElapsed: 0,
      totalPauseDuration: 0,
    });

    const elapsed = session.getTimeElapsed();
    expect(elapsed).toBeGreaterThanOrEqual(9);
    expect(elapsed).toBeLessThan(12);
  });

  it('should return stored time elapsed when paused', () => {
    const session = new InterviewSession({
      sessionId: 's1',
      interviewId: 'i1',
      candidateId: 'c1',
      communicationMode: 'text',
      status: 'paused',
      timeElapsed: 300,
    });

    expect(session.getTimeElapsed()).toBe(300);
  });

  it('should convert to object', () => {
    const session = new InterviewSession({
      sessionId: 's1',
      interviewId: 'i1',
      candidateId: 'c1',
      communicationMode: 'text',
    });

    const obj = session.toObject();

    expect(obj.sessionId).toBe('s1');
    expect(obj.status).toBe('in-progress');
  });
});
