/**
 * Interview State Machine Service
 * 
 * Domain service managing interview session state transitions.
 * Pure business logic for state management.
 */

import { InterviewSession, SessionStatus } from '../entities/interview-session.entity';

export class InterviewStateMachineService {
  /**
   * Check if transition from current status to new status is valid
   */
  canTransition(
    currentStatus: SessionStatus,
    newStatus: SessionStatus,
  ): boolean {
    const validTransitions: Record<SessionStatus, SessionStatus[]> = {
      'in-progress': ['paused', 'completed', 'abandoned'],
      paused: ['in-progress', 'abandoned'],
      completed: [], // Terminal state
      abandoned: [], // Terminal state
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Transition session to new status if valid
   */
  transition(
    session: InterviewSession,
    newStatus: SessionStatus,
  ): InterviewSession {
    if (!this.canTransition(session.status, newStatus)) {
      throw new Error(
        `Cannot transition from ${session.status} to ${newStatus}`,
      );
    }

    const updated = new InterviewSession({
      sessionId: session.sessionId,
      interviewId: session.interviewId,
      candidateId: session.candidateId,
      currentPhase: session.currentPhase,
      currentQuestion: session.currentQuestion,
      status: newStatus,
      communicationMode: session.communicationMode,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      pausedCount: session.pausedCount,
      totalPauseDuration: session.totalPauseDuration,
      pausedAt: session.pausedAt,
      skippedQuestions: session.skippedQuestions,
      timeElapsed: session.timeElapsed,
      phaseStartTime: session.phaseStartTime,
      phaseTimeElapsed: session.phaseTimeElapsed,
    });

    // Update timestamps based on transition
    if (newStatus === 'paused' && session.status === 'in-progress') {
      updated.pausedAt = new Date();
      updated.timeElapsed = session.getTimeElapsed();
      updated.phaseTimeElapsed = session.getPhaseTimeElapsed();
    } else if (newStatus === 'in-progress' && session.status === 'paused') {
      // Resume: calculate pause duration and update
      if (session.pausedAt) {
        const pauseDuration = Math.floor(
          (new Date().getTime() - session.pausedAt.getTime()) / 1000,
        );
        updated.totalPauseDuration = session.totalPauseDuration + pauseDuration;
        updated.pausedAt = undefined;
        updated.pausedCount = session.pausedCount + 1;
        updated.phaseStartTime = new Date(); // Reset phase start time
      }
    } else if (newStatus === 'completed') {
      updated.completedAt = new Date();
      updated.timeElapsed = session.getTimeElapsed();
    }

    return updated;
  }

  /**
   * Check if session can be paused
   */
  canPause(session: InterviewSession): boolean {
    return session.status === 'in-progress';
  }

  /**
   * Check if session can be resumed
   */
  canResume(session: InterviewSession): boolean {
    return session.status === 'paused';
  }

  /**
   * Check if session can move to next phase
   */
  canMoveToNextPhase(
    session: InterviewSession,
    totalPhases: number,
  ): boolean {
    return (
      session.status === 'in-progress' &&
      session.currentPhase < totalPhases - 1
    );
  }

  /**
   * Move session to next phase
   */
  moveToNextPhase(session: InterviewSession): InterviewSession {
    if (!this.canMoveToNextPhase(session, session.currentPhase + 2)) {
      throw new Error('Cannot move to next phase');
    }

    return new InterviewSession({
      sessionId: session.sessionId,
      interviewId: session.interviewId,
      candidateId: session.candidateId,
      currentPhase: session.currentPhase + 1,
      currentQuestion: undefined, // Clear current question
      status: session.status,
      communicationMode: session.communicationMode,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      pausedCount: session.pausedCount,
      totalPauseDuration: session.totalPauseDuration,
      pausedAt: session.pausedAt,
      skippedQuestions: session.skippedQuestions,
      timeElapsed: session.timeElapsed,
      phaseStartTime: new Date(),
      phaseTimeElapsed: 0,
    });
  }

  /**
   * Check if time limit has been exceeded
   */
  hasExceededTimeLimit(
    session: InterviewSession,
    totalTimeLimit: number, // minutes
  ): boolean {
    const elapsedMinutes = session.getTimeElapsed() / 60;
    return elapsedMinutes >= totalTimeLimit;
  }

  /**
   * Check if phase time limit has been exceeded
   */
  hasExceededPhaseTimeLimit(
    session: InterviewSession,
    phaseTimeLimit: number, // minutes
  ): boolean {
    const elapsedMinutes = session.getPhaseTimeElapsed() / 60;
    return elapsedMinutes >= phaseTimeLimit;
  }
}

