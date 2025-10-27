/**
 * Repository Ports - Interfaces for data persistence
 */

import { CalendarEvent, Habit, Goal } from '../../domain/entities';

/**
 * Calendar Event Repository Port
 */
export interface ICalendarEventRepository {
  /**
   * Save a calendar event
   */
  save(event: CalendarEvent): Promise<CalendarEvent>;

  /**
   * Find event by ID
   */
  findById(id: string): Promise<CalendarEvent | null>;

  /**
   * Find events by calendar ID
   */
  findByCalendarId(calendarId: string): Promise<CalendarEvent[]>;

  /**
   * Find events in a time range
   */
  findInTimeRange(
    calendarId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<CalendarEvent[]>;

  /**
   * Find events by user ID
   */
  findByUserId(userId: string): Promise<CalendarEvent[]>;

  /**
   * Update an event
   */
  update(id: string, event: Partial<CalendarEvent>): Promise<CalendarEvent>;

  /**
   * Delete an event
   */
  delete(id: string): Promise<void>;

  /**
   * Batch save events
   */
  batchSave(events: CalendarEvent[]): Promise<CalendarEvent[]>;

  /**
   * Delete all events for a calendar
   */
  deleteByCalendarId(calendarId: string): Promise<void>;
}

/**
 * Habit Repository Port
 */
export interface IHabitRepository {
  /**
   * Save a habit
   */
  save(habit: Habit): Promise<Habit>;

  /**
   * Find habit by ID
   */
  findById(id: string): Promise<Habit | null>;

  /**
   * Find all habits for a user
   */
  findByUserId(userId: string): Promise<Habit[]>;

  /**
   * Find active habits for a user
   */
  findActiveByUserId(userId: string): Promise<Habit[]>;

  /**
   * Find habits due today
   */
  findDueToday(userId: string): Promise<Habit[]>;

  /**
   * Update a habit
   */
  update(id: string, habit: Partial<Habit>): Promise<Habit>;

  /**
   * Delete a habit
   */
  delete(id: string): Promise<void>;
}

/**
 * Goal Repository Port
 */
export interface IGoalRepository {
  /**
   * Save a goal
   */
  save(goal: Goal): Promise<Goal>;

  /**
   * Find goal by ID
   */
  findById(id: string): Promise<Goal | null>;

  /**
   * Find all goals for a user
   */
  findByUserId(userId: string): Promise<Goal[]>;

  /**
   * Find active goals for a user
   */
  findActiveByUserId(userId: string): Promise<Goal[]>;

  /**
   * Find goals by status
   */
  findByStatus(userId: string, status: Goal['status']): Promise<Goal[]>;

  /**
   * Find overdue goals
   */
  findOverdue(userId: string): Promise<Goal[]>;

  /**
   * Find goals due soon (within X days)
   */
  findDueSoon(userId: string, daysThreshold: number): Promise<Goal[]>;

  /**
   * Update a goal
   */
  update(id: string, goal: Partial<Goal>): Promise<Goal>;

  /**
   * Delete a goal
   */
  delete(id: string): Promise<void>;
}
