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
  starterCode?: string;
  correctWorkingCode?: string;
}

export class UpdateQuestionDto {
  subcategory?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  question?: string;
  expectedDuration?: number;
  starterCode?: string;
  correctWorkingCode?: string;
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
        starterCode: dto.starterCode,
        correctWorkingCode: dto.correctWorkingCode,
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

  @Get(':questionId/statistics')
  async getQuestionStatistics(
    @Param('questionId') questionId: string,
  ): Promise<{
    questionId: string;
    usageCount: number;
    lastUsedAt?: Date;
    averageScore?: number;
    successRate?: number;
    usageTrend?: Array<{ date: string; count: number }>;
  }> {
    return await this.questionService.getQuestionStatistics(questionId);
  }

  @Get(':questionId')
  async getQuestion(
    @Param('questionId') questionId: string,
  ): Promise<InterviewQuestion | null> {
    return await this.questionService.getQuestion(questionId);
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
    if (dto.starterCode !== undefined) updates.starterCode = dto.starterCode;
    if (dto.correctWorkingCode !== undefined)
      updates.correctWorkingCode = dto.correctWorkingCode;

    return await this.questionService.updateQuestion(questionId, updates);
  }

  @Delete(':questionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuestion(@Param('questionId') questionId: string): Promise<void> {
    await this.questionService.deleteQuestion(questionId);
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  async bulkDeleteQuestions(
    @Body() body: { questionIds: string[] },
  ): Promise<{ success: boolean; deleted: number; errors: any[] }> {
    const errors: any[] = [];
    let deleted = 0;

    for (const questionId of body.questionIds) {
      try {
        const result = await this.questionService.deleteQuestion(questionId);
        if (result) {
          deleted++;
        }
      } catch (error) {
        errors.push({
          questionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { success: errors.length === 0, deleted, errors };
  }

  @Put('bulk-update')
  async bulkUpdateQuestions(
    @Body()
    body: {
      questionIds: string[];
      updates: {
        difficulty?: 'easy' | 'medium' | 'hard';
        tags?: {
          add?: string[];
          remove?: string[];
        };
      };
    },
  ): Promise<{ success: boolean; updated: number; errors: any[] }> {
    const errors: any[] = [];
    let updated = 0;

    for (const questionId of body.questionIds) {
      try {
        const question = await this.questionService.getQuestion(questionId);
        if (!question) {
          errors.push({
            questionId,
            error: 'Question not found',
          });
          continue;
        }

        const updates: Partial<InterviewQuestion> = {};
        if (body.updates.difficulty !== undefined) {
          updates.difficulty = body.updates.difficulty;
        }

        if (body.updates.tags) {
          const currentTags = question.tags || [];
          let newTags = [...currentTags];

          if (body.updates.tags.add) {
            newTags = [...new Set([...newTags, ...body.updates.tags.add])];
          }

          if (body.updates.tags.remove) {
            newTags = newTags.filter(
              (tag) => !body.updates.tags!.remove!.includes(tag),
            );
          }

          updates.tags = newTags;
        }

        const result = await this.questionService.updateQuestion(
          questionId,
          updates,
        );
        if (result) {
          updated++;
        }
      } catch (error) {
        errors.push({
          questionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { success: errors.length === 0, updated, errors };
  }

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  async importQuestions(
    @Body()
    body: {
      questions: Array<{
        questionId: string;
        category: 'tech-trivia' | 'system-design' | 'behavioral' | 'coding';
        subcategory?: string;
        difficulty: 'easy' | 'medium' | 'hard';
        tags?: string[];
        question: string;
        expectedDuration?: number;
        starterCode?: string;
        correctWorkingCode?: string;
      }>;
      options?: {
        skipDuplicates?: boolean;
        updateExisting?: boolean;
      };
    },
  ): Promise<{
    success: boolean;
    imported: number;
    updated: number;
    skipped: number;
    errors: any[];
  }> {
    const errors: any[] = [];
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const questionData of body.questions) {
      try {
        const existing = await this.questionService.getQuestion(
          questionData.questionId,
        );

        if (existing) {
          if (body.options?.updateExisting) {
            await this.questionService.updateQuestion(questionData.questionId, {
              category: questionData.category,
              subcategory: questionData.subcategory,
              difficulty: questionData.difficulty,
              tags: questionData.tags,
              question: questionData.question,
              expectedDuration: questionData.expectedDuration,
              starterCode: questionData.starterCode,
              correctWorkingCode: questionData.correctWorkingCode,
            });
            updated++;
          } else if (body.options?.skipDuplicates) {
            skipped++;
          } else {
            errors.push({
              questionId: questionData.questionId,
              error: 'Question already exists',
            });
          }
        } else {
          await this.questionService.createQuestion(
            questionData.questionId,
            questionData.category,
            questionData.difficulty,
            questionData.question,
            {
              subcategory: questionData.subcategory,
              tags: questionData.tags,
              expectedDuration: questionData.expectedDuration,
              starterCode: questionData.starterCode,
              correctWorkingCode: questionData.correctWorkingCode,
            },
          );
          imported++;
        }
      } catch (error) {
        errors.push({
          questionId: questionData.questionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { success: errors.length === 0, imported, updated, skipped, errors };
  }

  @Get('export')
  async exportQuestions(
    @Query('format') format: 'json' | 'csv' = 'json',
    @Query('includeTestCases') includeTestCases?: string,
    @Query('includeStarterCode') includeStarterCode?: string,
    @Query('includeCorrectWorkingCode') includeCorrectWorkingCode?: string,
  ): Promise<any> {
    const questions = await this.questionService.getAllQuestions();
    const includeTestCasesFlag = includeTestCases === 'true';
    const includeStarterCodeFlag = includeStarterCode === 'true';
    const includeCorrectWorkingCodeFlag = includeCorrectWorkingCode === 'true';

    if (format === 'csv') {
      // Simple CSV export
      const csv = questions
        .map((q) => {
          const row = [
            q.questionId,
            q.category,
            q.difficulty,
            q.question.replace(/\n/g, ' '),
            q.tags?.join(';') || '',
          ];
          if (includeStarterCodeFlag) {
            row.push(q.starterCode?.replace(/\n/g, ' ') || '');
          }
          if (includeCorrectWorkingCodeFlag) {
            row.push(q.correctWorkingCode?.replace(/\n/g, ' ') || '');
          }
          return row.map((cell) => `"${cell}"`).join(',');
        })
        .join('\n');

      const headers = [
        'questionId',
        'category',
        'difficulty',
        'question',
        'tags',
      ];
      if (includeStarterCodeFlag) headers.push('starterCode');
      if (includeCorrectWorkingCodeFlag) headers.push('correctWorkingCode');

      return {
        format: 'csv',
        data: `${headers.join(',')}\n${csv}`,
      };
    }

    // JSON export
    const exportData = questions.map((q) => {
      const data: any = {
        questionId: q.questionId,
        category: q.category,
        subcategory: q.subcategory,
        difficulty: q.difficulty,
        tags: q.tags,
        question: q.question,
        expectedDuration: q.expectedDuration,
      };

      if (includeStarterCodeFlag) {
        data.starterCode = q.starterCode;
      }
      if (includeCorrectWorkingCodeFlag) {
        data.correctWorkingCode = q.correctWorkingCode;
      }
      if (includeTestCasesFlag) {
        // Note: Test cases would need to be loaded separately
        data.testCases = []; // Placeholder
      }

      return data;
    });

    return {
      format: 'json',
      data: exportData,
    };
  }
}
