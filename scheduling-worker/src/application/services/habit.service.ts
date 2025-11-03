import { Injectable, Logger, Inject } from '@nestjs/common';
import { Habit, HabitFrequency, HabitPriority } from '../../domain/entities';
import { IHabitRepository } from '../ports/repositories.port';

/**
 * Habit Application Service
 *
 * Business logic for habit management
 *
 * Application Layer - Orchestrates domain logic
 */
@Injectable()
export class HabitService {
  private readonly logger = new Logger(HabitService.name);

  constructor(
    @Inject('IHabitRepository')
    private readonly habitRepository: IHabitRepository,
  ) {
    this.logger.log('HabitService initialized');
  }

  /**
   * Create a new habit
   */
  async createHabit(data: {
    userId: string;
    name: string;
    description?: string;
    frequency: HabitFrequency;
    priority: HabitPriority;
    estimatedDurationMinutes: number;
    preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
    metadata?: Record<string, unknown>;
  }): Promise<Habit> {
    this.logger.log(`Creating habit for user: ${data.userId}`);

    const habit = new Habit(
      this.generateId(),
      data.userId,
      data.name,
      data.description || null,
      data.frequency,
      data.priority,
      data.estimatedDurationMinutes,
      data.preferredTimeOfDay,
      new Date(),
      new Date(),
      true,
      [],
      data.metadata,
    );

    const saved = await this.habitRepository.save(habit);
    this.logger.log(`Created habit: ${saved.id}`);
    return saved;
  }

  /**
   * Get habit by ID
   */
  async getHabit(id: string): Promise<Habit | null> {
    return await this.habitRepository.findById(id);
  }

  /**
   * Get all habits for a user
   */
  async getUserHabits(userId: string): Promise<Habit[]> {
    return await this.habitRepository.findByUserId(userId);
  }

  /**
   * Get active habits for a user
   */
  async getActiveHabits(userId: string): Promise<Habit[]> {
    return await this.habitRepository.findActiveByUserId(userId);
  }

  /**
   * Get habits due today
   */
  async getHabitsDueToday(userId: string): Promise<Habit[]> {
    return await this.habitRepository.findDueToday(userId);
  }

  /**
   * Mark habit as completed for today
   */
  async completeHabit(id: string, note?: string): Promise<Habit> {
    this.logger.log(`Completing habit: ${id}`);

    const habit = await this.habitRepository.findById(id);
    if (!habit) {
      throw new Error(`Habit ${id} not found`);
    }

    const updated = habit.markCompleted(new Date(), note);
    await this.habitRepository.update(id, {
      completions: updated.completions,
      updatedAt: updated.updatedAt,
    });

    this.logger.log(`Completed habit: ${id}`);
    return updated;
  }

  /**
   * Update habit details
   */
  async updateHabit(
    id: string,
    updates: {
      name?: string;
      description?: string | null;
      frequency?: HabitFrequency;
      priority?: HabitPriority;
      estimatedDurationMinutes?: number;
      preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime';
      isActive?: boolean;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Habit> {
    this.logger.log(`Updating habit: ${id}`);

    const habit = await this.habitRepository.findById(id);
    if (!habit) {
      throw new Error(`Habit ${id} not found`);
    }

    const updated = habit.update(updates);
    await this.habitRepository.update(id, {
      ...updates,
      updatedAt: updated.updatedAt,
    });

    this.logger.log(`Updated habit: ${id}`);
    return updated;
  }

  /**
   * Delete a habit
   */
  async deleteHabit(id: string): Promise<void> {
    this.logger.log(`Deleting habit: ${id}`);
    await this.habitRepository.delete(id);
    this.logger.log(`Deleted habit: ${id}`);
  }

  /**
   * Get habit statistics
   */
  async getHabitStats(id: string): Promise<{
    currentStreak: number;
    longestStreak: number;
    completionRate30Days: number;
    completionRate90Days: number;
  }> {
    const habit = await this.habitRepository.findById(id);
    if (!habit) {
      throw new Error(`Habit ${id} not found`);
    }

    return {
      currentStreak: habit.getCurrentStreak(),
      longestStreak: habit.getLongestStreak(),
      completionRate30Days: habit.getCompletionRate(30),
      completionRate90Days: habit.getCompletionRate(90),
    };
  }

  /**
   * Get unmet habits (due but not completed)
   */
  async getUnmetHabits(userId: string): Promise<Habit[]> {
    const dueHabits = await this.getHabitsDueToday(userId);
    return dueHabits.filter((h) => !h.wasCompletedOn(new Date()));
  }

  private generateId(): string {
    return `habit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
