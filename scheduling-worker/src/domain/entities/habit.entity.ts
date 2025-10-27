/**
 * Habit Entity
 * 
 * Represents a recurring habit that the user wants to complete regularly
 * 
 * Domain Entity - No infrastructure dependencies
 */

export type HabitFrequency = 'daily' | 'weekly' | 'monthly';
export type HabitPriority = 1 | 2 | 3 | 4 | 5; // 1 = lowest, 5 = highest

export interface HabitCompletion {
  date: Date;
  completed: boolean;
  note?: string;
}

export class Habit {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public name: string,
    public description: string | null,
    public frequency: HabitFrequency,
    public priority: HabitPriority,
    public estimatedDurationMinutes: number,
    public preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime',
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public isActive: boolean,
    public completions: HabitCompletion[],
    public metadata?: Record<string, any>,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.id) {
      throw new Error('Habit ID is required');
    }
    if (!this.userId) {
      throw new Error('User ID is required');
    }
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Habit name is required');
    }
    if (this.estimatedDurationMinutes <= 0) {
      throw new Error('Estimated duration must be positive');
    }
    if (this.priority < 1 || this.priority > 5) {
      throw new Error('Priority must be between 1 and 5');
    }
  }

  /**
   * Check if habit was completed on a specific date
   */
  wasCompletedOn(date: Date): boolean {
    const dateStr = this.toDateString(date);
    return this.completions.some(
      (c) => c.completed && this.toDateString(c.date) === dateStr,
    );
  }

  /**
   * Mark habit as completed for a specific date
   */
  markCompleted(date: Date, note?: string): Habit {
    const dateStr = this.toDateString(date);
    const existingIndex = this.completions.findIndex(
      (c) => this.toDateString(c.date) === dateStr,
    );

    const newCompletions = [...this.completions];
    if (existingIndex >= 0) {
      newCompletions[existingIndex] = {
        date,
        completed: true,
        note,
      };
    } else {
      newCompletions.push({
        date,
        completed: true,
        note,
      });
    }

    return new Habit(
      this.id,
      this.userId,
      this.name,
      this.description,
      this.frequency,
      this.priority,
      this.estimatedDurationMinutes,
      this.preferredTimeOfDay,
      this.createdAt,
      new Date(),
      this.isActive,
      newCompletions,
      this.metadata,
    );
  }

  /**
   * Calculate current streak (consecutive days completed)
   */
  getCurrentStreak(): number {
    if (this.completions.length === 0) {
      return 0;
    }

    // Sort completions by date descending
    const sortedCompletions = [...this.completions]
      .filter((c) => c.completed)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    if (sortedCompletions.length === 0) {
      return 0;
    }

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Check if completed today or yesterday (for daily habits)
    if (this.frequency === 'daily') {
      for (let i = 0; i < sortedCompletions.length; i++) {
        const completionDate = new Date(sortedCompletions[i].date);
        completionDate.setHours(0, 0, 0, 0);

        const daysDiff = Math.floor(
          (currentDate.getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysDiff === streak) {
          streak++;
        } else {
          break;
        }
      }
    }

    return streak;
  }

  /**
   * Get longest streak
   */
  getLongestStreak(): number {
    if (this.completions.length === 0) {
      return 0;
    }

    const sortedCompletions = [...this.completions]
      .filter((c) => c.completed)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    let maxStreak = 0;
    let currentStreak = 0;
    let previousDate: Date | null = null;

    for (const completion of sortedCompletions) {
      const completionDate = new Date(completion.date);
      completionDate.setHours(0, 0, 0, 0);

      if (previousDate === null) {
        currentStreak = 1;
      } else {
        const daysDiff = Math.floor(
          (completionDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysDiff === 1) {
          currentStreak++;
        } else {
          maxStreak = Math.max(maxStreak, currentStreak);
          currentStreak = 1;
        }
      }

      previousDate = completionDate;
    }

    return Math.max(maxStreak, currentStreak);
  }

  /**
   * Get completion rate for the last N days
   */
  getCompletionRate(days: number): number {
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const relevantCompletions = this.completions.filter((c) => c.date >= startDate);

    if (relevantCompletions.length === 0) {
      return 0;
    }

    const completedCount = relevantCompletions.filter((c) => c.completed).length;
    return completedCount / days;
  }

  /**
   * Check if habit is due today
   */
  isDueToday(): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!this.isActive) {
      return false;
    }

    // Check if already completed today
    if (this.wasCompletedOn(today)) {
      return false;
    }

    // Check frequency
    switch (this.frequency) {
      case 'daily':
        return true;
      case 'weekly':
        // For simplicity, assume weekly habits are due on Monday
        return today.getDay() === 1;
      case 'monthly':
        // For simplicity, assume monthly habits are due on the 1st
        return today.getDate() === 1;
      default:
        return false;
    }
  }

  /**
   * Update habit details
   */
  update(updates: {
    name?: string;
    description?: string | null;
    frequency?: HabitFrequency;
    priority?: HabitPriority;
    estimatedDurationMinutes?: number;
    preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime';
    isActive?: boolean;
    metadata?: Record<string, any>;
  }): Habit {
    return new Habit(
      this.id,
      this.userId,
      updates.name ?? this.name,
      updates.description !== undefined ? updates.description : this.description,
      updates.frequency ?? this.frequency,
      updates.priority ?? this.priority,
      updates.estimatedDurationMinutes ?? this.estimatedDurationMinutes,
      updates.preferredTimeOfDay ?? this.preferredTimeOfDay,
      this.createdAt,
      new Date(),
      updates.isActive ?? this.isActive,
      this.completions,
      updates.metadata ?? this.metadata,
    );
  }

  private toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Convert to plain object (for serialization)
   */
  toObject(): Record<string, any> {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      description: this.description,
      frequency: this.frequency,
      priority: this.priority,
      estimatedDurationMinutes: this.estimatedDurationMinutes,
      preferredTimeOfDay: this.preferredTimeOfDay,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      isActive: this.isActive,
      completions: this.completions.map((c) => ({
        date: c.date.toISOString(),
        completed: c.completed,
        note: c.note,
      })),
      metadata: this.metadata,
    };
  }

  /**
   * Create from plain object
   */
  static fromObject(obj: any): Habit {
    return new Habit(
      obj.id,
      obj.userId,
      obj.name,
      obj.description,
      obj.frequency,
      obj.priority,
      obj.estimatedDurationMinutes,
      obj.preferredTimeOfDay,
      new Date(obj.createdAt),
      new Date(obj.updatedAt),
      obj.isActive,
      obj.completions?.map((c: any) => ({
        date: new Date(c.date),
        completed: c.completed,
        note: c.note,
      })) || [],
      obj.metadata,
    );
  }
}
