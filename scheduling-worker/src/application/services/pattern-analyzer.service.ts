import { Injectable, Logger } from '@nestjs/common';
import {
  ActivityPattern,
  ActivityPatternType,
  ActivityEvent,
} from '../../domain/entities';

/**
 * Pattern Analyzer Service
 *
 * Analyzes activity events to extract patterns
 *
 * Application Layer - Pattern analysis logic
 */
@Injectable()
export class PatternAnalyzerService {
  private readonly logger = new Logger(PatternAnalyzerService.name);

  constructor() {
    this.logger.log('PatternAnalyzerService initialized');
  }

  /**
   * Analyze hourly patterns from events
   */
  analyzeHourlyPatterns(events: ActivityEvent[]): ActivityPattern {
    if (events.length === 0) {
      throw new Error('Cannot analyze patterns from empty event list');
    }

    const userId = events[0].userId;
    const completedEvents = events.filter((e) => e.completed);

    // Analyze preferred hours (hours with most completions)
    const hourCounts = new Map<number, number>();
    completedEvents.forEach((event) => {
      const hour = event.scheduledTime.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });

    const preferredHours = Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour]) => hour);

    // Analyze peak productivity hours (hours with highest productivity scores)
    const productivityByHour = new Map<number, number[]>();
    completedEvents.forEach((event) => {
      if (event.productivityScore !== undefined) {
        const hour = event.scheduledTime.getHours();
        if (!productivityByHour.has(hour)) {
          productivityByHour.set(hour, []);
        }
        productivityByHour.get(hour)!.push(event.productivityScore);
      }
    });

    const peakProductivityHours = Array.from(productivityByHour.entries())
      .map(([hour, scores]) => ({
        hour,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3)
      .map(({ hour }) => hour);

    // Calculate completion rate
    const completionRate = completedEvents.length / events.length;

    // Calculate average focus duration
    const durations = completedEvents
      .map((e) => e.getActualDurationMinutes())
      .filter((d): d is number => d !== null);
    const averageFocusDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    // Calculate productivity score (average of all productivity scores)
    const productivityScores = completedEvents
      .map((e) => e.productivityScore)
      .filter((s): s is number => s !== undefined);
    const productivityScore =
      productivityScores.length > 0
        ? productivityScores.reduce((a, b) => a + b, 0) /
          productivityScores.length
        : 0.5; // Default to 0.5 if no scores

    return new ActivityPattern(
      this.generateId(),
      userId,
      'hourly',
      preferredHours.length > 0 ? preferredHours : [9, 10, 14, 15], // Default hours
      [0, 1, 2, 3, 4, 5, 6], // All days by default
      productivityScore,
      completionRate,
      averageFocusDuration,
      peakProductivityHours.length > 0
        ? peakProductivityHours
        : preferredHours.slice(0, 3), // Fallback to preferred hours
      new Date(),
      new Date(),
    );
  }

  /**
   * Analyze daily patterns from events
   */
  analyzeDailyPatterns(events: ActivityEvent[]): ActivityPattern {
    if (events.length === 0) {
      throw new Error('Cannot analyze patterns from empty event list');
    }

    const userId = events[0].userId;
    const completedEvents = events.filter((e) => e.completed);

    // Analyze preferred days (days with most completions)
    const dayCounts = new Map<number, number>();
    completedEvents.forEach((event) => {
      const day = event.scheduledTime.getDay();
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    });

    const preferredDays = Array.from(dayCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([day]) => day);

    // Use hourly analysis for hours
    const hourlyPattern = this.analyzeHourlyPatterns(events);

    return new ActivityPattern(
      this.generateId(),
      userId,
      'daily',
      hourlyPattern.preferredHours,
      preferredDays.length > 0 ? preferredDays : [1, 2, 3, 4, 5], // Default weekdays
      hourlyPattern.productivityScore,
      hourlyPattern.completionRate,
      hourlyPattern.averageFocusDuration,
      hourlyPattern.peakProductivityHours,
      new Date(),
      new Date(),
    );
  }

  /**
   * Analyze weekly patterns from events
   */
  analyzeWeeklyPatterns(events: ActivityEvent[]): ActivityPattern {
    if (events.length === 0) {
      throw new Error('Cannot analyze patterns from empty event list');
    }

    // Weekly patterns are similar to daily but aggregated over weeks
    const dailyPattern = this.analyzeDailyPatterns(events);

    return new ActivityPattern(
      this.generateId(),
      dailyPattern.userId,
      'weekly',
      dailyPattern.preferredHours,
      dailyPattern.preferredDays,
      dailyPattern.productivityScore,
      dailyPattern.completionRate,
      dailyPattern.averageFocusDuration,
      dailyPattern.peakProductivityHours,
      new Date(),
      new Date(),
    );
  }

  /**
   * Detect peak productivity hours from events
   */
  detectPeakHours(events: ActivityEvent[]): number[] {
    const completedEvents = events.filter(
      (e) => e.completed && e.productivityScore !== undefined,
    );

    if (completedEvents.length === 0) {
      return [9, 10, 14, 15]; // Default peak hours
    }

    const productivityByHour = new Map<number, number[]>();
    completedEvents.forEach((event) => {
      const hour = event.scheduledTime.getHours();
      if (!productivityByHour.has(hour)) {
        productivityByHour.set(hour, []);
      }
      productivityByHour.get(hour)!.push(event.productivityScore!);
    });

    return Array.from(productivityByHour.entries())
      .map(([hour, scores]) => ({
        hour,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 3)
      .map(({ hour }) => hour);
  }

  /**
   * Calculate productivity score from events
   */
  calculateProductivityScore(events: ActivityEvent[]): number {
    const completedEvents = events.filter(
      (e) => e.completed && e.productivityScore !== undefined,
    );

    if (completedEvents.length === 0) {
      return 0.5; // Default score
    }

    const scores = completedEvents.map((e) => e.productivityScore!);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Calculate completion rate from events
   */
  calculateCompletionRate(events: ActivityEvent[]): number {
    if (events.length === 0) {
      return 0;
    }

    const completedCount = events.filter((e) => e.completed).length;
    return completedCount / events.length;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `act_pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
