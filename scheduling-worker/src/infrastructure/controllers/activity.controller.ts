import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ActivityModelService } from '../../application/services/activity-model.service';
import { ActivityPattern, ActivityEvent } from '../../domain/entities';
import { EfficiencyMetrics } from '../../domain/value-objects';

// DTOs for API documentation
class TrackCompletionDto {
  userId!: string;
  scheduledTime!: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  userRating?: number;
  productivityScore?: number;
  interruptions?: number;
}

class AnalyzeTimeUsageDto {
  userId!: string;
  startDate!: Date;
  endDate!: Date;
}

@ApiTags('Activity')
@Controller('activity')
export class ActivityController {
  private readonly logger = new Logger(ActivityController.name);

  constructor(private readonly activityModelService: ActivityModelService) {}

  @Get('patterns/:userId')
  @ApiOperation({ summary: 'Get user activity patterns' })
  @ApiParam({ name: 'userId', type: String })
  @ApiResponse({
    status: 200,
    description: 'User activity patterns',
    type: ActivityPattern,
  })
  @ApiResponse({ status: 404, description: 'Pattern not found' })
  async getPatterns(
    @Param('userId') userId: string,
  ): Promise<ActivityPattern | null> {
    this.logger.log(`Fetching patterns for user ${userId}`);
    return await this.activityModelService.getUserPatterns(userId);
  }

  @Post('events/:eventId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track event completion' })
  @ApiParam({ name: 'eventId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Event completion tracked',
    type: ActivityEvent,
  })
  async trackEventCompletion(
    @Param('eventId') eventId: string,
    @Body() dto: TrackCompletionDto,
  ): Promise<ActivityEvent> {
    this.logger.log(`Tracking completion for event ${eventId}`);
    return await this.activityModelService.trackEventCompletion(
      eventId,
      dto.userId,
      dto.scheduledTime,
      {
        actualStartTime: dto.actualStartTime,
        actualEndTime: dto.actualEndTime,
        userRating: dto.userRating,
        productivityScore: dto.productivityScore,
        interruptions: dto.interruptions,
      },
    );
  }

  @Get('efficiency/:userId')
  @ApiOperation({ summary: 'Get schedule efficiency metrics' })
  @ApiParam({ name: 'userId', type: String })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Schedule efficiency metrics',
  })
  async getEfficiency(
    @Param('userId') userId: string,
    @Query('startDate') startDateStr: string,
    @Query('endDate') endDateStr: string,
  ): Promise<EfficiencyMetrics> {
    this.logger.log(
      `Fetching efficiency metrics for user ${userId} from ${startDateStr} to ${endDateStr}`,
    );
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    return await this.activityModelService.calculateScheduleEfficiency(
      userId,
      startDate,
      endDate,
    );
  }

  @Get('insights/:userId')
  @ApiOperation({ summary: 'Get productivity insights' })
  @ApiParam({ name: 'userId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Productivity insights',
  })
  async getInsights(@Param('userId') userId: string) {
    this.logger.log(`Fetching insights for user ${userId}`);
    return await this.activityModelService.getProductivityInsights(userId);
  }

  @Get('predict/:eventId')
  @ApiOperation({ summary: 'Predict event success probability' })
  @ApiParam({ name: 'eventId', type: String })
  @ApiResponse({
    status: 200,
    description: 'Event success probability (0-1)',
  })
  async predictEventSuccess(
    @Param('eventId') eventId: string,
  ): Promise<{ eventId: string; probability: number }> {
    this.logger.log(`Predicting success for event ${eventId}`);
    const probability =
      await this.activityModelService.predictEventSuccess(eventId);
    return { eventId, probability };
  }

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Analyze time usage' })
  @ApiResponse({
    status: 200,
    description: 'Time usage analysis',
  })
  async analyzeTimeUsage(@Body() dto: AnalyzeTimeUsageDto) {
    this.logger.log(
      `Analyzing time usage for user ${dto.userId} from ${dto.startDate.toISOString()} to ${dto.endDate.toISOString()}`,
    );
    return await this.activityModelService.analyzeTimeUsage(
      dto.userId,
      dto.startDate,
      dto.endDate,
    );
  }
}
