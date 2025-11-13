/**
 * Learning Mode Adapter Implementation
 *
 * Bridges orchestrator with LearningModeService
 * Tracks component merges via GraphComponentService integration
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import {
  ILearningModeAdapter,
  LearningMode,
  LearningModeConfig,
  LearningModeResult,
} from '../interfaces';
import { GraphComponentService } from '@application/services/graph-component.service';

@Injectable()
export class LearningModeAdapter implements ILearningModeAdapter {
  private readonly logger = new Logger(LearningModeAdapter.name);
  private userModes: Map<string, LearningMode> = new Map();
  private activeSessions: Map<string, LearningModeConfig> = new Map();
  private sessionComponentCounts: Map<string, number> = new Map(); // Track component counts per session

  constructor(
    @Optional()
    private readonly graphComponentService?: GraphComponentService,
  ) {
    if (this.graphComponentService) {
      this.logger.log('GraphComponentService integrated for component merge tracking');
    }
  }

  async executeLearningMode(
    config: LearningModeConfig,
  ): Promise<LearningModeResult> {
    try {
      this.logger.log(
        `Executing ${config.mode} learning for user ${config.userId}`,
      );

      // TODO: Delegate to real LearningModeService
      // return this.learningModeService.executeLearningMode(config);

      // Track session
      const sessionId = `session_${config.userId}_${Date.now()}`;
      this.activeSessions.set(config.userId, config);
      this.userModes.set(config.userId, config.mode);

      // Get initial component count for merge tracking
      let initialComponentCount = 0;
      let finalComponentCount = 0;
      if (this.graphComponentService) {
        try {
          initialComponentCount = await this.graphComponentService.getComponentCount();
          this.sessionComponentCounts.set(sessionId, initialComponentCount);
          this.logger.debug(
            `Initial component count: ${initialComponentCount}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to get initial component count: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // Stub implementation
      const startTime = Date.now();

      // Simulate learning execution (in real implementation, this would trigger actual research)
      // For now, we'll just wait a bit to simulate processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get final component count to calculate merges
      let componentsMerged = 0;
      if (this.graphComponentService) {
        try {
          finalComponentCount = await this.graphComponentService.getComponentCount();
          // Components merged = initial - final (when components merge, count decreases)
          componentsMerged = Math.max(0, initialComponentCount - finalComponentCount);
          this.logger.debug(
            `Component merge tracking: initial=${initialComponentCount}, final=${finalComponentCount}, merged=${componentsMerged}`,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to get final component count: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const result: LearningModeResult = {
        success: true,
        mode: config.mode,
        topicsProcessed: config.topics || [],
        duration: Date.now() - startTime,
        timestamp: new Date(),
        componentsMerged,
      };

      // Clean up session tracking
      this.sessionComponentCounts.delete(sessionId);

      return result;
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
      // TODO: Delegate to real LearningModeService
      // return this.learningModeService.getCurrentMode(userId);

      // Stub implementation
      return this.userModes.get(userId) || null;
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

      // TODO: Delegate to real LearningModeService
      // return this.learningModeService.switchMode(userId, newMode);

      // Stub implementation
      this.userModes.set(userId, newMode);
      return true;
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

      // TODO: Delegate to real LearningModeService
      // return this.learningModeService.getModeStatistics(mode);

      // Stub implementation
      return {
        mode,
        usageCount: 10,
        averageDuration: 3600,
        successRate: 0.92,
      };
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
      // TODO: Delegate to real LearningModeService
      // return this.learningModeService.isLearning(userId);

      // Stub implementation
      return this.activeSessions.has(userId);
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

      // TODO: Delegate to real LearningModeService
      // return this.learningModeService.cancelLearning(userId);

      // Stub implementation
      this.activeSessions.delete(userId);
      this.userModes.delete(userId);
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to cancel learning: ${err.message}`, err.stack);
      throw error;
    }
  }
}
