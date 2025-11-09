/**
 * Repository Ports
 *
 * Interfaces for repository implementations (Domain Layer Ports)
 * These are implemented in the Infrastructure layer
 */

import {
  Interview,
  InterviewSession,
  InterviewQuestion,
  InterviewResponse,
  CandidateProfile,
  InterviewReport,
  QuestionCategory,
  Transcript,
  Webhook,
} from '../../domain/entities';

export interface IInterviewRepository {
  save(interview: Interview): Promise<Interview>;
  findById(id: string): Promise<Interview | null>;
  findAll(): Promise<Interview[]>;
  update(id: string, interview: Partial<Interview>): Promise<Interview | null>;
  delete(id: string): Promise<boolean>;
}

export interface IInterviewSessionRepository {
  save(session: InterviewSession): Promise<InterviewSession>;
  findById(sessionId: string): Promise<InterviewSession | null>;
  findByCandidateId(candidateId: string): Promise<InterviewSession[]>;
  findByInterviewId(interviewId: string): Promise<InterviewSession[]>;
  update(
    sessionId: string,
    session: Partial<InterviewSession>,
  ): Promise<InterviewSession | null>;
  delete(sessionId: string): Promise<boolean>;
}

export interface IInterviewQuestionRepository {
  save(question: InterviewQuestion): Promise<InterviewQuestion>;
  findById(questionId: string): Promise<InterviewQuestion | null>;
  findByCategory(
    category: QuestionCategory,
    difficulty?: 'easy' | 'medium' | 'hard',
    limit?: number,
  ): Promise<InterviewQuestion[]>;
  findByTags(tags: string[]): Promise<InterviewQuestion[]>;
  findAll(): Promise<InterviewQuestion[]>;
  update(
    questionId: string,
    question: Partial<InterviewQuestion>,
  ): Promise<InterviewQuestion | null>;
  delete(questionId: string): Promise<boolean>;
}

export interface IInterviewResponseRepository {
  save(response: InterviewResponse): Promise<InterviewResponse>;
  findById(responseId: string): Promise<InterviewResponse | null>;
  findBySessionId(sessionId: string): Promise<InterviewResponse[]>;
  findByQuestionId(questionId: string): Promise<InterviewResponse[]>;
  findBySessionAndQuestion(
    sessionId: string,
    questionId: string,
  ): Promise<InterviewResponse | null>;
  update(
    responseId: string,
    response: Partial<InterviewResponse>,
  ): Promise<InterviewResponse | null>;
}

export interface ICandidateProfileRepository {
  save(profile: CandidateProfile): Promise<CandidateProfile>;
  findBySessionId(sessionId: string): Promise<CandidateProfile | null>;
  update(
    sessionId: string,
    profile: Partial<CandidateProfile>,
  ): Promise<CandidateProfile | null>;
  delete(sessionId: string): Promise<boolean>;
}

export interface ITranscriptRepository {
  save(transcript: Transcript): Promise<Transcript>;
  findBySessionId(sessionId: string): Promise<Transcript | null>;
  appendMessage(
    sessionId: string,
    message: Transcript['messages'][0],
  ): Promise<void>;
  update(
    sessionId: string,
    transcript: Partial<Transcript>,
  ): Promise<Transcript | null>;
}

export interface IInterviewReportRepository {
  save(report: InterviewReport): Promise<InterviewReport>;
  findById(reportId: string): Promise<InterviewReport | null>;
  findBySessionId(sessionId: string): Promise<InterviewReport | null>;
  delete(reportId: string): Promise<boolean>;
}

export interface IWebhookRepository {
  save(webhook: Webhook): Promise<Webhook>;
  findById(id: string): Promise<Webhook | null>;
  findByUserId(userId: string): Promise<Webhook[]>;
  findByEvent(event: string): Promise<Webhook[]>;
  update(id: string, webhook: Partial<Webhook>): Promise<Webhook | null>;
  delete(id: string): Promise<boolean>;
}
