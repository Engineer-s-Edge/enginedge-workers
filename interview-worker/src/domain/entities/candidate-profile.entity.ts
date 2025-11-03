/**
 * CandidateProfile Entity
 *
 * Represents the live observations and insights about a candidate during an interview.
 * This profile is built incrementally by the interview agent as the interview progresses.
 */

export interface ResumeFindings {
  verified: string[]; // Confirmed from resume
  questioned: string[]; // Doesn't match resume
  deepDived: string[]; // Strong areas to explore more
}

export interface InterviewFlow {
  pausedAt: string[]; // What topics/questions where paused at
  skippedQuestions: number; // Count of skipped questions
  pauseDuration: number; // Total pause duration in seconds
}

export interface CandidateObservations {
  strengths: string[]; // Positive observations
  concerns: string[]; // Areas of concern
  resumeFindings: ResumeFindings;
  adaptability: string; // How they responded to hard questions
  communicationStyle: string; // How they explained solutions
  interviewFlow: InterviewFlow;
  keyInsights: string; // Recruiter-like summary
}

export class CandidateProfile {
  profileId: string;
  sessionId: string;
  observations: CandidateObservations;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: {
    profileId: string;
    sessionId: string;
    observations?: Partial<CandidateObservations>;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.profileId = data.profileId;
    this.sessionId = data.sessionId;
    this.observations = {
      strengths: data.observations?.strengths || [],
      concerns: data.observations?.concerns || [],
      resumeFindings: {
        verified: data.observations?.resumeFindings?.verified || [],
        questioned: data.observations?.resumeFindings?.questioned || [],
        deepDived: data.observations?.resumeFindings?.deepDived || [],
      },
      adaptability: data.observations?.adaptability || '',
      communicationStyle: data.observations?.communicationStyle || '',
      interviewFlow: {
        pausedAt: data.observations?.interviewFlow?.pausedAt || [],
        skippedQuestions:
          data.observations?.interviewFlow?.skippedQuestions || 0,
        pauseDuration: data.observations?.interviewFlow?.pauseDuration || 0,
      },
      keyInsights: data.observations?.keyInsights || '',
    };
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  /**
   * Append an observation to a category
   */
  appendObservation(
    category: 'strengths' | 'concerns' | 'keyInsights',
    text: string,
  ): void {
    if (category === 'strengths' || category === 'concerns') {
      this.observations[category].push(text);
    } else if (category === 'keyInsights') {
      const existing = this.observations.keyInsights;
      this.observations.keyInsights = existing ? `${existing}\n${text}` : text;
    }
    this.updatedAt = new Date();
  }

  /**
   * Update resume findings
   */
  updateResumeFindings(
    type: 'verified' | 'questioned' | 'deepDived',
    finding: string,
  ): void {
    this.observations.resumeFindings[type].push(finding);
    this.updatedAt = new Date();
  }

  /**
   * Update interview flow metadata
   */
  updateInterviewFlow(data: Partial<InterviewFlow>): void {
    if (data.pausedAt) {
      this.observations.interviewFlow.pausedAt.push(...data.pausedAt);
    }
    if (data.skippedQuestions !== undefined) {
      this.observations.interviewFlow.skippedQuestions = data.skippedQuestions;
    }
    if (data.pauseDuration !== undefined) {
      this.observations.interviewFlow.pauseDuration = data.pauseDuration;
    }
    this.updatedAt = new Date();
  }

  /**
   * Convert to plain object for MongoDB storage
   */
  toObject(): Record<string, unknown> {
    return {
      profileId: this.profileId,
      sessionId: this.sessionId,
      observations: this.observations,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Create from MongoDB document
   */
  static fromObject(data: Record<string, unknown>): CandidateProfile {
    return new CandidateProfile({
      profileId: data.profileId as string,
      sessionId: data.sessionId as string,
      observations: data.observations as CandidateObservations,
      createdAt: data.createdAt
        ? new Date(data.createdAt as string)
        : new Date(),
      updatedAt: data.updatedAt
        ? new Date(data.updatedAt as string)
        : new Date(),
    });
  }
}
