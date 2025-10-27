import { Injectable, Logger } from '@nestjs/common';
import { MLModelClient } from './ml-model-client.service';
import { TimeSlotService } from './time-slot.service';
import { TaskSchedulerService, Task } from './task-scheduler.service';
import { TimeSlot } from '../../domain/value-objects/time-slot.value-object';
import { CalendarEvent } from '../../domain/entities/calendar-event.entity';

/**
 * ML-Enhanced Recommendation
 */
export interface MLRecommendation {
  task: {
    id: string;
    title: string;
    description?: string;
    estimatedDuration: number;
  };
  recommendedSlot: TimeSlot;
  mlScore: number; // 0-1 from ML model
  ruleBasedScore: number; // Raw score from rule-based scoring
  combinedScore: number; // Weighted combination
  confidence: number;
  reasons: string[];
}

/**
 * Feedback for model improvement
 */
export interface SchedulingFeedback {
  taskId: string;
  scheduledSlot: TimeSlot;
  mlScore: number;
  userAccepted: boolean;
  userRating?: number; // 1-5 stars
  completedOnTime?: boolean;
  actualDuration?: number;
  feedback?: string;
}

/**
 * User Pattern Analysis
 */
export interface UserPatterns {
  preferredHours: number[];
  mostProductiveHours: number[];
  averageTaskDuration: number;
  completionRate: number;
}

/**
 * Application Service: ML-Enhanced Recommendation Service
 * 
 * Combines ML predictions with rule-based scheduling logic to provide
 * intelligent, personalized scheduling recommendations.
 * 
 * Uses hybrid approach:
 * - ML model provides learned user preferences (60% weight)
 * - Rule-based system provides constraints and fallback (40% weight)
 * - Combination produces optimal recommendations
 * 
 * @hexagonal-layer Application
 */
@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);
  private readonly mlWeight = 0.6; // 60% ML, 40% rule-based
  private readonly ruleWeight = 0.4;

  constructor(
    private readonly mlClient: MLModelClient,
    private readonly timeSlotService: TimeSlotService,
    private readonly taskScheduler: TaskSchedulerService,
  ) {}

  /**
   * Get ML-enhanced recommendations for scheduling tasks
   * 
   * @param userId - User ID
   * @param tasks - Tasks to schedule
   * @param calendarEvents - Current calendar events (busy times)
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @returns Array of recommendations sorted by combined score
   */
  async getRecommendations(
    userId: string,
    tasks: Array<{
      id: string;
      title: string;
      description?: string;
      estimatedDuration: number;
      priority?: 'high' | 'medium' | 'low';
      deadline?: Date;
    }>,
    calendarEvents: CalendarEvent[],
    startDate: Date,
    endDate: Date,
  ): Promise<MLRecommendation[]> {
    this.logger.log(
      `Getting ML recommendations for ${tasks.length} tasks from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    // Check if ML service is available
    const mlAvailable = await this.mlClient.healthCheck();

    if (!mlAvailable) {
      this.logger.warn('ML service unavailable, falling back to rule-based only');
      return this.getRuleBasedRecommendations(tasks, calendarEvents, startDate, endDate);
    }

    const recommendations: MLRecommendation[] = [];

    for (const task of tasks) {
      try {
        const recommendation = await this.getTaskRecommendation(
          userId,
          task,
          calendarEvents,
          startDate,
          endDate,
        );
        recommendations.push(recommendation);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to get recommendation for task ${task.id}: ${message}`,
        );
        // Fallback to rule-based for this task
        const fallback = await this.getRuleBasedTaskRecommendation(
          task,
          calendarEvents,
          startDate,
          endDate,
        );
        recommendations.push(fallback);
      }
    }

    // Sort by combined score descending
    recommendations.sort((a, b) => b.combinedScore - a.combinedScore);

    return recommendations;
  }

  /**
   * Get recommendation for a single task using hybrid ML + rule-based approach
   */
  private async getTaskRecommendation(
    userId: string,
    task: {
      id: string;
      title: string;
      description?: string;
      estimatedDuration: number;
      priority?: 'high' | 'medium' | 'low';
      deadline?: Date;
    },
    calendarEvents: CalendarEvent[],
    startDate: Date,
    endDate: Date,
  ): Promise<MLRecommendation> {
    // Get ML predictions
    const mlPredictions = await this.mlClient.predictOptimalSlots(userId, {
      title: task.title,
      description: task.description,
      duration: task.estimatedDuration,
      priority: task.priority,
      deadline: task.deadline?.toISOString(),
    });

    // Get available slots from rule-based system
    const availableSlots = this.timeSlotService.findAvailableSlots(
      calendarEvents,
      startDate,
      endDate,
      {
        minSlotDuration: task.estimatedDuration,
      },
    );

    if (availableSlots.length === 0) {
      throw new Error('No available slots found');
    }

    // Convert task to internal Task type for scoring
    const taskForScoring: Task = {
      id: task.id,
      title: task.title,
      durationMinutes: task.estimatedDuration,
      priority: this.convertPriorityToNumber(task.priority),
      deadline: task.deadline,
      type: 'goal', // Generic type for custom tasks
      sourceId: task.id,
      isRecurring: false,
    };

    // Find best slot combining ML and rule-based scores
    let bestSlot: TimeSlot | null = null;
    let bestMLScore = 0;
    let bestRuleScore = 0;
    let bestCombinedScore = 0;
    let bestConfidence = 0;
    const reasons: string[] = [];

    for (const slot of availableSlots) {
      const slotHour = slot.startTime.getHours();

      // Find matching ML prediction for this hour
      const mlPrediction = mlPredictions.find((p) => p.hour === slotHour);
      const mlScore = mlPrediction?.probability || 0;
      const confidence = mlPrediction?.confidence || 0;

      // Get rule-based score
      const ruleScore = this.taskScheduler['scoreSlot'](taskForScoring, slot);

      // Combined score (weighted average, normalized to 0-1)
      const normalizedRuleScore = Math.max(0, Math.min(1, ruleScore / 200)); // Max rule score is ~200
      const combinedScore =
        this.mlWeight * mlScore + this.ruleWeight * normalizedRuleScore;

      if (combinedScore > bestCombinedScore) {
        bestSlot = slot;
        bestMLScore = mlScore;
        bestRuleScore = ruleScore;
        bestCombinedScore = combinedScore;
        bestConfidence = confidence;
      }
    }

    if (!bestSlot) {
      throw new Error('No suitable slot found');
    }

    // Build explanation reasons
    if (bestMLScore > 0.7) {
      reasons.push('ML model strongly recommends this time');
    }
    if (bestRuleScore > 150) {
      reasons.push('Matches your preferred working hours');
    }
    if (task.priority === 'high') {
      reasons.push('High priority task scheduled early');
    }
    if (bestConfidence > 0.8) {
      reasons.push('High confidence prediction');
    }
    if (reasons.length === 0) {
      reasons.push('Standard scheduling algorithm');
    }

    return {
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        estimatedDuration: task.estimatedDuration,
      },
      recommendedSlot: bestSlot,
      mlScore: bestMLScore,
      ruleBasedScore: bestRuleScore,
      combinedScore: bestCombinedScore,
      confidence: bestConfidence,
      reasons,
    };
  }

  /**
   * Fallback to pure rule-based recommendations when ML is unavailable
   */
  private async getRuleBasedRecommendations(
    tasks: Array<{
      id: string;
      title: string;
      description?: string;
      estimatedDuration: number;
      priority?: 'high' | 'medium' | 'low';
      deadline?: Date;
    }>,
    calendarEvents: CalendarEvent[],
    startDate: Date,
    endDate: Date,
  ): Promise<MLRecommendation[]> {
    const recommendations: MLRecommendation[] = [];

    for (const task of tasks) {
      try {
        const rec = await this.getRuleBasedTaskRecommendation(
          task,
          calendarEvents,
          startDate,
          endDate,
        );
        recommendations.push(rec);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to get rule-based recommendation: ${message}`);
      }
    }

    return recommendations.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  /**
   * Get rule-based recommendation for a single task
   */
  private async getRuleBasedTaskRecommendation(
    task: {
      id: string;
      title: string;
      description?: string;
      estimatedDuration: number;
      priority?: 'high' | 'medium' | 'low';
      deadline?: Date;
    },
    calendarEvents: CalendarEvent[],
    startDate: Date,
    endDate: Date,
  ): Promise<MLRecommendation> {
    const availableSlots = this.timeSlotService.findAvailableSlots(
      calendarEvents,
      startDate,
      endDate,
      {
        minSlotDuration: task.estimatedDuration,
      },
    );

    if (availableSlots.length === 0) {
      throw new Error(`No available slots for task ${task.id}`);
    }

    // Convert to Task type
    const taskForScheduling: Task = {
      id: task.id,
      title: task.title,
      durationMinutes: task.estimatedDuration,
      priority: this.convertPriorityToNumber(task.priority),
      deadline: task.deadline,
      type: 'goal',
      sourceId: task.id,
      isRecurring: false,
    };

    // Find best slot using task scheduler
    let bestSlot = availableSlots[0];
    let bestScore = this.taskScheduler['scoreSlot'](taskForScheduling, bestSlot);

    for (const slot of availableSlots.slice(1)) {
      const score = this.taskScheduler['scoreSlot'](taskForScheduling, slot);
      if (score > bestScore) {
        bestSlot = slot;
        bestScore = score;
      }
    }

    return {
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        estimatedDuration: task.estimatedDuration,
      },
      recommendedSlot: bestSlot,
      mlScore: 0,
      ruleBasedScore: bestScore,
      combinedScore: Math.max(0, Math.min(1, bestScore / 200)), // Normalize to 0-1
      confidence: 0.5, // Moderate confidence for rule-based
      reasons: ['Rule-based scheduling (ML unavailable)'],
    };
  }

  /**
   * Submit feedback to improve ML model
   * 
   * @param feedback - User feedback on scheduled task
   */
  async submitFeedback(feedback: SchedulingFeedback): Promise<void> {
    this.logger.log(
      `Received feedback for task ${feedback.taskId}: ` +
      `accepted=${feedback.userAccepted}, rating=${feedback.userRating}`,
    );

    // TODO: Send feedback to ML service for model retraining
    // This would be an additional endpoint on the ML service
    // For now, just log it
    this.logger.debug('Feedback logged (ML service feedback endpoint not implemented)');
  }

  /**
   * Analyze user's scheduling patterns
   * 
   * @param userId - User ID
   * @returns Pattern analysis
   */
  async analyzeUserPatterns(userId: string): Promise<UserPatterns> {
    this.logger.log(`Analyzing patterns for user ${userId}`);

    // This would integrate with the ML service to get learned patterns
    // For now, return placeholder data
    // TODO: Call ML service /analyze endpoint when available

    return {
      preferredHours: [9, 10, 14, 15],
      mostProductiveHours: [9, 10],
      averageTaskDuration: 60,
      completionRate: 0.85,
    };
  }

  /**
   * Convert string priority to number (1-5)
   */
  private convertPriorityToNumber(priority?: 'high' | 'medium' | 'low'): number {
    switch (priority) {
      case 'high':
        return 5;
      case 'medium':
        return 3;
      case 'low':
        return 1;
      default:
        return 3;
    }
  }
}
