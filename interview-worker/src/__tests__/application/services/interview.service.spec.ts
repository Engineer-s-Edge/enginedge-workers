/**
 * Interview Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { InterviewService } from '../../../application/services/interview.service';
import { Interview } from '../../../domain/entities';
import { mock } from 'jest-mock-extended';
import { IInterviewRepository } from '../../../application/ports/repositories.port';

describe('InterviewService', () => {
  let service: InterviewService;
  const mockInterviewRepository = mock<IInterviewRepository>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewService,
        { provide: 'IInterviewRepository', useValue: mockInterviewRepository },
      ],
    }).compile();

    service = module.get<InterviewService>(InterviewService);
    mockInterviewRepository.save.mockReset();
    mockInterviewRepository.findById.mockReset();
    mockInterviewRepository.findAll.mockReset();
    mockInterviewRepository.update.mockReset();
    mockInterviewRepository.delete.mockReset();
  });

  it('should create interview', async () => {
    const mockInterview = new Interview({
      id: 'test-interview',
      title: 'Test Interview',
      phases: [],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        totalTimeLimit: 60,
      },
      rubric: { overall: { weights: {} } },
    });

    mockInterviewRepository.save.mockImplementation(async (i: any) => i);

    const result = await service.createInterview({
      title: 'Test Interview',
      phases: [],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        totalTimeLimit: 60,
      },
      rubric: { overall: { weights: {} } },
    });

    expect(result.title).toBe('Test Interview');
    expect(mockInterviewRepository.save).toHaveBeenCalled();
  });

  it('should get all interviews', async () => {
    const mockInterviews = [
      new Interview({
        id: 'i1',
        title: 'Interview 1',
        phases: [],
        config: {
          allowPause: true,
          maxPauseDuration: null,
          allowSkip: true,
          totalTimeLimit: 60,
        },
        rubric: { overall: { weights: {} } },
      }),
    ];

    mockInterviewRepository.findAll.mockResolvedValue(mockInterviews);

    const result = await service.getAllInterviews();

    expect(result).toHaveLength(1);
    expect(mockInterviewRepository.findAll).toHaveBeenCalled();
  });

  it('should get interview by ID', async () => {
    const mockInterview = new Interview({
      id: 'test-id',
      title: 'Test Interview',
      phases: [],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        totalTimeLimit: 60,
      },
      rubric: { overall: { weights: {} } },
    });

    mockInterviewRepository.findById.mockResolvedValue(mockInterview);

    const result = await service.getInterview('test-id');

    expect(result?.id).toBe('test-id');
    expect(mockInterviewRepository.findById).toHaveBeenCalledWith('test-id');
  });

  it('should update interview', async () => {
    const updatedInterview = new Interview({
      id: 'test-id',
      title: 'Updated Title',
      phases: [],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        totalTimeLimit: 90,
      },
      rubric: { overall: { weights: {} } },
    });

    mockInterviewRepository.update.mockResolvedValue(updatedInterview);

    const result = await service.updateInterview('test-id', {
      title: 'Updated Title',
    });

    expect(result?.title).toBe('Updated Title');
    expect(mockInterviewRepository.update).toHaveBeenCalled();
  });

  it('should delete interview', async () => {
    mockInterviewRepository.delete.mockResolvedValue(true);

    const result = await service.deleteInterview('test-id');

    expect(result).toBe(true);
    expect(mockInterviewRepository.delete).toHaveBeenCalledWith('test-id');
  });
});
