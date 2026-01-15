import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * ML Model API Response Types
 */
export interface DeliverableMapResponse {
  embedding: number[];
  category: string;
  category_confidence: number;
  urgency: string;
  priority: string;
  estimated_duration_hours: number;
  semantic_features: Record<string, unknown>;
}

export interface SlotRecommendation {
  time_slot: number;
  hour: number;
  probability: number;
  confidence: number;
  recommended: boolean;
}

export interface PredictSlotsResponse {
  recommendations: SlotRecommendation[];
}

export interface FeedbackRequest {
  taskId: string;
  scheduledSlot: {
    startTime: Date;
    endTime: Date;
  };
  mlScore: number;
  userAccepted: boolean;
  userRating?: number;
  completedOnTime?: boolean;
  actualDuration?: number;
  feedback?: string;
}

export interface UserPatternsResponse {
  preferredHours: number[];
  mostProductiveHours: number[];
  averageTaskDuration: number;
  completionRate: number;
}

/**
 * Application Service: ML Model Client
 *
 * Communicates with the external ML service (scheduling-model) to get
 * AI-powered recommendations for task scheduling.
 *
 * Port: Outbound adapter for ML predictions
 *
 * @hexagonal-layer Application
 */
@Injectable()
export class MLModelClient {
  protected readonly logger = new Logger(MLModelClient.name);
  private readonly httpClient: AxiosInstance;
  private readonly mlServiceUrl: string;
  private readonly timeout: number = 10000; // 10 second timeout

  constructor(private readonly configService: ConfigService) {
    // ML service runs on port 8000 in K8s cluster
    this.mlServiceUrl =
      this.configService.get<string>('ML_SERVICE_URL') ||
      'http://scheduling-model:8000';

    this.httpClient = axios.create({
      baseURL: this.mlServiceUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(
      `ML Model Client initialized with URL: ${this.mlServiceUrl}`,
    );
  }

  /**
   * Check if ML service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/health');
      return response.data.status === 'ok' && response.data.models_initialized;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`ML service health check failed: ${message}`);
      return false;
    }
  }

  /**
   * Map a natural language deliverable to structured ML features
   *
   * @param deliverableText - Natural language description of the task
   * @param context - Additional context (priority, etc.)
   * @returns ML-derived features including embedding, category, urgency, duration
   */
  async mapDeliverable(
    deliverableText: string,
    context: Record<string, unknown> = {},
  ): Promise<DeliverableMapResponse> {
    try {
      this.logger.debug(`Mapping deliverable: "${deliverableText}"`);

      const response = await this.httpClient.post<DeliverableMapResponse>(
        '/map-deliverable',
        {
          deliverable_text: deliverableText,
          context,
        },
      );

      this.logger.debug(
        `Deliverable mapped to category: ${response.data.category}, ` +
          `urgency: ${response.data.urgency}, ` +
          `estimated duration: ${response.data.estimated_duration_hours}h`,
      );

      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to map deliverable: ${message}`, stack);
      throw new Error(`ML service unavailable: ${message}`);
    }
  }

  /**
   * Get ML-based time slot predictions for a user and deliverable
   *
   * @param userId - User ID
   * @param deliverable - Task/deliverable information
   * @param context - Additional context
   * @returns Array of slot recommendations with probabilities
   */
  async predictOptimalSlots(
    userId: string,
    deliverable: Record<string, unknown>,
    context: Record<string, unknown> = {},
  ): Promise<SlotRecommendation[]> {
    try {
      this.logger.debug(`Predicting optimal slots for user ${userId}`);

      const response = await this.httpClient.post<PredictSlotsResponse>(
        '/predict-slots',
        {
          user_id: userId,
          deliverable,
          context,
        },
      );

      const recommendations = response.data.recommendations;
      this.logger.debug(
        `Received ${recommendations.length} slot recommendations, ` +
          `${recommendations.filter((r: SlotRecommendation) => r.recommended).length} marked as recommended`,
      );

      return recommendations;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to predict slots: ${message}`, stack);
      throw new Error(`ML service unavailable: ${message}`);
    }
  }

  /**
   * Predict time slots for a task within a date range
   *
   * @param userId - User ID
   * @param taskData - Task information
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @returns Response with slot recommendations
   */
  async predictSlots(
    userId: string,
    taskData: Record<string, unknown>,
    startDate: Date,
    endDate: Date,
  ): Promise<PredictSlotsResponse> {
    try {
      this.logger.debug(
        `Predicting slots for user ${userId} between ${startDate} and ${endDate}`,
      );

      const response = await this.httpClient.post<PredictSlotsResponse>(
        '/predict-slots',
        {
          user_id: userId,
          deliverable: taskData,
          context: {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
          },
        },
      );

      this.logger.debug(
        `Received ${response.data.recommendations.length} slot recommendations`,
      );

      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to predict slots: ${message}`, stack);
      throw new Error(`ML service unavailable: ${message}`);
    }
  }

  /**
   * Get embeddings for multiple tasks at once (batch operation)
   *
   * @param tasks - Array of task descriptions
   * @returns Array of embeddings
   */
  async batchMapDeliverables(
    tasks: Array<{ text: string; context?: Record<string, unknown> }>,
  ): Promise<DeliverableMapResponse[]> {
    try {
      // For now, call sequentially. Could be optimized with Promise.all
      const results: DeliverableMapResponse[] = [];

      for (const task of tasks) {
        try {
          const result = await this.mapDeliverable(task.text, task.context || {});
          results.push(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          this.logger.warn(`Skipping task due to mapping failure: ${message}`);
        }
      }

      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Batch mapping failed: ${message}`, stack);
      throw error;
    }
  }

  /**
   * Submit feedback to ML service for model retraining
   *
   * @param feedback - User feedback on scheduled task
   */
  async submitFeedback(feedback: FeedbackRequest): Promise<void> {
    try {
      this.logger.debug(`Submitting feedback for task ${feedback.taskId}`);

      await this.httpClient.post('/feedback', {
        task_id: feedback.taskId,
        scheduled_slot: {
          start_time: feedback.scheduledSlot.startTime.toISOString(),
          end_time: feedback.scheduledSlot.endTime.toISOString(),
        },
        ml_score: feedback.mlScore,
        user_accepted: feedback.userAccepted,
        user_rating: feedback.userRating,
        completed_on_time: feedback.completedOnTime,
        actual_duration: feedback.actualDuration,
        feedback: feedback.feedback,
      });

      this.logger.debug('Feedback submitted successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to submit feedback: ${message}`, stack);
      throw new Error(`ML service feedback submission failed: ${message}`);
    }
  }

  /**
   * Analyze user's scheduling patterns
   *
   * @param userId - User ID
   * @returns Pattern analysis from ML service
   */
  async analyzeUserPatterns(
    userId: string,
  ): Promise<UserPatternsResponse | null> {
    try {
      this.logger.debug(`Analyzing patterns for user ${userId}`);

      const response = await this.httpClient.get<UserPatternsResponse>(
        `/analyze/${userId}`,
      );

      this.logger.debug(
        `Pattern analysis complete: preferred hours ${response.data.preferredHours.join(', ')}, ` +
          `completion rate ${response.data.completionRate}`,
      );

      return response.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.warn(`Failed to analyze user patterns: ${message}`, stack);
      return null; // Return null to allow fallback
    }
  }

  /**
   * Check if ML service is configured and available
   */
  isAvailable(): boolean {
    return !!this.mlServiceUrl;
  }
}
