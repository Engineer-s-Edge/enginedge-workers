/**
 * Interview Agent Types
 */

export interface InterviewAgentConfig {
  interviewWorkerBaseUrl?: string;
  sessionId: string;
  interviewId: string;
  candidateId: string;
  temperature?: number;
  model?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  communicationMode?: 'voice' | 'text';
}

export interface InterviewContext {
  sessionId: string;
  interviewId: string;
  candidateId: string;
  currentPhase: number;
  currentQuestion?: string;
  timeElapsed: number; // seconds
  phaseTimeElapsed: number; // seconds
  totalTimeLimit: number; // minutes
  phaseTimeLimit: number; // minutes
  questionsRemainingInPhase: number;
  questionsRemainingTotal: number;
  communicationMode: 'voice' | 'text';
}

