/**
 * Question Seed Controller Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { QuestionSeedController } from '../../../../infrastructure/controllers/question-seed.controller';
import { QuestionService } from '../../../../application/services/question.service';

describe('QuestionSeedController', () => {
  let controller: QuestionSeedController;
  let mockQuestionService: any;

  beforeEach(async () => {
    mockQuestionService = {
      createQuestion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionSeedController],
      providers: [
        {
          provide: QuestionService,
          useValue: mockQuestionService,
        },
      ],
    }).compile();

    controller = module.get<QuestionSeedController>(QuestionSeedController);
  });

  it('should seed questions', async () => {
    mockQuestionService.createQuestion.mockResolvedValue({ questionId: 'q1' });

    const result = await controller.seedQuestions();

    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('count');
    expect(result.count).toBeGreaterThan(0);
    expect(mockQuestionService.createQuestion).toHaveBeenCalled();
  });
});

