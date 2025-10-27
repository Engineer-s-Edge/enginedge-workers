/**
 * Learning Mode Adapter Interface
 * 
 * Port interface for learning mode execution
 * Abstracts external LearningModeService implementation
 */

export type LearningMode = 'user-directed' | 'autonomous' | 'scheduled';

export interface LearningModeConfig {
  userId: string;
  mode: LearningMode;
  topics?: string[];
  detectedGaps?: Array<{ topic: string; gapScore: number }>;
  cronSchedule?: string;
}

export interface LearningModeResult {
  success: boolean;
  mode: LearningMode;
  topicsProcessed: string[];
  duration: number;
  timestamp: Date;
}

export interface ILearningModeAdapter {
  /**
   * Execute learning in specified mode
   */
  executeLearningMode(config: LearningModeConfig): Promise<LearningModeResult>;

  /**
   * Get current learning mode
   */
  getCurrentMode(userId: string): Promise<LearningMode | null>;

  /**
   * Switch learning mode
   */
  switchMode(userId: string, newMode: LearningMode): Promise<boolean>;

  /**
   * Get mode statistics
   */
  getModeStatistics(mode: LearningMode): Promise<Record<string, unknown>>;

  /**
   * Check if user is in learning session
   */
  isLearning(userId: string): Promise<boolean>;

  /**
   * Cancel current learning session
   */
  cancelLearning(userId: string): Promise<boolean>;
}
