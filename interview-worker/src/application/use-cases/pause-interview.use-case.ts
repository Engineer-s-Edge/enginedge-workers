/**
 * Pause Interview Use Case
 */

import { Injectable, Inject } from '@nestjs/common';
import { InterviewSession } from '../../domain/entities';
import { IInterviewSessionRepository } from '../ports/repositories.port';
import { InterviewStateMachineService } from '../../domain/services/interview-state-machine.service';

@Injectable()
export class PauseInterviewUseCase {
  private readonly stateMachine = new InterviewStateMachineService();

  constructor(
    @Inject('IInterviewSessionRepository')
    private readonly sessionRepository: IInterviewSessionRepository,
  ) {}

  async execute(sessionId: string): Promise<InterviewSession> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!this.stateMachine.canPause(session)) {
      throw new Error(`Cannot pause session in status: ${session.status}`);
    }

    const updated = this.stateMachine.transition(session, 'paused');
    await this.sessionRepository.save(updated);

    return updated;
  }
}
