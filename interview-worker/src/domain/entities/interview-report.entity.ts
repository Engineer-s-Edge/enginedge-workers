import type { CandidateObservations } from './candidate-profile.entity';
export type InterviewScore = {
  overall: number;
  byPhase: {
    behavioral?: number;
    technical?: number;
    coding?: number;
    systemDesign?: number;
  };
};

// Transcript message and transcript types used across repositories and use-cases
export type TranscriptMessage = {
  timestamp: Date;
  speaker: 'candidate' | 'agent';
  text: string;
  type: 'user-input' | 'voice-transcription' | 'agent-response' | 'followup';
  followupForQuestionId?: string;
};

export type Transcript = {
  sessionId: string;
  messages: TranscriptMessage[];
};

// Interview report entity used by evaluator and repositories
export class InterviewReport {
  reportId: string;
  sessionId: string;
  score: InterviewScore;
  feedback: string;
  observations?: CandidateObservations;
  transcript: Transcript;
  generatedAt: Date;

  constructor(data: {
    reportId: string;
    sessionId: string;
    score: InterviewScore;
    feedback: string;
    observations?: CandidateObservations;
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

  toObject(): Record<string, unknown> {
    return {
      reportId: this.reportId,
      sessionId: this.sessionId,
      score: this.score,
      feedback: this.feedback,
      observations: this.observations,
      transcript: {
        sessionId: this.transcript.sessionId,
        messages: this.transcript.messages.map((m) => ({
          timestamp: m.timestamp,
          speaker: m.speaker,
          text: m.text,
          type: m.type,
          followupForQuestionId: m.followupForQuestionId,
        })),
      },
      generatedAt: this.generatedAt,
    };
  }

  static fromObject(data: Record<string, unknown>): InterviewReport {
    const transcriptDoc = data.transcript as {
      sessionId: string;
      messages: any[];
    };
    return new InterviewReport({
      reportId: data.reportId as string,
      sessionId: data.sessionId as string,
      score: data.score as InterviewScore,
      feedback: data.feedback as string,
      observations: (data.observations as CandidateObservations) || undefined,
      transcript: {
        sessionId: transcriptDoc?.sessionId || (data.sessionId as string),
        messages: (transcriptDoc?.messages || []).map((msg: any) => ({
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          speaker: msg.speaker as 'candidate' | 'agent',
          text: msg.text as string,
          type: msg.type as
            | 'user-input'
            | 'voice-transcription'
            | 'agent-response'
            | 'followup',
          followupForQuestionId: msg.followupForQuestionId as
            | string
            | undefined,
        })),
      },
      generatedAt: data.generatedAt
        ? new Date(data.generatedAt as string)
        : new Date(),
    });
  }
}
