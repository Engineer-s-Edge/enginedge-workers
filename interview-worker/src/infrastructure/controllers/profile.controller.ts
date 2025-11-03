/**
 * Profile Controller
 *
 * REST API endpoints for candidate profile management
 */

import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CandidateProfileService } from '../../application/services/candidate-profile.service';
import { CandidateProfile } from '../../domain/entities';

export class AppendObservationDto {
  category!: 'strengths' | 'concerns' | 'keyInsights';
  text!: string;
}

export class UpdateResumeFindingsDto {
  type!: 'verified' | 'questioned' | 'deepDived';
  finding!: string;
}

@Controller('sessions/:sessionId/profile')
export class ProfileController {
  constructor(private readonly profileService: CandidateProfileService) {}

  @Get()
  async getProfile(
    @Param('sessionId') sessionId: string,
  ): Promise<CandidateProfile | null> {
    return await this.profileService.getProfile(sessionId);
  }

  @Get('recall')
  async recallProfile(@Param('sessionId') sessionId: string): Promise<{
    strengths: string[];
    concerns: string[];
    resumeFindings: {
      verified: string[];
      questioned: string[];
      deepDived: string[];
    };
    keyInsights: string;
    interviewFlow: {
      pausedAt: string[];
      skippedQuestions: number;
      pauseDuration: number;
    };
  }> {
    return await this.profileService.recallProfile(sessionId);
  }

  @Post('observation')
  async appendObservation(
    @Param('sessionId') sessionId: string,
    @Body() dto: AppendObservationDto,
  ): Promise<CandidateProfile> {
    return await this.profileService.appendObservation(
      sessionId,
      dto.category,
      dto.text,
    );
  }

  @Post('resume-findings')
  async updateResumeFindings(
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateResumeFindingsDto,
  ): Promise<CandidateProfile> {
    return await this.profileService.updateResumeFindings(
      sessionId,
      dto.type,
      dto.finding,
    );
  }
}
