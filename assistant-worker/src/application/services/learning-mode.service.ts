/**
 * Learning Mode Service
 *
 * Manages learning mode execution for Genius agents.
 * Coordinates with GeniusAgentOrchestrator to execute actual learning cycles.
 * Tracks learning sessions, mode switches, and statistics.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { ILogger } from '../ports/logger.port';
import { GeniusAgentOrchestrator } from './genius-agent.orchestrator';
import { GraphComponentService } from './graph-component.service';
import {
  LearningMode,
  LearningModeConfig,
  LearningModeResult,
} from '../../infrastructure/adapters/interfaces/learning-mode.adapter.interface';

interface LearningSession {
  userId: string;
  mode: LearningMode;
  startTime: Date;
  topics?: string[];
  detectedGaps?: Array<{ topic: string; gapScore: number }>;
  sessionId: string;
}

interface ModeStatistics {
  mode: LearningMode;
  usageCount: number;
  totalDuration: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  successRate: number;
  lastUsed?: Date;
}

@Injectable()
export class LearningModeService {
  private activeSessions: Map<string, LearningSession> = new Map(); // userId -> session
  private userModes: Map<string, LearningMode> = new Map(); // userId -> current mode
  private modeStats: Map<LearningMode, ModeStatistics> = new Map();
  private sessionHistory: Map<string, LearningModeResult> = new Map(); // sessionId -> result

  constructor(
    @Inject('ILogger') private readonly logger: ILogger,
    @Optional()
    private readonly geniusOrchestrator?: GeniusAgentOrchestrator,
    @Optional()
    private readonly graphComponentService?: GraphComponentService,
  ) {
    // Initialize statistics for each mode
    const modes: LearningMode[] = ['user-directed', 'autonomous', 'scheduled'];
    modes.forEach((mode) => {
      this.modeStats.set(mode, {
        mode,
        usageCount: 0,
        totalDuration: 0,
        successCount: 0,
        failureCount: 0,
        averageDuration: 0,
        successRate: 0,
      });
    });
  }

  /**
   * Execute learning in specified mode
   */
  async executeLearningMode(config: LearningModeConfig): Promise<LearningModeResult> {
    this.logger.info(`Executing ${config.mode} learning for user ${config.userId}`, {
      topics: config.topics?.length || 0,
      detectedGaps: config.detectedGaps?.length || 0,
    });

    const sessionId = `session_${config.userId}_${Date.now()}`;
    const startTime = Date.now();

    // Create session
    const session: LearningSession = {
      userId: config.userId,
      mode: config.mode,
      startTime: new Date(),
      topics: config.topics,
      detectedGaps: config.detectedGaps,
      sessionId,
    };

    this.activeSessions.set(config.userId, session);
    this.userModes.set(config.userId, config.mode);

    // Get initial component count for merge tracking
    let initialComponentCount = 0;
    let finalComponentCount = 0;
    if (this.graphComponentService) {
      try {
        initialComponentCount = await this.graphComponentService.getComponentCount();
        this.logger.debug(`Initial component count: ${initialComponentCount}`);
      } catch (error) {
        this.logger.warn(
          `Failed to get initial component count: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    try {
      // Execute actual learning based on mode
      let topicsProcessed: string[] = [];
      let success = false;

      if (this.geniusOrchestrator) {
        try {
          switch (config.mode) {
            case 'user-directed':
              if (config.topics && config.topics.length > 0) {
                // Execute user-directed learning with specified topics
                const result = await this.geniusOrchestrator.executeUserDirectedLearning(
                  config.userId,
                  config.topics.map((topic) => ({
                    topic,
                    complexity: 'L3', // Default complexity, could be enhanced
                  })),
                );
                topicsProcessed = config.topics;
                success = result?.success !== false;
              } else {
                this.logger.warn('User-directed learning requires topics');
                success = false;
              }
              break;

            case 'autonomous':
              // Execute autonomous learning (detects gaps and processes topics)
              const autonomousResult = await this.geniusOrchestrator.executeAutonomousLearning(
                config.userId,
                {
                  maxTopics: config.topics?.length || 5,
                  minPriority: 0,
                },
              );
              topicsProcessed = autonomousResult?.topicsProcessed || config.topics || [];
              success = autonomousResult?.success !== false;
              break;

            case 'scheduled':
              // Scheduled learning is handled by ScheduledLearningManagerService
              // This mode just tracks the session
              topicsProcessed = config.topics || [];
              success = true;
              this.logger.info('Scheduled learning mode - execution handled by scheduler');
              break;

            default:
              this.logger.error(`Unknown learning mode: ${config.mode}`);
              success = false;
          }
        } catch (error) {
          this.logger.error(
            `Learning execution failed: ${error instanceof Error ? error.message : String(error)}`,
            { userId: config.userId, mode: config.mode },
          );
          success = false;
        }
      } else {
        this.logger.warn('GeniusAgentOrchestrator not available, learning execution skipped');
        topicsProcessed = config.topics || [];
        success = false;
      }

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

      const duration = Date.now() - startTime;
      const result: LearningModeResult = {
        success,
        mode: config.mode,
        topicsProcessed,
        duration,
        timestamp: new Date(),
        componentsMerged,
      };

      // Store result
      this.sessionHistory.set(sessionId, result);

      // Update statistics
      this.updateModeStatistics(config.mode, duration, success);

      // Clean up session
      this.activeSessions.delete(config.userId);

      this.logger.info(`Learning mode execution completed`, {
        mode: config.mode,
        success,
        duration,
        topicsProcessed: topicsProcessed.length,
        componentsMerged,
      });

      return result;
    } catch (error) {
      // Clean up session on error
      this.activeSessions.delete(config.userId);

      const duration = Date.now() - startTime;
      this.updateModeStatistics(config.mode, duration, false);

      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Learning mode execution failed: ${err.message}`, err.stack);

      return {
        success: false,
        mode: config.mode,
        topicsProcessed: config.topics || [],
        duration,
        timestamp: new Date(),
        componentsMerged: 0,
      };
    }
  }

  /**
   * Get current learning mode for user
   */
  async getCurrentMode(userId: string): Promise<LearningMode | null> {
    return this.userModes.get(userId) || null;
  }

  /**
   * Switch learning mode for user
   */
  async switchMode(userId: string, newMode: LearningMode): Promise<boolean> {
    this.logger.info(`Switching user ${userId} to ${newMode} mode`);

    // Cancel any active learning session
    const activeSession = this.activeSessions.get(userId);
    if (activeSession) {
      this.logger.warn(`Cancelling active ${activeSession.mode} session for user ${userId}`);
      this.activeSessions.delete(userId);
    }

    // Update mode
    this.userModes.set(userId, newMode);

    return true;
  }

  /**
   * Get mode statistics
   */
  async getModeStatistics(mode: LearningMode): Promise<Record<string, unknown>> {
    const stats = this.modeStats.get(mode);
    if (!stats) {
      return {
        mode,
        usageCount: 0,
        averageDuration: 0,
        successRate: 0,
      };
    }

    return {
      mode: stats.mode,
      usageCount: stats.usageCount,
      averageDuration: stats.averageDuration,
      successRate: stats.successRate,
      totalDuration: stats.totalDuration,
      successCount: stats.successCount,
      failureCount: stats.failureCount,
      lastUsed: stats.lastUsed?.toISOString(),
    };
  }

  /**
   * Check if user is in learning session
   */
  async isLearning(userId: string): Promise<boolean> {
    return this.activeSessions.has(userId);
  }

  /**
   * Cancel current learning session
   */
  async cancelLearning(userId: string): Promise<boolean> {
    this.logger.info(`Cancelling learning for user ${userId}`);

    const session = this.activeSessions.get(userId);
    if (!session) {
      this.logger.warn(`No active learning session found for user ${userId}`);
      return false;
    }

    // Cancel session
    this.activeSessions.delete(userId);
    this.userModes.delete(userId);

    // Update statistics (mark as failure)
    if (session) {
      const duration = Date.now() - session.startTime.getTime();
      this.updateModeStatistics(session.mode, duration, false);
    }

    return true;
  }

  /**
   * Update mode statistics
   */
  private updateModeStatistics(mode: LearningMode, duration: number, success: boolean): void {
    const stats = this.modeStats.get(mode);
    if (!stats) {
      return;
    }

    stats.usageCount++;
    stats.totalDuration += duration;
    stats.averageDuration = stats.totalDuration / stats.usageCount;

    if (success) {
      stats.successCount++;
    } else {
      stats.failureCount++;
    }

    const totalAttempts = stats.successCount + stats.failureCount;
    stats.successRate = totalAttempts > 0 ? stats.successCount / totalAttempts : 0;
    stats.lastUsed = new Date();

    this.modeStats.set(mode, stats);
  }
}
