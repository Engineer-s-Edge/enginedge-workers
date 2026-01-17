import { Injectable, Logger } from '@nestjs/common';
import { TimeSlot } from '../../domain/value-objects/time-slot.value-object';
import { CalendarEvent } from '../../domain/entities/calendar-event.entity';

export interface WorkingHours {
  startHour: number; // 0-23
  endHour: number; // 0-23
  daysOfWeek: number[]; // 0-6 (Sunday-Saturday)
}

export interface TimeSlotOptions {
  workingHours?: WorkingHours;
  bufferMinutes?: number;
  minSlotDuration?: number;
  maxSlotDuration?: number;
  includeWeekends?: boolean;
}

@Injectable()
export class TimeSlotService {
  private readonly logger = new Logger(TimeSlotService.name);

  /**
   * Find available time slots in a date range, excluding busy times
   */
  findAvailableSlots(
    events: CalendarEvent[],
    startDate: Date,
    endDate: Date,
    options: TimeSlotOptions = {},
  ): TimeSlot[] {
    this.logger.debug(
      `Finding available slots from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    const {
      workingHours = { startHour: 9, endHour: 17, daysOfWeek: [1, 2, 3, 4, 5] },
      bufferMinutes = 0,
      minSlotDuration = 15,
      includeWeekends = false,
    } = options;

    // Generate all possible time slots based on working hours
    const allSlots = this.generateWorkingHourSlots(
      startDate,
      endDate,
      workingHours,
      includeWeekends,
    );

    // Get busy time slots from calendar events
    const busySlots = this.extractBusySlots(events, bufferMinutes);

    // Remove busy slots from available slots
    const availableSlots = this.subtractBusySlots(allSlots, busySlots);

    // Filter by minimum duration
    const filteredSlots = availableSlots.filter(
      (slot) => slot.getDurationMinutes() >= minSlotDuration,
    );

    this.logger.debug(
      `Found ${filteredSlots.length} available slots (${busySlots.length} busy periods excluded)`,
    );

    return filteredSlots;
  }

  /**
   * Generate time slots based on working hours
   */
  private generateWorkingHourSlots(
    startDate: Date,
    endDate: Date,
    workingHours: WorkingHours,
    includeWeekends: boolean,
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const currentDate = new Date(startDate);

    while (currentDate < endDate) {
      const dayOfWeek = currentDate.getUTCDay();

      // Check if this day should be included
      const shouldInclude =
        workingHours.daysOfWeek.includes(dayOfWeek) ||
        (includeWeekends && (dayOfWeek === 0 || dayOfWeek === 6));

      if (shouldInclude) {
        const slotStart = new Date(currentDate);
        slotStart.setUTCHours(workingHours.startHour, 0, 0, 0);

        const slotEnd = new Date(currentDate);
        slotEnd.setUTCHours(workingHours.endHour, 0, 0, 0);

        // Make sure we don't exceed the end date
        if (slotStart < endDate) {
          const actualEnd = slotEnd > endDate ? endDate : slotEnd;
          // Ensure we don't create slots ending before they start (due to start clamp)
          // Also clamp start if it's before startDate?
          // Technically generateWorkingHourSlots checks currentDate which starts at startDate.
          // But if startDate has minutes, setUTCHours(9,0,0,0) might go back in time if startDate was 09:30.
          // But for now let's just use UTC.

          // Wait, if startDate is 10:00, and startHour is 9.
          // slotStart becomes 09:00. This is BEFORE startDate.
          // We should clamp slotStart to startDate if it is the first day.
          const actualStart = slotStart < startDate ? startDate : slotStart;

          if (actualStart < actualEnd) {
            slots.push(new TimeSlot(actualStart, actualEnd));
          }
        }
      }

      // Move to next day
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      currentDate.setUTCHours(0, 0, 0, 0);
    }

    return slots;
  }

  /**
   * Extract busy time slots from calendar events
   */
  private extractBusySlots(
    events: CalendarEvent[],
    bufferMinutes: number,
  ): TimeSlot[] {
    const busySlots: TimeSlot[] = [];

    for (const event of events) {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);

      // Add buffer time before and after
      if (bufferMinutes > 0) {
        start.setMinutes(start.getMinutes() - bufferMinutes);
        end.setMinutes(end.getMinutes() + bufferMinutes);
      }

      busySlots.push(new TimeSlot(start, end));
    }

    // Merge overlapping busy slots
    return this.mergeBusySlots(busySlots);
  }

  /**
   * Merge overlapping or adjacent busy slots
   */
  private mergeBusySlots(slots: TimeSlot[]): TimeSlot[] {
    if (slots.length === 0) return [];

    // Sort by start time
    const sorted = [...slots].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );

    const merged: TimeSlot[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = merged[merged.length - 1];

      if (
        current.overlapsWith(previous) ||
        this.isAdjacent(previous, current)
      ) {
        // Merge with previous slot
        const newEnd =
          current.endTime > previous.endTime
            ? current.endTime
            : previous.endTime;
        merged[merged.length - 1] = new TimeSlot(previous.startTime, newEnd);
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  /**
   * Check if two slots are adjacent (no gap between them)
   */
  private isAdjacent(slot1: TimeSlot, slot2: TimeSlot): boolean {
    return slot1.endTime.getTime() === slot2.startTime.getTime();
  }

  /**
   * Subtract busy slots from available slots
   */
  private subtractBusySlots(
    availableSlots: TimeSlot[],
    busySlots: TimeSlot[],
  ): TimeSlot[] {
    let result: TimeSlot[] = [...availableSlots];

    for (const busySlot of busySlots) {
      const newResult: TimeSlot[] = [];

      for (const availableSlot of result) {
        if (!availableSlot.overlapsWith(busySlot)) {
          // No overlap, keep the slot
          newResult.push(availableSlot);
        } else {
          // Overlap exists, split the available slot
          const splits = this.splitSlotByBusy(availableSlot, busySlot);
          newResult.push(...splits);
        }
      }

      result = newResult;
    }

    return result;
  }

  /**
   * Split an available slot by removing a busy period
   */
  private splitSlotByBusy(
    availableSlot: TimeSlot,
    busySlot: TimeSlot,
  ): TimeSlot[] {
    const result: TimeSlot[] = [];

    // Check if there's time before the busy period
    if (availableSlot.startTime < busySlot.startTime) {
      const beforeEnd =
        busySlot.startTime < availableSlot.endTime
          ? busySlot.startTime
          : availableSlot.endTime;
      result.push(new TimeSlot(availableSlot.startTime, beforeEnd));
    }

    // Check if there's time after the busy period
    if (availableSlot.endTime > busySlot.endTime) {
      const afterStart =
        busySlot.endTime > availableSlot.startTime
          ? busySlot.endTime
          : availableSlot.startTime;
      result.push(new TimeSlot(afterStart, availableSlot.endTime));
    }

    return result;
  }

  /**
   * Find the next available slot of a specific duration
   */
  findNextAvailableSlot(
    events: CalendarEvent[],
    durationMinutes: number,
    startFrom: Date = new Date(),
    options: TimeSlotOptions = {},
  ): TimeSlot | null {
    const endDate = new Date(startFrom);
    endDate.setDate(endDate.getDate() + 30); // Look ahead 30 days

    const availableSlots = this.findAvailableSlots(
      events,
      startFrom,
      endDate,
      options,
    );

    for (const slot of availableSlots) {
      if (slot.canFitDuration(durationMinutes)) {
        const [allocatedSlot] = slot.allocateStart(durationMinutes);
        return allocatedSlot;
      }
    }

    return null;
  }

  /**
   * Find all slots that can fit a specific duration
   */
  findSlotsForDuration(
    events: CalendarEvent[],
    durationMinutes: number,
    startDate: Date,
    endDate: Date,
    options: TimeSlotOptions = {},
  ): TimeSlot[] {
    const availableSlots = this.findAvailableSlots(
      events,
      startDate,
      endDate,
      options,
    );

    return availableSlots
      .filter((slot) => slot.canFitDuration(durationMinutes))
      .map((slot) => {
        const [allocatedSlot] = slot.allocateStart(durationMinutes);
        return allocatedSlot;
      });
  }

  /**
   * Check if a specific time slot is available
   */
  isSlotAvailable(
    events: CalendarEvent[],
    slot: TimeSlot,
    bufferMinutes: number = 0,
  ): boolean {
    const busySlots = this.extractBusySlots(events, bufferMinutes);

    for (const busySlot of busySlots) {
      if (slot.overlapsWith(busySlot)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get total available time in minutes for a date range
   */
  getTotalAvailableTime(
    events: CalendarEvent[],
    startDate: Date,
    endDate: Date,
    options: TimeSlotOptions = {},
  ): number {
    const availableSlots = this.findAvailableSlots(
      events,
      startDate,
      endDate,
      options,
    );

    return availableSlots.reduce(
      (total, slot) => total + slot.getDurationMinutes(),
      0,
    );
  }

  /**
   * Get total busy time in minutes for a date range
   */
  getTotalBusyTime(events: CalendarEvent[], bufferMinutes: number = 0): number {
    const busySlots = this.extractBusySlots(events, bufferMinutes);

    return busySlots.reduce(
      (total, slot) => total + slot.getDurationMinutes(),
      0,
    );
  }
}
