/**
 * Pause Interview Use Case Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PauseInterviewUseCase } from '../../../application/use-cases/pause-interview.use-case';
import { InterviewSession } from '../../../domain/entities';
import { mock } from 'jest-mock-extended';
import { IInterviewSessionRepository } from '../../../application/ports/repositories.port';

describe('PauseInterviewUseCase', () => {
  let useCase: PauseInterviewUseCase;
  const mockSessionRepository = mock<IInterviewSessionRepository>();

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PauseInterviewUseCase,
        { provide: 'IInterviewSessionRepository', useValue: mockSessionRepository },
      ],
    }).compile();

    useCase = moduleRef.get<PauseInterviewUseCase>(PauseInterviewUseCase);
    mockSessionRepository.findById.mockReset();
    mockSessionRepository.save.mockReset();
  });

  it('should pause an in-progress session', async () => {
    const mockSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'in-progress',
      communicationMode: 'text',
    });

    mockSessionRepository.findById.mockResolvedValue(mockSession);
    mockSessionRepository.save.mockImplementation(async (s: any) => s);

    const result = await useCase.execute('test-session');

    expect(result.status).toBe('paused');
    expect(result.pausedAt).toBeDefined();
    expect(mockSessionRepository.save).toHaveBeenCalled();
  });

  it('should throw error if session not found', async () => {
    mockSessionRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('non-existent')).rejects.toThrow('Session not found');
  });

  it('should throw error if session cannot be paused', async () => {
    const completedSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'completed',
      communicationMode: 'text',
    });

    mockSessionRepository.findById.mockResolvedValue(completedSession);

    await expect(useCase.execute('test-session')).rejects.toThrow('Cannot pause session');
  });
});
