import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  RecommendationService,
  MLRecommendation,
  SchedulingFeedback,
  UserPatterns,
} from '../../application/services/recommendation.service';
import { MongoCalendarEventRepository } from '../adapters/persistence/mongo-calendar-event.repository';
import { MLRecommendationService } from '../../application/services/ml-recommendation.service';
import { TaskService } from '../../application/services/task.service';

/**
 * DTOs for ML endpoints
 */
class GetRecommendationsDto {
  userId!: string;
  tasks!: Array<{
    id: string;
    title: string;
    description?: string;
    estimatedDuration: number;
    priority?: 'high' | 'medium' | 'low';
    deadline?: string; // ISO date string
  }>;
  startDate!: string; // ISO date string
  endDate!: string; // ISO date string
}

class SubmitFeedbackDto {
  taskId!: string;
  scheduledSlot!: {
    startTime: string; // ISO date string
    endTime: string; // ISO date string
  };
  mlScore!: number;
  userAccepted!: boolean;
  userRating?: number; // 1-5
  completedOnTime?: boolean;
  actualDuration?: number;
  feedback?: string;
}

/**
 * Infrastructure Controller: ML Scheduling Controller
 *
 * Provides ML-enhanced scheduling recommendations and user feedback endpoints.
 *
 * Endpoints:
 * - POST /ml/recommendations - Get ML-powered task recommendations
 * - POST /ml/feedback - Submit user feedback on scheduled tasks
 * - GET /ml/analysis/:userId - Get user scheduling pattern analysis
 *
 * @hexagonal-layer Infrastructure
 */
@Controller('ml')
export class MLController {
  private readonly logger = new Logger(MLController.name);

  constructor(
    private readonly recommendationService: RecommendationService,
    private readonly calendarRepo: MongoCalendarEventRepository,
    private readonly mlRecommendationService: MLRecommendationService,
    private readonly taskService: TaskService,
  ) {}

  /**
   * Get ML-enhanced scheduling recommendations
   *
   * POST /ml/recommendations
   *
   * Body: {
   *   userId: string,
   *   tasks: Array<{ id, title, description?, estimatedDuration, priority?, deadline? }>,
   *   startDate: ISO string,
   *   endDate: ISO string
   * }
   *
   * Returns: Array<MLRecommendation>
   */
  @Post('recommendations')
  async getRecommendations(
    @Body() dto: GetRecommendationsDto,
  ): Promise<{ recommendations: MLRecommendation[] }> {
    try {
      this.logger.log(
        `Getting ML recommendations for user ${dto.userId}, ${dto.tasks.length} tasks`,
      );

      // Parse dates
      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new HttpException(
          'Invalid date format. Use ISO 8601 format.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Get current calendar events to determine busy times
      // Note: This gets all events for user, then filters by date range
      const allEvents = await this.calendarRepo.findByUserId(dto.userId);
      const calendarEvents = allEvents.filter((event) => {
        return event.startTime < endDate && event.endTime > startDate;
      });

      // Convert task deadlines from strings to Dates
      const tasks = dto.tasks.map((task) => ({
        ...task,
        deadline: task.deadline ? new Date(task.deadline) : undefined,
      }));

      // Get recommendations
      const recommendations =
        await this.recommendationService.getRecommendations(
          dto.userId,
          tasks,
          calendarEvents,
          startDate,
          endDate,
        );

      this.logger.log(`Generated ${recommendations.length} recommendations`);

      return { recommendations };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get recommendations: ${message}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to generate recommendations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Submit feedback on a scheduled task
   *
   * POST /ml/feedback
   *
   * Body: {
   *   taskId: string,
   *   scheduledSlot: { startTime: ISO, endTime: ISO },
   *   mlScore: number,
   *   userAccepted: boolean,
   *   userRating?: number,
   *   completedOnTime?: boolean,
   *   actualDuration?: number,
   *   feedback?: string
   * }
   *
   * Returns: { success: boolean, message: string }
   */
  @Post('feedback')
  async submitFeedback(
    @Body() dto: SubmitFeedbackDto,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Receiving feedback for task ${dto.taskId}`);

      // Validate user rating if provided
      if (
        dto.userRating !== undefined &&
        (dto.userRating < 1 || dto.userRating > 5)
      ) {
        throw new HttpException(
          'User rating must be between 1 and 5',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Parse slot times
      const startTime = new Date(dto.scheduledSlot.startTime);
      const endTime = new Date(dto.scheduledSlot.endTime);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new HttpException(
          'Invalid slot time format. Use ISO 8601 format.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Import TimeSlot class
      const { TimeSlot } = await import(
        '../../domain/value-objects/time-slot.value-object'
      );

      const feedback: SchedulingFeedback = {
        taskId: dto.taskId,
        scheduledSlot: new TimeSlot(startTime, endTime),
        mlScore: dto.mlScore,
        userAccepted: dto.userAccepted,
        userRating: dto.userRating,
        completedOnTime: dto.completedOnTime,
        actualDuration: dto.actualDuration,
        feedback: dto.feedback,
      };

      await this.recommendationService.submitFeedback(feedback);

      return {
        success: true,
        message: 'Feedback submitted successfully',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to submit feedback: ${message}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to submit feedback',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get user scheduling pattern analysis
   *
   * GET /ml/analysis/:userId
   *
   * Returns: {
   *   preferredHours: number[],
   *   mostProductiveHours: number[],
   *   averageTaskDuration: number,
   *   completionRate: number
   * }
   */
  @Get('analysis/:userId')
  async getUserAnalysis(
    @Param('userId') userId: string,
  ): Promise<UserPatterns> {
    try {
      this.logger.log(`Getting analysis for user ${userId}`);

      const patterns =
        await this.recommendationService.analyzeUserPatterns(userId);

      return patterns;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get user analysis: ${message}`);

      throw new HttpException(
        'Failed to retrieve user analysis',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check for ML integration
   *
   * GET /ml/health
   *
   * Returns: { mlServiceAvailable: boolean }
   */
  @Get('health')
  async checkMLHealth(): Promise<{ mlServiceAvailable: boolean }> {
    // Access MLModelClient through RecommendationService
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mlClient = (this.recommendationService as any).mlClient;
    const available = await mlClient.healthCheck();

    return { mlServiceAvailable: available };
  }

  /**
   * ML Task Scheduling - Find optimal time slot for task
   *
   * NOTE: This endpoint is kept for backward compatibility.
   * The main endpoint is at POST /scheduling/tasks/schedule
   */
  @Post('tasks/schedule')
  async scheduleTaskML(
    @Body()
    body: {
      title: string;
      description?: string;
      estimatedDuration: number;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      category?: string;
      dueDate?: string;
      preferences?: {
        preferredHours?: number[];
        preferredDays?: number[];
        avoidConflicts?: boolean;
      };
    },
  ) {
    this.logger.log(`ML scheduling task: ${body.title}`);

    // This would integrate with ML model to find optimal slots
    // For now, return mock recommendations
    const recommendations = [
      {
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(
          Date.now() + 24 * 60 * 60 * 1000 + body.estimatedDuration * 60 * 1000,
        ).toISOString(),
        confidence: 0.85,
        reasoning: 'High availability, optimal productivity time, no conflicts',
      },
    ];

    return {
      recommendations,
      shouldSplit: false,
      splitRecommendation: null,
    };
  }

  /**
   * ML Task Split and Schedule - Split task and schedule parts
   *
   * NOTE: This endpoint is kept for backward compatibility.
   * The main endpoint is at POST /scheduling/tasks/split-schedule
   */
  @Post('tasks/split-schedule')
  async splitAndScheduleTaskML(
    @Body()
    body: {
      title: string;
      description?: string;
      totalDuration: number;
      preferredPartDuration: number;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      category?: string;
      timeRange: {
        start: string;
        end: string;
      };
    },
  ) {
    this.logger.log(`ML splitting and scheduling task: ${body.title}`);

    const numberOfParts = Math.ceil(
      body.totalDuration / body.preferredPartDuration,
    );
    const splitTasks = [];

    for (let i = 0; i < numberOfParts; i++) {
      const startTime = new Date(
        new Date(body.timeRange.start).getTime() + i * 24 * 60 * 60 * 1000,
      );
      startTime.setHours(9, 0, 0, 0);
      const endTime = new Date(
        startTime.getTime() + body.preferredPartDuration * 60 * 1000,
      );

      splitTasks.push({
        id: `task_${Date.now()}_${i}`,
        title: `${body.title} (Part ${i + 1})`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        confidence: 0.8 - i * 0.02,
      });
    }

    return { splitTasks };
  }

  /**
   * Get ML recommendations for task reorganization
   *
   * NOTE: This endpoint is kept for backward compatibility.
   * The main endpoint is at GET /scheduling/recommendations
   */
  @Get('recommendations')
  async getRecommendationsML(
    @Query('userId') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    this.logger.log(`Getting ML recommendations for user ${userId}`);

    const result = await this.mlRecommendationService.generateRecommendations(
      userId,
      new Date(startDate),
      new Date(endDate),
    );

    return result;
  }

  /**
   * Accept ML recommendations
   *
   * NOTE: This endpoint is kept for backward compatibility.
   * The main endpoint is at POST /scheduling/recommendations/accept
   */
  @Post('recommendations/accept')
  async acceptRecommendationsML(
    @Body()
    body: {
      userId: string;
      recommendationIds?: string[];
      allRecommendations: Array<{
        taskId: string;
        originalStartTime: string;
        recommendedStartTime: string;
        originalEndTime: string;
        recommendedEndTime: string;
        reasoning: string;
        confidence: number;
      }>;
    },
  ) {
    this.logger.log(`Accepting recommendations for user ${body.userId}`);

    const recommendations = body.allRecommendations.map((r) => ({
      taskId: r.taskId,
      originalStartTime: new Date(r.originalStartTime),
      recommendedStartTime: new Date(r.recommendedStartTime),
      originalEndTime: new Date(r.originalEndTime),
      recommendedEndTime: new Date(r.recommendedEndTime),
      reasoning: r.reasoning,
      confidence: r.confidence,
    }));

    const result = await this.mlRecommendationService.applyRecommendations(
      body.userId,
      body.recommendationIds || [],
      recommendations,
    );

    return result;
  }
}
