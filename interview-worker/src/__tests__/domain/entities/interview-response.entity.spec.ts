/**
 * InterviewResponse Entity Unit Tests
 */

import { InterviewResponse } from '../../../domain/entities/interview-response.entity';

describe('InterviewResponse', () => {
  it('should create response with required fields', () => {
    const response = new InterviewResponse({
      responseId: 'r1',
      sessionId: 's1',
      questionId: 'q1',
      candidateResponse: 'My answer',
      submittedAt: new Date(),
    });

    expect(response.responseId).toBe('r1');
    expect(response.sessionId).toBe('s1');
    expect(response.questionId).toBe('q1');
    expect(response.candidateResponse).toBe('My answer');
    expect(response.skipped).toBe(false);
    expect(response.followups).toEqual([]);
  });

  it('should create response with optional fields', () => {
    const followup1 = {
      followupForQuestionId: 'q1',
      text: 'Can you elaborate?',
      depth: 1,
      candidateResponse: 'More details',
      timestamp: new Date(),
    };
    const followup2 = {
      followupForQuestionId: 'q1',
      text: 'Any examples?',
      depth: 2,
      candidateResponse: 'Example here',
      timestamp: new Date(),
    };

    const response = new InterviewResponse({
      responseId: 'r1',
      sessionId: 's1',
      questionId: 'q1',
      candidateResponse: 'My answer',
      submittedAt: new Date(),
      skipped: true,
      followups: [followup1, followup2],
    });

    expect(response.skipped).toBe(true);
    expect(response.followups).toHaveLength(2);
  });

  it('should convert to object', () => {
    const response = new InterviewResponse({
      responseId: 'r1',
      sessionId: 's1',
      questionId: 'q1',
      candidateResponse: 'My answer',
      submittedAt: new Date(),
    });

    const obj = response.toObject();

    expect(obj.responseId).toBe('r1');
    expect(obj.sessionId).toBe('s1');
    expect(obj.questionId).toBe('q1');
  });

  it('should create from object', () => {
    const obj = {
      responseId: 'r1',
      sessionId: 's1',
      questionId: 'q1',
      candidateResponse: 'My answer',
      submittedAt: new Date(),
      skipped: false,
      followups: [],
    };

    const response = InterviewResponse.fromObject(obj);

    expect(response.responseId).toBe('r1');
    expect(response.candidateResponse).toBe('My answer');
  });
});

