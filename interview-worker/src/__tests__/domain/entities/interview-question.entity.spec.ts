/**
 * InterviewQuestion Entity Unit Tests
 */

import { InterviewQuestion } from '../../../domain/entities/interview-question.entity';

describe('InterviewQuestion', () => {
  it('should create question with required fields', () => {
    const question = new InterviewQuestion({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'easy',
      question: 'What is an array?',
    });

    expect(question.questionId).toBe('q1');
    expect(question.category).toBe('tech-trivia');
    expect(question.difficulty).toBe('easy');
    expect(question.question).toBe('What is an array?');
    expect(question.tags).toEqual([]);
  });

  it('should create question with optional fields', () => {
    const question = new InterviewQuestion({
      questionId: 'q2',
      category: 'system-design',
      difficulty: 'hard',
      question: 'Design a distributed cache',
      subcategory: 'caching',
      tags: ['distributed-systems', 'caching'],
      expectedDuration: 30,
    });

    expect(question.subcategory).toBe('caching');
    expect(question.tags).toContain('distributed-systems');
    expect(question.expectedDuration).toBe(30);
  });

  it('should convert to object', () => {
    const question = new InterviewQuestion({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'easy',
      question: 'Test question',
    });

    const obj = question.toObject();

    expect(obj.questionId).toBe('q1');
    expect(obj.category).toBe('tech-trivia');
    expect(obj.question).toBe('Test question');
  });

  it('should create from object', () => {
    const obj = {
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'easy',
      question: 'Test question',
      tags: ['arrays'],
      expectedDuration: 5,
    };

    const question = InterviewQuestion.fromObject(obj);

    expect(question.questionId).toBe('q1');
    expect(question.tags).toContain('arrays');
    expect(question.expectedDuration).toBe(5);
  });
});
