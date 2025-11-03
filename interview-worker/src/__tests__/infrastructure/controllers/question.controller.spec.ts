/**
 * Question Controller Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { QuestionController } from '../../../../infrastructure/controllers/question.controller';
import { QuestionService } from '../../../../application/services/question.service';
import { InterviewQuestion } from '../../../../domain/entities';

describe('QuestionController', () => {
  let controller: QuestionController;
  let mockQuestionService: any;

  beforeEach(async () => {
    mockQuestionService = {
      createQuestion: jest.fn(),
      getAllQuestions: jest.fn(),
      getQuestion: jest.fn(),
      getQuestionsByCategory: jest.fn(),
      selectQuestions: jest.fn(),
      updateQuestion: jest.fn(),
      deleteQuestion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionController],
      providers: [
        {
          provide: QuestionService,
          useValue: mockQuestionService,
        },
      ],
    }).compile();

    controller = module.get<QuestionController>(QuestionController);
  });

  it('should create question', async () => {
    const mockQuestion = new InterviewQuestion({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'easy',
      question: 'Test question',
    });

    mockQuestionService.createQuestion.mockResolvedValue(mockQuestion);

    const result = await controller.createQuestion({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'easy',
      question: 'Test question',
    });

    expect(result.questionId).toBe('q1');
    expect(mockQuestionService.createQuestion).toHaveBeenCalled();
  });

  it('should get all questions when no query params', async () => {
    const mockQuestions = [
      new InterviewQuestion({
        questionId: 'q1',
        category: 'tech-trivia',
        difficulty: 'easy',
        question: 'Question 1',
      }),
    ];

    mockQuestionService.getAllQuestions.mockResolvedValue(mockQuestions);

    const result = await controller.getQuestions({});

    expect(result).toHaveLength(1);
    expect(mockQuestionService.getAllQuestions).toHaveBeenCalled();
  });

  it('should select questions when query params provided', async () => {
    const mockQuestions = [
      new InterviewQuestion({
        questionId: 'q1',
        category: 'tech-trivia',
        difficulty: 'medium',
        question: 'Question 1',
      }),
    ];

    mockQuestionService.selectQuestions.mockResolvedValue(mockQuestions);

    const result = await controller.getQuestions({
      category: 'tech-trivia',
      difficulty: 'medium',
    });

    expect(result).toHaveLength(1);
    expect(mockQuestionService.selectQuestions).toHaveBeenCalled();
  });

  it('should get question by ID', async () => {
    const mockQuestion = new InterviewQuestion({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'easy',
      question: 'Test question',
    });

    mockQuestionService.getQuestion.mockResolvedValue(mockQuestion);

    const result = await controller.getQuestion('q1');

    expect(result?.questionId).toBe('q1');
    expect(mockQuestionService.getQuestion).toHaveBeenCalledWith('q1');
  });

  it('should get questions by category', async () => {
    const mockQuestions = [
      new InterviewQuestion({
        questionId: 'q1',
        category: 'tech-trivia',
        difficulty: 'easy',
        question: 'Question 1',
      }),
    ];

    mockQuestionService.getQuestionsByCategory.mockResolvedValue(mockQuestions);

    const result = await controller.getQuestionsByCategory(
      'tech-trivia',
      'easy',
    );

    expect(result).toHaveLength(1);
    expect(mockQuestionService.getQuestionsByCategory).toHaveBeenCalledWith(
      'tech-trivia',
      'easy',
    );
  });

  it('should update question', async () => {
    const updatedQuestion = new InterviewQuestion({
      questionId: 'q1',
      category: 'tech-trivia',
      difficulty: 'medium',
      question: 'Updated question',
    });

    mockQuestionService.updateQuestion.mockResolvedValue(updatedQuestion);

    const result = await controller.updateQuestion('q1', {
      difficulty: 'medium',
      question: 'Updated question',
    });

    expect(result?.difficulty).toBe('medium');
    expect(mockQuestionService.updateQuestion).toHaveBeenCalled();
  });

  it('should delete question', async () => {
    mockQuestionService.deleteQuestion.mockResolvedValue(true);

    await controller.deleteQuestion('q1');

    expect(mockQuestionService.deleteQuestion).toHaveBeenCalledWith('q1');
  });
});
