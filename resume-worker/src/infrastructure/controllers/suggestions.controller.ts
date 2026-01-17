import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { SuggestionsService } from '../../application/services/suggestions.service';

@Controller('resume/suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Post('score-bullet')
  @HttpCode(HttpStatus.OK)
  async scoreBullet(
    @Body() body: { bulletText: string; jobPostingId: string; userId: string },
  ) {
    return this.suggestionsService.scoreBullet(
      body.bulletText,
      body.jobPostingId,
      body.userId,
    );
  }

  @Post('score-resume-with-bullet')
  @HttpCode(HttpStatus.OK)
  async scoreResumeWithBullet(
    @Body()
    body: {
      resumeId: string;
      bulletText: string;
      bulletId?: string;
      targetSection: string;
      targetIndex: number;
      jobPostingId: string;
      replaceExisting: boolean;
      existingBulletId?: string;
    },
  ) {
    return this.suggestionsService.scoreResumeWithBullet(
      body.resumeId,
      body.bulletText,
      body.bulletId,
      body.targetSection,
      body.targetIndex,
      body.jobPostingId,
      body.replaceExisting,
      body.existingBulletId,
    );
  }

  @Post('bullet-improvements')
  @HttpCode(HttpStatus.OK)
  async getBulletImprovements(
    @Body()
    body: {
      resumeId: string;
      bulletText: string;
      jobPostingId?: string;
      minScoreImprovement: number;
      userId: string;
    },
  ) {
    return this.suggestionsService.getBulletImprovements(
      body.resumeId,
      body.bulletText,
      body.jobPostingId,
      body.minScoreImprovement,
      body.userId,
    );
  }

  @Post('bank-swaps')
  @HttpCode(HttpStatus.OK)
  async getBankSwaps(
    @Body()
    body: {
      resumeId: string;
      jobPostingId?: string;
      userId: string;
      minScoreImprovement: number;
      limit: number;
    },
  ) {
    return this.suggestionsService.getBankSwaps(
      body.resumeId,
      body.jobPostingId,
      body.userId,
      body.minScoreImprovement,
      body.limit,
    );
  }
}
