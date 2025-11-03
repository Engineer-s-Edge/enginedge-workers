/**
 * Session Service
 *
 * Application service for managing interview sessions.
 */

import { Injectable, Inject } from '@nestjs/common';
import { InterviewSession } from '../../domain/entities';
import { IInterviewSessionRepository } from '../ports/repositories.port';
import { StartInterviewUseCase } from '../use-cases/start-interview.use-case';
import { PauseInterviewUseCase } from '../use-cases/pause-interview.use-case';
import { ResumeInterviewUseCase } from '../use-cases/resume-interview.use-case';
import { SkipQuestionUseCase } from '../use-cases/skip-question.use-case';
import { SubmitResponseUseCase } from '../use-cases/submit-response.use-case';

@Injectable()
export class SessionService {
  constructor(
    @Inject('IInterviewSessionRepository')
    private readonly sessionRepository: IInterviewSessionRepository,
    private readonly startInterviewUseCase: StartInterviewUseCase,
    private readonly pauseInterviewUseCase: PauseInterviewUseCase,
    private readonly resumeInterviewUseCase: ResumeInterviewUseCase,
    private readonly skipQuestionUseCase: SkipQuestionUseCase,
    private readonly submitResponseUseCase: SubmitResponseUseCase,
  ) {}

  async startSession(input: {
    interviewId: string;
    candidateId: string;
    communicationMode: 'voice' | 'text';
  }): Promise<InterviewSession> {
    return await this.startInterviewUseCase.execute(input);
  }

  async getSession(sessionId: string): Promise<InterviewSession | null> {
    return await this.sessionRepository.findById(sessionId);
  }

  async pauseSession(sessionId: string): Promise<InterviewSession> {
    return await this.pauseInterviewUseCase.execute(sessionId);
  }

  async resumeSession(sessionId: string): Promise<InterviewSession> {
    return await this.resumeInterviewUseCase.execute(sessionId);
  }

  async skipQuestion(
    sessionId: string,
    questionId: string,
  ): Promise<InterviewSession> {
    return await this.skipQuestionUseCase.execute(sessionId, questionId);
  }

  async submitResponse(input: {
    sessionId: string;
    questionId: string;
    candidateResponse: string;
    skipped?: boolean;
    communicationMode: 'voice' | 'text';
  }): Promise<any> {
    return await this.submitResponseUseCase.execute(input);
  }

  async getSessionsByCandidate(
    candidateId: string,
  ): Promise<InterviewSession[]> {
    return await this.sessionRepository.findByCandidateId(candidateId);
  }
}
