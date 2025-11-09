import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { HabitService } from './habit.service';
import { GoalService } from './goal.service';
import { ScheduledTask } from './task-scheduler.service';
import { ICalendarEventRepository } from '../ports/repositories.port';
import { ActivityModelService } from './activity-model.service';
import { MetricsAdapter } from '../../infrastructure/adapters/monitoring/metrics.adapter';

export interface CompletionRecord {
  taskId: string;
  taskType: 'habit' | 'goal';
  sourceId: string;
  completedAt: Date;
  scheduledSlotStart: Date;
  scheduledSlotEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  completionRate: number; // 0-100 (100 = fully completed)
  notes?: string;
  wasRescheduled: boolean;
}

export interface CompletionStats {
  totalScheduled: number;
  totalCompleted: number;
  totalPartiallyCompleted: number;
  totalSkipped: number;
  completionRate: number;
  averageCompletionTime: number; // minutes
  onTimeRate: number; // percentage completed on time
}

@Injectable()
export class TaskCompletionService {
  private readonly logger = new Logger(TaskCompletionService.name);
  private completionHistory: CompletionRecord[] = [];

  constructor(
    private readonly habitService: HabitService,
    private readonly goalService: GoalService,
    @Inject('ICalendarEventRepository')
    private readonly eventRepository: ICalendarEventRepository,
    @Optional()
    private readonly activityModelService?: ActivityModelService,
    @Optional()
    private readonly metricsAdapter?: MetricsAdapter,
  ) {}

  /**
   * Mark a scheduled task as completed
   */
  async completeTask(
    scheduledTask: ScheduledTask,
    completionRate: number = 100,
    actualStart?: Date,
    actualEnd?: Date,
    notes?: string,
  ): Promise<CompletionRecord> {
    this.logger.log(
      `Marking task "${scheduledTask.title}" as ${completionRate}% complete`,
    );

    // Update the underlying habit or goal
    if (scheduledTask.type === 'habit') {
      await this.completeHabitTask(scheduledTask, notes);
    } else if (scheduledTask.type === 'goal') {
      await this.completeGoalTask(scheduledTask, completionRate, notes);
    }

    // Create completion record
    const record: CompletionRecord = {
      taskId: scheduledTask.id,
      taskType: scheduledTask.type,
      sourceId: scheduledTask.sourceId,
      completedAt: new Date(),
      scheduledSlotStart: scheduledTask.scheduledSlot.startTime,
      scheduledSlotEnd: scheduledTask.scheduledSlot.endTime,
      actualStart,
      actualEnd,
      completionRate,
      notes,
      wasRescheduled: false,
    };

    this.completionHistory.push(record);

    this.logger.debug(`Task completion recorded: ${scheduledTask.id}`);

    // Record metrics
    if (this.metricsAdapter) {
      this.metricsAdapter.incrementTasksCompleted(scheduledTask.type);
    }

    // Track activity if ActivityModelService is available
    if (this.activityModelService) {
      try {
        // Extract userId from scheduledTask (assuming it's in metadata or we need to get it from the task)
        const userId =
          (scheduledTask as any).userId ||
          (scheduledTask as any).metadata?.userId;
        if (userId) {
          await this.activityModelService.trackEventCompletion(
            scheduledTask.id,
            userId,
            scheduledTask.scheduledSlot.startTime,
            {
              actualStartTime,
              actualEndTime,
              productivityScore: completionRate / 100, // Convert to 0-1 scale
            },
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to track activity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Don't fail the completion if activity tracking fails
      }
    }

    return record;
  }

  /**
   * Complete a habit task
   */
  private async completeHabitTask(
    scheduledTask: ScheduledTask,
    notes?: string,
  ): Promise<void> {
    await this.habitService.completeHabit(scheduledTask.sourceId, notes);

    this.logger.debug(`Habit ${scheduledTask.sourceId} marked complete`);
  }

  /**
   * Complete a goal task
   */
  private async completeGoalTask(
    scheduledTask: ScheduledTask,
    completionRate: number,
    notes?: string,
  ): Promise<void> {
    // Calculate progress increment based on task duration vs total goal time
    const taskDurationHours = scheduledTask.durationMinutes / 60;

    // Update goal progress
    await this.goalService.updateProgress(
      scheduledTask.sourceId,
      completionRate,
      notes,
    );

    this.logger.debug(
      `Goal ${scheduledTask.sourceId} progress updated: ${completionRate}%`,
    );
  }

  /**
   * Mark a task as skipped/not completed
   */
  async skipTask(
    scheduledTask: ScheduledTask,
    reason?: string,
  ): Promise<CompletionRecord> {
    this.logger.log(
      `Skipping task "${scheduledTask.title}": ${reason || 'No reason provided'}`,
    );

    const record: CompletionRecord = {
      taskId: scheduledTask.id,
      taskType: scheduledTask.type,
      sourceId: scheduledTask.sourceId,
      completedAt: new Date(),
      scheduledSlotStart: scheduledTask.scheduledSlot.startTime,
      scheduledSlotEnd: scheduledTask.scheduledSlot.endTime,
      completionRate: 0,
      notes: reason,
      wasRescheduled: false,
    };

    this.completionHistory.push(record);

    return record;
  }

  /**
   * Reschedule an incomplete task
   */
  async rescheduleTask(
    scheduledTask: ScheduledTask,
    newStartTime: Date,
    reason?: string,
  ): Promise<CompletionRecord> {
    this.logger.log(
      `Rescheduling task "${scheduledTask.title}" to ${newStartTime.toISOString()}`,
    );

    // Record metrics
    if (this.metricsAdapter) {
      this.metricsAdapter.incrementTasksRescheduled(scheduledTask.type);
    }

    const record: CompletionRecord = {
      taskId: scheduledTask.id,
      taskType: scheduledTask.type,
      sourceId: scheduledTask.sourceId,
      completedAt: new Date(),
      scheduledSlotStart: scheduledTask.scheduledSlot.startTime,
      scheduledSlotEnd: scheduledTask.scheduledSlot.endTime,
      completionRate: 0,
      notes: reason,
      wasRescheduled: true,
    };

    this.completionHistory.push(record);

    return record;
  }

  /**
   * Get completion history for a date range
   */
  getCompletionHistory(startDate: Date, endDate: Date): CompletionRecord[] {
    return this.completionHistory.filter(
      (record) =>
        record.completedAt >= startDate && record.completedAt <= endDate,
    );
  }

  /**
   * Get completion history for a specific task type
   */
  getCompletionHistoryByType(
    type: 'habit' | 'goal',
    startDate?: Date,
    endDate?: Date,
  ): CompletionRecord[] {
    let records = this.completionHistory.filter(
      (record) => record.taskType === type,
    );

    if (startDate && endDate) {
      records = records.filter(
        (record) =>
          record.completedAt >= startDate && record.completedAt <= endDate,
      );
    }

    return records;
  }

  /**
   * Get completion statistics
   */
  getCompletionStats(startDate: Date, endDate: Date): CompletionStats {
    const records = this.getCompletionHistory(startDate, endDate);

    const totalScheduled = records.length;
    const totalCompleted = records.filter(
      (r) => r.completionRate === 100,
    ).length;
    const totalPartiallyCompleted = records.filter(
      (r) => r.completionRate > 0 && r.completionRate < 100,
    ).length;
    const totalSkipped = records.filter((r) => r.completionRate === 0).length;

    const completionRate =
      totalScheduled > 0 ? (totalCompleted / totalScheduled) * 100 : 0;

    // Calculate average completion time
    const completedRecords = records.filter(
      (r) => r.completionRate > 0 && r.actualStart && r.actualEnd,
    );

    const totalCompletionTime = completedRecords.reduce((sum, record) => {
      const duration =
        (record.actualEnd!.getTime() - record.actualStart!.getTime()) /
        (1000 * 60);
      return sum + duration;
    }, 0);

    const averageCompletionTime =
      completedRecords.length > 0
        ? totalCompletionTime / completedRecords.length
        : 0;

    // Calculate on-time rate (completed within scheduled time)
    const onTimeCompletions = records.filter((r) => {
      if (!r.actualEnd || r.completionRate === 0) return false;
      return r.actualEnd <= r.scheduledSlotEnd;
    }).length;

    const onTimeRate =
      totalScheduled > 0 ? (onTimeCompletions / totalScheduled) * 100 : 0;

    return {
      totalScheduled,
      totalCompleted,
      totalPartiallyCompleted,
      totalSkipped,
      completionRate,
      averageCompletionTime,
      onTimeRate,
    };
  }

  /**
   * Get completion rate for a specific habit
   */
  getHabitCompletionRate(habitId: string, days: number = 30): number {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const records = this.completionHistory.filter(
      (r) =>
        r.taskType === 'habit' &&
        r.sourceId === habitId &&
        r.completedAt >= startDate,
    );

    if (records.length === 0) return 0;

    const completedCount = records.filter(
      (r) => r.completionRate === 100,
    ).length;
    return (completedCount / records.length) * 100;
  }

  /**
   * Get completion rate for a specific goal
   */
  getGoalCompletionRate(goalId: string): number {
    const records = this.completionHistory.filter(
      (r) => r.taskType === 'goal' && r.sourceId === goalId,
    );

    if (records.length === 0) return 0;

    const totalCompletionRate = records.reduce(
      (sum, r) => sum + r.completionRate,
      0,
    );

    return totalCompletionRate / records.length;
  }

  /**
   * Get tasks that were rescheduled
   */
  getRescheduledTasks(startDate: Date, endDate: Date): CompletionRecord[] {
    return this.completionHistory.filter(
      (record) =>
        record.wasRescheduled &&
        record.completedAt >= startDate &&
        record.completedAt <= endDate,
    );
  }

  /**
   * Get incomplete tasks that need follow-up
   */
  getIncompleteTasksNeedingFollowUp(
    maxAge: number = 7, // days
  ): CompletionRecord[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

    return this.completionHistory.filter(
      (record) =>
        record.completionRate < 100 &&
        !record.wasRescheduled &&
        record.completedAt >= cutoffDate,
    );
  }

  /**
   * Clear completion history (for testing or data cleanup)
   */
  clearHistory(): void {
    this.completionHistory = [];
    this.logger.log('Completion history cleared');
  }

  /**
   * Export completion history (for analytics or backup)
   */
  exportHistory(): CompletionRecord[] {
    return [...this.completionHistory];
  }

  /**
   * Import completion history (for restoration)
   */
  importHistory(records: CompletionRecord[]): void {
    this.completionHistory = records;
    this.logger.log(`Imported ${records.length} completion records`);
  }
}
