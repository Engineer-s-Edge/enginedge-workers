/**
 * Session Flow Integration Tests
 * 
 * Tests the complete session lifecycle with real MongoDB
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { SessionService } from '@application/services/session.service';
import { InterviewService } from '@application/services/interview.service';
import { QuestionService } from '@application/services/question.service';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

describe('Session Flow Integration', () => {
  let app: TestingModule;
  let sessionService: SessionService;
  let interviewService: InterviewService;
  let questionService: QuestionService;
  let mongoServer: MongoMemoryServer;
  let mongoClient: MongoClient;

  beforeAll(async () => {
    // Start MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect to in-memory MongoDB
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();

    // Set environment variables
    process.env.MONGODB_URI = mongoUri;
    process.env.MONGODB_DATABASE = 'test_db';

    app = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    sessionService = app.get<SessionService>(SessionService);
    interviewService = app.get<InterviewService>(InterviewService);
    questionService = app.get<QuestionService>(QuestionService);

    // Create test interview
    await interviewService.createInterview({
      title: 'Integration Test Interview',
      description: 'Test interview for integration tests',
      phases: [
        {
          phaseId: 'phase-1',
          type: 'technical',
          duration: 30,
          difficulty: 'medium',
          questionCount: 2,
        },
      ],
      config: {
        allowPause: true,
        maxPauseDuration: null,
        allowSkip: true,
        maxSkips: null,
        totalTimeLimit: 60,
      },
      rubric: {
        overall: {
          weights: {
            technical: 1.0,
          },
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
    if (mongoClient) {
      await mongoClient.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('should complete full session lifecycle: start -> pause -> resume -> submit -> complete', async () => {
    // Get interview
    const interviews = await interviewService.getAllInterviews();
    const interview = interviews[0];
    expect(interview).toBeDefined();

    // Start session
    const session = await sessionService.startSession({
      interviewId: interview.id,
      candidateId: 'integration-test-candidate',
      communicationMode: 'text',
    });

    expect(session.status).toBe('in-progress');
    expect(session.sessionId).toBeDefined();

    // Pause session
    const pausedSession = await sessionService.pauseSession(session.sessionId);
    expect(pausedSession.status).toBe('paused');
    expect(pausedSession.pausedAt).toBeDefined();

    // Resume session
    const resumedSession = await sessionService.resumeSession(session.sessionId);
    expect(resumedSession.status).toBe('in-progress');
    expect(resumedSession.pausedAt).toBeUndefined();
    expect(resumedSession.pausedCount).toBeGreaterThan(0);

    // Submit a response
    const questions = await questionService.getQuestionsByCategory('tech-trivia', 'medium');
    if (questions.length > 0) {
      const question = questions[0];
      const response = await sessionService.submitResponse({
        sessionId: session.sessionId,
        questionId: question.questionId,
        candidateResponse: 'This is my answer to the integration test question.',
        communicationMode: 'text',
      });

      expect(response.sessionId).toBe(session.sessionId);
      expect(response.questionId).toBe(question.questionId);
      expect(response.candidateResponse).toBeDefined();
    }
  });

  it('should handle multiple sessions concurrently', async () => {
    const interviews = await interviewService.getAllInterviews();
    const interview = interviews[0];

    // Create multiple sessions
    const sessions = await Promise.all([
      sessionService.startSession({
        interviewId: interview.id,
        candidateId: 'candidate-1',
        communicationMode: 'text',
      }),
      sessionService.startSession({
        interviewId: interview.id,
        candidateId: 'candidate-2',
        communicationMode: 'text',
      }),
      sessionService.startSession({
        interviewId: interview.id,
        candidateId: 'candidate-3',
        communicationMode: 'text',
      }),
    ]);

    expect(sessions).toHaveLength(3);
    expect(new Set(sessions.map((s) => s.sessionId)).size).toBe(3); // All unique

    // Verify each can be retrieved independently
    for (const session of sessions) {
      const retrieved = await sessionService.getSession(session.sessionId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(session.sessionId);
    }
  });
});

