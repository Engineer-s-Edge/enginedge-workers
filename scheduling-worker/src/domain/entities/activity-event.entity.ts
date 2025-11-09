/**
 * Activity Event Entity
 *
 * Represents a tracked activity event for pattern analysis
 *
 * Domain Entity - No infrastructure dependencies
 */

export class ActivityEvent {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly eventId: string, // calendar event ID
    public scheduledTime: Date,
    public actualStartTime?: Date,
    public actualEndTime?: Date,
    public completed: boolean,
    public completedOnTime: boolean,
    public userRating?: number, // 1-5
    public productivityScore?: number, // 0-1
    public interruptions: number,
    public rescheduled: boolean,
    public readonly createdAt: Date,
    public metadata?: Record<string, any>,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.id) {
      throw new Error('ActivityEvent ID is required');
    }
    if (!this.userId) {
      throw new Error('User ID is required');
    }
    if (!this.eventId) {
      throw new Error('Event ID is required');
    }
    if (
      this.userRating !== undefined &&
      (this.userRating < 1 || this.userRating > 5)
    ) {
      throw new Error('User rating must be between 1 and 5');
    }
    if (
      this.productivityScore !== undefined &&
      (this.productivityScore < 0 || this.productivityScore > 1)
    ) {
      throw new Error('Productivity score must be between 0 and 1');
    }
    if (this.interruptions < 0) {
      throw new Error('Interruptions must be non-negative');
    }
    if (this.actualStartTime && this.actualEndTime) {
      if (this.actualEndTime <= this.actualStartTime) {
        throw new Error('Actual end time must be after actual start time');
      }
    }
  }

  /**
   * Mark event as completed
   */
  markCompleted(
    actualStartTime?: Date,
    actualEndTime?: Date,
    userRating?: number,
    productivityScore?: number,
    interruptions?: number,
  ): ActivityEvent {
    const now = new Date();
    const wasOnTime =
      actualEndTime && actualEndTime <= this.scheduledTime
        ? false
        : actualEndTime
          ? actualEndTime <=
            new Date(
              this.scheduledTime.getTime() +
                (actualEndTime.getTime() -
                  (actualStartTime?.getTime() || now.getTime())),
            )
          : false;

    return new ActivityEvent(
      this.id,
      this.userId,
      this.eventId,
      this.scheduledTime,
      actualStartTime ?? this.actualStartTime,
      actualEndTime ?? this.actualEndTime,
      true,
      wasOnTime,
      userRating ?? this.userRating,
      productivityScore ?? this.productivityScore,
      interruptions ?? this.interruptions,
      this.rescheduled,
      this.createdAt,
      this.metadata,
    );
  }

  /**
   * Mark event as rescheduled
   */
  markRescheduled(newScheduledTime: Date): ActivityEvent {
    return new ActivityEvent(
      this.id,
      this.userId,
      this.eventId,
      newScheduledTime,
      this.actualStartTime,
      this.actualEndTime,
      this.completed,
      this.completedOnTime,
      this.userRating,
      this.productivityScore,
      this.interruptions,
      true,
      this.createdAt,
      this.metadata,
    );
  }

  /**
   * Get actual duration in minutes
   */
  getActualDurationMinutes(): number | null {
    if (!this.actualStartTime || !this.actualEndTime) {
      return null;
    }
    return (
      (this.actualEndTime.getTime() - this.actualStartTime.getTime()) /
      (1000 * 60)
    );
  }

  /**
   * Get scheduled duration in minutes (if available from metadata)
   */
  getScheduledDurationMinutes(): number | null {
    if (this.metadata?.scheduledDurationMinutes) {
      return this.metadata.scheduledDurationMinutes as number;
    }
    return null;
  }

  /**
   * Convert to plain object (for serialization)
   */
  toObject(): Record<string, any> {
    return {
      id: this.id,
      userId: this.userId,
      eventId: this.eventId,
      scheduledTime: this.scheduledTime.toISOString(),
      actualStartTime: this.actualStartTime?.toISOString(),
      actualEndTime: this.actualEndTime?.toISOString(),
      completed: this.completed,
      completedOnTime: this.completedOnTime,
      userRating: this.userRating,
      productivityScore: this.productivityScore,
      interruptions: this.interruptions,
      rescheduled: this.rescheduled,
      createdAt: this.createdAt.toISOString(),
      metadata: this.metadata,
    };
  }

  /**
   * Create from plain object
   */
  static fromObject(obj: any): ActivityEvent {
    return new ActivityEvent(
      obj.id,
      obj.userId,
      obj.eventId,
      new Date(obj.scheduledTime),
      obj.actualStartTime ? new Date(obj.actualStartTime) : undefined,
      obj.actualEndTime ? new Date(obj.actualEndTime) : undefined,
      obj.completed || false,
      obj.completedOnTime || false,
      obj.userRating,
      obj.productivityScore,
      obj.interruptions || 0,
      obj.rescheduled || false,
      new Date(obj.createdAt),
      obj.metadata,
    );
  }
}
