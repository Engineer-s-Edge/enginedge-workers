/**
 * Scheduled Learning Adapter Implementation
 *
 * Bridges orchestrator with ScheduledLearningManager
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
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
      if (!this.scheduledLearningManager) {
        throw new Error(
          'ScheduledLearningManagerService is required but not available',
        );
      }
      return await this.scheduledLearningManager.scheduleLearning(config);
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
      if (!this.scheduledLearningManager) {
        throw new Error(
          'ScheduledLearningManagerService is required but not available',
        );
      }
      return await this.scheduledLearningManager.cancelScheduled(scheduleId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to cancel schedule: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getSchedule(scheduleId: string): Promise<ScheduleInfo | null> {
    try {
      if (!this.scheduledLearningManager) {
        throw new Error(
          'ScheduledLearningManagerService is required but not available',
        );
      }
      return await this.scheduledLearningManager.getSchedule(scheduleId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to get schedule: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getUserSchedules(userId: string): Promise<ScheduleInfo[]> {
    try {
      if (!this.scheduledLearningManager) {
        throw new Error(
          'ScheduledLearningManagerService is required but not available',
        );
      }
      return await this.scheduledLearningManager.getUserSchedules(userId);
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
      if (!this.scheduledLearningManager) {
        throw new Error(
          'ScheduledLearningManagerService is required but not available',
        );
      }
      return await this.scheduledLearningManager.updateSchedule(
        scheduleId,
        config,
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to update schedule: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getNextScheduledRuns(limit = 10): Promise<ScheduleInfo[]> {
    try {
      if (!this.scheduledLearningManager) {
        throw new Error(
          'ScheduledLearningManagerService is required but not available',
        );
      }
      return await this.scheduledLearningManager.getNextScheduledRuns(limit);
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
      if (!this.scheduledLearningManager) {
        throw new Error(
          'ScheduledLearningManagerService is required but not available',
        );
      }
      return await this.scheduledLearningManager.pauseSchedule(scheduleId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to pause schedule: ${err.message}`, err.stack);
      throw error;
    }
  }

  async resumeSchedule(scheduleId: string): Promise<boolean> {
    try {
      if (!this.scheduledLearningManager) {
        throw new Error(
          'ScheduledLearningManagerService is required but not available',
        );
      }
      return await this.scheduledLearningManager.resumeSchedule(scheduleId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to resume schedule: ${err.message}`, err.stack);
      throw error;
    }
  }
}
