/**
 * Goal Entity
 * 
 * Represents a long-term goal with milestones and progress tracking
 * 
 * Domain Entity - No infrastructure dependencies
 */

export type GoalPriority = 1 | 2 | 3 | 4 | 5; // 1 = lowest, 5 = highest
export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'abandoned';

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  targetDate?: Date;
  completed: boolean;
  completedAt?: Date;
}

export interface GoalProgress {
  date: Date;
  progressPercentage: number; // 0-100
  note?: string;
}

export class Goal {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public title: string,
    public description: string | null,
    public priority: GoalPriority,
    public status: GoalStatus,
    public targetDate: Date | null,
    public estimatedTimeRequired: number, // in minutes
    public timeSpent: number, // in minutes
    public progressPercentage: number, // 0-100
    public milestones: Milestone[],
    public progressHistory: GoalProgress[],
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public isActive: boolean,
    public dependsOn: string[], // IDs of other goals
    public metadata?: Record<string, any>,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.id) {
      throw new Error('Goal ID is required');
    }
    if (!this.userId) {
      throw new Error('User ID is required');
    }
    if (!this.title || this.title.trim().length === 0) {
      throw new Error('Goal title is required');
    }
    if (this.priority < 1 || this.priority > 5) {
      throw new Error('Priority must be between 1 and 5');
    }
    if (this.progressPercentage < 0 || this.progressPercentage > 100) {
      throw new Error('Progress percentage must be between 0 and 100');
    }
    if (this.estimatedTimeRequired < 0) {
      throw new Error('Estimated time required must be non-negative');
    }
    if (this.timeSpent < 0) {
      throw new Error('Time spent must be non-negative');
    }
  }

  /**
   * Update progress
   */
  updateProgress(newProgress: number, note?: string): Goal {
    if (newProgress < 0 || newProgress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }

    const newProgressHistory = [
      ...this.progressHistory,
      {
        date: new Date(),
        progressPercentage: newProgress,
        note,
      },
    ];

    // Update status based on progress
    let newStatus = this.status;
    if (newProgress === 100) {
      newStatus = 'completed';
    } else if (newProgress > 0 && this.status === 'not_started') {
      newStatus = 'in_progress';
    }

    return new Goal(
      this.id,
      this.userId,
      this.title,
      this.description,
      this.priority,
      newStatus,
      this.targetDate,
      this.estimatedTimeRequired,
      this.timeSpent,
      newProgress,
      this.milestones,
      newProgressHistory,
      this.createdAt,
      new Date(),
      this.isActive,
      this.dependsOn,
      this.metadata,
    );
  }

  /**
   * Add time spent on this goal
   */
  addTimeSpent(minutes: number): Goal {
    if (minutes <= 0) {
      throw new Error('Minutes must be positive');
    }

    return new Goal(
      this.id,
      this.userId,
      this.title,
      this.description,
      this.priority,
      this.status,
      this.targetDate,
      this.estimatedTimeRequired,
      this.timeSpent + minutes,
      this.progressPercentage,
      this.milestones,
      this.progressHistory,
      this.createdAt,
      new Date(),
      this.isActive,
      this.dependsOn,
      this.metadata,
    );
  }

  /**
   * Add or update a milestone
   */
  updateMilestone(milestone: Milestone): Goal {
    const existingIndex = this.milestones.findIndex((m) => m.id === milestone.id);

    const newMilestones = [...this.milestones];
    if (existingIndex >= 0) {
      newMilestones[existingIndex] = milestone;
    } else {
      newMilestones.push(milestone);
    }

    return new Goal(
      this.id,
      this.userId,
      this.title,
      this.description,
      this.priority,
      this.status,
      this.targetDate,
      this.estimatedTimeRequired,
      this.timeSpent,
      this.progressPercentage,
      newMilestones,
      this.progressHistory,
      this.createdAt,
      new Date(),
      this.isActive,
      this.dependsOn,
      this.metadata,
    );
  }

  /**
   * Mark milestone as completed
   */
  completeMilestone(milestoneId: string): Goal {
    const milestone = this.milestones.find((m) => m.id === milestoneId);
    if (!milestone) {
      throw new Error(`Milestone ${milestoneId} not found`);
    }

    const updatedMilestone: Milestone = {
      ...milestone,
      completed: true,
      completedAt: new Date(),
    };

    return this.updateMilestone(updatedMilestone);
  }

  /**
   * Get completion percentage of milestones
   */
  getMilestoneCompletionRate(): number {
    if (this.milestones.length === 0) {
      return 0;
    }

    const completedCount = this.milestones.filter((m) => m.completed).length;
    return (completedCount / this.milestones.length) * 100;
  }

  /**
   * Get remaining time estimate
   */
  getRemainingTimeEstimate(): number {
    const remainingProgress = 100 - this.progressPercentage;
    if (this.progressPercentage === 0) {
      return this.estimatedTimeRequired;
    }

    // Estimate based on current progress
    const timePerPercent = this.timeSpent / this.progressPercentage;
    return Math.ceil(timePerPercent * remainingProgress);
  }

  /**
   * Check if goal is overdue
   */
  isOverdue(): boolean {
    if (!this.targetDate) {
      return false;
    }

    return new Date() > this.targetDate && this.status !== 'completed';
  }

  /**
   * Check if goal is due soon (within X days)
   */
  isDueSoon(daysThreshold: number = 7): boolean {
    if (!this.targetDate || this.status === 'completed') {
      return false;
    }

    const now = new Date();
    const daysUntilDue = Math.ceil(
      (this.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    return daysUntilDue > 0 && daysUntilDue <= daysThreshold;
  }

  /**
   * Check if all dependencies are completed
   */
  areDependenciesMet(allGoals: Goal[]): boolean {
    if (this.dependsOn.length === 0) {
      return true;
    }

    return this.dependsOn.every((depId) => {
      const depGoal = allGoals.find((g) => g.id === depId);
      return depGoal?.status === 'completed';
    });
  }

  /**
   * Check if goal should be scheduled (active, not completed, dependencies met)
   */
  shouldBeScheduled(allGoals: Goal[]): boolean {
    return (
      this.isActive &&
      this.status !== 'completed' &&
      this.status !== 'abandoned' &&
      this.areDependenciesMet(allGoals)
    );
  }

  /**
   * Update goal details
   */
  update(updates: {
    title?: string;
    description?: string | null;
    priority?: GoalPriority;
    status?: GoalStatus;
    targetDate?: Date | null;
    estimatedTimeRequired?: number;
    isActive?: boolean;
    dependsOn?: string[];
    metadata?: Record<string, any>;
  }): Goal {
    return new Goal(
      this.id,
      this.userId,
      updates.title ?? this.title,
      updates.description !== undefined ? updates.description : this.description,
      updates.priority ?? this.priority,
      updates.status ?? this.status,
      updates.targetDate !== undefined ? updates.targetDate : this.targetDate,
      updates.estimatedTimeRequired ?? this.estimatedTimeRequired,
      this.timeSpent,
      this.progressPercentage,
      this.milestones,
      this.progressHistory,
      this.createdAt,
      new Date(),
      updates.isActive ?? this.isActive,
      updates.dependsOn ?? this.dependsOn,
      updates.metadata ?? this.metadata,
    );
  }

  /**
   * Convert to plain object (for serialization)
   */
  toObject(): Record<string, any> {
    return {
      id: this.id,
      userId: this.userId,
      title: this.title,
      description: this.description,
      priority: this.priority,
      status: this.status,
      targetDate: this.targetDate?.toISOString() || null,
      estimatedTimeRequired: this.estimatedTimeRequired,
      timeSpent: this.timeSpent,
      progressPercentage: this.progressPercentage,
      milestones: this.milestones.map((m) => ({
        ...m,
        targetDate: m.targetDate?.toISOString(),
        completedAt: m.completedAt?.toISOString(),
      })),
      progressHistory: this.progressHistory.map((p) => ({
        date: p.date.toISOString(),
        progressPercentage: p.progressPercentage,
        note: p.note,
      })),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      isActive: this.isActive,
      dependsOn: this.dependsOn,
      metadata: this.metadata,
    };
  }

  /**
   * Create from plain object
   */
  static fromObject(obj: any): Goal {
    return new Goal(
      obj.id,
      obj.userId,
      obj.title,
      obj.description,
      obj.priority,
      obj.status,
      obj.targetDate ? new Date(obj.targetDate) : null,
      obj.estimatedTimeRequired,
      obj.timeSpent,
      obj.progressPercentage,
      obj.milestones?.map((m: any) => ({
        ...m,
        targetDate: m.targetDate ? new Date(m.targetDate) : undefined,
        completedAt: m.completedAt ? new Date(m.completedAt) : undefined,
      })) || [],
      obj.progressHistory?.map((p: any) => ({
        date: new Date(p.date),
        progressPercentage: p.progressPercentage,
        note: p.note,
      })) || [],
      new Date(obj.createdAt),
      new Date(obj.updatedAt),
      obj.isActive,
      obj.dependsOn || [],
      obj.metadata,
    );
  }
}
