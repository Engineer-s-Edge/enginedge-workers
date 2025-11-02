/**
 * Report Controller
 * 
 * REST API endpoints for interview report management
 */

import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EvaluatorService } from '../../application/services/evaluator.service';
import { InterviewReport } from '../../domain/entities';

@Controller('sessions/:sessionId/report')
export class ReportController {
  constructor(private readonly evaluatorService: EvaluatorService) {}

  /**
   * POST /sessions/:sessionId/report/generate
   * Generate report on candidate request
   */
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generateReport(
    @Param('sessionId') sessionId: string,
  ): Promise<InterviewReport> {
    return await this.evaluatorService.generateReport(sessionId);
  }

  /**
   * GET /sessions/:sessionId/report
   * Get generated report
   */
  @Get()
  async getReport(
    @Param('sessionId') sessionId: string,
  ): Promise<InterviewReport | null> {
    // The evaluator service will check for existing report
    return await this.evaluatorService.generateReport(sessionId);
  }
}

