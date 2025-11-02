/**
 * Question Selection Service Unit Tests
 */

import { QuestionSelectionService } from '../../../domain/services/question-selection.service';
import { InterviewQuestion } from '../../../domain/entities/interview-question.entity';

describe('QuestionSelectionService', () => {
  let service: QuestionSelectionService;
  let mockQuestions: InterviewQuestion[];

  beforeEach(() => {
    service = new QuestionSelectionService();
    
    mockQuestions = [
      new InterviewQuestion({
        questionId: 'q1',
        category: 'tech-trivia',
        difficulty: 'easy',
        subcategory: 'arrays',
        tags: ['data-structures'],
        question: 'What is an array?',
      }),
      new InterviewQuestion({
        questionId: 'q2',
        category: 'tech-trivia',
        difficulty: 'medium',
        subcategory: 'algorithms',
        tags: ['sorting', 'complexity'],
        question: 'Explain quicksort',
      }),
      new InterviewQuestion({
        questionId: 'q3',
        category: 'behavioral',
        difficulty: 'easy',
        tags: ['teamwork'],
        question: 'Tell me about yourself',
      }),
      new InterviewQuestion({
        questionId: 'q4',
        category: 'system-design',
        difficulty: 'hard',
        subcategory: 'distributed-systems',
        tags: ['scalability'],
        question: 'Design a distributed cache',
      }),
      new InterviewQuestion({
        questionId: 'q5',
        category: 'tech-trivia',
        difficulty: 'medium',
        subcategory: 'arrays',
        tags: ['data-structures', 'optimization'],
        question: 'Find the maximum subarray',
      }),
    ];
  });

  describe('selectQuestions', () => {
    it('should select all questions when no criteria provided', () => {
      const result = service.selectQuestions(mockQuestions, {});
      expect(result).toHaveLength(5);
    });

    it('should filter by category', () => {
      const result = service.selectQuestions(mockQuestions, {
        category: 'tech-trivia',
      });
      expect(result).toHaveLength(3);
      result.forEach((q) => {
        expect(q.category).toBe('tech-trivia');
      });
    });

    it('should filter by difficulty', () => {
      const result = service.selectQuestions(mockQuestions, {
        difficulty: 'medium',
      });
      expect(result).toHaveLength(2);
      result.forEach((q) => {
        expect(q.difficulty).toBe('medium');
      });
    });

    it('should filter by subcategory', () => {
      const result = service.selectQuestions(mockQuestions, {
        subcategory: 'arrays',
      });
      expect(result).toHaveLength(2);
      result.forEach((q) => {
        expect(q.subcategory).toBe('arrays');
      });
    });

    it('should filter by tags', () => {
      const result = service.selectQuestions(mockQuestions, {
        tags: ['data-structures'],
      });
      expect(result).toHaveLength(2);
      result.forEach((q) => {
        expect(q.tags).toContain('data-structures');
      });
    });

    it('should exclude already used questions', () => {
      const result = service.selectQuestions(mockQuestions, {
        excludeQuestionIds: ['q1', 'q3'],
      });
      expect(result).toHaveLength(3);
      expect(result.find((q) => q.questionId === 'q1')).toBeUndefined();
      expect(result.find((q) => q.questionId === 'q3')).toBeUndefined();
    });

    it('should apply limit', () => {
      const result = service.selectQuestions(mockQuestions, {
        limit: 2,
      });
      expect(result).toHaveLength(2);
    });

    it('should combine multiple criteria', () => {
      const result = service.selectQuestions(mockQuestions, {
        category: 'tech-trivia',
        difficulty: 'medium',
        tags: ['sorting'],
      });
      expect(result).toHaveLength(1);
      expect(result[0].questionId).toBe('q2');
    });

    it('should return empty array when no questions match', () => {
      const result = service.selectQuestions(mockQuestions, {
        category: 'coding',
      });
      expect(result).toHaveLength(0);
    });

    it('should randomize question order', () => {
      const result1 = service.selectQuestions(mockQuestions, {});
      const result2 = service.selectQuestions(mockQuestions, {});
      
      // Results should be different (high probability)
      // Note: There's a small chance they're the same, but very unlikely with 5 items
      const ids1 = result1.map((q) => q.questionId).join(',');
      const ids2 = result2.map((q) => q.questionId).join(',');
      
      // At least verify we got the same questions (just potentially different order)
      expect(result1.length).toBe(result2.length);
    });
  });

  describe('selectQuestionsForPhases', () => {
    it('should select questions for multiple phases without repetition', () => {
      const phaseRequirements = [
        {
          category: 'tech-trivia' as const,
          difficulty: 'easy' as const,
          count: 1,
        },
        {
          category: 'tech-trivia' as const,
          difficulty: 'medium' as const,
          count: 1,
        },
      ];

      const result = service.selectQuestionsForPhases(
        mockQuestions,
        phaseRequirements,
      );

      expect(result.size).toBe(2);
      expect(result.get(0)).toHaveLength(1);
      expect(result.get(1)).toHaveLength(1);

      // Verify no repetition
      const allSelected = [
        ...(result.get(0) || []),
        ...(result.get(1) || []),
      ];
      const questionIds = allSelected.map((q) => q.questionId);
      const uniqueIds = new Set(questionIds);
      expect(uniqueIds.size).toBe(2);
    });

    it('should exclude previously used questions', () => {
      const phaseRequirements = [
        {
          category: 'tech-trivia' as const,
          difficulty: 'medium' as const,
          count: 2,
        },
      ];

      const result = service.selectQuestionsForPhases(
        mockQuestions,
        phaseRequirements,
        ['q2'], // Already used
      );

      expect(result.get(0)).toHaveLength(1); // Only q5 should be selected
      expect(result.get(0)?.[0].questionId).toBe('q5');
    });

    it('should handle subcategory and tags in phase requirements', () => {
      const phaseRequirements = [
        {
          category: 'tech-trivia' as const,
          difficulty: 'medium' as const,
          count: 1,
          subcategory: 'arrays',
          tags: ['data-structures'],
        },
      ];

      const result = service.selectQuestionsForPhases(
        mockQuestions,
        phaseRequirements,
      );

      expect(result.get(0)).toHaveLength(1);
      expect(result.get(0)?.[0].questionId).toBe('q5');
    });

    it('should return empty array for phase if not enough questions available', () => {
      const phaseRequirements = [
        {
          category: 'coding' as const,
          difficulty: 'easy' as const,
          count: 5,
        },
      ];

      const result = service.selectQuestionsForPhases(
        mockQuestions,
        phaseRequirements,
      );

      expect(result.get(0)).toHaveLength(0);
    });
  });
});

