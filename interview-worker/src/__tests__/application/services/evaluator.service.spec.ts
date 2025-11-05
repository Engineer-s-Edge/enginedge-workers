/**
 * Evaluator Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EvaluatorService } from '../../../application/services/evaluator.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  InterviewSession,
  InterviewReport,
  CandidateProfile,
  Transcript,
} from '../../../domain/entities';
import { Interview } from '../../../domain/entities';
import { mock } from 'jest-mock-extended';
import {
  IInterviewSessionRepository,
  ICandidateProfileRepository,
  ITranscriptRepository,
  IInterviewReportRepository,
  IInterviewRepository,
} from '../../../application/ports/repositories.port';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('EvaluatorService', () => {
  let service: EvaluatorService;
  const mockSessionRepository = mock<IInterviewSessionRepository>();
  const mockProfileRepository = mock<ICandidateProfileRepository>();
  const mockTranscriptRepository = mock<ITranscriptRepository>();
  const mockReportRepository = mock<IInterviewReportRepository>();
  const mockInterviewRepository = mock<IInterviewRepository>();
  let mockConfigService: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockReturnValue('http://localhost:3001'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluatorService,
        { provide: ConfigService, useValue: mockConfigService },
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
        {
          provide: 'IInterviewReportRepository',
          useValue: mockReportRepository,
        },
        { provide: 'IInterviewRepository', useValue: mockInterviewRepository },
      ],
    }).compile();

    service = module.get<EvaluatorService>(EvaluatorService);
    jest.clearAllMocks();
  });

  it('should generate report for completed session', async () => {
    const mockSession = new InterviewSession({
      sessionId: 's1',
      interviewId: 'i1',
      candidateId: 'c1',
      status: 'completed',
      communicationMode: 'text',
      completedAt: new Date(),
    });

    const mockInterview = new Interview({
      id: 'i1',
      title: 'Test Interview',
      phases: [],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        totalTimeLimit: 60,
      },
      rubric: { overall: { weights: { technical: 1.0 } } },
    });

    const mockProfile = new CandidateProfile({
      profileId: 'p1',
      sessionId: 's1',
      observations: {
        strengths: ['Strong'],
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
    });

    const mockTranscript: Transcript = {
      sessionId: 's1',
      messages: [],
    };

    mockSessionRepository.findById.mockResolvedValue(mockSession);
    mockInterviewRepository.findById.mockResolvedValue(mockInterview);
    mockProfileRepository.findBySessionId.mockResolvedValue(mockProfile);
    mockTranscriptRepository.findBySessionId.mockResolvedValue(mockTranscript);
    mockReportRepository.findBySessionId.mockResolvedValue(null);

    mockedAxios.post.mockResolvedValue({
      data: {
        content: JSON.stringify({
          score: { overall: 85, byPhase: { technical: 85 } },
          feedback: 'Strong candidate',
        }),
      },
    });

    mockReportRepository.save.mockImplementation(async (r: any) => r);

    const result = await service.generateReport('s1');

    expect(result).toBeInstanceOf(InterviewReport);
    expect(result.score.overall).toBe(85);
    expect(mockReportRepository.save).toHaveBeenCalled();
  });

  it('should throw error if session not found', async () => {
    mockSessionRepository.findById.mockResolvedValue(null);

    await expect(service.generateReport('non-existent')).rejects.toThrow(
      'Session not found',
    );
  });

  it('should throw error if session not completed', async () => {
    const mockSession = new InterviewSession({
      sessionId: 's1',
      interviewId: 'i1',
      candidateId: 'c1',
      status: 'in-progress',
      communicationMode: 'text',
    });

    mockSessionRepository.findById.mockResolvedValue(mockSession);

    await expect(service.generateReport('s1')).rejects.toThrow(
      'Session must be completed',
    );
  });

  it('should return existing report if already generated', async () => {
    const mockSession = new InterviewSession({
      sessionId: 's1',
      interviewId: 'i1',
      candidateId: 'c1',
      status: 'completed',
      communicationMode: 'text',
      completedAt: new Date(),
    });

    const existingReport = new InterviewReport({
      reportId: 'r1',
      sessionId: 's1',
      score: { overall: 80, byPhase: {} },
      feedback: 'Existing feedback',
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
      transcript: { sessionId: 's1', messages: [] },
    });

    mockSessionRepository.findById.mockResolvedValue(mockSession);
    mockReportRepository.findBySessionId.mockResolvedValue(existingReport);

    const result = await service.generateReport('s1');

    expect(result.reportId).toBe('r1');
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
