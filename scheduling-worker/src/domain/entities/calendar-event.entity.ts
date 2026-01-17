/**
 * Calendar Event Entity
 *
 * Represents a calendar event (from Google Calendar or other sources)
 *
 * Domain Entity - No infrastructure dependencies
 */

export interface EventAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  optional?: boolean;
}

export interface EventReminder {
  method: 'email' | 'popup';
  minutes: number;
}

export interface EventRecurrence {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number; // e.g., every 2 weeks
  until?: Date;
  count?: number; // number of occurrences
  byDay?: string[]; // ['MO', 'WE', 'FR']
}

export class CalendarEvent {
  constructor(
    public readonly id: string,
    public readonly calendarId: string,
    public title: string,
    public description: string | null,
    public readonly startTime: Date,
    public readonly endTime: Date,
    public location: string | null,
    public attendees: EventAttendee[],
    public reminders: EventReminder[],
    public recurrence: EventRecurrence | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly source: 'google' | 'internal' = 'google',
    public metadata?: Record<string, any>,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.id) {
      throw new Error('Event ID is required');
    }
    if (!this.calendarId) {
      throw new Error('Calendar ID is required');
    }
    if (!this.title || this.title.trim().length === 0) {
      throw new Error('Event title is required');
    }
    if (this.endTime <= this.startTime) {
      throw new Error('Event end time must be after start time');
    }
  }

  /**
   * Get the duration of the event in minutes
   */
  getDurationMinutes(): number {
    return (this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60);
  }

  /**
   * Check if this event overlaps with another event
   */
  overlapsWith(other: CalendarEvent): boolean {
    return (
      (this.startTime < other.endTime && this.endTime > other.startTime) ||
      (other.startTime < this.endTime && other.endTime > this.startTime)
    );
  }

  /**
   * Check if this event occurs during a specific time range
   */
  occursInRange(startTime: Date, endTime: Date): boolean {
    return this.startTime < endTime && this.endTime > startTime;
  }

  /**
   * Check if this event is all-day
   */
  isAllDay(): boolean {
    const duration = this.getDurationMinutes();
    const isFullDay = duration >= 1440; // 24 hours
    const startAtMidnight =
      this.startTime.getUTCHours() === 0 &&
      this.startTime.getUTCMinutes() === 0;
    return isFullDay && startAtMidnight;
  }

  /**
   * Check if event is recurring
   */
  isRecurring(): boolean {
    return this.recurrence !== null;
  }

  /**
   * Update event details
   */
  update(updates: {
    title?: string;
    description?: string | null;
    location?: string | null;
    attendees?: EventAttendee[];
    reminders?: EventReminder[];
    recurrence?: EventRecurrence | null;
    metadata?: Record<string, any>;
  }): CalendarEvent {
    return new CalendarEvent(
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
    );
  }

  /**
   * Create a copy of this event with a new time
   */
  reschedule(newStartTime: Date, newEndTime: Date): CalendarEvent {
    if (newEndTime <= newStartTime) {
      throw new Error('New end time must be after new start time');
    }

    return new CalendarEvent(
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
    );
  }

  /**
   * Clone this event with a new ID (for copying events)
   */
  clone(newId: string): CalendarEvent {
    return new CalendarEvent(
      newId,
      this.calendarId,
      this.title,
      this.description,
      this.startTime,
      this.endTime,
      this.location,
      [...this.attendees],
      [...this.reminders],
      this.recurrence,
      new Date(),
      new Date(),
      this.source,
      { ...this.metadata },
    );
  }

  /**
   * Convert to plain object (for serialization)
   */
  toObject(): Record<string, any> {
    return {
      id: this.id,
      calendarId: this.calendarId,
      title: this.title,
      description: this.description,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime.toISOString(),
      location: this.location,
      attendees: this.attendees,
      reminders: this.reminders,
      recurrence: this.recurrence,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      source: this.source,
      metadata: this.metadata,
    };
  }

  /**
   * Create from plain object
   */
  static fromObject(obj: any): CalendarEvent {
    return new CalendarEvent(
      obj.id,
      obj.calendarId,
      obj.title,
      obj.description,
      new Date(obj.startTime),
      new Date(obj.endTime),
      obj.location,
      obj.attendees || [],
      obj.reminders || [],
      obj.recurrence || null,
      new Date(obj.createdAt),
      new Date(obj.updatedAt),
      obj.source || 'google',
      obj.metadata,
    );
  }
}
