/**
 * Interview State Machine Service Unit Tests
 */

import { InterviewStateMachineService } from '../../../domain/services/interview-state-machine.service';
import { InterviewSession, SessionStatus } from '../../../domain/entities/interview-session.entity';

describe('InterviewStateMachineService', () => {
  let service: InterviewStateMachineService;
  let mockSession: InterviewSession;

  beforeEach(() => {
    service = new InterviewStateMachineService();
    mockSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      currentPhase: 0,
      status: 'in-progress',
      communicationMode: 'text',
      startedAt: new Date(Date.now() - 60000), // Started 1 minute ago
    });
  });

  describe('canTransition', () => {
    it('should allow transition from in-progress to paused', () => {
      expect(service.canTransition('in-progress', 'paused')).toBe(true);
    });

    it('should allow transition from in-progress to completed', () => {
      expect(service.canTransition('in-progress', 'completed')).toBe(true);
    });

    it('should allow transition from in-progress to abandoned', () => {
      expect(service.canTransition('in-progress', 'abandoned')).toBe(true);
    });

    it('should allow transition from paused to in-progress', () => {
      expect(service.canTransition('paused', 'in-progress')).toBe(true);
    });

    it('should allow transition from paused to abandoned', () => {
      expect(service.canTransition('paused', 'abandoned')).toBe(true);
    });

    it('should not allow transition from completed to any state', () => {
      expect(service.canTransition('completed', 'in-progress')).toBe(false);
      expect(service.canTransition('completed', 'paused')).toBe(false);
      expect(service.canTransition('completed', 'abandoned')).toBe(false);
    });

    it('should not allow transition from abandoned to any state', () => {
      expect(service.canTransition('abandoned', 'in-progress')).toBe(false);
      expect(service.canTransition('abandoned', 'paused')).toBe(false);
      expect(service.canTransition('abandoned', 'completed')).toBe(false);
    });

    it('should not allow invalid transitions', () => {
      expect(service.canTransition('paused', 'completed')).toBe(false);
    });
  });

  describe('transition', () => {
    it('should transition from in-progress to paused', () => {
      const result = service.transition(mockSession, 'paused');
      
      expect(result.status).toBe('paused');
      expect(result.pausedAt).toBeDefined();
      expect(result.timeElapsed).toBeGreaterThan(0);
    });

    it('should transition from paused to in-progress', () => {
      const pausedSession = service.transition(mockSession, 'paused');
      
      // Simulate some time passing by manually setting pausedAt in the past
      const pauseStartTime = Date.now() - 5000; // 5 seconds ago
      const sessionWithPause = new InterviewSession({
        ...pausedSession,
        pausedAt: new Date(pauseStartTime),
      });
      
      const resumedSession = service.transition(sessionWithPause, 'in-progress');
      
      expect(resumedSession.status).toBe('in-progress');
      expect(resumedSession.pausedAt).toBeUndefined();
      expect(resumedSession.pausedCount).toBe(1);
      expect(resumedSession.totalPauseDuration).toBeGreaterThanOrEqual(5);
      expect(resumedSession.phaseStartTime).toBeDefined();
    });

    it('should transition to completed', () => {
      const result = service.transition(mockSession, 'completed');
      
      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeDefined();
      expect(result.timeElapsed).toBeGreaterThan(0);
    });

    it('should throw error for invalid transition', () => {
      const completedSession = service.transition(mockSession, 'completed');
      
      expect(() => {
        service.transition(completedSession, 'in-progress');
      }).toThrow();
    });

    it('should calculate pause duration correctly', () => {
      const pausedSession = service.transition(mockSession, 'paused');
      
      // Simulate pause by setting pausedAt in the past
      const pauseStartTime = Date.now() - 5000; // 5 seconds ago
      const sessionWithPause = new InterviewSession({
        ...pausedSession,
        pausedAt: new Date(pauseStartTime),
      });
      
      const resumedSession = service.transition(sessionWithPause, 'in-progress');
      
      expect(resumedSession.totalPauseDuration).toBeGreaterThanOrEqual(5);
    });

    it('should preserve session data during transition', () => {
      const sessionWithData = new InterviewSession({
        ...mockSession,
        currentQuestion: 'q1',
        skippedQuestions: ['q2'],
      });
      
      const result = service.transition(sessionWithData, 'paused');
      
      expect(result.sessionId).toBe(sessionWithData.sessionId);
      expect(result.currentQuestion).toBe('q1');
      expect(result.skippedQuestions).toEqual(['q2']);
    });
  });

  describe('canPause', () => {
    it('should return true for in-progress session', () => {
      expect(service.canPause(mockSession)).toBe(true);
    });

    it('should return false for paused session', () => {
      const pausedSession = service.transition(mockSession, 'paused');
      expect(service.canPause(pausedSession)).toBe(false);
    });

    it('should return false for completed session', () => {
      const completedSession = service.transition(mockSession, 'completed');
      expect(service.canPause(completedSession)).toBe(false);
    });
  });

  describe('canResume', () => {
    it('should return true for paused session', () => {
      const pausedSession = service.transition(mockSession, 'paused');
      expect(service.canResume(pausedSession)).toBe(true);
    });

    it('should return false for in-progress session', () => {
      expect(service.canResume(mockSession)).toBe(false);
    });

    it('should return false for completed session', () => {
      const completedSession = service.transition(mockSession, 'completed');
      expect(service.canResume(completedSession)).toBe(false);
    });
  });

  describe('canMoveToNextPhase', () => {
    it('should return true when can move to next phase', () => {
      expect(service.canMoveToNextPhase(mockSession, 3)).toBe(true);
    });

    it('should return false when on last phase', () => {
      const lastPhaseSession = new InterviewSession({
        ...mockSession,
        currentPhase: 2,
      });
      expect(service.canMoveToNextPhase(lastPhaseSession, 3)).toBe(false);
    });

    it('should return false when not in-progress', () => {
      const pausedSession = service.transition(mockSession, 'paused');
      expect(service.canMoveToNextPhase(pausedSession, 3)).toBe(false);
    });
  });

  describe('moveToNextPhase', () => {
    it('should move to next phase', () => {
      const result = service.moveToNextPhase(mockSession);
      
      expect(result.currentPhase).toBe(1);
      expect(result.currentQuestion).toBeUndefined();
      expect(result.phaseStartTime).toBeDefined();
      expect(result.phaseTimeElapsed).toBe(0);
    });

    it('should verify cannot move to next phase when not in-progress', () => {
      // Test that canMoveToNextPhase returns false for non-in-progress sessions
      const pausedSession = new InterviewSession({
        ...mockSession,
        currentPhase: 0,
        status: 'paused',
      });
      
      expect(service.canMoveToNextPhase(pausedSession, 3)).toBe(false);
      
      const completedSession = new InterviewSession({
        ...mockSession,
        currentPhase: 1,
        status: 'completed',
      });
      
      expect(service.canMoveToNextPhase(completedSession, 3)).toBe(false);
    });
  });

  describe('hasExceededTimeLimit', () => {
    it('should return false when within time limit', () => {
      const session = new InterviewSession({
        ...mockSession,
        startedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        timeElapsed: 30 * 60, // 30 minutes elapsed
      });
      
      expect(service.hasExceededTimeLimit(session, 60)).toBe(false);
    });

    it('should return true when exceeded time limit', () => {
      const session = new InterviewSession({
        ...mockSession,
        startedAt: new Date(Date.now() - 65 * 60 * 1000), // 65 minutes ago
        timeElapsed: 65 * 60, // 65 minutes elapsed
      });
      
      expect(service.hasExceededTimeLimit(session, 60)).toBe(true);
    });
  });

  describe('hasExceededPhaseTimeLimit', () => {
    it('should return false when within phase time limit', () => {
      const session = new InterviewSession({
        ...mockSession,
        phaseStartTime: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        phaseTimeElapsed: 15 * 60, // 15 minutes elapsed
      });
      
      expect(service.hasExceededPhaseTimeLimit(session, 30)).toBe(false);
    });

    it('should return true when exceeded phase time limit', () => {
      const session = new InterviewSession({
        ...mockSession,
        phaseStartTime: new Date(Date.now() - 35 * 60 * 1000), // 35 minutes ago
        phaseTimeElapsed: 35 * 60, // 35 minutes elapsed
      });
      
      expect(service.hasExceededPhaseTimeLimit(session, 30)).toBe(true);
    });
  });
});

