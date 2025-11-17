import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import {
  ResumeEvaluatorService,
  EvaluateResumeOptions,
} from '../../application/services/resume-evaluator.service';
import { BulletEvaluatorService } from '../../application/services/bullet-evaluator.service';

@Controller('resume/evaluation')
export class EvaluationController {
  constructor(
    private readonly resumeEvaluatorService: ResumeEvaluatorService,
    private readonly bulletEvaluatorService: BulletEvaluatorService,
  ) {}

  @Post('resume/:resumeId')
  async evaluateResume(
    @Param('resumeId') resumeId: string,
    @Body() options: EvaluateResumeOptions,
  ) {
    return this.resumeEvaluatorService.evaluateResume(resumeId, options);
  }

  @Get('resume/:resumeId/reports')
  async getResumeReports(@Param('resumeId') resumeId: string) {
    return this.resumeEvaluatorService.getReportsByResumeId(resumeId);
  }

  @Get('report/:reportId')
  async getReport(@Param('reportId') reportId: string) {
    return this.resumeEvaluatorService.getReportById(reportId);
  }

  @Post('bullet')
  async evaluateBullet(
    @Body()
    body: {
      bulletText: string;
      role?: string;
      useLlm?: boolean;
      generateFixes?: boolean;
    },
  ) {
    return this.bulletEvaluatorService.evaluateBullet(
      body.bulletText,
      body.role,
      body.useLlm,
      body.generateFixes,
    );
  }

  @Post('bullets')
  async evaluateBullets(
    @Body() body: { bullets: string[]; role?: string; useLlm?: boolean },
  ) {
    return this.bulletEvaluatorService.evaluateBullets(
      body.bullets,
      body.role,
      body.useLlm,
    );
  }

  @Get('resume/:resumeId/history')
  async getScoreHistory(
    @Param('resumeId') resumeId: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.resumeEvaluatorService.getScoreHistory(
      resumeId,
      {
        limit: limit ? parseInt(limit, 10) : 20,
        startDate,
        endDate,
      },
    );
  }

  @Get('compare/:reportId1/:reportId2')
  async compareEvaluations(
    @Param('reportId1') reportId1: string,
    @Param('reportId2') reportId2: string,
  ) {
    return this.resumeEvaluatorService.compareEvaluations(reportId1, reportId2);
  }
}
