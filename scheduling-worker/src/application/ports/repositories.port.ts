/**
 * Repository Ports - Interfaces for data persistence
 */

import {
  CalendarEvent,
  Habit,
  Goal,
  ActivityPattern,
  ActivityEvent,
  Task,
} from '../../domain/entities';

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

/**
 * Activity Pattern Repository Port
 */
export interface IActivityPatternRepository {
  /**
   * Save an activity pattern
   */
  save(pattern: ActivityPattern): Promise<ActivityPattern>;

  /**
   * Find pattern by ID
   */
  findById(id: string): Promise<ActivityPattern | null>;

  /**
   * Find pattern by user ID
   */
  findByUserId(userId: string): Promise<ActivityPattern | null>;

  /**
   * Find patterns by user ID and pattern type
   */
  findByUserIdAndType(
    userId: string,
    patternType: ActivityPattern['patternType'],
  ): Promise<ActivityPattern | null>;

  /**
   * Update a pattern
   */
  update(
    id: string,
    pattern: Partial<ActivityPattern>,
  ): Promise<ActivityPattern>;

  /**
   * Delete a pattern
   */
  delete(id: string): Promise<void>;
}

/**
 * Activity Event Repository Port
 */
export interface IActivityEventRepository {
  /**
   * Save an activity event
   */
  save(event: ActivityEvent): Promise<ActivityEvent>;

  /**
   * Find event by ID
   */
  findById(id: string): Promise<ActivityEvent | null>;

  /**
   * Find events by user ID
   */
  findByUserId(userId: string): Promise<ActivityEvent[]>;

  /**
   * Find events by event ID (calendar event ID)
   */
  findByEventId(eventId: string): Promise<ActivityEvent | null>;

  /**
   * Find events in a date range
   */
  findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ActivityEvent[]>;

  /**
   * Find completed events
   */
  findCompletedByUserId(userId: string): Promise<ActivityEvent[]>;

  /**
   * Delete an event
   */
  delete(id: string): Promise<void>;
}

/**
 * Task Repository Port
 */
export interface ITaskRepository {
  /**
   * Save a task
   */
  save(task: Task): Promise<Task>;

  /**
   * Find task by ID
   */
  findById(id: string): Promise<Task | null>;

  /**
   * Find tasks by date range
   */
  findByDateRange(
    startDate: Date,
    endDate: Date,
    userId?: string,
  ): Promise<Task[]>;

  /**
   * Find tasks by category
   */
  findByCategory(
    category: string,
    startDate: Date,
    endDate: Date,
    userId?: string,
  ): Promise<Task[]>;

  /**
   * Find locked tasks in date range
   */
  findLockedTasks(
    startDate: Date,
    endDate: Date,
    userId?: string,
  ): Promise<Task[]>;

  /**
   * Find unlocked tasks in date range
   */
  findUnlockedTasks(
    startDate: Date,
    endDate: Date,
    userId?: string,
  ): Promise<Task[]>;

  /**
   * Find tasks by status
   */
  findByStatus(
    status: Task['completionStatus'],
    startDate: Date,
    endDate: Date,
    userId?: string,
  ): Promise<Task[]>;

  /**
   * Find tasks by priority
   */
  findByPriority(
    priority: Task['priority'],
    startDate: Date,
    endDate: Date,
    userId?: string,
  ): Promise<Task[]>;

  /**
   * Find tasks by user ID
   */
  findByUserId(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Task[]>;

  /**
   * Find tasks by parent task ID (for split tasks)
   */
  findByParentTaskId(parentTaskId: string): Promise<Task[]>;

  /**
   * Find tasks by split from task ID
   */
  findBySplitFromTaskId(splitFromTaskId: string): Promise<Task[]>;

  /**
   * Update a task
   */
  update(task: Task): Promise<Task>;

  /**
   * Delete a task
   */
  delete(id: string): Promise<boolean>;

  /**
   * Find tasks with filters
   */
  findWithFilters(filters: {
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    category?: string;
    priority?: Task['priority'];
    status?: Task['completionStatus'];
    isLocked?: boolean;
    tags?: string[];
  }): Promise<Task[]>;
}
