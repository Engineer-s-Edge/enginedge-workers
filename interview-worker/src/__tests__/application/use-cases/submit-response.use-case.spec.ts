/**
 * Submit Response Use Case Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SubmitResponseUseCase } from '../../../application/use-cases/submit-response.use-case';
import { InterviewSession, InterviewResponse } from '../../../domain/entities';
import { mock } from 'jest-mock-extended';
import {
  IInterviewSessionRepository,
  IInterviewResponseRepository,
  ITranscriptRepository,
} from '../../../application/ports/repositories.port';

describe('SubmitResponseUseCase', () => {
  let useCase: SubmitResponseUseCase;
  const mockSessionRepository = mock<IInterviewSessionRepository>();
  const mockResponseRepository = mock<IInterviewResponseRepository>();
  const mockTranscriptRepository = mock<ITranscriptRepository>();

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SubmitResponseUseCase,
        { provide: 'IInterviewSessionRepository', useValue: mockSessionRepository },
        { provide: 'IInterviewResponseRepository', useValue: mockResponseRepository },
        { provide: 'ITranscriptRepository', useValue: mockTranscriptRepository },
      ],
    }).compile();

    useCase = moduleRef.get<SubmitResponseUseCase>(SubmitResponseUseCase);
    mockSessionRepository.findById.mockReset();
    mockResponseRepository.save.mockReset();
    mockTranscriptRepository.findBySessionId.mockReset();
  });

  it('should submit response successfully', async () => {
    const mockSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'in-progress',
      communicationMode: 'text',
      currentQuestion: 'q1',
    });

    mockSessionRepository.findById.mockResolvedValue(mockSession);
    mockResponseRepository.findBySessionAndQuestion.mockResolvedValue(null);
    mockResponseRepository.save.mockImplementation(async (r: any) => r);
    mockTranscriptRepository.appendMessage.mockResolvedValue(undefined);

    const result = await useCase.execute({
      sessionId: 'test-session',
      questionId: 'q1',
      candidateResponse: 'My answer',
      communicationMode: 'text',
    });

    expect(result).toBeInstanceOf(InterviewResponse);
    expect(result.questionId).toBe('q1');
    expect(mockResponseRepository.save).toHaveBeenCalled();
  });

  it('should throw error if session not found', async () => {
    mockSessionRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        sessionId: 'non-existent',
        questionId: 'q1',
        candidateResponse: 'Answer',
        communicationMode: 'text',
      }),
    ).rejects.toThrow('Session not found');
  });
});
