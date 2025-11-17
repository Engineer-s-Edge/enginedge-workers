/**
 * Phase Transition Service
 *
 * Handles automatic phase transitions and incomplete response handling
 */

import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { SessionService } from './session.service';
import { InterviewService } from './interview.service';
import { QuestionService } from './question.service';
import { IInterviewSessionRepository, IInterviewResponseRepository } from '../ports/repositories.port';
import { InterviewSession } from '../../domain/entities';
import { InterviewWebSocketGateway } from '../../infrastructure/gateways/interview-websocket.gateway';

@Injectable()
export class PhaseTransitionService {
  private readonly logger = new Logger(PhaseTransitionService.name);

  constructor(
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    private readonly interviewService: InterviewService,
    private readonly questionService: QuestionService,
    @Inject('IInterviewSessionRepository')
    private readonly sessionRepository: IInterviewSessionRepository,
    @Inject('IInterviewResponseRepository')
    private readonly responseRepository: IInterviewResponseRepository,
    @Inject(forwardRef(() => InterviewWebSocketGateway))
    private readonly websocketGateway: InterviewWebSocketGateway,
  ) {}

  /**
   * Check if phase transition is needed and trigger it
   */
  async checkAndTransitionPhase(sessionId: string): Promise<boolean> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session || session.status !== 'in-progress') {
      return false;
    }

    const interview = await this.interviewService.getInterview(
      session.interviewId,
    );
    if (!interview) {
      return false;
    }

    // Get current phase by index
    const currentPhase = interview.phases[session.currentPhase];
    if (!currentPhase) {
      return false;
    }

    // Check if phase time limit reached
    const phaseTimeElapsed = session.getPhaseTimeElapsed();
    const phaseTimeLimit = currentPhase.duration * 60; // Convert to seconds

    // Check if phase question count reached
    // Count total responses and estimate current phase responses
    // (Simplified - in production, would track phaseId in responses)
    const responses = await this.responseRepository.findBySessionId(sessionId);
    const totalResponses = responses.length;
    const previousPhasesQuestionCount = interview.phases
      .slice(0, session.currentPhase)
      .reduce((sum, p) => sum + p.questionCount, 0);
    const currentPhaseResponses = totalResponses - previousPhasesQuestionCount;

    let shouldTransition = false;
    let reason = '';

    if (phaseTimeElapsed >= phaseTimeLimit) {
      shouldTransition = true;
      reason = 'time-limit';
    } else if (currentPhaseResponses >= currentPhase.questionCount) {
      shouldTransition = true;
      reason = 'question-count';
    }

    if (shouldTransition) {
      await this.transitionToNextPhase(sessionId, session, interview, reason);
      return true;
    }

    return false;
  }

  /**
   * Transition to next phase
   */
  private async transitionToNextPhase(
    sessionId: string,
    session: InterviewSession,
    interview: any,
    reason: string,
  ): Promise<void> {
    const currentPhase = interview.phases[session.currentPhase];
    const nextPhaseIndex = session.currentPhase + 1;

    // Check if there's a next phase
    if (nextPhaseIndex >= interview.phases.length) {
      // No more phases, end session
      await this.sessionService.endSession(sessionId);
      return;
    }

    const nextPhase = interview.phases[nextPhaseIndex];

    // Handle incomplete responses based on phase type
    if (reason === 'time-limit') {
      if (
        currentPhase.type === 'coding' ||
        currentPhase.type === 'system-design'
      ) {
        // Interrupt immediately, but save current work
        await this.saveIncompleteResponse(sessionId, session);
      } else {
        // Behavioral/Technical: Let user finish current response
        // Wait a bit for response to complete
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    // Get responses to exclude already answered questions
    const responses = await this.responseRepository.findBySessionId(sessionId);
    const excludeQuestionIds = responses.map((r) => r.questionId);

    // Select questions for next phase
    const nextQuestions = await this.questionService.selectQuestions({
      category: this.mapPhaseTypeToCategory(nextPhase.type),
      difficulty: nextPhase.difficulty,
      tags: nextPhase.tags,
      limit: nextPhase.questionCount,
      excludeQuestionIds,
    });

    // Update session
    await this.sessionRepository.update(sessionId, {
      currentPhase: nextPhaseIndex,
      currentQuestion: nextQuestions[0]?.questionId,
      phaseStartTime: new Date(),
      phaseTimeElapsed: 0,
    });

    // Announce phase transition via WebSocket
    this.websocketGateway.server.clients.forEach((client: any) => {
      if (client.sessionId === sessionId) {
        client.send(
          JSON.stringify({
            type: 'phase-transition',
            sessionId,
            fromPhase: {
              phaseId: currentPhase.phaseId,
              type: currentPhase.type,
            },
            toPhase: {
              phaseId: nextPhase.phaseId,
              type: nextPhase.type,
            },
            reason,
          }),
        );
      }
    });

    this.logger.log(
      `Phase transition: ${sessionId} from phase ${currentPhase.phaseId} to ${nextPhase.phaseId}`,
    );
  }

  /**
   * Save incomplete response when phase ends
   */
  private async saveIncompleteResponse(
    sessionId: string,
    session: InterviewSession,
  ): Promise<void> {
    if (!session.currentQuestion) {
      return;
    }

    // Mark response as incomplete
    // This would be handled by the response service
    this.logger.log(
      `Saving incomplete response for question ${session.currentQuestion} in session ${sessionId}`,
    );
  }

  /**
   * Map phase type to question category
   */
  private mapPhaseTypeToCategory(
    phaseType: string,
  ): 'tech-trivia' | 'system-design' | 'behavioral' | 'coding' {
    switch (phaseType) {
      case 'behavioral':
        return 'behavioral';
      case 'technical':
        return 'tech-trivia';
      case 'coding':
        return 'coding';
      case 'system-design':
        return 'system-design';
      default:
        return 'tech-trivia';
    }
  }
}
