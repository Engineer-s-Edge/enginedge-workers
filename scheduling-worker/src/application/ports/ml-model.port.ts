/**
 * ML Model Client Port - Interface for ML-based scheduling recommendations
 */

export interface TaskEmbedding {
  taskId: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export interface SlotPrediction {
  slotStartTime: Date;
  slotEndTime: Date;
  score: number; // 0-1, higher is better
  confidence: number; // 0-1
  reasoning?: string;
}

export interface SchedulingRecommendation {
  taskId: string;
  recommendedSlots: SlotPrediction[];
  alternativeSlots: SlotPrediction[];
  userSatisfactionPrediction: number; // 0-1
}

export interface UserActivityPattern {
  userId: string;
  preferredWorkingHours: { start: string; end: string };
  peakProductivityHours: string[]; // e.g., ['09:00', '10:00', '15:00']
  averageTaskDuration: number; // in minutes
  completionRate: number; // 0-1
}

/**
 * ML Model Service Port
 */
export interface IMLModelService {
  /**
   * Get embedding for a task (convert task to vector representation)
   */
  getTaskEmbedding(
    taskTitle: string,
    taskDescription: string,
    metadata?: Record<string, any>,
  ): Promise<TaskEmbedding>;

  /**
   * Predict optimal time slots for a task
   */
  predictOptimalSlots(
    task: TaskEmbedding,
    availableSlots: { startTime: Date; endTime: Date }[],
    userContext?: UserActivityPattern,
  ): Promise<SchedulingRecommendation>;

  /**
   * Predict user satisfaction for a proposed schedule
   */
  predictUserSatisfaction(
    userId: string,
    proposedSchedule: {
      taskId: string;
      slotStartTime: Date;
      slotEndTime: Date;
    }[],
  ): Promise<number>;

  /**
   * Get user activity patterns
   */
  getUserActivityPattern(userId: string): Promise<UserActivityPattern>;

  /**
   * Submit feedback to improve model
   */
  submitFeedback(
    taskId: string,
    scheduledSlot: { startTime: Date; endTime: Date },
    completed: boolean,
    userRating?: number,
  ): Promise<void>;

  /**
   * Check if ML service is available
   */
  healthCheck(): Promise<boolean>;
}
