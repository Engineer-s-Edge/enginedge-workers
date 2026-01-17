/**
 * Skip Question Use Case
 */

import { Injectable, Inject } from '@nestjs/common';
import { InterviewSession } from '../../domain/entities';
import {
  IInterviewSessionRepository,
  ICandidateProfileRepository,
} from '../ports/repositories.port';

@Injectable()
export class SkipQuestionUseCase {
  constructor(
    @Inject('IInterviewSessionRepository')
    private readonly sessionRepository: IInterviewSessionRepository,
    @Inject('ICandidateProfileRepository')
    private readonly profileRepository: ICandidateProfileRepository,
  ) {}

  async execute(
    sessionId: string,
    questionId: string,
  ): Promise<InterviewSession> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'in-progress') {
      throw new Error(`Cannot skip question in status: ${session.status}`);
    }

    // Mark question as skipped
    session.skipQuestion(questionId);

    // Update profile to track skipped questions
    const profile = await this.profileRepository.findBySessionId(sessionId);
    if (profile) {
      profile.updateInterviewFlow({
        skippedQuestions: session.skippedQuestions.length,
      });
      await this.profileRepository.save(profile);
    }

    // Clear current question - create updated session with all required fields
    const updated = new InterviewSession({
      sessionId: session.sessionId,
      interviewId: session.interviewId,
      candidateId: session.candidateId,
      currentPhase: session.currentPhase,
      currentQuestion: undefined,
      status: session.status,
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

    await this.sessionRepository.save(updated);

    return updated;
  }
}
