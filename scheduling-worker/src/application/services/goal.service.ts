import { Injectable, Logger, Inject } from '@nestjs/common';
import { Goal, GoalPriority, GoalStatus, Milestone } from '../../domain/entities';
import { IGoalRepository } from '../ports/repositories.port';

/**
 * Goal Application Service
 * 
 * Business logic for goal management
 * 
 * Application Layer - Orchestrates domain logic
 */
@Injectable()
export class GoalService {
  private readonly logger = new Logger(GoalService.name);

  constructor(
    @Inject('IGoalRepository')
    private readonly goalRepository: IGoalRepository,
  ) {
    this.logger.log('GoalService initialized');
  }

  /**
   * Create a new goal
   */
  async createGoal(data: {
    userId: string;
    title: string;
    description?: string;
    priority: GoalPriority;
    targetDate?: Date;
    estimatedTimeRequired: number;
    dependsOn?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<Goal> {
    this.logger.log(`Creating goal for user: ${data.userId}`);

    const goal = new Goal(
      this.generateId(),
      data.userId,
      data.title,
      data.description || null,
      data.priority,
      'not_started',
      data.targetDate || null,
      data.estimatedTimeRequired,
      0, // timeSpent
      0, // progressPercentage
      [],
      [],
      new Date(),
      new Date(),
      true,
      data.dependsOn || [],
      data.metadata,
    );

    const saved = await this.goalRepository.save(goal);
    this.logger.log(`Created goal: ${saved.id}`);
    return saved;
  }

  /**
   * Get goal by ID
   */
  async getGoal(id: string): Promise<Goal | null> {
    return await this.goalRepository.findById(id);
  }

  /**
   * Get all goals for a user
   */
  async getUserGoals(userId: string): Promise<Goal[]> {
    return await this.goalRepository.findByUserId(userId);
  }

  /**
   * Get active goals for a user
   */
  async getActiveGoals(userId: string): Promise<Goal[]> {
    return await this.goalRepository.findActiveByUserId(userId);
  }

  /**
   * Update goal progress
   */
  async updateProgress(id: string, progress: number, note?: string): Promise<Goal> {
    this.logger.log(`Updating progress for goal: ${id} to ${progress}%`);

    const goal = await this.goalRepository.findById(id);
    if (!goal) {
      throw new Error(`Goal ${id} not found`);
    }

    const updated = goal.updateProgress(progress, note);
    await this.goalRepository.update(id, {
      progressPercentage: updated.progressPercentage,
      status: updated.status,
      progressHistory: updated.progressHistory,
      updatedAt: updated.updatedAt,
    });

    this.logger.log(`Updated goal progress: ${id}`);
    return updated;
  }

  /**
   * Add time spent on a goal
   */
  async addTimeSpent(id: string, minutes: number): Promise<Goal> {
    this.logger.log(`Adding ${minutes} minutes to goal: ${id}`);

    const goal = await this.goalRepository.findById(id);
    if (!goal) {
      throw new Error(`Goal ${id} not found`);
    }

    const updated = goal.addTimeSpent(minutes);
    await this.goalRepository.update(id, {
      timeSpent: updated.timeSpent,
      updatedAt: updated.updatedAt,
    });

    this.logger.log(`Updated time spent for goal: ${id}`);
    return updated;
  }

  /**
   * Add or update a milestone
   */
  async updateMilestone(id: string, milestone: Milestone): Promise<Goal> {
    this.logger.log(`Updating milestone for goal: ${id}`);

    const goal = await this.goalRepository.findById(id);
    if (!goal) {
      throw new Error(`Goal ${id} not found`);
    }

    const updated = goal.updateMilestone(milestone);
    await this.goalRepository.update(id, {
      milestones: updated.milestones,
      updatedAt: updated.updatedAt,
    });

    this.logger.log(`Updated milestone for goal: ${id}`);
    return updated;
  }

  /**
   * Complete a milestone
   */
  async completeMilestone(goalId: string, milestoneId: string): Promise<Goal> {
    this.logger.log(`Completing milestone ${milestoneId} for goal: ${goalId}`);

    const goal = await this.goalRepository.findById(goalId);
    if (!goal) {
      throw new Error(`Goal ${goalId} not found`);
    }

    const updated = goal.completeMilestone(milestoneId);
    await this.goalRepository.update(goalId, {
      milestones: updated.milestones,
      updatedAt: updated.updatedAt,
    });

    this.logger.log(`Completed milestone ${milestoneId}`);
    return updated;
  }

  /**
   * Update goal details
   */
  async updateGoal(
    id: string,
    updates: {
      title?: string;
      description?: string | null;
      priority?: GoalPriority;
      status?: GoalStatus;
      targetDate?: Date | null;
      estimatedTimeRequired?: number;
      isActive?: boolean;
      dependsOn?: string[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<Goal> {
    this.logger.log(`Updating goal: ${id}`);

    const goal = await this.goalRepository.findById(id);
    if (!goal) {
      throw new Error(`Goal ${id} not found`);
    }

    const updated = goal.update(updates);
    await this.goalRepository.update(id, {
      ...updates,
      updatedAt: updated.updatedAt,
    });

    this.logger.log(`Updated goal: ${id}`);
    return updated;
  }

  /**
   * Delete a goal
   */
  async deleteGoal(id: string): Promise<void> {
    this.logger.log(`Deleting goal: ${id}`);
    await this.goalRepository.delete(id);
    this.logger.log(`Deleted goal: ${id}`);
  }

  /**
   * Get overdue goals
   */
  async getOverdueGoals(userId: string): Promise<Goal[]> {
    return await this.goalRepository.findOverdue(userId);
  }

  /**
   * Get goals due soon
   */
  async getGoalsDueSoon(userId: string, daysThreshold: number = 7): Promise<Goal[]> {
    return await this.goalRepository.findDueSoon(userId, daysThreshold);
  }

  /**
   * Get unmet goals (active goals that should be worked on)
   */
  async getUnmetGoals(userId: string): Promise<Goal[]> {
    const allGoals = await this.getUserGoals(userId);
    const activeGoals = await this.getActiveGoals(userId);
    
    return activeGoals.filter((goal) => goal.shouldBeScheduled(allGoals));
  }

  /**
   * Get goal statistics
   */
  async getGoalStats(id: string): Promise<{
    milestoneCompletionRate: number;
    remainingTimeEstimate: number;
    isOverdue: boolean;
    isDueSoon: boolean;
  }> {
    const goal = await this.goalRepository.findById(id);
    if (!goal) {
      throw new Error(`Goal ${id} not found`);
    }

    return {
      milestoneCompletionRate: goal.getMilestoneCompletionRate(),
      remainingTimeEstimate: goal.getRemainingTimeEstimate(),
      isOverdue: goal.isOverdue(),
      isDueSoon: goal.isDueSoon(),
    };
  }

  private generateId(): string {
    return `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
