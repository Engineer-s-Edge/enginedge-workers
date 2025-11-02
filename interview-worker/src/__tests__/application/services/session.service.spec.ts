/**
 * Session Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from '../../../application/services/session.service';
import { StartInterviewUseCase } from '../../../application/use-cases/start-interview.use-case';
import { PauseInterviewUseCase } from '../../../application/use-cases/pause-interview.use-case';
import { ResumeInterviewUseCase } from '../../../application/use-cases/resume-interview.use-case';
import { SkipQuestionUseCase } from '../../../application/use-cases/skip-question.use-case';
import { SubmitResponseUseCase } from '../../../application/use-cases/submit-response.use-case';
import { InterviewSession } from '../../../domain/entities';
import { mock } from 'jest-mock-extended';
import { IInterviewSessionRepository } from '../../../application/ports/repositories.port';

describe('SessionService', () => {
  let service: SessionService;
  const mockSessionRepository = mock<IInterviewSessionRepository>();
  let mockStartInterviewUseCase: any;
  let mockPauseInterviewUseCase: any;
  let mockResumeInterviewUseCase: any;
  let mockSkipQuestionUseCase: any;
  let mockSubmitResponseUseCase: any;

  beforeEach(async () => {
    mockStartInterviewUseCase = { execute: jest.fn() };
    mockPauseInterviewUseCase = { execute: jest.fn() };
    mockResumeInterviewUseCase = { execute: jest.fn() };
    mockSkipQuestionUseCase = { execute: jest.fn() };
    mockSubmitResponseUseCase = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: 'IInterviewSessionRepository', useValue: mockSessionRepository },
        { provide: StartInterviewUseCase, useValue: mockStartInterviewUseCase },
        { provide: PauseInterviewUseCase, useValue: mockPauseInterviewUseCase },
        { provide: ResumeInterviewUseCase, useValue: mockResumeInterviewUseCase },
        { provide: SkipQuestionUseCase, useValue: mockSkipQuestionUseCase },
        { provide: SubmitResponseUseCase, useValue: mockSubmitResponseUseCase },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  it('should start session', async () => {
    const mockSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'in-progress',
      communicationMode: 'text',
    });

    mockStartInterviewUseCase.execute.mockResolvedValue(mockSession);

    const result = await service.startSession({
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      communicationMode: 'text',
    });

    expect(result.sessionId).toBe('test-session');
    expect(mockStartInterviewUseCase.execute).toHaveBeenCalled();
  });

  it('should get session by ID', async () => {
    const mockSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'in-progress',
      communicationMode: 'text',
    });

    mockSessionRepository.findById.mockResolvedValue(mockSession);

    const result = await service.getSession('test-session');

    expect(result?.sessionId).toBe('test-session');
    expect(mockSessionRepository.findById).toHaveBeenCalledWith('test-session');
  });

  it('should pause session', async () => {
    const pausedSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'paused',
      communicationMode: 'text',
      pausedAt: new Date(),
    });

    mockPauseInterviewUseCase.execute.mockResolvedValue(pausedSession);

    const result = await service.pauseSession('test-session');

    expect(result.status).toBe('paused');
    expect(mockPauseInterviewUseCase.execute).toHaveBeenCalledWith('test-session');
  });

  it('should resume session', async () => {
    const resumedSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'in-progress',
      communicationMode: 'text',
    });

    mockResumeInterviewUseCase.execute.mockResolvedValue(resumedSession);

    const result = await service.resumeSession('test-session');

    expect(result.status).toBe('in-progress');
    expect(mockResumeInterviewUseCase.execute).toHaveBeenCalledWith('test-session');
  });

  it('should skip question', async () => {
    const updatedSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'in-progress',
      communicationMode: 'text',
      skippedQuestions: ['q1'],
    });

    mockSkipQuestionUseCase.execute.mockResolvedValue(updatedSession);

    const result = await service.skipQuestion('test-session', 'q1');

    expect(result.skippedQuestions).toContain('q1');
    expect(mockSkipQuestionUseCase.execute).toHaveBeenCalledWith({
      sessionId: 'test-session',
      questionId: 'q1',
    });
  });

  it('should submit response', async () => {
    const mockResponse = {
      responseId: 'resp-1',
      sessionId: 'test-session',
      questionId: 'q1',
      candidateResponse: 'My answer',
      submittedAt: new Date(),
    };

    mockSubmitResponseUseCase.execute.mockResolvedValue(mockResponse);

    const result = await service.submitResponse({
      sessionId: 'test-session',
      questionId: 'q1',
      candidateResponse: 'My answer',
      communicationMode: 'text',
    });

    expect(result.sessionId).toBe('test-session');
    expect(mockSubmitResponseUseCase.execute).toHaveBeenCalled();
  });
});

