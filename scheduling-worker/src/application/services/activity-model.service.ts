import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import {
  ActivityPattern,
  ActivityEvent,
  ActivityPatternType,
} from '../../domain/entities';
import { EfficiencyMetrics } from '../../domain/value-objects';
import {
  IActivityPatternRepository,
  IActivityEventRepository,
} from '../ports/repositories.port';
import { PatternAnalyzerService } from './pattern-analyzer.service';
import { PredictionService } from './prediction.service';
import { MetricsAdapter } from '../../infrastructure/adapters/monitoring/metrics.adapter';

export interface CompletionData {
  actualStartTime?: Date;
  actualEndTime?: Date;
  userRating?: number;
  productivityScore?: number;
  interruptions?: number;
}

export interface TimeUsageAnalysis {
  totalTimeScheduled: number; // minutes
  totalTimeSpent: number; // minutes
  totalTimeWasted: number; // minutes
  averageSessionDuration: number; // minutes
  mostActiveHours: number[]; // hours 0-23
  leastActiveHours: number[]; // hours 0-23
  timeByCategory?: Record<string, number>; // minutes by category
}

export interface ProductivityInsights {
  overallProductivityScore: number; // 0-1
  bestProductivityHours: number[]; // hours 0-23
  bestProductivityDays: number[]; // days 0-6
  completionTrend: 'improving' | 'declining' | 'stable';
  recommendations: string[];
}

/**
 * Activity Model Service
 *
 * Main service for tracking user activity, analyzing patterns, and providing insights
 *
 * Application Layer - Activity tracking orchestration
 */
@Injectable()
export class ActivityModelService {
  private readonly logger = new Logger(ActivityModelService.name);

  constructor(
    @Inject('IActivityPatternRepository')
    private readonly patternRepository: IActivityPatternRepository,
    @Inject('IActivityEventRepository')
    private readonly eventRepository: IActivityEventRepository,
    private readonly patternAnalyzer: PatternAnalyzerService,
    private readonly predictionService: PredictionService,
    @Optional()
    private readonly metricsAdapter?: MetricsAdapter,
  ) {
    this.logger.log('ActivityModelService initialized');
  }

  /**
   * Track event completion
   */
  async trackEventCompletion(
    eventId: string,
    userId: string,
    scheduledTime: Date,
    completionData: CompletionData,
  ): Promise<ActivityEvent> {
    this.logger.log(`Tracking completion for event ${eventId}`);

    // Check if event already exists
    let activityEvent = await this.eventRepository.findByEventId(eventId);

    if (!activityEvent) {
      // Create new activity event
      activityEvent = new ActivityEvent(
        this.generateEventId(),
        userId,
        eventId,
        scheduledTime,
        true, // completed
        false, // completedOnTime - Will be calculated
        completionData.actualStartTime,
        completionData.actualEndTime,
        completionData.userRating,
        completionData.productivityScore,
        completionData.interruptions || 0,
        false, // rescheduled
        new Date(), // createdAt
      );
    } else {
      // Update existing event
      activityEvent = activityEvent.markCompleted(
        completionData.actualStartTime,
        completionData.actualEndTime,
        completionData.userRating,
        completionData.productivityScore,
        completionData.interruptions,
      );
    }

    const saved = await this.eventRepository.save(activityEvent);
    this.logger.debug(`Activity event saved: ${saved.id}`);

    // Record metrics
    if (this.metricsAdapter) {
      this.metricsAdapter.incrementActivityEventsTracked();
    }

    // Update activity pattern asynchronously (don't wait)
    this.updateActivityPattern(userId).catch((error) => {
      this.logger.error(
        `Failed to update activity pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    });

    return saved;
  }

  /**
   * Update activity pattern for a user
   */
  async updateActivityPattern(userId: string): Promise<ActivityPattern> {
    this.logger.log(`Updating activity pattern for user ${userId}`);

    // Get all completed events for the user
    const events = await this.eventRepository.findCompletedByUserId(userId);

    if (events.length === 0) {
      this.logger.warn(
        `No events found for user ${userId}, creating default pattern`,
      );
      return this.createDefaultPattern(userId);
    }

    // Analyze patterns
    const hourlyPattern = this.patternAnalyzer.analyzeHourlyPatterns(events);
    const dailyPattern = this.patternAnalyzer.analyzeDailyPatterns(events);

    // Use daily pattern as the main pattern (most comprehensive)
    const pattern = dailyPattern;

    // Check if pattern already exists
    const existingPattern = await this.patternRepository.findByUserId(userId);

    if (existingPattern) {
      // Update existing pattern
      const updated = existingPattern.update({
        preferredHours: pattern.preferredHours,
        preferredDays: pattern.preferredDays,
        productivityScore: pattern.productivityScore,
        completionRate: pattern.completionRate,
        averageFocusDuration: pattern.averageFocusDuration,
        peakProductivityHours: pattern.peakProductivityHours,
      });
      const saved = await this.patternRepository.update(
        existingPattern.id,
        updated,
      );

      // Record metrics
      if (this.metricsAdapter) {
        this.metricsAdapter.incrementActivityPatternsUpdated();
        this.metricsAdapter.setProductivityScore(
          userId,
          saved.productivityScore,
        );
      }

      return saved;
    } else {
      // Create new pattern
      const saved = await this.patternRepository.save(pattern);

      // Record metrics
      if (this.metricsAdapter) {
        this.metricsAdapter.incrementActivityPatternsUpdated();
        this.metricsAdapter.setProductivityScore(
          userId,
          saved.productivityScore,
        );
      }

      return saved;
    }
  }

  /**
   * Predict event success probability
   */
  async predictEventSuccess(eventId: string): Promise<number> {
    this.logger.debug(`Predicting success for event ${eventId}`);

    const event = await this.eventRepository.findByEventId(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    const pattern = await this.patternRepository.findByUserId(event.userId);
    if (!pattern) {
      this.logger.warn(
        `No pattern found for user ${event.userId}, using default prediction`,
      );
      return 0.5; // Default probability
    }

    return await this.predictionService.predictSuccessProbability(
      event,
      pattern,
    );
  }

  /**
   * Calculate schedule efficiency metrics
   */
  async calculateScheduleEfficiency(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<EfficiencyMetrics> {
    this.logger.log(
      `Calculating efficiency for user ${userId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    const events = await this.eventRepository.findByDateRange(
      userId,
      startDate,
      endDate,
    );

    if (events.length === 0) {
      // Return default metrics
      return new EfficiencyMetrics(0, 0, 0, 0, 0, 0, 0);
    }

    const completedEvents = events.filter((e) => e.completed);
    const completionRate = completedEvents.length / events.length;

    // Calculate punctuality rate (completed on time)
    const onTimeCount = completedEvents.filter((e) => e.completedOnTime).length;
    const punctualityRate =
      completedEvents.length > 0 ? onTimeCount / completedEvents.length : 0;

    // Calculate time utilization
    const totalScheduledTime = events.reduce((sum, e) => {
      const duration = e.getScheduledDurationMinutes() || 60;
      return sum + duration;
    }, 0);

    const totalActualTime = completedEvents.reduce((sum, e) => {
      const duration = e.getActualDurationMinutes() || 0;
      return sum + duration;
    }, 0);

    const timeUtilization =
      totalScheduledTime > 0 ? totalActualTime / totalScheduledTime : 0;

    // Calculate average delay
    const delays = completedEvents
      .map((e) => {
        if (!e.actualStartTime) return 0;
        const delay =
          (e.actualStartTime.getTime() - e.scheduledTime.getTime()) /
          (1000 * 60);
        return Math.max(0, delay);
      })
      .filter((d) => d > 0);

    const averageDelay =
      delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;

    // Calculate reschedule frequency (events per week)
    const rescheduledCount = events.filter((e) => e.rescheduled).length;
    const daysDiff =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const weeks = daysDiff / 7;
    const rescheduleFrequency = weeks > 0 ? rescheduledCount / weeks : 0;

    // Calculate productivity score
    const productivityScores = completedEvents
      .map((e) => e.productivityScore)
      .filter((s): s is number => s !== undefined);

    const productivityScore =
      productivityScores.length > 0
        ? productivityScores.reduce((a, b) => a + b, 0) /
          productivityScores.length
        : 0.5;

    // Calculate schedule efficiency (weighted combination)
    const scheduleEfficiency =
      completionRate * 0.4 +
      punctualityRate * 0.3 +
      timeUtilization * 0.2 +
      productivityScore * 0.1;

    return new EfficiencyMetrics(
      scheduleEfficiency,
      timeUtilization,
      completionRate,
      punctualityRate,
      productivityScore,
      averageDelay,
      rescheduleFrequency,
    );
  }

  /**
   * Analyze time usage
   */
  async analyzeTimeUsage(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TimeUsageAnalysis> {
    this.logger.log(
      `Analyzing time usage for user ${userId} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    const events = await this.eventRepository.findByDateRange(
      userId,
      startDate,
      endDate,
    );

    const completedEvents = events.filter((e) => e.completed);

    // Calculate total time
    const totalTimeScheduled = events.reduce((sum, e) => {
      const duration = e.getScheduledDurationMinutes() || 60;
      return sum + duration;
    }, 0);

    const totalTimeSpent = completedEvents.reduce((sum, e) => {
      const duration = e.getActualDurationMinutes() || 0;
      return sum + duration;
    }, 0);

    const totalTimeWasted = totalTimeScheduled - totalTimeSpent;

    // Calculate average session duration
    const durations = completedEvents
      .map((e) => e.getActualDurationMinutes())
      .filter((d): d is number => d !== null);
    const averageSessionDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    // Analyze most/least active hours
    const hourCounts = new Map<number, number>();
    completedEvents.forEach((e) => {
      const hour = e.scheduledTime.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });

    const mostActiveHours = Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => hour);

    const leastActiveHours = Array.from(hourCounts.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([hour]) => hour);

    return {
      totalTimeScheduled,
      totalTimeSpent,
      totalTimeWasted,
      averageSessionDuration,
      mostActiveHours,
      leastActiveHours,
    };
  }

  /**
   * Get user patterns
   */
  async getUserPatterns(userId: string): Promise<ActivityPattern | null> {
    return await this.patternRepository.findByUserId(userId);
  }

  /**
   * Get productivity insights
   */
  async getProductivityInsights(userId: string): Promise<ProductivityInsights> {
    this.logger.log(`Getting productivity insights for user ${userId}`);

    const pattern = await this.patternRepository.findByUserId(userId);
    if (!pattern) {
      throw new Error(`No pattern found for user ${userId}`);
    }

    // Get recent events to analyze trends
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days

    const recentEvents = await this.eventRepository.findByDateRange(
      userId,
      startDate,
      endDate,
    );

    // Calculate completion trend
    const recentCompleted = recentEvents.filter((e) => e.completed).length;
    const olderEvents = await this.eventRepository.findByDateRange(
      userId,
      new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000),
      startDate,
    );
    const olderCompleted = olderEvents.filter((e) => e.completed).length;

    let completionTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentEvents.length > 0 && olderEvents.length > 0) {
      const recentRate = recentCompleted / recentEvents.length;
      const olderRate = olderCompleted / olderEvents.length;
      if (recentRate > olderRate + 0.1) {
        completionTrend = 'improving';
      } else if (recentRate < olderRate - 0.1) {
        completionTrend = 'declining';
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (pattern.completionRate < 0.7) {
      recommendations.push(
        'Consider scheduling tasks during your peak productivity hours for better completion rates.',
      );
    }
    if (pattern.productivityScore < 0.6) {
      recommendations.push(
        'Try scheduling important tasks during your most productive hours.',
      );
    }
    if (pattern.averageFocusDuration < 30) {
      recommendations.push(
        'Consider breaking down longer tasks into smaller, focused sessions.',
      );
    }

    return {
      overallProductivityScore: pattern.productivityScore,
      bestProductivityHours: pattern.peakProductivityHours,
      bestProductivityDays: pattern.preferredDays,
      completionTrend,
      recommendations,
    };
  }

  /**
   * Create default pattern for a user
   */
  private createDefaultPattern(userId: string): ActivityPattern {
    return new ActivityPattern(
      this.generatePatternId(),
      userId,
      'daily',
      [9, 10, 14, 15], // Default preferred hours
      [1, 2, 3, 4, 5], // Weekdays
      0.5, // Default productivity score
      0.5, // Default completion rate
      60, // Default focus duration
      [9, 10], // Default peak hours
      new Date(),
      new Date(),
    );
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `act_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique pattern ID
   */
  private generatePatternId(): string {
    return `act_pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
