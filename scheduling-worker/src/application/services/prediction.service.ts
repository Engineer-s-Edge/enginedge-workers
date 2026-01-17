import { Injectable, Logger, Inject } from '@nestjs/common';
import { ActivityPattern, ActivityEvent } from '../../domain/entities';
import { MLModelClient } from './ml-model-client.service';

/**
 * Prediction Service
 *
 * Uses ML model to predict event success, optimal times, and completion times
 *
 * Application Layer - ML prediction orchestration
 */
@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);

  constructor(
    @Inject(MLModelClient)
    private readonly mlClient: MLModelClient,
  ) {
    this.logger.log('PredictionService initialized');
  }

  /**
   * Predict success probability for an event
   *
   * @param event - Activity event to predict
   * @param userPattern - User's activity pattern
   * @returns Probability of success (0-1)
   */
  async predictSuccessProbability(
    event: ActivityEvent,
    userPattern: ActivityPattern,
  ): Promise<number> {
    this.logger.debug(
      `Predicting success probability for event ${event.eventId}`,
    );

    try {
      // Check if ML service is available
      const mlAvailable = await this.mlClient.healthCheck();
      if (!mlAvailable) {
        this.logger.warn('ML service unavailable, using fallback prediction');
        return this.fallbackSuccessPrediction(event, userPattern);
      }

      // Prepare features for ML model
      const features = this.extractFeatures(event, userPattern);

      // Call ML service (assuming it has a predict endpoint)
      // For now, we'll use the existing predictOptimalSlots and derive probability
      const hour = event.scheduledTime.getHours();
      const predictions = await this.mlClient.predictOptimalSlots(
        event.userId,
        {
          title: `Event ${event.eventId}`,
          duration: event.getScheduledDurationMinutes() || 60,
        },
      );

      const prediction = predictions.find((p) => p.hour === hour);
      if (prediction) {
        return prediction.probability;
      }

      // Fallback if no matching prediction
      return this.fallbackSuccessPrediction(event, userPattern);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to predict success probability: ${message}, using fallback`,
      );
      return this.fallbackSuccessPrediction(event, userPattern);
    }
  }

  /**
   * Predict optimal time for a task
   *
   * @param task - Task information
   * @param userPattern - User's activity pattern
   * @returns Optimal scheduled time
   */
  async predictOptimalTime(
    task: {
      title: string;
      duration: number; // minutes
      priority?: 'high' | 'medium' | 'low';
    },
    userPattern: ActivityPattern,
  ): Promise<Date> {
    this.logger.debug(`Predicting optimal time for task: ${task.title}`);

    try {
      const mlAvailable = await this.mlClient.healthCheck();
      if (!mlAvailable) {
        return this.fallbackOptimalTime(task, userPattern);
      }

      const predictions = await this.mlClient.predictOptimalSlots(
        userPattern.userId,
        {
          title: task.title,
          duration: task.duration,
          priority: task.priority,
        },
      );

      if (predictions.length > 0) {
        const bestPrediction = predictions.find((p) => p.recommended);
        const prediction = bestPrediction || predictions[0];

        // Create date for today at the recommended hour
        const date = new Date();
        date.setHours(prediction.hour, 0, 0, 0);
        return date;
      }

      return this.fallbackOptimalTime(task, userPattern);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to predict optimal time: ${message}, using fallback`,
      );
      return this.fallbackOptimalTime(task, userPattern);
    }
  }

  /**
   * Predict completion time for a task
   *
   * @param task - Task information
   * @param userPattern - User's activity pattern
   * @returns Predicted completion time in minutes
   */
  async predictCompletionTime(
    task: {
      title: string;
      estimatedDuration: number; // minutes
    },
    userPattern: ActivityPattern,
  ): Promise<number> {
    this.logger.debug(`Predicting completion time for task: ${task.title}`);

    // For now, use average focus duration as a multiplier
    // If user's average focus duration is longer than estimated, use that
    // Otherwise, use estimated duration with a small buffer
    const baseDuration = task.estimatedDuration;
    const avgFocusDuration = userPattern.averageFocusDuration;

    if (avgFocusDuration > 0 && avgFocusDuration > baseDuration) {
      // User typically takes longer, use average
      return Math.ceil(avgFocusDuration * 1.1); // 10% buffer
    }

    // Use estimated duration with productivity score adjustment
    const productivityMultiplier = 1.0 - (userPattern.productivityScore - 0.5);
    return Math.ceil(baseDuration * productivityMultiplier);
  }

  /**
   * Extract features from event and pattern for ML model
   */
  private extractFeatures(
    event: ActivityEvent,
    pattern: ActivityPattern,
  ): Record<string, unknown> {
    const hour = event.scheduledTime.getHours();
    const day = event.scheduledTime.getDay();

    return {
      hour,
      day,
      isPreferredHour: pattern.isPreferredHour(hour),
      isPeakProductivityHour: pattern.isPeakProductivityHour(hour),
      isPreferredDay: pattern.isPreferredDay(day),
      productivityScore: pattern.productivityScore,
      completionRate: pattern.completionRate,
      averageFocusDuration: pattern.averageFocusDuration,
      scheduledDuration: event.getScheduledDurationMinutes() || 60,
    };
  }

  /**
   * Fallback success prediction when ML is unavailable
   */
  private fallbackSuccessPrediction(
    event: ActivityEvent,
    userPattern: ActivityPattern,
  ): number {
    const hour = event.scheduledTime.getHours();
    let probability = 0.5; // Base probability

    // Adjust based on preferred hours
    if (userPattern.isPreferredHour(hour)) {
      probability += 0.2;
    }

    // Adjust based on peak productivity hours
    if (userPattern.isPeakProductivityHour(hour)) {
      probability += 0.15;
    }

    // Adjust based on completion rate
    probability = probability * 0.7 + userPattern.completionRate * 0.3;

    // Adjust based on productivity score
    probability = probability * 0.8 + userPattern.productivityScore * 0.2;

    return Math.min(1, Math.max(0, probability));
  }

  /**
   * Fallback optimal time when ML is unavailable
   */
  private fallbackOptimalTime(
    task: { priority?: 'high' | 'medium' | 'low' },
    userPattern: ActivityPattern,
  ): Date {
    const date = new Date();
    let hour: number;

    // Use peak productivity hours if available
    if (userPattern.peakProductivityHours.length > 0) {
      hour = userPattern.peakProductivityHours[0];
    } else if (userPattern.preferredHours.length > 0) {
      hour = userPattern.preferredHours[0];
    } else {
      // Default to 9 AM
      hour = 9;
    }

    // Adjust for priority (high priority tasks earlier in the day)
    if (task.priority === 'high' && hour > 8) {
      hour = Math.max(8, hour - 1);
    }

    date.setHours(hour, 0, 0, 0);
    return date;
  }
}
