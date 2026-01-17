/**
 * InterviewResponse Entity
 *
 * Represents a candidate's response to a question, including any follow-up questions and answers.
 */

export interface Followup {
  followupForQuestionId: string;
  text: string;
  depth: number; // How many follow-ups deep (1, 2, 3, etc.)
  candidateResponse: string;
  timestamp: Date;
}

export class InterviewResponse {
  responseId: string;
  sessionId: string;
  questionId: string;
  candidateResponse: string;
  followups?: Followup[];
  skipped: boolean;
  submittedAt: Date;

  constructor(data: {
    responseId: string;
    sessionId: string;
    questionId: string;
    candidateResponse: string;
    followups?: Followup[];
    skipped?: boolean;
    submittedAt?: Date;
  }) {
    this.responseId = data.responseId;
    this.sessionId = data.sessionId;
    this.questionId = data.questionId;
    this.candidateResponse = data.candidateResponse;
    this.followups = data.followups || [];
    this.skipped = data.skipped || false;
    this.submittedAt = data.submittedAt || new Date();
  }

  /**
   * Add a follow-up question and response
   */
  addFollowup(followup: Omit<Followup, 'timestamp'>): void {
    this.followups = this.followups || [];
    this.followups.push({
      ...followup,
      timestamp: new Date(),
    });
  }

  /**
   * Get follow-up count for this question
   */
  getFollowupCount(): number {
    return this.followups?.length || 0;
  }

  /**
   * Check if follow-up limit is reached
   */
  isFollowupLimitReached(maxFollowups: number = 3): boolean {
    return this.getFollowupCount() >= maxFollowups;
  }

  /**
   * Convert to plain object for MongoDB storage
   */
  toObject(): Record<string, unknown> {
    return {
      responseId: this.responseId,
      sessionId: this.sessionId,
      questionId: this.questionId,
      candidateResponse: this.candidateResponse,
      followups: this.followups?.map((f) => ({
        followupForQuestionId: f.followupForQuestionId,
        text: f.text,
        depth: f.depth,
        candidateResponse: f.candidateResponse,
        timestamp: f.timestamp,
      })),
      skipped: this.skipped,
      submittedAt: this.submittedAt,
    };
  }

  /**
   * Create from MongoDB document
   */
  static fromObject(data: Record<string, unknown>): InterviewResponse {
    return new InterviewResponse({
      responseId: data.responseId as string,
      sessionId: data.sessionId as string,
      questionId: data.questionId as string,
      candidateResponse: data.candidateResponse as string,
      followups: (
        data.followups as Array<
          Omit<Followup, 'timestamp'> & { timestamp: string | Date }
        >
      )?.map((f) => ({
        followupForQuestionId: f.followupForQuestionId,
        text: f.text,
        depth: f.depth,
        candidateResponse: f.candidateResponse,
        timestamp:
          f.timestamp instanceof Date
            ? f.timestamp
            : new Date(f.timestamp as string),
      })),
      skipped: data.skipped as boolean,
      submittedAt: data.submittedAt
        ? new Date(data.submittedAt as string)
        : new Date(),
    });
  }
}
