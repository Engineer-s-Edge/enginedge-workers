/**
 * Analytics Controller
 *
 * REST API endpoints for interview analytics and progress tracking
 */

import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { SessionService } from '../../application/services/session.service';
import { EvaluatorService } from '../../application/services/evaluator.service';
import { MongoCodeExecutionRepository } from '../adapters/database/code-execution.repository';
import { IInterviewSessionRepository } from '../../application/ports/repositories.port';

@Controller('sessions')
export class AnalyticsController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly evaluatorService: EvaluatorService,
    private readonly codeExecutionRepository: MongoCodeExecutionRepository,
    @Inject('IInterviewSessionRepository')
    private readonly sessionRepository: IInterviewSessionRepository,
  ) {}

  @Get(':userId/analytics/trends')
  async getScoreTrends(
    @Param('userId') userId: string,
    @Query('days') days: string = '30',
  ): Promise<{
    trends: Array<{
      date: string;
      score: number;
      sessionId: string;
    }>;
    averageScore: number;
  }> {
    // Get all sessions for user (would need to add userId to session entity)
    // For now, return placeholder
    return {
      trends: [],
      averageScore: 0,
    };
  }

  @Get(':userId/analytics/phases')
  async getPhasePerformance(@Param('userId') userId: string): Promise<{
    phases: Array<{
      phaseType: string;
      averageScore: number;
      completionRate: number;
      totalAttempts: number;
    }>;
  }> {
    // Aggregate phase performance across all sessions
    return {
      phases: [],
    };
  }

  @Get(':userId/analytics/time-efficiency')
  async getTimeEfficiency(@Param('userId') userId: string): Promise<{
    averageTimePerQuestion: number;
    timeEfficiencyTrend: Array<{
      date: string;
      efficiency: number;
    }>;
  }> {
    return {
      averageTimePerQuestion: 0,
      timeEfficiencyTrend: [],
    };
  }

  @Get(':userId/analytics/question-types')
  async getQuestionTypePerformance(@Param('userId') userId: string): Promise<{
    byType: Array<{
      type: string;
      averageScore: number;
      totalAttempts: number;
      successRate: number;
    }>;
  }> {
    return {
      byType: [],
    };
  }

  @Get(':sessionId1/compare/:sessionId2')
  async compareSessions(
    @Param('sessionId1') sessionId1: string,
    @Param('sessionId2') sessionId2: string,
  ): Promise<{
    session1: {
      sessionId: string;
      score: number;
    };
    session2: {
      sessionId: string;
      score: number;
    };
    differences: {
      scoreDifference: number;
      improvements: string[];
      degradations: string[];
    };
    summary: string;
  }> {
    const report1 = await this.evaluatorService.getReport(sessionId1);
    const report2 = await this.evaluatorService.getReport(sessionId2);

    if (!report1 || !report2) {
      throw new HttpException(
        'One or both reports not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const score1 = report1.score.overall;
    const score2 = report2.score.overall;
    const scoreDifference = score2 - score1;

    const improvements: string[] = [];
    const degradations: string[] = [];

    if (scoreDifference > 0) {
      improvements.push(`Overall score improved by ${scoreDifference} points`);
    } else if (scoreDifference < 0) {
      degradations.push(
        `Overall score decreased by ${Math.abs(scoreDifference)} points`,
      );
    }

    return {
      session1: {
        sessionId: sessionId1,
        score: score1,
      },
      session2: {
        sessionId: sessionId2,
        score: score2,
      },
      differences: {
        scoreDifference,
        improvements,
        degradations,
      },
      summary: `Session ${sessionId2} scored ${scoreDifference > 0 ? 'higher' : scoreDifference < 0 ? 'lower' : 'the same'} than session ${sessionId1}`,
    };
  }
}
