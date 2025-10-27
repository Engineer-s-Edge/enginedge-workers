import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
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
      const calendarEvents = allEvents.filter(event => {
        return event.startTime < endDate && event.endTime > startDate;
      });

      // Convert task deadlines from strings to Dates
      const tasks = dto.tasks.map((task) => ({
        ...task,
        deadline: task.deadline ? new Date(task.deadline) : undefined,
      }));

      // Get recommendations
      const recommendations = await this.recommendationService.getRecommendations(
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
      if (dto.userRating !== undefined && (dto.userRating < 1 || dto.userRating > 5)) {
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
      const { TimeSlot } = await import('../../domain/value-objects/time-slot.value-object');
      
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

      const patterns = await this.recommendationService.analyzeUserPatterns(userId);

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
}
