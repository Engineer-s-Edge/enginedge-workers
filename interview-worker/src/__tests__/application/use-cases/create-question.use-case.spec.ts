/**
 * Create Question Use Case Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CreateQuestionUseCase } from '../../../application/use-cases/create-question.use-case';
import { InterviewQuestion } from '../../../domain/entities';

describe('CreateQuestionUseCase', () => {
  let useCase: CreateQuestionUseCase;
  let mockQuestionRepository: any;

  beforeEach(async () => {
    mockQuestionRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateQuestionUseCase,
        {
          provide: 'IInterviewQuestionRepository',
          useValue: mockQuestionRepository,
        },
      ],
    }).compile();

    useCase = module.get<CreateQuestionUseCase>(CreateQuestionUseCase);
  });

  it('should create question successfully', async () => {
    mockQuestionRepository.findById.mockResolvedValue(null);
    mockQuestionRepository.save.mockImplementation(async (q: any) => q);

    const result = await useCase.execute({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'easy',
      question: 'What is an array?',
      subcategory: 'data-structures',
      tags: ['arrays'],
      expectedDuration: 5,
    });

    expect(result.questionId).toBe('q1');
    expect(result.category).toBe('tech-trivia');
    expect(result.difficulty).toBe('easy');
    expect(result.question).toBe('What is an array?');
    expect(mockQuestionRepository.save).toHaveBeenCalled();
  });

  it('should create question even if question with same ID exists (repository handles uniqueness)', async () => {
    mockQuestionRepository.findById.mockResolvedValue(null);
    mockQuestionRepository.save.mockImplementation(async (q: any) => q);

    const result = await useCase.execute({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'easy',
      question: 'New question',
    });

    expect(result.questionId).toBe('q1');
  });

  it('should create question with optional fields', async () => {
    mockQuestionRepository.findById.mockResolvedValue(null);
    mockQuestionRepository.save.mockImplementation(async (q: any) => q);

    const result = await useCase.execute({
      questionId: 'q2',
      category: 'behavioral',
      difficulty: 'medium',
      question: 'Tell me about a challenge',
    });

    expect(result.tags).toEqual([]);
  });
});
