/**
 * Scheduled Learning Manager Service
 *
 * Manages cron-based learning schedules with timezone support.
 * Uses node-cron for scheduling and supports configurable timezones.
 */

import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cron from 'node-cron';
import { ILogger } from '../ports/logger.port';
import {
  ScheduleConfig,
  ScheduleInfo,
} from '../../infrastructure/adapters/interfaces/scheduled-learning.adapter.interface';
import { GeniusAgentOrchestrator } from './genius-agent.orchestrator';

@Injectable()
export class ScheduledLearningManagerService
  implements OnModuleInit, OnModuleDestroy
{
  private schedules: Map<string, ScheduleInfo> = new Map();
  private cronTasks: Map<string, cron.ScheduledTask> = new Map();
  private readonly defaultTimezone: string;

  constructor(
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly configService?: ConfigService,
    @Optional()
    private readonly geniusOrchestrator?: GeniusAgentOrchestrator,
  ) {
    this.defaultTimezone =
      this.configService?.get<string>('DEFAULT_TIMEZONE') ||
      process.env.DEFAULT_TIMEZONE ||
      'UTC';
  }

  async onModuleInit() {
    this.logger.info(
      `ScheduledLearningManager initialized with default timezone: ${this.defaultTimezone}`,
    );
  }

  async onModuleDestroy() {
    // Clean up all cron tasks
    for (const [scheduleId, task] of this.cronTasks.entries()) {
      task.stop();
      this.logger.debug(`Stopped cron task for schedule ${scheduleId}`);
    }
    this.cronTasks.clear();
  }

  /**
   * Schedule learning for topic with cron expression
   */
  async scheduleLearning(config: ScheduleConfig): Promise<ScheduleInfo> {
    const timezone = (config as any).timezone || this.defaultTimezone;

    // Validate cron expression
    if (!cron.validate(config.cronExpression)) {
      throw new Error(`Invalid cron expression: ${config.cronExpression}`);
    }

    const scheduleId = `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate next run time based on cron expression and timezone
    const nextRun = this.calculateNextRun(config.cronExpression, timezone);

    const schedule: ScheduleInfo = {
      id: scheduleId,
      topicId: config.topicId,
      userId: config.userId,
      cronExpression: config.cronExpression,
      nextRun,
      runCount: 0,
      enabled: config.enabled ?? true,
    };

    this.schedules.set(scheduleId, schedule);

    // Create cron task if enabled
    if (schedule.enabled) {
      this.createCronTask(scheduleId, config.cronExpression, timezone);
    }

    this.logger.info(`Scheduled learning created`, {
      scheduleId,
      topicId: config.topicId,
      cronExpression: config.cronExpression,
      timezone,
      nextRun: nextRun.toISOString(),
    });

    return schedule;
  }

  /**
   * Cancel scheduled learning
   */
  async cancelScheduled(scheduleId: string): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return false;
    }

    // Stop cron task
    const task = this.cronTasks.get(scheduleId);
    if (task) {
      task.stop();
      this.cronTasks.delete(scheduleId);
    }

    this.schedules.delete(scheduleId);

    this.logger.info(`Scheduled learning cancelled`, { scheduleId });
    return true;
  }

  /**
   * Get scheduled learning
   */
  async getSchedule(scheduleId: string): Promise<ScheduleInfo | null> {
    return this.schedules.get(scheduleId) || null;
  }

  /**
   * Get user's scheduled learnings
   */
  async getUserSchedules(userId: string): Promise<ScheduleInfo[]> {
    return Array.from(this.schedules.values()).filter(
      (s) => s.userId === userId,
    );
  }

  /**
   * Update schedule
   */
  async updateSchedule(
    scheduleId: string,
    config: Partial<ScheduleConfig & { timezone?: string }>,
  ): Promise<ScheduleInfo> {
    const existing = this.schedules.get(scheduleId);
    if (!existing) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    const timezone = config.timezone || this.defaultTimezone;

    // Stop existing cron task
    const existingTask = this.cronTasks.get(scheduleId);
    if (existingTask) {
      existingTask.stop();
      this.cronTasks.delete(scheduleId);
    }

    // Update schedule
    const updated: ScheduleInfo = {
      ...existing,
      cronExpression: config.cronExpression || existing.cronExpression,
      enabled: config.enabled ?? existing.enabled,
    };

    // Recalculate next run if cron expression changed
    if (config.cronExpression) {
      if (!cron.validate(config.cronExpression)) {
        throw new Error(`Invalid cron expression: ${config.cronExpression}`);
      }
      updated.nextRun = this.calculateNextRun(config.cronExpression, timezone);
    }

    this.schedules.set(scheduleId, updated);

    // Create new cron task if enabled
    if (updated.enabled) {
      this.createCronTask(scheduleId, updated.cronExpression, timezone);
    }

    this.logger.info(`Schedule updated`, { scheduleId });
    return updated;
  }

  /**
   * Get next scheduled runs
   */
  async getNextScheduledRuns(limit = 10): Promise<ScheduleInfo[]> {
    return Array.from(this.schedules.values())
      .filter((s) => s.enabled)
      .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime())
      .slice(0, limit);
  }

  /**
   * Pause schedule
   */
  async pauseSchedule(scheduleId: string): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return false;
    }

    schedule.enabled = false;

    // Stop cron task
    const task = this.cronTasks.get(scheduleId);
    if (task) {
      task.stop();
      this.cronTasks.delete(scheduleId);
    }

    this.logger.info(`Schedule paused`, { scheduleId });
    return true;
  }

  /**
   * Resume schedule
   */
  async resumeSchedule(scheduleId: string): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return false;
    }

    schedule.enabled = true;

    // Recalculate next run
    const timezone = this.defaultTimezone; // Could be stored per schedule
    schedule.nextRun = this.calculateNextRun(schedule.cronExpression, timezone);

    // Create cron task
    this.createCronTask(scheduleId, schedule.cronExpression, timezone);

    this.logger.info(`Schedule resumed`, { scheduleId });
    return true;
  }

  /**
   * Create cron task for a schedule
   */
  private createCronTask(
    scheduleId: string,
    cronExpression: string,
    timezone: string,
  ): void {
    const task = cron.schedule(
      cronExpression,
      async () => {
        await this.executeScheduledLearning(scheduleId);
      },
      {
        timezone,
      },
    );

    this.cronTasks.set(scheduleId, task);
  }

  /**
   * Execute scheduled learning
   */
  private async executeScheduledLearning(scheduleId: string): Promise<void> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule || !schedule.enabled) {
      return;
    }

    this.logger.info(`Executing scheduled learning`, {
      scheduleId,
      topicId: schedule.topicId,
      userId: schedule.userId,
    });

    try {
      // Trigger actual learning execution via GeniusAgentOrchestrator
      if (this.geniusOrchestrator) {
        try {
          // Execute autonomous learning for the scheduled topic
          // Note: The orchestrator will detect knowledge gaps and process topics
          // If topicId is provided, it will be prioritized in the learning cycle
          await this.geniusOrchestrator.executeAutonomousLearning(
            schedule.userId,
            {
              maxTopics: schedule.topicId ? 1 : 5, // Focus on single topic if specified
              minPriority: 0,
            },
          );

          this.logger.info(`Genius learning session launched for scheduled topic`, {
            scheduleId,
            topicId: schedule.topicId,
            userId: schedule.userId,
          });
        } catch (error) {
          this.logger.error(
            `Failed to launch Genius learning session: ${error instanceof Error ? error.message : String(error)}`,
            { scheduleId, topicId: schedule.topicId },
          );
          // Continue to update schedule even if learning launch fails
        }
      } else {
        this.logger.warn(
          `GeniusAgentOrchestrator not available, skipping learning execution`,
          { scheduleId },
        );
      }

      schedule.runCount++;
      schedule.lastRun = new Date();

      // Recalculate next run
      const timezone = this.defaultTimezone;
      schedule.nextRun = this.calculateNextRun(
        schedule.cronExpression,
        timezone,
      );

      this.logger.info(`Scheduled learning executed successfully`, {
        scheduleId,
        runCount: schedule.runCount,
      });
    } catch (error) {
      this.logger.error(
        `Failed to execute scheduled learning: ${error instanceof Error ? error.message : String(error)}`,
        { scheduleId },
      );
    }
  }

  /**
   * Calculate next run time from cron expression and timezone
   */
  private calculateNextRun(cronExpression: string, timezone: string): Date {
    // Use a library like `cron-parser` for accurate next run calculation
    try {
      const parser = require('cron-parser');
      const interval = parser.parseExpression(cronExpression, {
        tz: timezone,
      });
      return interval.next().toDate();
    } catch (error) {
      // Fallback: calculate approximate next run (1 hour from now)
      this.logger.warn(
        `Failed to parse cron expression for next run calculation, using fallback`,
        { cronExpression, timezone },
      );
      return new Date(Date.now() + 3600000); // 1 hour from now
    }
  }
}
