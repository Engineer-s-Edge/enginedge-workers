/**
 * Session Service
 *
 * Application service for managing interview sessions.
 */

import { Injectable, Inject } from '@nestjs/common';
import { InterviewSession, Interview } from '../../domain/entities';
import { IInterviewSessionRepository, IInterviewRepository } from '../ports/repositories.port';
import { StartInterviewUseCase } from '../use-cases/start-interview.use-case';
import { PauseInterviewUseCase } from '../use-cases/pause-interview.use-case';
import { ResumeInterviewUseCase } from '../use-cases/resume-interview.use-case';
import { SkipQuestionUseCase } from '../use-cases/skip-question.use-case';
import { SubmitResponseUseCase } from '../use-cases/submit-response.use-case';
import { WebhookService } from './webhook.service';
import { WebhookEvent } from '../../domain/value-objects/webhook-event.value-object';
import { CodeExecutionService } from './code-execution.service';
import { MongoTestCaseRepository } from '../../infrastructure/adapters/database/test-case.repository';
import { PhaseTransitionService } from './phase-transition.service';
import { TimeLimitService } from './time-limit.service';

@Injectable()
export class SessionService {
  constructor(
    @Inject('IInterviewSessionRepository')
    private readonly sessionRepository: IInterviewSessionRepository,
    @Inject('IInterviewRepository')
    private readonly interviewRepository: IInterviewRepository,
    private readonly startInterviewUseCase: StartInterviewUseCase,
    private readonly pauseInterviewUseCase: PauseInterviewUseCase,
    private readonly resumeInterviewUseCase: ResumeInterviewUseCase,
    private readonly skipQuestionUseCase: SkipQuestionUseCase,
    private readonly submitResponseUseCase: SubmitResponseUseCase,
    private readonly webhookService: WebhookService,
    private readonly codeExecutionService: CodeExecutionService,
    private readonly testCaseRepository: MongoTestCaseRepository,
    private readonly phaseTransitionService: PhaseTransitionService,
    private readonly timeLimitService: TimeLimitService,
  ) {}

  async startSession(input: {
    interviewId: string;
    candidateId: string;
    communicationMode: 'voice' | 'text';
  }): Promise<InterviewSession> {
    const session = await this.startInterviewUseCase.execute(input);

    // Trigger webhook
    await this.webhookService.triggerWebhook(WebhookEvent.INTERVIEW_STARTED, {
      interviewId: session.interviewId,
      sessionId: session.sessionId,
      candidateId: session.candidateId,
      communicationMode: session.communicationMode,
      startedAt: session.startedAt,
    });

    // Start time limit monitoring
    await this.timeLimitService.startMonitoring(session.sessionId);

    // Start periodic phase transition checks
    setInterval(async () => {
      await this.phaseTransitionService.checkAndTransitionPhase(session.sessionId);
    }, 10000); // Check every 10 seconds

    return session;
  }

  async getSession(sessionId: string): Promise<InterviewSession | null> {
    return await this.sessionRepository.findById(sessionId);
  }

  async pauseSession(sessionId: string): Promise<InterviewSession> {
    const session = await this.pauseInterviewUseCase.execute(sessionId);

    // Trigger webhook
    await this.webhookService.triggerWebhook(WebhookEvent.SESSION_PAUSED, {
      sessionId: session.sessionId,
      interviewId: session.interviewId,
      candidateId: session.candidateId,
      pausedAt: new Date(),
    });

    return session;
  }

  async resumeSession(sessionId: string): Promise<InterviewSession> {
    const session = await this.resumeInterviewUseCase.execute(sessionId);

    // Trigger webhook
    await this.webhookService.triggerWebhook(WebhookEvent.SESSION_RESUMED, {
      sessionId: session.sessionId,
      interviewId: session.interviewId,
      candidateId: session.candidateId,
      resumedAt: new Date(),
    });

    return session;
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
    code?: string;
    language?: string;
  }): Promise<any> {
    const response = await this.submitResponseUseCase.execute(input);

    // If code is provided, execute it
    if (input.code && input.language) {
      try {
        const testCases = await this.testCaseRepository.findByQuestionId(
          input.questionId,
        );

        const execution = await this.codeExecutionService.executeCode({
          code: input.code,
          language: input.language,
          testCases,
          responseId: response.responseId,
          sessionId: input.sessionId,
          questionId: input.questionId,
        });

        // Trigger webhook for code execution completion
        await this.webhookService.triggerWebhook(
          WebhookEvent.RESPONSE_SUBMITTED,
          {
            sessionId: input.sessionId,
            responseId: response.responseId,
            questionId: input.questionId,
            executionId: execution.id,
            passedTests: execution.passedTests,
            totalTests: execution.totalTests,
          },
        );
      } catch (error) {
        // Log error but don't fail the response submission
        console.error('Code execution failed:', error);
      }
    }

    return response;
  }

  async getSessionsByCandidate(
    candidateId: string,
  ): Promise<InterviewSession[]> {
    return await this.sessionRepository.findByCandidateId(candidateId);
  }

  async endSession(sessionId: string): Promise<InterviewSession> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Stop time limit monitoring
    this.timeLimitService.stopMonitoring(sessionId);

    const updated = await this.sessionRepository.update(sessionId, {
      status: 'completed',
      completedAt: new Date(),
    });

    if (!updated) {
      throw new Error(`Failed to end session: ${sessionId}`);
    }

    // Trigger webhook
    await this.webhookService.triggerWebhook(WebhookEvent.INTERVIEW_COMPLETED, {
      sessionId: updated.sessionId,
      interviewId: updated.interviewId,
      candidateId: updated.candidateId,
      completedAt: updated.completedAt,
    });

    return updated;
  }

  async getInterview(interviewId: string): Promise<Interview | null> {
    return await this.interviewRepository.findById(interviewId);
  }
}
