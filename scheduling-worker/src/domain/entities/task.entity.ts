/**
 * Task Entity
 *
 * Represents a task (completable calendar event) with additional task-specific fields.
 * Tasks extend calendar events but are the primary unit for internal scheduling.
 *
 * Domain Entity - No infrastructure dependencies
 */

import {
  CalendarEvent,
  EventAttendee,
  EventReminder,
  EventRecurrence,
} from './calendar-event.entity';

export type TaskCompletionStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'partially-completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export class Task extends CalendarEvent {
  constructor(
    id: string,
    calendarId: string,
    title: string,
    description: string | null,
    startTime: Date,
    endTime: Date,
    location: string | null,
    attendees: EventAttendee[],
    reminders: EventReminder[],
    recurrence: EventRecurrence | null,
    createdAt: Date,
    updatedAt: Date,
    source: 'google' | 'internal' = 'internal',
    metadata?: Record<string, any>,
    // Task-specific fields
    public completionStatus: TaskCompletionStatus = 'pending',
    public completionPercentage: number = 0,
    public isLocked: boolean = false,
    public estimatedDuration?: number,
    public actualDuration?: number,
    public category?: string,
    public priority?: TaskPriority,
    public tags?: string[],
    public parentTaskId?: string,
    public splitFromTaskId?: string,
    public completedAt?: Date,
    public lockedAt?: Date,
  ) {
    super(
      id,
      calendarId,
      title,
      description,
      startTime,
      endTime,
      location,
      attendees,
      reminders,
      recurrence,
      createdAt,
      updatedAt,
      source,
      metadata,
    );
    this.validateTask();
  }

  private validateTask(): void {
    if (this.completionPercentage < 0 || this.completionPercentage > 100) {
      throw new Error('Completion percentage must be between 0 and 100');
    }
    if (this.estimatedDuration && this.estimatedDuration <= 0) {
      throw new Error('Estimated duration must be positive');
    }
    if (this.actualDuration && this.actualDuration <= 0) {
      throw new Error('Actual duration must be positive');
    }
    if (
      this.completionStatus === 'completed' &&
      this.completionPercentage !== 100
    ) {
      throw new Error('Completed tasks must have 100% completion percentage');
    }
    if (
      this.completionStatus === 'partially-completed' &&
      this.completionPercentage === 100
    ) {
      throw new Error(
        'Partially completed tasks cannot have 100% completion percentage',
      );
    }
  }

  /**
   * Mark task as complete
   */
  markComplete(actualDuration?: number, notes?: string): Task {
    return new Task(
      this.id,
      this.calendarId,
      this.title,
      this.description,
      this.startTime,
      this.endTime,
      this.location,
      this.attendees,
      this.reminders,
      this.recurrence,
      this.createdAt,
      new Date(),
      this.source,
      { ...this.metadata, completionNotes: notes },
      'completed',
      100,
      this.isLocked,
      this.estimatedDuration,
      actualDuration ?? this.actualDuration,
      this.category,
      this.priority,
      this.tags,
      this.parentTaskId,
      this.splitFromTaskId,
      new Date(),
      this.lockedAt,
    );
  }

  /**
   * Mark task as partially complete
   */
  markPartiallyComplete(
    completionPercentage: number,
    actualDuration?: number,
    notes?: string,
  ): Task {
    if (completionPercentage <= 0 || completionPercentage >= 100) {
      throw new Error('Partial completion percentage must be between 1 and 99');
    }
    return new Task(
      this.id,
      this.calendarId,
      this.title,
      this.description,
      this.startTime,
      this.endTime,
      this.location,
      this.attendees,
      this.reminders,
      this.recurrence,
      this.createdAt,
      new Date(),
      this.source,
      { ...this.metadata, completionNotes: notes },
      'partially-completed',
      completionPercentage,
      this.isLocked,
      this.estimatedDuration,
      actualDuration ?? this.actualDuration,
      this.category,
      this.priority,
      this.tags,
      this.parentTaskId,
      this.splitFromTaskId,
      this.completedAt,
      this.lockedAt,
    );
  }

  /**
   * Lock or unlock task
   */
  setLocked(locked: boolean): Task {
    return new Task(
      this.id,
      this.calendarId,
      this.title,
      this.description,
      this.startTime,
      this.endTime,
      this.location,
      this.attendees,
      this.reminders,
      this.recurrence,
      this.createdAt,
      new Date(),
      this.source,
      this.metadata,
      this.completionStatus,
      this.completionPercentage,
      locked,
      this.estimatedDuration,
      this.actualDuration,
      this.category,
      this.priority,
      this.tags,
      this.parentTaskId,
      this.splitFromTaskId,
      this.completedAt,
      locked ? new Date() : this.lockedAt,
    );
  }

  /**
   * Defer task to new time
   */
  defer(newStartTime: Date, newEndTime: Date): Task {
    if (newEndTime <= newStartTime) {
      throw new Error('New end time must be after new start time');
    }
    return new Task(
      this.id,
      this.calendarId,
      this.title,
      this.description,
      newStartTime,
      newEndTime,
      this.location,
      this.attendees,
      this.reminders,
      this.recurrence,
      this.createdAt,
      new Date(),
      this.source,
      this.metadata,
      this.completionStatus,
      this.completionPercentage,
      this.isLocked,
      this.estimatedDuration,
      this.actualDuration,
      this.category,
      this.priority,
      this.tags,
      this.parentTaskId,
      this.splitFromTaskId,
      this.completedAt,
      this.lockedAt,
    );
  }

  /**
   * Update task details
   */
  updateTask(updates: {
    title?: string;
    description?: string | null;
    location?: string | null;
    attendees?: EventAttendee[];
    reminders?: EventReminder[];
    recurrence?: EventRecurrence | null;
    category?: string;
    priority?: TaskPriority;
    tags?: string[];
    estimatedDuration?: number;
    metadata?: Record<string, any>;
  }): Task {
    return new Task(
      this.id,
      this.calendarId,
      updates.title ?? this.title,
      updates.description !== undefined
        ? updates.description
        : this.description,
      this.startTime,
      this.endTime,
      updates.location !== undefined ? updates.location : this.location,
      updates.attendees ?? this.attendees,
      updates.reminders ?? this.reminders,
      updates.recurrence !== undefined ? updates.recurrence : this.recurrence,
      this.createdAt,
      new Date(),
      this.source,
      updates.metadata ?? this.metadata,
      this.completionStatus,
      this.completionPercentage,
      this.isLocked,
      updates.estimatedDuration ?? this.estimatedDuration,
      this.actualDuration,
      updates.category ?? this.category,
      updates.priority ?? this.priority,
      updates.tags ?? this.tags,
      this.parentTaskId,
      this.splitFromTaskId,
      this.completedAt,
      this.lockedAt,
    );
  }

  /**
   * Create a duplicate of this task
   */
  duplicate(newId: string, newStartTime?: Date, newEndTime?: Date): Task {
    const startTime = newStartTime ?? this.startTime;
    const endTime = newEndTime ?? this.endTime;
    return new Task(
      newId,
      this.calendarId,
      this.title,
      this.description,
      startTime,
      endTime,
      this.location,
      [...this.attendees],
      [...this.reminders],
      this.recurrence,
      new Date(),
      new Date(),
      this.source,
      { ...this.metadata },
      'pending',
      0,
      false,
      this.estimatedDuration,
      undefined,
      this.category,
      this.priority,
      this.tags ? [...this.tags] : undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  }

  /**
   * Convert to plain object (for serialization)
   */
  toObject(): Record<string, any> {
    return {
      ...super.toObject(),
      completionStatus: this.completionStatus,
      completionPercentage: this.completionPercentage,
      isLocked: this.isLocked,
      estimatedDuration: this.estimatedDuration,
      actualDuration: this.actualDuration,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
      parentTaskId: this.parentTaskId,
      splitFromTaskId: this.splitFromTaskId,
      completedAt: this.completedAt?.toISOString(),
      lockedAt: this.lockedAt?.toISOString(),
    };
  }

  /**
   * Create from plain object
   */
  static fromObject(obj: any): Task {
    const calendarEvent = CalendarEvent.fromObject(obj);
    return new Task(
      calendarEvent.id,
      calendarEvent.calendarId,
      calendarEvent.title,
      calendarEvent.description,
      calendarEvent.startTime,
      calendarEvent.endTime,
      calendarEvent.location,
      calendarEvent.attendees,
      calendarEvent.reminders,
      calendarEvent.recurrence,
      calendarEvent.createdAt,
      calendarEvent.updatedAt,
      calendarEvent.source,
      calendarEvent.metadata,
      obj.completionStatus || 'pending',
      obj.completionPercentage || 0,
      obj.isLocked || false,
      obj.estimatedDuration,
      obj.actualDuration,
      obj.category,
      obj.priority,
      obj.tags,
      obj.parentTaskId,
      obj.splitFromTaskId,
      obj.completedAt ? new Date(obj.completedAt) : undefined,
      obj.lockedAt ? new Date(obj.lockedAt) : undefined,
    );
  }

  /**
   * Create from CalendarEvent
   */
  static fromCalendarEvent(
    event: CalendarEvent,
    taskFields?: {
      completionStatus?: TaskCompletionStatus;
      completionPercentage?: number;
      isLocked?: boolean;
      estimatedDuration?: number;
      actualDuration?: number;
      category?: string;
      priority?: TaskPriority;
      tags?: string[];
      parentTaskId?: string;
      splitFromTaskId?: string;
    },
  ): Task {
    return new Task(
      event.id,
      event.calendarId,
      event.title,
      event.description,
      event.startTime,
      event.endTime,
      event.location,
      event.attendees,
      event.reminders,
      event.recurrence,
      event.createdAt,
      event.updatedAt,
      event.source,
      event.metadata,
      taskFields?.completionStatus || 'pending',
      taskFields?.completionPercentage || 0,
      taskFields?.isLocked || false,
      taskFields?.estimatedDuration,
      taskFields?.actualDuration,
      taskFields?.category,
      taskFields?.priority,
      taskFields?.tags,
      taskFields?.parentTaskId,
      taskFields?.splitFromTaskId,
    );
  }
}
