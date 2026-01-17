/**
 * Metrics Adapter
 *
 * Provides Prometheus metrics for monitoring and observability.
 */

import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

/**
 * Metrics Adapter for Prometheus
 */
@Injectable()
export class MetricsAdapter {
  public readonly registry: Registry;

  // Calendar sync metrics
  private calendarSyncTotal: Counter<string>;
  private calendarSyncDuration: Histogram<string>;
  private calendarSyncErrors: Counter<string>;
  private calendarEventsSynced: Counter<string>;

  // Scheduling metrics
  private tasksScheduled: Counter<string>;
  private tasksCompleted: Counter<string>;
  private tasksRescheduled: Counter<string>;
  private scheduleEfficiency: Gauge<string>;
  private schedulingConflicts: Counter<string>;

  // Habit/Goal metrics
  private habitsCreated: Counter<string>;
  private habitsCompleted: Counter<string>;
  private goalsCreated: Counter<string>;
  private goalsCompleted: Counter<string>;

  // ML metrics
  private mlPredictions: Counter<string>;
  private mlPredictionDuration: Histogram<string>;
  private mlPredictionErrors: Counter<string>;
  private mlModelAccuracy: Gauge<string>;

  // Activity metrics
  private activityEventsTracked: Counter<string>;
  private activityPatternsUpdated: Counter<string>;
  private productivityScore: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    // Initialize calendar sync metrics
    this.calendarSyncTotal = new Counter({
      name: 'scheduling_calendar_sync_total',
      help: 'Total number of calendar sync operations',
      labelNames: ['status'],
      registers: [this.registry],
    });

    this.calendarSyncDuration = new Histogram({
      name: 'scheduling_calendar_sync_duration_seconds',
      help: 'Calendar sync operation duration in seconds',
      labelNames: ['status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry],
    });

    this.calendarSyncErrors = new Counter({
      name: 'scheduling_calendar_sync_errors_total',
      help: 'Total number of calendar sync errors',
      labelNames: ['error_type'],
      registers: [this.registry],
    });

    this.calendarEventsSynced = new Counter({
      name: 'scheduling_calendar_events_synced_total',
      help: 'Total number of calendar events synced',
      registers: [this.registry],
    });

    // Initialize scheduling metrics
    this.tasksScheduled = new Counter({
      name: 'scheduling_tasks_scheduled_total',
      help: 'Total number of tasks scheduled',
      labelNames: ['task_type'],
      registers: [this.registry],
    });

    this.tasksCompleted = new Counter({
      name: 'scheduling_tasks_completed_total',
      help: 'Total number of tasks completed',
      labelNames: ['task_type'],
      registers: [this.registry],
    });

    this.tasksRescheduled = new Counter({
      name: 'scheduling_tasks_rescheduled_total',
      help: 'Total number of tasks rescheduled',
      labelNames: ['task_type'],
      registers: [this.registry],
    });

    this.scheduleEfficiency = new Gauge({
      name: 'scheduling_schedule_efficiency',
      help: 'Schedule efficiency score (0-1)',
      labelNames: ['user_id'],
      registers: [this.registry],
    });

    this.schedulingConflicts = new Counter({
      name: 'scheduling_conflicts_total',
      help: 'Total number of scheduling conflicts',
      registers: [this.registry],
    });

    // Initialize habit/goal metrics
    this.habitsCreated = new Counter({
      name: 'scheduling_habits_created_total',
      help: 'Total number of habits created',
      registers: [this.registry],
    });

    this.habitsCompleted = new Counter({
      name: 'scheduling_habits_completed_total',
      help: 'Total number of habit completions',
      registers: [this.registry],
    });

    this.goalsCreated = new Counter({
      name: 'scheduling_goals_created_total',
      help: 'Total number of goals created',
      registers: [this.registry],
    });

    this.goalsCompleted = new Counter({
      name: 'scheduling_goals_completed_total',
      help: 'Total number of goals completed',
      registers: [this.registry],
    });

    // Initialize ML metrics
    this.mlPredictions = new Counter({
      name: 'scheduling_ml_predictions_total',
      help: 'Total number of ML predictions',
      labelNames: ['prediction_type'],
      registers: [this.registry],
    });

    this.mlPredictionDuration = new Histogram({
      name: 'scheduling_ml_prediction_duration_seconds',
      help: 'ML prediction duration in seconds',
      labelNames: ['prediction_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.mlPredictionErrors = new Counter({
      name: 'scheduling_ml_prediction_errors_total',
      help: 'Total number of ML prediction errors',
      labelNames: ['error_type'],
      registers: [this.registry],
    });

    this.mlModelAccuracy = new Gauge({
      name: 'scheduling_ml_model_accuracy',
      help: 'ML model accuracy (0-1)',
      registers: [this.registry],
    });

    // Initialize activity metrics
    this.activityEventsTracked = new Counter({
      name: 'scheduling_activity_events_tracked_total',
      help: 'Total number of activity events tracked',
      registers: [this.registry],
    });

    this.activityPatternsUpdated = new Counter({
      name: 'scheduling_activity_patterns_updated_total',
      help: 'Total number of activity patterns updated',
      registers: [this.registry],
    });

    this.productivityScore = new Gauge({
      name: 'scheduling_productivity_score',
      help: 'User productivity score (0-1)',
      labelNames: ['user_id'],
      registers: [this.registry],
    });

    // Start collecting system metrics
    this.startSystemMetricsCollection();
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Start collecting system metrics
   */
  private startSystemMetricsCollection(): void {
    // System metrics collection can be added here if needed
  }

  // Calendar sync metric methods
  incrementCalendarSync(status: string = 'success'): void {
    this.calendarSyncTotal.inc({ status });
  }

  recordCalendarSyncDuration(
    seconds: number,
    status: string = 'success',
  ): void {
    this.calendarSyncDuration.observe({ status }, seconds);
  }

  incrementCalendarSyncErrors(errorType: string): void {
    this.calendarSyncErrors.inc({ error_type: errorType });
  }

  incrementCalendarEventsSynced(count: number = 1): void {
    this.calendarEventsSynced.inc(count);
  }

  // Scheduling metric methods
  incrementTasksScheduled(taskType: string): void {
    this.tasksScheduled.inc({ task_type: taskType });
  }

  incrementTasksCompleted(taskType: string): void {
    this.tasksCompleted.inc({ task_type: taskType });
  }

  incrementTasksRescheduled(taskType: string): void {
    this.tasksRescheduled.inc({ task_type: taskType });
  }

  setScheduleEfficiency(userId: string, efficiency: number): void {
    this.scheduleEfficiency.set({ user_id: userId }, efficiency);
  }

  incrementSchedulingConflicts(): void {
    this.schedulingConflicts.inc();
  }

  // Habit/Goal metric methods
  incrementHabitsCreated(): void {
    this.habitsCreated.inc();
  }

  incrementHabitsCompleted(): void {
    this.habitsCompleted.inc();
  }

  incrementGoalsCreated(): void {
    this.goalsCreated.inc();
  }

  incrementGoalsCompleted(): void {
    this.goalsCompleted.inc();
  }

  // ML metric methods
  incrementMLPredictions(predictionType: string): void {
    this.mlPredictions.inc({ prediction_type: predictionType });
  }

  recordMLPredictionDuration(seconds: number, predictionType: string): void {
    this.mlPredictionDuration.observe(
      { prediction_type: predictionType },
      seconds,
    );
  }

  incrementMLPredictionErrors(errorType: string): void {
    this.mlPredictionErrors.inc({ error_type: errorType });
  }

  setMLModelAccuracy(accuracy: number): void {
    this.mlModelAccuracy.set(accuracy);
  }

  // Activity metric methods
  incrementActivityEventsTracked(): void {
    this.activityEventsTracked.inc();
  }

  incrementActivityPatternsUpdated(): void {
    this.activityPatternsUpdated.inc();
  }

  setProductivityScore(userId: string, score: number): void {
    this.productivityScore.set({ user_id: userId }, score);
  }
}
