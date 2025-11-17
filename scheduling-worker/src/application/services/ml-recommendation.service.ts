import { Injectable, Logger, Inject } from '@nestjs/common';
import { Task } from '../../domain/entities';
import { ITaskRepository } from '../ports/repositories.port';
import { MongoDayLockRepository } from '../../infrastructure/adapters/persistence/mongo-day-lock.repository';
import { MLModelClient } from './ml-model-client.service';
import { SchedulingRulesService } from '../../domain/services/scheduling-rules.service';

/**
 * Task Reorganization Recommendation
 */
export interface TaskRecommendation {
  taskId: string;
  originalStartTime: Date;
  recommendedStartTime: Date;
  originalEndTime: Date;
  recommendedEndTime: Date;
  reasoning: string;
  confidence: number;
}

export interface RecommendationSummary {
  totalTasks: number;
  recommendedTasks: number;
  lockedTasks: number;
  improvementScore: number;
}

/**
 * ML Recommendation Service
 *
 * Generates ML recommendations for task reorganization
 *
 * Application Layer - Orchestrates domain logic
 */
@Injectable()
export class MLRecommendationService {
  private readonly logger = new Logger(MLRecommendationService.name);

  constructor(
    @Inject('ITaskRepository')
    private readonly taskRepository: ITaskRepository,
    private readonly dayLockRepository: MongoDayLockRepository,
    private readonly mlModelClient: MLModelClient,
    private readonly schedulingRules: SchedulingRulesService,
  ) {
    this.logger.log('MLRecommendationService initialized');
  }

  /**
   * Generate recommendations for task reorganization in time range
   */
  async generateRecommendations(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    recommendations: TaskRecommendation[];
    summary: RecommendationSummary;
  }> {
    this.logger.log(`Generating recommendations for user ${userId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get all unlocked tasks in range
    const allTasks = await this.taskRepository.findByDateRange(startDate, endDate, userId);
    const unlockedTasks = allTasks.filter((t) => !t.isLocked);

    // Get locked days
    const lockedDays = await this.dayLockRepository.getLockedDays(userId, startDate, endDate);
    const lockedDayStrings = new Set(lockedDays.map((d) => d.toISOString().split('T')[0]));

    // Filter out tasks on locked days
    const tasksToRecommend = unlockedTasks.filter((t) => {
      const taskDate = t.startTime.toISOString().split('T')[0];
      return !lockedDayStrings.has(taskDate);
    });

    const recommendations: TaskRecommendation[] = [];

    // For each task, find better time slots using ML
    for (const task of tasksToRecommend) {
      try {
        const recommendation = await this.recommendTaskTime(task, userId, startDate, endDate, allTasks);
        if (recommendation) {
          recommendations.push(recommendation);
        }
      } catch (error) {
        this.logger.warn(`Failed to generate recommendation for task ${task.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Calculate summary
    const summary: RecommendationSummary = {
      totalTasks: allTasks.length,
      recommendedTasks: recommendations.length,
      lockedTasks: allTasks.length - unlockedTasks.length,
      improvementScore: this.calculateImprovementScore(recommendations),
    };

    return { recommendations, summary };
  }

  /**
   * Recommend better time for a task
   */
  private async recommendTaskTime(
    task: Task,
    userId: string,
    startDate: Date,
    endDate: Date,
    existingTasks: Task[],
  ): Promise<TaskRecommendation | null> {
    // Use ML model to predict optimal time
    const mlAvailable = await this.mlModelClient.healthCheck();

    if (!mlAvailable) {
      // Fallback to rule-based recommendation
      return this.ruleBasedRecommendation(task, startDate, endDate, existingTasks);
    }

    try {
      // Get ML predictions for optimal time slots
      const taskData = {
        title: task.title,
        description: task.description || '',
        estimatedDuration: task.estimatedDuration || task.getDurationMinutes(),
        priority: task.priority || 'medium',
        category: task.category || 'general',
      };

      // Call ML service to get slot recommendations
      const mlResponse = await this.mlModelClient.predictSlots(userId, taskData, startDate, endDate);

      if (!mlResponse || !mlResponse.recommendations || mlResponse.recommendations.length === 0) {
        return this.ruleBasedRecommendation(task, startDate, endDate, existingTasks);
      }

      // Find best recommended slot
      const bestSlot = mlResponse.recommendations
        .filter((r) => r.recommended)
        .sort((a, b) => b.probability - a.probability)[0];

      if (!bestSlot) {
        return this.ruleBasedRecommendation(task, startDate, endDate, existingTasks);
      }

      // Convert hour to actual datetime
      const recommendedDate = new Date(startDate);
      recommendedDate.setHours(bestSlot.hour, 0, 0, 0);
      const recommendedEnd = new Date(recommendedDate);
      recommendedEnd.setMinutes(recommendedEnd.getMinutes() + (task.estimatedDuration || task.getDurationMinutes()));

      // Validate against scheduling rules
      const existingTaskData = existingTasks
        .filter((t) => t.id !== task.id)
        .map((t) => ({ startTime: t.startTime, endTime: t.endTime, isLocked: t.isLocked }));

      const validation = this.schedulingRules.validateTaskSchedule(
        recommendedDate,
        recommendedEnd,
        existingTaskData,
      );

      if (!validation.valid) {
        // Try rule-based if ML recommendation is invalid
        return this.ruleBasedRecommendation(task, startDate, endDate, existingTasks);
      }

      return {
        taskId: task.id,
        originalStartTime: task.startTime,
        recommendedStartTime: recommendedDate,
        originalEndTime: task.endTime,
        recommendedEndTime: recommendedEnd,
        reasoning: `ML-optimized time slot based on productivity patterns. Confidence: ${(bestSlot.confidence * 100).toFixed(1)}%`,
        confidence: bestSlot.confidence,
      };
    } catch (error) {
      this.logger.warn(`ML recommendation failed for task ${task.id}, using rule-based: ${error instanceof Error ? error.message : String(error)}`);
      return this.ruleBasedRecommendation(task, startDate, endDate, existingTasks);
    }
  }

  /**
   * Rule-based recommendation (fallback)
   */
  private ruleBasedRecommendation(
    task: Task,
    startDate: Date,
    endDate: Date,
    existingTasks: Task[],
  ): TaskRecommendation | null {
    const duration = task.estimatedDuration || task.getDurationMinutes();
    const existingTaskData = existingTasks
      .filter((t) => t.id !== task.id)
      .map((t) => ({ startTime: t.startTime, endTime: t.endTime, isLocked: t.isLocked }));

    // Find available slots
    const slots = this.schedulingRules.findAvailableSlots(
      task.startTime,
      duration,
      existingTaskData,
    );

    if (slots.length === 0) {
      return null; // No better slot found
    }

    // Use first available slot
    const bestSlot = slots[0];

    return {
      taskId: task.id,
      originalStartTime: task.startTime,
      recommendedStartTime: bestSlot.startTime,
      originalEndTime: task.endTime,
      recommendedEndTime: bestSlot.endTime,
      reasoning: 'Rule-based recommendation: better availability, no conflicts',
      confidence: 0.7, // Lower confidence for rule-based
    };
  }

  /**
   * Calculate improvement score
   */
  private calculateImprovementScore(recommendations: TaskRecommendation[]): number {
    if (recommendations.length === 0) {
      return 0;
    }

    // Average confidence weighted by number of recommendations
    const avgConfidence = recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length;
    const coverage = recommendations.length / Math.max(recommendations.length, 1);

    return Math.min(avgConfidence * coverage, 1.0);
  }

  /**
   * Apply recommendations to tasks
   */
  async applyRecommendations(
    userId: string,
    recommendationIds: string[],
    allRecommendations: TaskRecommendation[],
  ): Promise<{
    accepted: number;
    failed: number;
    updatedTasks: Array<{
      taskId: string;
      oldStartTime: Date;
      newStartTime: Date;
    }>;
  }> {
    this.logger.log(`Applying ${recommendationIds.length} recommendations for user ${userId}`);

    const recommendationsToApply = recommendationIds.length > 0
      ? allRecommendations.filter((r) => recommendationIds.includes(r.taskId))
      : allRecommendations;

    const updatedTasks: Array<{
      taskId: string;
      oldStartTime: Date;
      newStartTime: Date;
    }> = [];

    let accepted = 0;
    let failed = 0;

    for (const recommendation of recommendationsToApply) {
      try {
        const task = await this.taskRepository.findById(recommendation.taskId);
        if (!task) {
          failed++;
          continue;
        }

        // Check if task is still unlocked
        if (task.isLocked) {
          failed++;
          continue;
        }

        // Check if day is still unlocked
        const taskDate = task.startTime.toISOString().split('T')[0];
        const isLocked = await this.dayLockRepository.isDayLocked(userId, task.startTime);
        if (isLocked) {
          failed++;
          continue;
        }

        // Apply recommendation
        const deferred = task.defer(recommendation.recommendedStartTime, recommendation.recommendedEndTime);
        await this.taskRepository.update(deferred);

        updatedTasks.push({
          taskId: task.id,
          oldStartTime: recommendation.originalStartTime,
          newStartTime: recommendation.recommendedStartTime,
        });

        accepted++;
      } catch (error) {
        this.logger.error(`Failed to apply recommendation for task ${recommendation.taskId}: ${error instanceof Error ? error.message : String(error)}`);
        failed++;
      }
    }

    return { accepted, failed, updatedTasks };
  }
}
