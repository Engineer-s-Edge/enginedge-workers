/**
 * Question Seed Controller
 * 
 * Endpoint to seed the question bank with sample questions.
 * This is a development/admin endpoint.
 */

import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { QuestionService } from '../../application/services/question.service';
import { createSeedQuestions } from '../adapters/database/question-seed';

@Controller('admin/questions')
export class QuestionSeedController {
  constructor(private readonly questionService: QuestionService) {}

  @Post('seed')
  @HttpCode(HttpStatus.CREATED)
  async seedQuestions(): Promise<{ message: string; count: number }> {
    const seedQuestions = createSeedQuestions();
    let count = 0;

    for (const question of seedQuestions) {
      await this.questionService.createQuestion(
        question.questionId,
        question.category,
        question.difficulty,
        question.question,
        {
          subcategory: question.subcategory,
          tags: question.tags,
          expectedDuration: question.expectedDuration,
        },
      );
      count++;
    }

    return {
      message: `Successfully seeded ${count} questions`,
      count,
    };
  }
}

