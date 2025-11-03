/**
 * Interview Controller Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { InterviewController } from '../../../../infrastructure/controllers/interview.controller';
import { InterviewService } from '../../../../application/services/interview.service';
import { Interview } from '../../../../domain/entities';

describe('InterviewController', () => {
  let controller: InterviewController;
  let mockInterviewService: any;

  beforeEach(async () => {
    mockInterviewService = {
      createInterview: jest.fn(),
      getAllInterviews: jest.fn(),
      getInterview: jest.fn(),
      updateInterview: jest.fn(),
      deleteInterview: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InterviewController],
      providers: [
        {
          provide: InterviewService,
          useValue: mockInterviewService,
        },
      ],
    }).compile();

    controller = module.get<InterviewController>(InterviewController);
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

    mockInterviewService.createInterview.mockResolvedValue(mockInterview);

    const result = await controller.createInterview({
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

    expect(result.id).toBe('test-interview');
    expect(mockInterviewService.createInterview).toHaveBeenCalled();
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

    mockInterviewService.getAllInterviews.mockResolvedValue(mockInterviews);

    const result = await controller.getAllInterviews();

    expect(result).toHaveLength(1);
    expect(mockInterviewService.getAllInterviews).toHaveBeenCalled();
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

    mockInterviewService.getInterview.mockResolvedValue(mockInterview);

    const result = await controller.getInterview('test-id');

    expect(result?.id).toBe('test-id');
    expect(mockInterviewService.getInterview).toHaveBeenCalledWith('test-id');
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

    mockInterviewService.updateInterview.mockResolvedValue(updatedInterview);

    const result = await controller.updateInterview('test-id', {
      title: 'Updated Title',
    });

    expect(result?.title).toBe('Updated Title');
    expect(mockInterviewService.updateInterview).toHaveBeenCalled();
  });

  it('should delete interview', async () => {
    mockInterviewService.deleteInterview.mockResolvedValue(true);

    await controller.deleteInterview('test-id');

    expect(mockInterviewService.deleteInterview).toHaveBeenCalledWith(
      'test-id',
    );
  });
});
