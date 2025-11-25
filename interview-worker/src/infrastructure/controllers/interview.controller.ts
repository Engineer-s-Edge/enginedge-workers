/**
 * Interview Controller
 *
 * REST API endpoints for interview configuration management
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
  HttpException,
} from '@nestjs/common';
import { InterviewService } from '../../application/services/interview.service';
import { CreateInterviewDto } from '../../application/dto/create-interview.dto';
import { Interview } from '../../domain/entities';

@Controller('interviews')
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createInterview(@Body() dto: CreateInterviewDto): Promise<Interview> {
    return await this.interviewService.createInterview(dto);
  }

  @Get()
  async getAllInterviews(
    @Query('userId') userId?: string,
  ): Promise<Interview[] | { interviews: Interview[]; pagination: any }> {
    if (userId) {
      return await this.interviewService.getUserInterviews(userId);
    }
    return await this.interviewService.getAllInterviews();
  }

  @Get('public')
  async getPublicInterviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: 'popular' | 'recent' | 'usage',
    @Query('category') category?: string,
    @Query('difficulty') difficulty?: 'easy' | 'medium' | 'hard',
    @Query('search') search?: string,
  ): Promise<{ interviews: Interview[]; pagination: any }> {
    return await this.interviewService.getPublicInterviews({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sortBy,
      category,
      difficulty,
      search,
    });
  }

  @Get('favorites')
  async getFavoriteInterviews(
    @Query('userId') userId: string,
  ): Promise<{ interviews: Interview[] }> {
    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }
    return await this.interviewService.getFavoriteInterviews(userId);
  }

  @Get(':id')
  async getInterview(@Param('id') id: string): Promise<Interview | null> {
    return await this.interviewService.getInterview(id);
  }

  @Put(':id')
  async updateInterview(
    @Param('id') id: string,
    @Body() updates: Partial<CreateInterviewDto>,
  ): Promise<Interview | null> {
    // Convert DTO to Interview updates
    const interviewUpdates: Partial<Interview> = {};
    if (updates.title !== undefined) interviewUpdates.title = updates.title;
    if (updates.description !== undefined)
      interviewUpdates.description = updates.description;
    if (updates.phases !== undefined) {
      interviewUpdates.phases = updates.phases.map((p) => ({
        phaseId: p.phaseId,
        type: p.type,
        duration: p.duration,
        difficulty: p.difficulty,
        questionCount: p.questionCount,
        tags: p.tags,
        promptOverride: p.promptOverride,
        config: p.config,
      }));
    }
    if (updates.config !== undefined) {
      interviewUpdates.config = {
        allowPause: updates.config.allowPause ?? true,
        maxPauseDuration: updates.config.maxPauseDuration ?? null,
        allowSkip: updates.config.allowSkip ?? true,
        maxSkips: updates.config.maxSkips ?? null,
        totalTimeLimit: updates.config.totalTimeLimit,
      };
    }
    if (updates.rubric !== undefined) interviewUpdates.rubric = updates.rubric;

    return await this.interviewService.updateInterview(id, interviewUpdates);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteInterview(@Param('id') id: string): Promise<void> {
    await this.interviewService.deleteInterview(id);
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  async duplicateInterview(
    @Param('id') id: string,
    @Body() body?: { title?: string; description?: string },
  ): Promise<Interview> {
    const duplicated = await this.interviewService.duplicateInterview(
      id,
      body?.title,
      body?.description,
    );
    if (!duplicated) {
      throw new HttpException('Interview not found', HttpStatus.NOT_FOUND);
    }
    return duplicated;
  }

  @Post(':id/publish')
  async publishInterview(
    @Param('id') id: string,
    @Body() body: { visibility: 'private' | 'public' | 'unlisted' },
  ): Promise<{ id: string; visibility: string; publishedAt?: Date }> {
    const interview = await this.interviewService.publishInterview(
      id,
      body.visibility,
    );
    if (!interview) {
      throw new HttpException('Interview not found', HttpStatus.NOT_FOUND);
    }
    return {
      id: interview.id,
      visibility: interview.visibility,
      publishedAt: interview.publishedAt,
    };
  }

  @Post(':id/unpublish')
  async unpublishInterview(
    @Param('id') id: string,
  ): Promise<{ id: string; visibility: string; publishedAt: null }> {
    const interview = await this.interviewService.publishInterview(
      id,
      'private',
    );
    if (!interview) {
      throw new HttpException('Interview not found', HttpStatus.NOT_FOUND);
    }
    return {
      id: interview.id,
      visibility: interview.visibility,
      publishedAt: null,
    };
  }

  @Post(':id/favorite')
  async favoriteInterview(
    @Param('id') id: string,
    @Body() body: { userId: string },
  ): Promise<{ success: boolean; favoriteCount: number }> {
    const result = await this.interviewService.favoriteInterview(
      id,
      body.userId,
    );
    if (!result) {
      throw new HttpException('Interview not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Delete(':id/favorite')
  async unfavoriteInterview(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<{ success: boolean; favoriteCount: number }> {
    if (!userId) {
      throw new HttpException('userId is required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.interviewService.unfavoriteInterview(id, userId);
    if (!result) {
      throw new HttpException('Interview not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Put(':id/phases/reorder')
  async reorderPhases(
    @Param('id') id: string,
    @Body() body: { phaseOrder: string[] },
  ): Promise<Interview> {
    const interview = await this.interviewService.reorderPhases(
      id,
      body.phaseOrder,
    );
    if (!interview) {
      throw new HttpException('Interview not found', HttpStatus.NOT_FOUND);
    }
    return interview;
  }
}
