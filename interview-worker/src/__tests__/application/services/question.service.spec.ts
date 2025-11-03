/**
 * Question Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { QuestionService } from '../../../application/services/question.service';
import { CreateQuestionUseCase } from '../../../application/use-cases/create-question.use-case';
import { SelectQuestionsUseCase } from '../../../application/use-cases/select-questions.use-case';
import { InterviewQuestion } from '../../../domain/entities';

describe('QuestionService', () => {
  let service: QuestionService;
  let mockQuestionRepository: any;
  let mockCreateQuestionUseCase: any;
  let mockSelectQuestionsUseCase: any;

  beforeEach(async () => {
    mockQuestionRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findByCategory: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    mockCreateQuestionUseCase = {
      execute: jest.fn(),
    };

    mockSelectQuestionsUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionService,
        {
          provide: 'IInterviewQuestionRepository',
          useValue: mockQuestionRepository,
        },
        {
          provide: CreateQuestionUseCase,
          useValue: mockCreateQuestionUseCase,
        },
        {
          provide: SelectQuestionsUseCase,
          useValue: mockSelectQuestionsUseCase,
        },
      ],
    }).compile();

    service = module.get<QuestionService>(QuestionService);
  });

  it('should get question by ID', async () => {
    const mockQuestion = new InterviewQuestion({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'easy',
      question: 'Test question',
    });

    mockQuestionRepository.findById.mockResolvedValue(mockQuestion);

    const result = await service.getQuestion('q1');

    expect(result).toBeDefined();
    expect(result?.questionId).toBe('q1');
  });

  it('should get all questions', async () => {
    const mockQuestions = [
      new InterviewQuestion({
        questionId: 'q1',
        category: 'tech-trivia',
        difficulty: 'easy',
        question: 'Question 1',
      }),
    ];

    mockQuestionRepository.findAll.mockResolvedValue(mockQuestions);

    const result = await service.getAllQuestions();

    expect(result).toHaveLength(1);
  });

  it('should get questions by category', async () => {
    const mockQuestions = [
      new InterviewQuestion({
        questionId: 'q1',
        category: 'tech-trivia',
        difficulty: 'medium',
        question: 'Question 1',
      }),
    ];

    mockQuestionRepository.findByCategory.mockResolvedValue(mockQuestions);

    const result = await service.getQuestionsByCategory(
      'tech-trivia',
      'medium',
    );

    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('tech-trivia');
  });

  it('should create question', async () => {
    const mockQuestion = new InterviewQuestion({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'easy',
      question: 'New question',
    });

    mockCreateQuestionUseCase.execute.mockResolvedValue(mockQuestion);

    const result = await service.createQuestion(
      'q1',
      'tech-trivia',
      'easy',
      'New question',
    );

    expect(result.questionId).toBe('q1');
    expect(mockCreateQuestionUseCase.execute).toHaveBeenCalled();
  });

  it('should delete question', async () => {
    mockQuestionRepository.delete.mockResolvedValue(true);

    const result = await service.deleteQuestion('q1');

    expect(result).toBe(true);
    expect(mockQuestionRepository.delete).toHaveBeenCalledWith('q1');
  });
});
