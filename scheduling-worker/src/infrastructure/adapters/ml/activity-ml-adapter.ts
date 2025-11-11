import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MLModelClient } from '../../../application/services/ml-model-client.service';
import { ActivityEvent, ActivityPattern } from '../../../domain/entities';

/**
 * Activity ML Adapter
 *
 * Extends MLModelClient for activity-specific predictions
 *
 * Infrastructure Adapter - ML integration for activity model
 */
@Injectable()
export class ActivityMLAdapter extends MLModelClient {
  protected readonly logger = new Logger(ActivityMLAdapter.name);

  constructor(configService: ConfigService) {
    super(configService);
    this.logger.log('ActivityMLAdapter initialized');
  }

  /**
   * Predict event success probability
   *
   * @param features - Features extracted from event and pattern
   * @returns Success probability (0-1)
   */
  async predictEventSuccess(features: {
    hour: number;
    day: number;
    isPreferredHour: boolean;
    isPeakProductivityHour: boolean;
    isPreferredDay: boolean;
    productivityScore: number;
    completionRate: number;
    averageFocusDuration: number;
    scheduledDuration: number;
  }): Promise<number> {
    this.logger.debug('Predicting event success with ML model');

    try {
      // Use the existing predictOptimalSlots endpoint with features
      const predictions = await this.predictOptimalSlots(
        'user', // userId not needed for this prediction
        {
          hour: features.hour,
          day: features.day,
          duration: features.scheduledDuration,
        },
        {
          isPreferredHour: features.isPreferredHour,
          isPeakProductivityHour: features.isPeakProductivityHour,
          isPreferredDay: features.isPreferredDay,
          productivityScore: features.productivityScore,
          completionRate: features.completionRate,
          averageFocusDuration: features.averageFocusDuration,
        },
      );

      // Find prediction for the specific hour
      const prediction = predictions.find((p) => p.hour === features.hour);
      if (prediction) {
        return prediction.probability;
      }

      // Fallback to average probability
      if (predictions.length > 0) {
        const avgProbability =
          predictions.reduce((sum, p) => sum + p.probability, 0) /
          predictions.length;
        return avgProbability;
      }

      // Final fallback
      return 0.5;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to predict event success: ${message}, using fallback`,
      );
      // Fallback calculation
      let probability = 0.5;
      if (features.isPreferredHour) probability += 0.2;
      if (features.isPeakProductivityHour) probability += 0.15;
      probability = probability * 0.7 + features.completionRate * 0.3;
      return Math.min(1, Math.max(0, probability));
    }
  }

  /**
   * Predict optimal time for scheduling
   *
   * @param features - Features for prediction
   * @returns Optimal time as Date
   */
  async predictOptimalTime(features: {
    userId: string;
    taskTitle: string;
    duration: number;
    priority?: 'high' | 'medium' | 'low';
    preferredHours?: number[];
    peakProductivityHours?: number[];
  }): Promise<Date> {
    this.logger.debug('Predicting optimal time with ML model');

    try {
      const predictions = await this.predictOptimalSlots(features.userId, {
        title: features.taskTitle,
        duration: features.duration,
        priority: features.priority,
      });

      if (predictions.length > 0) {
        const bestPrediction = predictions.find((p) => p.recommended);
        const prediction = bestPrediction || predictions[0];

        const date = new Date();
        date.setHours(prediction.hour, 0, 0, 0);
        return date;
      }

      // Fallback to preferred hours
      return this.fallbackOptimalTime(features);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to predict optimal time: ${message}, using fallback`,
      );
      return this.fallbackOptimalTime(features);
    }
  }

  /**
   * Predict completion time for a task
   *
   * @param features - Features for prediction
   * @returns Predicted completion time in minutes
   */
  async predictCompletionTime(features: {
    estimatedDuration: number;
    averageFocusDuration: number;
    productivityScore: number;
  }): Promise<number> {
    this.logger.debug('Predicting completion time with ML model');

    // For now, use a simple calculation based on focus duration and productivity
    // In a full implementation, this would call the ML service
    const baseDuration = features.estimatedDuration;
    const avgFocusDuration = features.averageFocusDuration;

    if (avgFocusDuration > 0 && avgFocusDuration > baseDuration) {
      // User typically takes longer
      return Math.ceil(avgFocusDuration * 1.1);
    }

    // Adjust based on productivity score
    const productivityMultiplier = 1.0 - (features.productivityScore - 0.5);
    return Math.ceil(baseDuration * productivityMultiplier);
  }

  /**
   * Fallback optimal time calculation
   */
  private fallbackOptimalTime(features: {
    peakProductivityHours?: number[];
    preferredHours?: number[];
  }): Date {
    const date = new Date();
    let hour: number;

    if (
      features.peakProductivityHours &&
      features.peakProductivityHours.length > 0
    ) {
      hour = features.peakProductivityHours[0];
    } else if (features.preferredHours && features.preferredHours.length > 0) {
      hour = features.preferredHours[0];
    } else {
      hour = 9; // Default 9 AM
    }

    date.setHours(hour, 0, 0, 0);
    return date;
  }
}
