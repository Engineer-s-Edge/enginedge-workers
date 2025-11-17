/**
 * Time Limit Service
 *
 * Handles time warnings and time limit reached behavior
 */

import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { SessionService } from './session.service';
import { InterviewService } from './interview.service';
import { IInterviewSessionRepository } from '../ports/repositories.port';
import { InterviewSession } from '../../domain/entities';
import { InterviewWebSocketGateway } from '../../infrastructure/gateways/interview-websocket.gateway';

interface TimeWarning {
  type: 'yellow' | 'red';
  timeRemaining: number; // seconds
  message: string;
}

@Injectable()
export class TimeLimitService {
  private readonly logger = new Logger(TimeLimitService.name);
  private readonly warningIntervals = new Map<string, NodeJS.Timeout[]>();
  private readonly sentWarnings = new Map<string, Set<string>>(); // Track sent warnings per session

  constructor(
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    private readonly interviewService: InterviewService,
    @Inject('IInterviewSessionRepository')
    private readonly sessionRepository: IInterviewSessionRepository,
    @Inject(forwardRef(() => InterviewWebSocketGateway))
    private readonly websocketGateway: InterviewWebSocketGateway,
  ) {}

  /**
   * Start time limit monitoring for a session
   */
  async startMonitoring(sessionId: string): Promise<void> {
    // Clear any existing intervals
    this.stopMonitoring(sessionId);

    const session = await this.sessionRepository.findById(sessionId);
    if (!session || session.status !== 'in-progress') {
      return;
    }

    const interview = await this.interviewService.getInterview(
      session.interviewId,
    );
    if (!interview) {
      return;
    }

    const intervals: NodeJS.Timeout[] = [];
    const sentWarnings = new Set<string>();

    // Monitor phase time limit
    const phaseInterval = setInterval(async () => {
      await this.checkPhaseTimeLimit(sessionId, sentWarnings);
    }, 5000); // Check every 5 seconds

    // Monitor total time limit
    const totalInterval = setInterval(async () => {
      await this.checkTotalTimeLimit(sessionId, sentWarnings);
    }, 5000);

    intervals.push(phaseInterval, totalInterval);
    this.warningIntervals.set(sessionId, intervals);
    this.sentWarnings.set(sessionId, sentWarnings);
  }

  /**
   * Stop time limit monitoring for a session
   */
  stopMonitoring(sessionId: string): void {
    const intervals = this.warningIntervals.get(sessionId);
    if (intervals) {
      intervals.forEach((interval) => clearInterval(interval));
      this.warningIntervals.delete(sessionId);
    }
    this.sentWarnings.delete(sessionId);
  }

  /**
   * Check phase time limit and send warnings
   */
  private async checkPhaseTimeLimit(
    sessionId: string,
    sentWarnings: Set<string>,
  ): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session || session.status !== 'in-progress') {
      return;
    }

    const interview = await this.interviewService.getInterview(
      session.interviewId,
    );
    if (!interview) {
      return;
    }

    const currentPhase = interview.phases[session.currentPhase || 0];
    if (!currentPhase) {
      return;
    }

    const phaseTimeElapsed = session.getPhaseTimeElapsed();
    const phaseTimeLimit = currentPhase.duration * 60; // Convert to seconds
    const timeRemaining = phaseTimeLimit - phaseTimeElapsed;

    // Send warnings
    if (timeRemaining <= 30 && !sentWarnings.has('phase-red')) {
      await this.sendWarning(sessionId, {
        type: 'red',
        timeRemaining,
        message: `Phase time limit: ${Math.floor(timeRemaining)} seconds remaining`,
      });
      sentWarnings.add('phase-red');
    } else if (
      timeRemaining <= 120 &&
      timeRemaining > 30 &&
      !sentWarnings.has('phase-yellow')
    ) {
      await this.sendWarning(sessionId, {
        type: 'yellow',
        timeRemaining,
        message: `Phase time limit: ${Math.floor(timeRemaining / 60)} minutes remaining`,
      });
      sentWarnings.add('phase-yellow');
    }

    // Check if time limit reached
    if (timeRemaining <= 0 && !sentWarnings.has('phase-limit-reached')) {
      await this.handlePhaseTimeLimitReached(sessionId, session, currentPhase);
      sentWarnings.add('phase-limit-reached');
    }
  }

  /**
   * Check total time limit and send warnings
   */
  private async checkTotalTimeLimit(
    sessionId: string,
    sentWarnings: Set<string>,
  ): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session || session.status !== 'in-progress') {
      return;
    }

    const interview = await this.interviewService.getInterview(
      session.interviewId,
    );
    if (!interview) {
      return;
    }

    const totalTimeLimit = interview.getTotalTimeLimit() * 60; // Convert to seconds
    const timeElapsed = session.getTimeElapsed();
    const timeRemaining = totalTimeLimit - timeElapsed;

    // Send warnings
    if (timeRemaining <= 30 && !sentWarnings.has('total-red')) {
      await this.sendWarning(sessionId, {
        type: 'red',
        timeRemaining,
        message: `Total time limit: ${Math.floor(timeRemaining)} seconds remaining`,
      });
      sentWarnings.add('total-red');
    } else if (
      timeRemaining <= 120 &&
      timeRemaining > 30 &&
      !sentWarnings.has('total-yellow')
    ) {
      await this.sendWarning(sessionId, {
        type: 'yellow',
        timeRemaining,
        message: `Total time limit: ${Math.floor(timeRemaining / 60)} minutes remaining`,
      });
      sentWarnings.add('total-yellow');
    }

    // Check if time limit reached
    if (timeRemaining <= 0 && !sentWarnings.has('total-limit-reached')) {
      await this.handleTotalTimeLimitReached(sessionId, session);
      sentWarnings.add('total-limit-reached');
    }
  }

  /**
   * Send time warning via WebSocket
   */
  private async sendWarning(
    sessionId: string,
    warning: TimeWarning,
  ): Promise<void> {
    this.websocketGateway.server.clients.forEach((client: any) => {
      if (client.sessionId === sessionId) {
        client.send(
          JSON.stringify({
            type: 'time-warning',
            sessionId,
            warning: {
              type: warning.type,
              timeRemaining: warning.timeRemaining,
              message: warning.message,
            },
          }),
        );
      }
    });

    this.logger.log(
      `Time warning sent: ${sessionId} - ${warning.type} - ${warning.message}`,
    );
  }

  /**
   * Handle phase time limit reached
   */
  private async handlePhaseTimeLimitReached(
    sessionId: string,
    session: InterviewSession,
    phase: any,
  ): Promise<void> {
    // For coding/system-design: interrupt immediately
    if (phase.type === 'coding' || phase.type === 'system-design') {
      // Save current work and transition
      this.logger.log(
        `Phase time limit reached for ${sessionId}, interrupting immediately`,
      );
      // Trigger phase transition
      // This would be handled by PhaseTransitionService
    } else {
      // For behavioral/technical: let user finish, then transition
      this.logger.log(
        `Phase time limit reached for ${sessionId}, allowing response completion`,
      );
    }
  }

  /**
   * Handle total time limit reached
   */
  private async handleTotalTimeLimitReached(
    sessionId: string,
    session: InterviewSession,
  ): Promise<void> {
    this.logger.log(`Total time limit reached for ${sessionId}, ending session`);
    await this.sessionService.endSession(sessionId);
  }
}
