/**
 * Start Interview Use Case Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { StartInterviewUseCase } from '../../../application/use-cases/start-interview.use-case';
import { Interview } from '../../../domain/entities';
import { InterviewSession } from '../../../domain/entities';

describe('StartInterviewUseCase', () => {
  let useCase: StartInterviewUseCase;
  let mockInterviewRepository: any;
  let mockSessionRepository: any;
  let mockProfileRepository: any;
  let mockTranscriptRepository: any;

  beforeEach(async () => {
    mockInterviewRepository = {
      findById: jest.fn(),
    };

    mockSessionRepository = {
      save: jest.fn(),
    };

    mockProfileRepository = {
      save: jest.fn(),
    };

    mockTranscriptRepository = {
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartInterviewUseCase,
        {
          provide: 'IInterviewRepository',
          useValue: mockInterviewRepository,
        },
        {
          provide: 'IInterviewSessionRepository',
          useValue: mockSessionRepository,
        },
        {
          provide: 'ICandidateProfileRepository',
          useValue: mockProfileRepository,
        },
        {
          provide: 'ITranscriptRepository',
          useValue: mockTranscriptRepository,
        },
      ],
    }).compile();

    useCase = module.get<StartInterviewUseCase>(StartInterviewUseCase);
  });

  it('should create and return session successfully', async () => {
    const mockInterview = new Interview({
      id: 'test-interview',
      userId: 'test-user',
      title: 'Test Interview',
      phases: [],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        maxSkips: null,
        totalTimeLimit: 60,
      },
      rubric: { overall: { weights: {} } },
    });

    mockInterviewRepository.findById.mockResolvedValue(mockInterview);
    mockSessionRepository.save.mockImplementation(
      async (session: any) => session,
    );
    mockProfileRepository.save.mockImplementation(
      async (profile: any) => profile,
    );
    mockTranscriptRepository.save.mockResolvedValue(undefined);

    const result = await useCase.execute({
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      communicationMode: 'text',
    });

    expect(result).toBeInstanceOf(InterviewSession);
    expect(result.interviewId).toBe('test-interview');
    expect(result.candidateId).toBe('test-candidate');
    expect(result.status).toBe('in-progress');
    expect(result.currentPhase).toBe(0);
    expect(mockSessionRepository.save).toHaveBeenCalled();
    expect(mockProfileRepository.save).toHaveBeenCalled();
    expect(mockTranscriptRepository.save).toHaveBeenCalled();
  });

  it('should throw error if interview not found', async () => {
    mockInterviewRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        interviewId: 'non-existent',
        candidateId: 'test-candidate',
        communicationMode: 'text',
      }),
    ).rejects.toThrow('Interview not found: non-existent');
  });

  it('should create session with voice communication mode', async () => {
    const mockInterview = new Interview({
      id: 'test-interview',
      userId: 'test-user',
      title: 'Test Interview',
      phases: [],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        maxSkips: null,
        totalTimeLimit: 60,
      },
      rubric: { overall: { weights: {} } },
    });

    mockInterviewRepository.findById.mockResolvedValue(mockInterview);
    mockSessionRepository.save.mockImplementation(
      async (session: any) => session,
    );
    mockProfileRepository.save.mockImplementation(
      async (profile: any) => profile,
    );
    mockTranscriptRepository.save.mockResolvedValue(undefined);

    const result = await useCase.execute({
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      communicationMode: 'voice',
    });

    expect(result.communicationMode).toBe('voice');
  });
});
