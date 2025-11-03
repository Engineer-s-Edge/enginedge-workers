/**
 * Skip Question Use Case Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SkipQuestionUseCase } from '../../../application/use-cases/skip-question.use-case';
import { InterviewSession } from '../../../domain/entities';

describe('SkipQuestionUseCase', () => {
  let useCase: SkipQuestionUseCase;
  let mockSessionRepository: any;

  beforeEach(async () => {
    mockSessionRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    const mockProfileRepository = {
      findBySessionId: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkipQuestionUseCase,
        {
          provide: 'IInterviewSessionRepository',
          useValue: mockSessionRepository,
        },
        {
          provide: 'ICandidateProfileRepository',
          useValue: mockProfileRepository,
        },
      ],
    }).compile();

    useCase = module.get<SkipQuestionUseCase>(SkipQuestionUseCase);
  });

  it('should skip question successfully', async () => {
    const mockSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'in-progress',
      communicationMode: 'text',
      currentQuestion: 'q1',
      skippedQuestions: [],
    });

    mockSessionRepository.findById.mockResolvedValue(mockSession);
    mockSessionRepository.save.mockImplementation(async (s: any) => s);

    const result = await useCase.execute('test-session', 'q1');

    expect(result.skippedQuestions).toContain('q1');
    expect(result.currentQuestion).toBeUndefined();
    expect(mockSessionRepository.save).toHaveBeenCalled();
  });

  it('should throw error if session not found', async () => {
    mockSessionRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('non-existent', 'q1')).rejects.toThrow(
      'Session not found',
    );
  });

  it('should throw error if session not in-progress', async () => {
    const mockSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'completed',
      communicationMode: 'text',
    });

    mockSessionRepository.findById.mockResolvedValue(mockSession);

    await expect(useCase.execute('test-session', 'q1')).rejects.toThrow(
      'Cannot skip question',
    );
  });

  it('should track multiple skipped questions', async () => {
    const mockSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'in-progress',
      communicationMode: 'text',
      currentQuestion: 'q2',
      skippedQuestions: ['q1'],
    });

    mockSessionRepository.findById.mockResolvedValue(mockSession);
    mockSessionRepository.save.mockImplementation(async (s: any) => s);

    const result = await useCase.execute('test-session', 'q2');

    expect(result.skippedQuestions).toContain('q1');
    expect(result.skippedQuestions).toContain('q2');
    expect(result.skippedQuestions).toHaveLength(2);
  });
});
