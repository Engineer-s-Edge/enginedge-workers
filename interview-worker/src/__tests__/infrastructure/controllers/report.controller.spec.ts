/**
 * Report Controller Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ReportController } from '../../../../infrastructure/controllers/report.controller';
import { EvaluatorService } from '../../../../application/services/evaluator.service';
import { InterviewReport } from '../../../../domain/entities';

describe('ReportController', () => {
  let controller: ReportController;
  let mockEvaluatorService: any;

  beforeEach(async () => {
    mockEvaluatorService = {
      generateReport: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [
        {
          provide: EvaluatorService,
          useValue: mockEvaluatorService,
        },
      ],
    }).compile();

    controller = module.get<ReportController>(ReportController);
  });

  it('should generate report', async () => {
    const mockReport = new InterviewReport({
      reportId: 'r1',
      sessionId: 's1',
      score: {
        overall: 85,
        byPhase: {
          technical: 90,
        },
      },
      feedback: 'Strong candidate',
      observations: {
        strengths: ['Good problem-solving'],
        concerns: [],
        resumeFindings: {
          verified: [],
          questioned: [],
          deepDived: [],
        },
        adaptability: '',
        communicationStyle: '',
        interviewFlow: {
          pausedAt: [],
          skippedQuestions: 0,
          pauseDuration: 0,
        },
        keyInsights: '',
      },
      transcript: {
        sessionId: 's1',
        messages: [],
      },
    });

    mockEvaluatorService.generateReport.mockResolvedValue(mockReport);

    const result = await controller.generateReport('s1');

    expect(result.reportId).toBe('r1');
    expect(result.score.overall).toBe(85);
    expect(mockEvaluatorService.generateReport).toHaveBeenCalledWith('s1');
  });

  it('should get report (calls generateReport)', async () => {
    const mockReport = new InterviewReport({
      reportId: 'r1',
      sessionId: 's1',
      score: {
        overall: 85,
        byPhase: {},
      },
      feedback: 'Strong candidate',
      observations: {
        strengths: [],
        concerns: [],
        resumeFindings: {
          verified: [],
          questioned: [],
          deepDived: [],
        },
        adaptability: '',
        communicationStyle: '',
        interviewFlow: {
          pausedAt: [],
          skippedQuestions: 0,
          pauseDuration: 0,
        },
        keyInsights: '',
      },
      transcript: {
        sessionId: 's1',
        messages: [],
      },
    });

    mockEvaluatorService.generateReport.mockResolvedValue(mockReport);

    const result = await controller.getReport('s1');

    expect(result?.reportId).toBe('r1');
    expect(mockEvaluatorService.generateReport).toHaveBeenCalledWith('s1');
  });
});
