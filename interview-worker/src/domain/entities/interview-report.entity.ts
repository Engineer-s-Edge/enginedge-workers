/**
 * InterviewReport Entity
 * 
 * Represents the final evaluation report generated after an interview is completed.
 * Contains scores, feedback, and observations from the evaluator LLM.
 */

import { CandidateObservations } from './candidate-profile.entity';

export interface TranscriptMessage {
  timestamp: Date;
  speaker: 'candidate' | 'agent';
  text: string;
  type: 'user-input' | 'voice-transcription' | 'agent-response' | 'followup';
  followupForQuestionId?: string;
}

export interface Transcript {
  sessionId: string;
  messages: TranscriptMessage[];
}

export interface InterviewScore {
  overall: number; // 0-100
  byPhase: {
    behavioral?: number;
    technical?: number;
    coding?: number;
    systemDesign?: number;
  };
}

export class InterviewReport {
  reportId: string;
  sessionId: string;
  score: InterviewScore;
  feedback: string; // From evaluator LLM
  observations: CandidateObservations;
  transcript: Transcript;
  generatedAt: Date;

  constructor(data: {
    reportId: string;
    sessionId: string;
    score: InterviewScore;
    feedback: string;
    observations: CandidateObservations;
    transcript: Transcript;
    generatedAt?: Date;
  }) {
    this.reportId = data.reportId;
    this.sessionId = data.sessionId;
    this.score = data.score;
    this.feedback = data.feedback;
    this.observations = data.observations;
    this.transcript = data.transcript;
    this.generatedAt = data.generatedAt || new Date();
  }

  /**
   * Convert to plain object for MongoDB storage
   */
  toObject(): Record<string, unknown> {
    return {
      reportId: this.reportId,
      sessionId: this.sessionId,
      score: this.score,
      feedback: this.feedback,
      observations: this.observations,
      transcript: {
        sessionId: this.transcript.sessionId,
        messages: this.transcript.messages.map((msg) => ({
          timestamp: msg.timestamp,
          speaker: msg.speaker,
          text: msg.text,
          type: msg.type,
          followupForQuestionId: msg.followupForQuestionId,
        })),
      },
      generatedAt: this.generatedAt,
    };
  }

  /**
   * Create from MongoDB document
   */
  static fromObject(data: Record<string, unknown>): InterviewReport {
    const transcript = data.transcript as Record<string, unknown>;
    return new InterviewReport({
      reportId: data.reportId as string,
      sessionId: data.sessionId as string,
      score: data.score as InterviewScore,
      feedback: data.feedback as string,
      observations: data.observations as CandidateObservations,
      transcript: {
        sessionId: transcript.sessionId as string,
        messages: (transcript.messages as Record<string, unknown>[]).map((msg) => ({
          timestamp: msg.timestamp ? new Date(msg.timestamp as string) : new Date(),
          speaker: msg.speaker as 'candidate' | 'agent',
          text: msg.text as string,
          type: msg.type as 'user-input' | 'voice-transcription' | 'agent-response' | 'followup',
          followupForQuestionId: msg.followupForQuestionId as string | undefined,
        })),
      },
      generatedAt: data.generatedAt ? new Date(data.generatedAt as string) : new Date(),
    });
  }
}

