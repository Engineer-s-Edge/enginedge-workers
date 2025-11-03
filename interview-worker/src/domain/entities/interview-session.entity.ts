/**
 * InterviewSession Entity
 *
 * Represents an active interview session - a specific instance of an interview being conducted.
 * Tracks the state, progress, and timing of a single candidate's interview.
 */

export type SessionStatus =
  | 'in-progress'
  | 'paused'
  | 'completed'
  | 'abandoned';
export type CommunicationMode = 'voice' | 'text';

export class InterviewSession {
  sessionId: string;
  interviewId: string;
  candidateId: string;
  currentPhase: number; // 0-indexed phase number
  currentQuestion?: string; // questionId of current question
  status: SessionStatus;
  communicationMode: CommunicationMode;
  startedAt: Date;
  completedAt?: Date;
  pausedCount: number;
  totalPauseDuration: number; // seconds
  pausedAt?: Date; // When pause started (if currently paused)
  skippedQuestions: string[]; // Array of questionIds that were skipped
  timeElapsed: number; // seconds elapsed in interview
  phaseStartTime?: Date; // When current phase started
  phaseTimeElapsed: number; // seconds elapsed in current phase

  constructor(data: {
    sessionId: string;
    interviewId: string;
    candidateId: string;
    currentPhase?: number;
    currentQuestion?: string;
    status?: SessionStatus;
    communicationMode: CommunicationMode;
    startedAt?: Date;
    completedAt?: Date;
    pausedCount?: number;
    totalPauseDuration?: number;
    pausedAt?: Date;
    skippedQuestions?: string[];
    timeElapsed?: number;
    phaseStartTime?: Date;
    phaseTimeElapsed?: number;
  }) {
    this.sessionId = data.sessionId;
    this.interviewId = data.interviewId;
    this.candidateId = data.candidateId;
    this.currentPhase = data.currentPhase ?? 0;
    this.currentQuestion = data.currentQuestion;
    this.status = data.status || 'in-progress';
    this.communicationMode = data.communicationMode;
    this.startedAt = data.startedAt || new Date();
    this.completedAt = data.completedAt;
    this.pausedCount = data.pausedCount || 0;
    this.totalPauseDuration = data.totalPauseDuration || 0;
    this.pausedAt = data.pausedAt;
    this.skippedQuestions = data.skippedQuestions || [];
    this.timeElapsed = data.timeElapsed || 0;
    this.phaseStartTime = data.phaseStartTime || new Date();
    this.phaseTimeElapsed = data.phaseTimeElapsed || 0;
  }

  /**
   * Calculate current time elapsed (updates if not paused)
   */
  getTimeElapsed(): number {
    if (this.status === 'paused' || this.completedAt) {
      return this.timeElapsed;
    }
    const now = new Date();
    const elapsedSinceStart = Math.floor(
      (now.getTime() - this.startedAt.getTime()) / 1000,
    );
    return elapsedSinceStart - this.totalPauseDuration;
  }

  /**
   * Get time elapsed in current phase
   */
  getPhaseTimeElapsed(): number {
    if (this.status === 'paused' || this.completedAt || !this.phaseStartTime) {
      return this.phaseTimeElapsed;
    }
    const now = new Date();
    const elapsedSincePhaseStart = Math.floor(
      (now.getTime() - this.phaseStartTime.getTime()) / 1000,
    );
    return elapsedSincePhaseStart;
  }

  /**
   * Mark question as skipped
   */
  skipQuestion(questionId: string): void {
    if (!this.skippedQuestions.includes(questionId)) {
      this.skippedQuestions.push(questionId);
    }
  }

  /**
   * Convert to plain object for MongoDB storage
   */
  toObject(): Record<string, unknown> {
    return {
      sessionId: this.sessionId,
      interviewId: this.interviewId,
      candidateId: this.candidateId,
      currentPhase: this.currentPhase,
      currentQuestion: this.currentQuestion,
      status: this.status,
      communicationMode: this.communicationMode,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      pausedCount: this.pausedCount,
      totalPauseDuration: this.totalPauseDuration,
      pausedAt: this.pausedAt,
      skippedQuestions: this.skippedQuestions,
      timeElapsed: this.getTimeElapsed(),
      phaseStartTime: this.phaseStartTime,
      phaseTimeElapsed: this.getPhaseTimeElapsed(),
    };
  }

  /**
   * Create from MongoDB document
   */
  static fromObject(data: Record<string, unknown>): InterviewSession {
    return new InterviewSession({
      sessionId: data.sessionId as string,
      interviewId: data.interviewId as string,
      candidateId: data.candidateId as string,
      currentPhase: data.currentPhase as number,
      currentQuestion: data.currentQuestion as string | undefined,
      status: data.status as SessionStatus,
      communicationMode: data.communicationMode as CommunicationMode,
      startedAt: data.startedAt
        ? new Date(data.startedAt as string)
        : new Date(),
      completedAt: data.completedAt
        ? new Date(data.completedAt as string)
        : undefined,
      pausedCount: data.pausedCount as number,
      totalPauseDuration: data.totalPauseDuration as number,
      pausedAt: data.pausedAt ? new Date(data.pausedAt as string) : undefined,
      skippedQuestions: (data.skippedQuestions as string[]) || [],
      timeElapsed: data.timeElapsed as number,
      phaseStartTime: data.phaseStartTime
        ? new Date(data.phaseStartTime as string)
        : undefined,
      phaseTimeElapsed: data.phaseTimeElapsed as number,
    });
  }
}
