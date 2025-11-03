/**
 * Session Isolation and Concurrency Tests
 *
 * Tests that multiple interview sessions can run simultaneously without interference.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { SessionService } from '../../src/application/services/session.service';
import { QuestionService } from '../../src/application/services/question.service';
import { InterviewService } from '../../src/application/services/interview.service';
import { ConfigService } from '@nestjs/config';

describe('Session Isolation and Concurrency', () => {
  let app: TestingModule;
  let sessionService: SessionService;
  let interviewService: InterviewService;
  let questionService: QuestionService;
  let testInterviewId: string;
  const concurrentSessions = 5;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    sessionService = app.get<SessionService>(SessionService);
    interviewService = app.get<InterviewService>(InterviewService);
    questionService = app.get<QuestionService>(QuestionService);

    // Create a test interview
    const interview = await interviewService.createInterview({
      title: 'Test Interview',
      description: 'Concurrency test',
      phases: [
        {
          phaseId: 'phase-1',
          type: 'technical',
          duration: 30,
          difficulty: 'medium',
          questionCount: 3,
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

    testInterviewId = interview.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should handle 5 concurrent interview sessions without interference', async () => {
    const sessions = await Promise.all(
      Array.from({ length: concurrentSessions }, (_, i) =>
        sessionService.startSession({
          interviewId: testInterviewId,
          candidateId: `candidate-${i}`,
          communicationMode: 'text',
        }),
      ),
    );

    // Verify all sessions were created
    expect(sessions).toHaveLength(concurrentSessions);
    sessions.forEach((session, i) => {
      expect(session.sessionId).toBeDefined();
      expect(session.candidateId).toBe(`candidate-${i}`);
      expect(session.interviewId).toBe(testInterviewId);
      expect(session.status).toBe('in-progress');
    });

    // Verify session isolation - each session should have unique sessionId
    const sessionIds = sessions.map((s) => s.sessionId);
    const uniqueIds = new Set(sessionIds);
    expect(uniqueIds.size).toBe(concurrentSessions);

    // Verify each session can be retrieved independently
    for (const session of sessions) {
      const retrieved = await sessionService.getSession(session.sessionId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(session.sessionId);
      expect(retrieved?.candidateId).toBe(session.candidateId);
    }
  });

  it('should allow concurrent operations on different sessions', async () => {
    const sessions = await Promise.all(
      Array.from({ length: concurrentSessions }, (_, i) =>
        sessionService.startSession({
          interviewId: testInterviewId,
          candidateId: `candidate-${i}`,
          communicationMode: 'text',
        }),
      ),
    );

    // Concurrently pause different sessions
    const pauseResults = await Promise.all(
      sessions.map((session) => sessionService.pauseSession(session.sessionId)),
    );

    // Verify all pauses succeeded
    pauseResults.forEach((session) => {
      expect(session.status).toBe('paused');
    });

    // Concurrently resume different sessions
    const resumeResults = await Promise.all(
      pauseResults.map((session) =>
        sessionService.resumeSession(session.sessionId),
      ),
    );

    // Verify all resumes succeeded
    resumeResults.forEach((session) => {
      expect(session.status).toBe('in-progress');
    });
  });

  it('should maintain data isolation between sessions', async () => {
    const sessions = await Promise.all(
      Array.from({ length: concurrentSessions }, (_, i) =>
        sessionService.startSession({
          interviewId: testInterviewId,
          candidateId: `candidate-${i}`,
          communicationMode: 'text',
        }),
      ),
    );

    // Submit different responses to different sessions
    const responses = await Promise.all(
      sessions.map((session, i) =>
        sessionService.submitResponse({
          sessionId: session.sessionId,
          questionId: `question-${i}`,
          candidateResponse: `Response from candidate ${i}`,
          communicationMode: 'text',
        }),
      ),
    );

    // Verify each response is associated with correct session
    responses.forEach((response, i) => {
      expect(response.sessionId).toBe(sessions[i].sessionId);
      expect(response.candidateResponse).toBe(`Response from candidate ${i}`);
    });

    // Verify sessions remain isolated
    for (let i = 0; i < sessions.length; i++) {
      const retrieved = await sessionService.getSession(sessions[i].sessionId);
      expect(retrieved?.sessionId).toBe(sessions[i].sessionId);
    }
  });

  it('should handle concurrent profile updates without data corruption', async () => {
    const sessions = await Promise.all(
      Array.from({ length: concurrentSessions }, (_, i) =>
        sessionService.startSession({
          interviewId: testInterviewId,
          candidateId: `candidate-${i}`,
          communicationMode: 'text',
        }),
      ),
    );

    // Concurrently update profiles for different sessions
    const profileService = app.get('CandidateProfileService');
    await Promise.all(
      sessions.map((session, i) =>
        profileService.appendObservation(
          session.sessionId,
          'strengths',
          `Strength ${i} for candidate ${i}`,
        ),
      ),
    );

    // Verify each profile was updated correctly
    for (let i = 0; i < sessions.length; i++) {
      const profile = await profileService.getProfile(sessions[i].sessionId);
      expect(profile).toBeDefined();
      expect(profile?.observations.strengths).toContain(
        `Strength ${i} for candidate ${i}`,
      );
    }
  });
});
