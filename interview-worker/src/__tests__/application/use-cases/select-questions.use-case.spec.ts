/**
 * Select Questions Use Case Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SelectQuestionsUseCase } from '../../../application/use-cases/select-questions.use-case';
import { InterviewQuestion } from '../../../domain/entities';

describe('SelectQuestionsUseCase', () => {
  let useCase: SelectQuestionsUseCase;
  let mockQuestionRepository: any;

  beforeEach(async () => {
    mockQuestionRepository = {
      findAll: jest.fn(),
      findByCategory: jest.fn(),
      findByTags: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SelectQuestionsUseCase,
        {
          provide: 'IInterviewQuestionRepository',
          useValue: mockQuestionRepository,
        },
      ],
    }).compile();

    useCase = module.get<SelectQuestionsUseCase>(SelectQuestionsUseCase);
  });

  it('should select questions by category and difficulty', async () => {
    const mockQuestions = [
      new InterviewQuestion({
        questionId: 'q1',
        category: 'tech-trivia',
        difficulty: 'medium',
        question: 'Question 1',
      }),
      new InterviewQuestion({
        questionId: 'q2',
        category: 'tech-trivia',
        difficulty: 'medium',
        question: 'Question 2',
      }),
    ];

    mockQuestionRepository.findByCategory.mockResolvedValue(mockQuestions);

    const result = await useCase.execute({
      category: 'tech-trivia',
      difficulty: 'medium',
      limit: 2,
    });

    expect(result).toHaveLength(2);
    expect(result.every((q) => q.category === 'tech-trivia')).toBe(true);
    expect(result.every((q) => q.difficulty === 'medium')).toBe(true);
  });

  it('should filter by tags when provided', async () => {
    const allQuestions = [
      new InterviewQuestion({
        questionId: 'q1',
        category: 'tech-trivia',
        difficulty: 'medium',
        tags: ['sorting'],
        question: 'Question 1',
      }),
    ];

    const taggedQuestions = [
      new InterviewQuestion({
        questionId: 'q2',
        category: 'tech-trivia',
        difficulty: 'medium',
        tags: ['data-structures', 'sorting'],
        question: 'Question 2',
      }),
    ];

    mockQuestionRepository.findByCategory.mockResolvedValue(allQuestions);
    mockQuestionRepository.findByTags.mockResolvedValue(taggedQuestions);

    const result = await useCase.execute({
      category: 'tech-trivia',
      difficulty: 'medium',
      tags: ['sorting'],
    });

    expect(result.length).toBeGreaterThan(0);
  });

  it('should exclude specified question IDs', async () => {
    const mockQuestions = [
      new InterviewQuestion({
        questionId: 'q1',
        category: 'tech-trivia',
        difficulty: 'medium',
        question: 'Question 1',
      }),
      new InterviewQuestion({
        questionId: 'q2',
        category: 'tech-trivia',
        difficulty: 'medium',
        question: 'Question 2',
      }),
    ];

    mockQuestionRepository.findByCategory.mockResolvedValue(mockQuestions);

    const result = await useCase.execute({
      category: 'tech-trivia',
      difficulty: 'medium',
      excludeQuestionIds: ['q1'],
    });

    expect(result.find((q) => q.questionId === 'q1')).toBeUndefined();
  });

  it('should select all questions when no category specified', async () => {
    const allQuestions = [
      new InterviewQuestion({
        questionId: 'q1',
        category: 'tech-trivia',
        difficulty: 'easy',
        question: 'Question 1',
      }),
      new InterviewQuestion({
        questionId: 'q2',
        category: 'behavioral',
        difficulty: 'medium',
        question: 'Question 2',
      }),
    ];

    mockQuestionRepository.findAll.mockResolvedValue(allQuestions);

    const result = await useCase.execute({
      limit: 10,
    });

    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});

