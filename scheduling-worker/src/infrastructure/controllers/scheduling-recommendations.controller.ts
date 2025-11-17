import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { MLRecommendationService } from '../../application/services/ml-recommendation.service';

/**
 * Scheduling Recommendations Controller
 *
 * REST API endpoints for ML recommendations
 *
 * Infrastructure Layer - HTTP adapter
 */
@ApiTags('Scheduling Recommendations')
@Controller('scheduling/recommendations')
export class SchedulingRecommendationsController {
  private readonly logger = new Logger(SchedulingRecommendationsController.name);

  constructor(private readonly mlRecommendationService: MLRecommendationService) {
    this.logger.log('SchedulingRecommendationsController initialized');
  }

  /**
   * Get ML recommendations for task reorganization
   */
  @Get()
  @ApiOperation({ summary: 'Get ML recommendations for task reorganization' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiResponse({ status: 200, description: 'Recommendations retrieved' })
  async getRecommendations(
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
   */
  @Post('accept')
  @ApiOperation({ summary: 'Accept ML recommendations and apply to tasks' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userId', 'allRecommendations'],
      properties: {
        userId: { type: 'string' },
        recommendationIds: { type: 'array', items: { type: 'string' } },
        allRecommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              originalStartTime: { type: 'string', format: 'date-time' },
              recommendedStartTime: { type: 'string', format: 'date-time' },
              originalEndTime: { type: 'string', format: 'date-time' },
              recommendedEndTime: { type: 'string', format: 'date-time' },
              reasoning: { type: 'string' },
              confidence: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Recommendations accepted' })
  async acceptRecommendations(
    @Body() body: {
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
