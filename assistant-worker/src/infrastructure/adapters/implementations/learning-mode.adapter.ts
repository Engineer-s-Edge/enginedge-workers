/**
 * Learning Mode Adapter Implementation
 *
 * Bridges orchestrator with LearningModeService
 * Tracks component merges via GraphComponentService integration
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import {
  ILearningModeAdapter,
  LearningMode,
  LearningModeConfig,
  LearningModeResult,
} from '../interfaces';
import { LearningModeService } from '../../../application/services/learning-mode.service';

@Injectable()
export class LearningModeAdapter implements ILearningModeAdapter {
  private readonly logger = new Logger(LearningModeAdapter.name);

  constructor(
    @Inject(forwardRef(() => LearningModeService))
    private readonly learningModeService: LearningModeService,
  ) {}

  async executeLearningMode(
    config: LearningModeConfig,
  ): Promise<LearningModeResult> {
    try {
      this.logger.log(
        `Executing ${config.mode} learning for user ${config.userId}`,
      );
      return await this.learningModeService.executeLearningMode(config);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Learning mode execution failed: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async getCurrentMode(userId: string): Promise<LearningMode | null> {
    try {
      return await this.learningModeService.getCurrentMode(userId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to get current mode: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async switchMode(userId: string, newMode: LearningMode): Promise<boolean> {
    try {
      this.logger.log(`Switching user ${userId} to ${newMode} mode`);
      return await this.learningModeService.switchMode(userId, newMode);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to switch mode: ${err.message}`, err.stack);
      throw error;
    }
  }

  async getModeStatistics(
    mode: LearningMode,
  ): Promise<Record<string, unknown>> {
    try {
      this.logger.log(`Getting statistics for ${mode} mode`);
      return await this.learningModeService.getModeStatistics(mode);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to get mode statistics: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async isLearning(userId: string): Promise<boolean> {
    try {
      return await this.learningModeService.isLearning(userId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to check learning status: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async cancelLearning(userId: string): Promise<boolean> {
    try {
      this.logger.log(`Cancelling learning for user ${userId}`);
      return await this.learningModeService.cancelLearning(userId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to cancel learning: ${err.message}`, err.stack);
      throw error;
    }
  }
}
