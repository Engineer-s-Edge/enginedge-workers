/**
 * Scheduled Learning Adapter Interface
 * 
 * Port interface for cron-based learning scheduling
 * Abstracts external ScheduledLearningManager implementation
 */

export interface ScheduleConfig {
  topicId: string;
  userId: string;
  cronExpression: string;
  maxRunsPerDay?: number;
  enabled?: boolean;
}

export interface ScheduleInfo {
  id: string;
  topicId: string;
  userId: string;
  cronExpression: string;
  nextRun: Date;
  lastRun?: Date;
  runCount: number;
  enabled: boolean;
}

export interface IScheduledLearningAdapter {
  /**
   * Schedule learning for topic with cron expression
   */
  scheduleLearning(config: ScheduleConfig): Promise<ScheduleInfo>;

  /**
   * Cancel scheduled learning
   */
  cancelScheduled(scheduleId: string): Promise<boolean>;

  /**
   * Get scheduled learning
   */
  getSchedule(scheduleId: string): Promise<ScheduleInfo | null>;

  /**
   * Get user's scheduled learnings
   */
  getUserSchedules(userId: string): Promise<ScheduleInfo[]>;

  /**
   * Update schedule
   */
  updateSchedule(scheduleId: string, config: Partial<ScheduleConfig>): Promise<ScheduleInfo>;

  /**
   * Get next scheduled runs
   */
  getNextScheduledRuns(limit?: number): Promise<ScheduleInfo[]>;

  /**
   * Pause schedule
   */
  pauseSchedule(scheduleId: string): Promise<boolean>;

  /**
   * Resume schedule
   */
  resumeSchedule(scheduleId: string): Promise<boolean>;
}
