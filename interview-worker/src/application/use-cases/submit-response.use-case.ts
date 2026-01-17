/**
 * Submit Response Use Case
 */

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  InterviewResponse,
  InterviewSession,
  TranscriptMessage,
} from '../../domain/entities';
import {
  IInterviewSessionRepository,
  IInterviewResponseRepository,
  ITranscriptRepository,
} from '../ports/repositories.port';

export interface SubmitResponseInput {
  sessionId: string;
  questionId: string;
  candidateResponse: string;
  skipped?: boolean;
  communicationMode: 'voice' | 'text';
}

@Injectable()
export class SubmitResponseUseCase {
  constructor(
    @Inject('IInterviewSessionRepository')
    private readonly sessionRepository: IInterviewSessionRepository,
    @Inject('IInterviewResponseRepository')
    private readonly responseRepository: IInterviewResponseRepository,
    @Inject('ITranscriptRepository')
    private readonly transcriptRepository: ITranscriptRepository,
  ) {}

  async execute(input: SubmitResponseInput): Promise<InterviewResponse> {
    const session = await this.sessionRepository.findById(input.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    if (session.status !== 'in-progress') {
      throw new Error(`Cannot submit response in status: ${session.status}`);
    }

    // Create or update response
    let response = await this.responseRepository.findBySessionAndQuestion(
      input.sessionId,
      input.questionId,
    );

    if (response) {
      // Update existing response
      response = new InterviewResponse({
        responseId: response.responseId,
        sessionId: response.sessionId,
        questionId: response.questionId,
        candidateResponse: input.candidateResponse,
        followups: response.followups,
        skipped: input.skipped || false,
        submittedAt: response.submittedAt,
      });
    } else {
      // Create new response
      response = new InterviewResponse({
        responseId: uuidv4(),
        sessionId: input.sessionId,
        questionId: input.questionId,
        candidateResponse: input.candidateResponse,
        skipped: input.skipped || false,
        submittedAt: new Date(),
      });
    }

    await this.responseRepository.save(response);

    // Append to transcript
    const messageType: TranscriptMessage['type'] =
      input.communicationMode === 'voice'
        ? 'voice-transcription'
        : 'user-input';

    await this.transcriptRepository.appendMessage(input.sessionId, {
      timestamp: new Date(),
      speaker: 'candidate',
      text: input.candidateResponse,
      type: messageType,
    });

    // Update session - clear current question
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

    return response;
  }
}
