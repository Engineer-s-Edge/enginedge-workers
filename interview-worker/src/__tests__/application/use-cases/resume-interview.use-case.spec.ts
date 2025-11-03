/**
 * Resume Interview Use Case Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ResumeInterviewUseCase } from '../../../application/use-cases/resume-interview.use-case';
import { InterviewSession } from '../../../domain/entities';
import { mock } from 'jest-mock-extended';
import { IInterviewSessionRepository } from '../../../application/ports/repositories.port';

describe('ResumeInterviewUseCase', () => {
  let useCase: ResumeInterviewUseCase;
  const mockSessionRepository = mock<IInterviewSessionRepository>();

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ResumeInterviewUseCase,
        {
          provide: 'IInterviewSessionRepository',
          useValue: mockSessionRepository,
        },
      ],
    }).compile();

    useCase = moduleRef.get<ResumeInterviewUseCase>(ResumeInterviewUseCase);
    mockSessionRepository.findById.mockReset();
    mockSessionRepository.save.mockReset();
  });

  it('should resume a paused session', async () => {
    const pausedSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'paused',
      communicationMode: 'text',
      pausedAt: new Date(Date.now() - 5000),
    });

    mockSessionRepository.findById.mockResolvedValue(pausedSession);
    mockSessionRepository.save.mockImplementation(async (s: any) => s);

    const result = await useCase.execute('test-session');

    expect(result.status).toBe('in-progress');
    expect(result.pausedAt).toBeUndefined();
    expect(result.pausedCount).toBe(1);
    expect(mockSessionRepository.save).toHaveBeenCalled();
  });

  it('should throw error if session not found', async () => {
    mockSessionRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('non-existent')).rejects.toThrow(
      'Session not found',
    );
  });

  it('should throw error if session cannot be resumed', async () => {
    const inProgressSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'in-progress',
      communicationMode: 'text',
    });

    mockSessionRepository.findById.mockResolvedValue(inProgressSession);

    await expect(useCase.execute('test-session')).rejects.toThrow(
      'Cannot resume session',
    );
  });
});
