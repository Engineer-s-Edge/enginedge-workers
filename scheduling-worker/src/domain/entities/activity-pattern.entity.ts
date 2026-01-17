/**
 * Activity Pattern Entity
 *
 * Represents user activity patterns for scheduling optimization
 *
 * Domain Entity - No infrastructure dependencies
 */

export type ActivityPatternType = 'hourly' | 'daily' | 'weekly';

export class ActivityPattern {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public patternType: ActivityPatternType,
    public preferredHours: number[], // 0-23
    public preferredDays: number[], // 0-6, Sunday=0
    public productivityScore: number, // 0-1
    public completionRate: number, // 0-1
    public averageFocusDuration: number, // minutes
    public peakProductivityHours: number[], // 0-23
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public metadata?: Record<string, any>,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.id) {
      throw new Error('ActivityPattern ID is required');
    }
    if (!this.userId) {
      throw new Error('User ID is required');
    }
    if (!['hourly', 'daily', 'weekly'].includes(this.patternType)) {
      throw new Error('Pattern type must be hourly, daily, or weekly');
    }
    if (
      this.preferredHours.some((h) => h < 0 || h > 23) ||
      this.preferredHours.length === 0
    ) {
      throw new Error('Preferred hours must be between 0-23 and non-empty');
    }
    if (
      this.preferredDays.some((d) => d < 0 || d > 6) ||
      this.preferredDays.length === 0
    ) {
      throw new Error('Preferred days must be between 0-6 and non-empty');
    }
    if (this.productivityScore < 0 || this.productivityScore > 1) {
      throw new Error('Productivity score must be between 0 and 1');
    }
    if (this.completionRate < 0 || this.completionRate > 1) {
      throw new Error('Completion rate must be between 0 and 1');
    }
    if (this.averageFocusDuration < 0) {
      throw new Error('Average focus duration must be non-negative');
    }
    if (
      this.peakProductivityHours.some((h) => h < 0 || h > 23) ||
      this.peakProductivityHours.length === 0
    ) {
      throw new Error(
        'Peak productivity hours must be between 0-23 and non-empty',
      );
    }
  }

  /**
   * Update activity pattern with new data
   */
  update(updates: {
    patternType?: ActivityPatternType;
    preferredHours?: number[];
    preferredDays?: number[];
    productivityScore?: number;
    completionRate?: number;
    averageFocusDuration?: number;
    peakProductivityHours?: number[];
    metadata?: Record<string, any>;
  }): ActivityPattern {
    return new ActivityPattern(
      this.id,
      this.userId,
      updates.patternType ?? this.patternType,
      updates.preferredHours ?? this.preferredHours,
      updates.preferredDays ?? this.preferredDays,
      updates.productivityScore ?? this.productivityScore,
      updates.completionRate ?? this.completionRate,
      updates.averageFocusDuration ?? this.averageFocusDuration,
      updates.peakProductivityHours ?? this.peakProductivityHours,
      this.createdAt,
      new Date(),
      updates.metadata ?? this.metadata,
    );
  }

  /**
   * Check if a specific hour is preferred
   */
  isPreferredHour(hour: number): boolean {
    return this.preferredHours.includes(hour);
  }

  /**
   * Check if a specific day is preferred
   */
  isPreferredDay(day: number): boolean {
    return this.preferredDays.includes(day);
  }

  /**
   * Check if a specific hour is a peak productivity hour
   */
  isPeakProductivityHour(hour: number): boolean {
    return this.peakProductivityHours.includes(hour);
  }

  /**
   * Convert to plain object (for serialization)
   */
  toObject(): Record<string, any> {
    return {
      id: this.id,
      userId: this.userId,
      patternType: this.patternType,
      preferredHours: this.preferredHours,
      preferredDays: this.preferredDays,
      productivityScore: this.productivityScore,
      completionRate: this.completionRate,
      averageFocusDuration: this.averageFocusDuration,
      peakProductivityHours: this.peakProductivityHours,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      metadata: this.metadata,
    };
  }

  /**
   * Create from plain object
   */
  static fromObject(obj: any): ActivityPattern {
    return new ActivityPattern(
      obj.id,
      obj.userId,
      obj.patternType,
      obj.preferredHours || [],
      obj.preferredDays || [],
      obj.productivityScore || 0,
      obj.completionRate || 0,
      obj.averageFocusDuration || 0,
      obj.peakProductivityHours || [],
      new Date(obj.createdAt),
      new Date(obj.updatedAt),
      obj.metadata,
    );
  }
}
