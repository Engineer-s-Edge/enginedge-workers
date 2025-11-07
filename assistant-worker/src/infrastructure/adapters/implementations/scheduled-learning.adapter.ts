/**
 * Scheduled Learning Adapter Implementation
 *
 * Bridges orchestrator with ScheduledLearningManager
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import {
  IScheduledLearningAdapter,
  ScheduleConfig,
  ScheduleInfo,
} from '../interfaces';
import { ScheduledLearningManagerService } from '../../../application/services/scheduled-learning-manager.service';

@Injectable()
export class ScheduledLearningAdapter implements IScheduledLearningAdapter {
  private readonly logger = new Logger(ScheduledLearningAdapter.name);

  constructor(
    @Optional()
    @Inject('ScheduledLearningManagerService')
    private readonly scheduledLearningManager?: ScheduledLearningManagerService,
  ) {
    if (!this.scheduledLearningManager) {
      this.logger.warn(
        'ScheduledLearningManagerService not injected, using stub implementation',
      );
    }
  }

  async scheduleLearning(config: ScheduleConfig): Promise<ScheduleInfo> {
    try {
      if (this.scheduledLearningManager) {
        return await this.scheduledLearningManager.scheduleLearning(config);
      }

      // Fallback stub implementation
      this.logger.warn('Using stub implementation for scheduleLearning');
      const schedule: ScheduleInfo = {
        id: `schedule-${Date.now()}`,
        topicId: config.topicId,
        userId: config.userId,
        cronExpression: config.cronExpression,
        nextRun: new Date(Date.now() + 3600000),
        runCount: 0,
        enabled: config.enabled ?? true,
      };
      return schedule;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to schedule learning: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async cancelScheduled(scheduleId: string): Promise<boolean> {
    try {
      if (this.scheduledLearningManager) {
        return await this.scheduledLearningManager.cancelScheduled(scheduleId);
      }
      return false;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to cancel schedule: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getSchedule(scheduleId: string): Promise<ScheduleInfo | null> {
    try {
      if (this.scheduledLearningManager) {
        return await this.scheduledLearningManager.getSchedule(scheduleId);
      }
      return null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get schedule: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getUserSchedules(userId: string): Promise<ScheduleInfo[]> {
    try {
      if (this.scheduledLearningManager) {
        return await this.scheduledLearningManager.getUserSchedules(userId);
      }
      return [];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to get user schedules: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async updateSchedule(
    scheduleId: string,
    config: Partial<ScheduleConfig>,
  ): Promise<ScheduleInfo> {
    try {
      if (this.scheduledLearningManager) {
        return await this.scheduledLearningManager.updateSchedule(
          scheduleId,
          config,
        );
      }
      throw new Error('ScheduledLearningManager not available');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to update schedule: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getNextScheduledRuns(limit = 10): Promise<ScheduleInfo[]> {
    try {
      if (this.scheduledLearningManager) {
        return await this.scheduledLearningManager.getNextScheduledRuns(limit);
      }
      return [];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to get next scheduled runs: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async pauseSchedule(scheduleId: string): Promise<boolean> {
    try {
      if (this.scheduledLearningManager) {
        return await this.scheduledLearningManager.pauseSchedule(scheduleId);
      }
      return false;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to pause schedule: ${err.message}`, err.stack);
      throw error;
    }
  }

  async resumeSchedule(scheduleId: string): Promise<boolean> {
    try {
      if (this.scheduledLearningManager) {
        return await this.scheduledLearningManager.resumeSchedule(scheduleId);
      }
      return false;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to resume schedule: ${err.message}`, err.stack);
      throw error;
    }
  }
}
