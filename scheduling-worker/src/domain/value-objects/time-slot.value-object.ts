/**
 * Time Slot Value Object
 *
 * Represents an available time slot for scheduling
 *
 * Domain Value Object - Immutable, no infrastructure dependencies
 */

export class TimeSlot {
  constructor(
    public readonly startTime: Date,
    public readonly endTime: Date,
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.endTime <= this.startTime) {
      throw new Error('End time must be after start time');
    }
  }

  /**
   * Get duration in minutes
   */
  getDurationMinutes(): number {
    return (this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60);
  }

  /**
   * Check if this slot can fit a task of given duration (in minutes)
   */
  canFitDuration(durationMinutes: number): boolean {
    return this.getDurationMinutes() >= durationMinutes;
  }

  /**
   * Check if this slot overlaps with another slot
   */
  overlapsWith(other: TimeSlot): boolean {
    return (
      (this.startTime < other.endTime && this.endTime > other.startTime) ||
      (other.startTime < this.endTime && other.endTime > other.startTime)
    );
  }

  /**
   * Check if this slot fully contains another slot
   */
  contains(other: TimeSlot): boolean {
    return this.startTime <= other.startTime && this.endTime >= other.endTime;
  }

  /**
   * Check if a specific time falls within this slot
   */
  containsTime(time: Date): boolean {
    return time >= this.startTime && time < this.endTime;
  }

  /**
   * Split this slot into two slots at a given time
   */
  splitAt(time: Date): [TimeSlot | null, TimeSlot | null] {
    if (!this.containsTime(time)) {
      throw new Error('Time must be within the slot');
    }

    const beforeSlot =
      time > this.startTime ? new TimeSlot(this.startTime, time) : null;
    const afterSlot =
      time < this.endTime ? new TimeSlot(time, this.endTime) : null;

    return [beforeSlot, afterSlot];
  }

  /**
   * Create a new slot by allocating the start of this slot
   */
  allocateStart(durationMinutes: number): [TimeSlot, TimeSlot | null] {
    if (!this.canFitDuration(durationMinutes)) {
      throw new Error('Slot is too small for the requested duration');
    }

    const allocatedEndTime = new Date(
      this.startTime.getTime() + durationMinutes * 60 * 1000,
    );

    const allocatedSlot = new TimeSlot(this.startTime, allocatedEndTime);

    const remainingSlot =
      allocatedEndTime < this.endTime
        ? new TimeSlot(allocatedEndTime, this.endTime)
        : null;

    return [allocatedSlot, remainingSlot];
  }

  /**
   * Merge this slot with another adjacent slot
   */
  mergeWith(other: TimeSlot): TimeSlot | null {
    // Check if slots are adjacent
    if (this.endTime.getTime() === other.startTime.getTime()) {
      return new TimeSlot(this.startTime, other.endTime);
    }
    if (other.endTime.getTime() === this.startTime.getTime()) {
      return new TimeSlot(other.startTime, this.endTime);
    }

    // Slots are not adjacent
    return null;
  }

  /**
   * Add buffer time before and after this slot
   */
  addBuffer(bufferMinutes: number): TimeSlot {
    const bufferMs = bufferMinutes * 60 * 1000;
    return new TimeSlot(
      new Date(this.startTime.getTime() - bufferMs),
      new Date(this.endTime.getTime() + bufferMs),
    );
  }

  /**
   * Check if this slot is during working hours
   */
  isDuringWorkingHours(
    workStart: string, // e.g., "09:00"
    workEnd: string, // e.g., "18:00"
  ): boolean {
    const [workStartHour, workStartMin] = workStart.split(':').map(Number);
    const [workEndHour, workEndMin] = workEnd.split(':').map(Number);

    const startHour = this.startTime.getHours();
    const startMin = this.startTime.getMinutes();
    const endHour = this.endTime.getHours();
    const endMin = this.endTime.getMinutes();

    const isStartDuringWork =
      startHour > workStartHour ||
      (startHour === workStartHour && startMin >= workStartMin);
    const isEndDuringWork =
      endHour < workEndHour ||
      (endHour === workEndHour && endMin <= workEndMin);

    return isStartDuringWork && isEndDuringWork;
  }

  /**
   * Get time of day category
   */
  getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = this.startTime.getHours();

    if (hour >= 5 && hour < 12) {
      return 'morning';
    } else if (hour >= 12 && hour < 17) {
      return 'afternoon';
    } else if (hour >= 17 && hour < 21) {
      return 'evening';
    } else {
      return 'night';
    }
  }

  /**
   * Check if this slot is on a specific date
   */
  isOnDate(date: Date): boolean {
    const slotDate = new Date(this.startTime);
    slotDate.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return slotDate.getTime() === checkDate.getTime();
  }

  /**
   * Check if this slot is today
   */
  isToday(): boolean {
    return this.isOnDate(new Date());
  }

  /**
   * Convert to plain object
   */
  toObject(): { startTime: string; endTime: string; durationMinutes: number } {
    return {
      startTime: this.startTime.toISOString(),
      endTime: this.endTime.toISOString(),
      durationMinutes: this.getDurationMinutes(),
    };
  }

  /**
   * Create from plain object
   */
  static fromObject(obj: {
    startTime: string | Date;
    endTime: string | Date;
  }): TimeSlot {
    return new TimeSlot(new Date(obj.startTime), new Date(obj.endTime));
  }

  /**
   * Create a time slot for a specific time range today
   */
  static createToday(
    startHour: number,
    startMin: number,
    durationMinutes: number,
  ): TimeSlot {
    const start = new Date();
    start.setHours(startHour, startMin, 0, 0);

    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    return new TimeSlot(start, end);
  }

  /**
   * Create multiple slots from a time range
   */
  static createSlots(
    startTime: Date,
    endTime: Date,
    slotDurationMinutes: number,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    let currentStart = new Date(startTime);

    while (currentStart < endTime) {
      const currentEnd = new Date(
        currentStart.getTime() + slotDurationMinutes * 60 * 1000,
      );

      if (currentEnd > endTime) {
        break;
      }

      slots.push(new TimeSlot(currentStart, currentEnd));
      currentStart = currentEnd;
    }

    return slots;
  }
}
