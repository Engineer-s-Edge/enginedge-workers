/**
 * Start Interview Use Case
 */

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { InterviewSession, CommunicationMode } from '../../domain/entities';
import { Interview } from '../../domain/entities';
import {
  IInterviewRepository,
  IInterviewSessionRepository,
  ICandidateProfileRepository,
  ITranscriptRepository,
} from '../ports/repositories.port';
import { CandidateProfile } from '../../domain/entities';

export interface StartInterviewInput {
  interviewId: string;
  candidateId: string;
  communicationMode: CommunicationMode;
}

@Injectable()
export class StartInterviewUseCase {
  constructor(
    @Inject('IInterviewRepository')
    private readonly interviewRepository: IInterviewRepository,
    @Inject('IInterviewSessionRepository')
    private readonly sessionRepository: IInterviewSessionRepository,
    @Inject('ICandidateProfileRepository')
    private readonly profileRepository: ICandidateProfileRepository,
    @Inject('ITranscriptRepository')
    private readonly transcriptRepository: ITranscriptRepository,
  ) {}

  async execute(input: StartInterviewInput): Promise<InterviewSession> {
    // Load interview configuration
    const interview = await this.interviewRepository.findById(
      input.interviewId,
    );
    if (!interview) {
      throw new Error(`Interview not found: ${input.interviewId}`);
    }

    // Create session
    const sessionId = uuidv4();
    const session = new InterviewSession({
      sessionId,
      interviewId: input.interviewId,
      candidateId: input.candidateId,
      communicationMode: input.communicationMode,
      currentPhase: 0,
      status: 'in-progress',
      startedAt: new Date(),
      phaseStartTime: new Date(),
    });

    // Save session
    await this.sessionRepository.save(session);

    // Initialize candidate profile
    const profileId = uuidv4();
    const profile = new CandidateProfile({
      profileId,
      sessionId,
    });
    await this.profileRepository.save(profile);

    // Initialize transcript
    await this.transcriptRepository.save({
      sessionId,
      messages: [],
    });

    return session;
  }
}
