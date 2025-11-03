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
  HttpCode,
  HttpStatus,
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
  async getAllInterviews(): Promise<Interview[]> {
    return await this.interviewService.getAllInterviews();
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
}
