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
  Res,
} from '@nestjs/common';
import { EvaluatorService } from '../../application/services/evaluator.service';
import { InterviewReport } from '../../domain/entities';
import { Response } from 'express';

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
    return await this.evaluatorService.getReport(sessionId);
  }

  /**
   * GET /sessions/:sessionId/report/pdf
   * Get generated report as PDF
   */
  @Get('pdf')
  async getReportPdf(
    @Param('sessionId') sessionId: string,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.evaluatorService.getReport(sessionId);
    if (!report) {
      res.status(HttpStatus.NOT_FOUND).json({ error: 'Report not found' });
      return;
    }

    // Generate PDF from report
    // For now, return JSON. In production, use a PDF library like pdfkit or puppeteer
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="interview-report-${sessionId}.pdf"`,
    );

    // Placeholder: In production, generate actual PDF
    const pdfContent = `Interview Report for Session ${sessionId}\n\n${JSON.stringify(report, null, 2)}`;
    res.send(Buffer.from(pdfContent));
  }

  /**
   * GET /sessions/:sessionId/questions/:questionId/analysis
   * Get detailed question analysis
   */
  @Get('questions/:questionId/analysis')
  async getQuestionAnalysis(
    @Param('sessionId') sessionId: string,
    @Param('questionId') questionId: string,
  ): Promise<{
    questionId: string;
    thoughtProcess?: string;
    communicationAnalysis?: string;
    timeSpent?: number;
    scoreBreakdown?: any;
  }> {
    return await this.evaluatorService.getQuestionAnalysis(
      sessionId,
      questionId,
    );
  }
}
