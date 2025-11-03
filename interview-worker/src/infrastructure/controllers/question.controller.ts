/**
 * Question Controller
 *
 * REST API endpoints for question management
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QuestionService } from '../../application/services/question.service';
import { InterviewQuestion, QuestionCategory } from '../../domain/entities';

export class CreateQuestionDto {
  questionId!: string;
  category!: 'tech-trivia' | 'system-design' | 'behavioral' | 'coding';
  subcategory?: string;
  difficulty!: 'easy' | 'medium' | 'hard';
  tags?: string[];
  question!: string;
  expectedDuration?: number;
}

export class UpdateQuestionDto {
  subcategory?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  question?: string;
  expectedDuration?: number;
}

export class SelectQuestionsQueryDto {
  category?: QuestionCategory;
  difficulty?: 'easy' | 'medium' | 'hard';
  subcategory?: string;
  tags?: string; // Comma-separated tags
  excludeQuestionIds?: string; // Comma-separated question IDs
  limit?: number;
}

@Controller('questions')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createQuestion(
    @Body() dto: CreateQuestionDto,
  ): Promise<InterviewQuestion> {
    return await this.questionService.createQuestion(
      dto.questionId,
      dto.category,
      dto.difficulty,
      dto.question,
      {
        subcategory: dto.subcategory,
        tags: dto.tags,
        expectedDuration: dto.expectedDuration,
      },
    );
  }

  @Get()
  async getQuestions(
    @Query() query: SelectQuestionsQueryDto,
  ): Promise<InterviewQuestion[]> {
    // If selection criteria provided, use selection
    if (query.category || query.difficulty || query.subcategory || query.tags) {
      return await this.questionService.selectQuestions({
        category: query.category,
        difficulty: query.difficulty,
        subcategory: query.subcategory,
        tags: query.tags ? query.tags.split(',') : undefined,
        excludeQuestionIds: query.excludeQuestionIds
          ? query.excludeQuestionIds.split(',')
          : undefined,
        limit: query.limit ? parseInt(query.limit.toString(), 10) : undefined,
      });
    }

    // Otherwise return all questions
    return await this.questionService.getAllQuestions();
  }

  @Get(':questionId')
  async getQuestion(
    @Param('questionId') questionId: string,
  ): Promise<InterviewQuestion | null> {
    return await this.questionService.getQuestion(questionId);
  }

  @Get('category/:category')
  async getQuestionsByCategory(
    @Param('category') category: QuestionCategory,
    @Query('difficulty') difficulty?: 'easy' | 'medium' | 'hard',
  ): Promise<InterviewQuestion[]> {
    return await this.questionService.getQuestionsByCategory(
      category,
      difficulty,
    );
  }

  @Put(':questionId')
  async updateQuestion(
    @Param('questionId') questionId: string,
    @Body() dto: UpdateQuestionDto,
  ): Promise<InterviewQuestion | null> {
    const updates: Partial<InterviewQuestion> = {};
    if (dto.subcategory !== undefined) updates.subcategory = dto.subcategory;
    if (dto.difficulty !== undefined) updates.difficulty = dto.difficulty;
    if (dto.tags !== undefined) updates.tags = dto.tags;
    if (dto.question !== undefined) updates.question = dto.question;
    if (dto.expectedDuration !== undefined)
      updates.expectedDuration = dto.expectedDuration;

    return await this.questionService.updateQuestion(questionId, updates);
  }

  @Delete(':questionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuestion(@Param('questionId') questionId: string): Promise<void> {
    await this.questionService.deleteQuestion(questionId);
  }
}
