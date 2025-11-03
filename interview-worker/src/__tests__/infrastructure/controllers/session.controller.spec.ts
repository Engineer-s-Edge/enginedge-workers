/**
 * Session Controller Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SessionController } from '../../../../infrastructure/controllers/session.controller';
import { SessionService } from '../../../../application/services/session.service';
import { InterviewSession } from '../../../../domain/entities';

describe('SessionController', () => {
  let controller: SessionController;
  let mockSessionService: any;

  beforeEach(async () => {
    mockSessionService = {
      startSession: jest.fn(),
      getSession: jest.fn(),
      pauseSession: jest.fn(),
      resumeSession: jest.fn(),
      skipQuestion: jest.fn(),
      submitResponse: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    controller = module.get<SessionController>(SessionController);
  });

  it('should start session', async () => {
    const mockSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'in-progress',
      communicationMode: 'text',
    });

    mockSessionService.startSession.mockResolvedValue(mockSession);

    const result = await controller.startSession({
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      communicationMode: 'text',
    });

    expect(result.sessionId).toBe('test-session');
    expect(mockSessionService.startSession).toHaveBeenCalledWith({
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      communicationMode: 'text',
    });
  });

  it('should get session by ID', async () => {
    const mockSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'in-progress',
      communicationMode: 'text',
    });

    mockSessionService.getSession.mockResolvedValue(mockSession);

    const result = await controller.getSession('test-session');

    expect(result.sessionId).toBe('test-session');
    expect(mockSessionService.getSession).toHaveBeenCalledWith('test-session');
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

    mockSessionService.pauseSession.mockResolvedValue(pausedSession);

    const result = await controller.pauseSession('test-session');

    expect(result.status).toBe('paused');
    expect(mockSessionService.pauseSession).toHaveBeenCalledWith(
      'test-session',
    );
  });

  it('should resume session', async () => {
    const resumedSession = new InterviewSession({
      sessionId: 'test-session',
      interviewId: 'test-interview',
      candidateId: 'test-candidate',
      status: 'in-progress',
      communicationMode: 'text',
    });

    mockSessionService.resumeSession.mockResolvedValue(resumedSession);

    const result = await controller.resumeSession('test-session');

    expect(result.status).toBe('in-progress');
    expect(mockSessionService.resumeSession).toHaveBeenCalledWith(
      'test-session',
    );
  });

  it('should submit response', async () => {
    const mockResponse = {
      responseId: 'resp-1',
      sessionId: 'test-session',
      questionId: 'q1',
      candidateResponse: 'My answer',
      submittedAt: new Date(),
    };

    mockSessionService.submitResponse.mockResolvedValue(mockResponse);

    const result = await controller.submitResponse('test-session', {
      questionId: 'q1',
      candidateResponse: 'My answer',
      communicationMode: 'text',
    });

    expect(result.sessionId).toBe('test-session');
    expect(result.questionId).toBe('q1');
  });
});
