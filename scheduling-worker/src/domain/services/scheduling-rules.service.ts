/**
 * Scheduling Rules Service
 *
 * Enforces scheduling rules (no overlaps, working hours, bedtime, buffer time)
 *
 * Domain Service - Pure business logic with NO external dependencies
 */

export interface WorkingHours {
  startHour: number; // 0-23
  endHour: number; // 0-23
  daysOfWeek: number[]; // 0-6 (Sunday-Saturday)
}

export interface SchedulingRules {
  noOverlaps: boolean;
  workingHours?: WorkingHours;
  bedtime?: number; // Hour (0-23) after which tasks should not be scheduled
  bufferMinutes?: number; // Buffer time between tasks
  minimumDuration?: number; // Minimum task duration in minutes
  priorityHandling: boolean; // High priority tasks scheduled first
}

export class SchedulingRulesService {
  private defaultRules: SchedulingRules = {
    noOverlaps: true,
    workingHours: {
      startHour: 9,
      endHour: 17,
      daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
    },
    bedtime: 22,
    bufferMinutes: 15,
    minimumDuration: 15,
    priorityHandling: true,
  };

  /**
   * Validate task scheduling against rules
   */
  validateTaskSchedule(
    startTime: Date,
    endTime: Date,
    existingTasks: Array<{ startTime: Date; endTime: Date; isLocked?: boolean }>,
    rules: Partial<SchedulingRules> = {},
  ): { valid: boolean; errors: string[] } {
    const effectiveRules = { ...this.defaultRules, ...rules };
    const errors: string[] = [];

    // Check minimum duration
    if (effectiveRules.minimumDuration) {
      const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      if (duration < effectiveRules.minimumDuration) {
        errors.push(`Task duration (${duration} minutes) is less than minimum (${effectiveRules.minimumDuration} minutes)`);
      }
    }

    // Check working hours
    if (effectiveRules.workingHours) {
      const dayOfWeek = startTime.getDay();
      if (!effectiveRules.workingHours.daysOfWeek.includes(dayOfWeek)) {
        errors.push(`Task scheduled on non-working day (day ${dayOfWeek})`);
      }

      const startHour = startTime.getHours();
      const endHour = endTime.getHours();

      if (startHour < effectiveRules.workingHours.startHour) {
        errors.push(`Task starts before working hours (${effectiveRules.workingHours.startHour}:00)`);
      }

      if (endHour > effectiveRules.workingHours.endHour) {
        errors.push(`Task ends after working hours (${effectiveRules.workingHours.endHour}:00)`);
      }
    }

    // Check bedtime
    if (effectiveRules.bedtime) {
      const endHour = endTime.getHours();
      if (endHour >= effectiveRules.bedtime) {
        errors.push(`Task ends after bedtime (${effectiveRules.bedtime}:00)`);
      }
    }

    // Check overlaps
    if (effectiveRules.noOverlaps) {
      for (const task of existingTasks) {
        if (task.isLocked) continue; // Skip locked tasks for overlap check

        const overlaps =
          (startTime < task.endTime && endTime > task.startTime) ||
          (task.startTime < endTime && task.endTime > startTime);

        if (overlaps) {
          errors.push(`Task overlaps with existing task (${task.startTime.toISOString()} - ${task.endTime.toISOString()})`);
        }
      }
    }

    // Check buffer time
    if (effectiveRules.bufferMinutes) {
      for (const task of existingTasks) {
        if (task.isLocked) continue;

        const timeBetween = Math.min(
          Math.abs(startTime.getTime() - task.endTime.getTime()),
          Math.abs(endTime.getTime() - task.startTime.getTime()),
        ) / (1000 * 60);

        if (timeBetween < effectiveRules.bufferMinutes && timeBetween > 0) {
          errors.push(`Task does not have enough buffer time (${timeBetween} minutes < ${effectiveRules.bufferMinutes} minutes)`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Find available time slots
   */
  findAvailableSlots(
    date: Date,
    durationMinutes: number,
    existingTasks: Array<{ startTime: Date; endTime: Date; isLocked?: boolean }>,
    rules: Partial<SchedulingRules> = {},
  ): Array<{ startTime: Date; endTime: Date }> {
    const effectiveRules = { ...this.defaultRules, ...rules };
    const slots: Array<{ startTime: Date; endTime: Date }> = [];

    if (!effectiveRules.workingHours) {
      return slots;
    }

    const dayOfWeek = date.getDay();
    if (!effectiveRules.workingHours.daysOfWeek.includes(dayOfWeek)) {
      return slots; // Not a working day
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(effectiveRules.workingHours.startHour, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(effectiveRules.workingHours.endHour, 0, 0, 0);

    if (effectiveRules.bedtime) {
      const bedtimeTime = new Date(date);
      bedtimeTime.setHours(effectiveRules.bedtime, 0, 0, 0);
      if (endOfDay > bedtimeTime) {
        endOfDay.setTime(bedtimeTime.getTime());
      }
    }

    // Sort existing tasks by start time
    const sortedTasks = [...existingTasks]
      .filter((t) => {
        const taskDate = new Date(t.startTime);
        return taskDate.toDateString() === date.toDateString();
      })
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    let currentTime = new Date(startOfDay);

    for (const task of sortedTasks) {
      if (task.isLocked) {
        // Skip locked tasks, but move current time past them
        if (task.endTime > currentTime) {
          currentTime = new Date(task.endTime);
          if (effectiveRules.bufferMinutes) {
            currentTime.setMinutes(currentTime.getMinutes() + effectiveRules.bufferMinutes);
          }
        }
        continue;
      }

      // Check if there's a slot before this task
      const slotEnd = new Date(task.startTime);
      if (effectiveRules.bufferMinutes) {
        slotEnd.setMinutes(slotEnd.getMinutes() - effectiveRules.bufferMinutes);
      }

      if (slotEnd > currentTime) {
        const slotDuration = (slotEnd.getTime() - currentTime.getTime()) / (1000 * 60);
        if (slotDuration >= durationMinutes) {
          const slotEndTime = new Date(currentTime);
          slotEndTime.setMinutes(slotEndTime.getMinutes() + durationMinutes);
          slots.push({
            startTime: new Date(currentTime),
            endTime: slotEndTime,
          });
        }
      }

      // Move current time past this task
      currentTime = new Date(task.endTime);
      if (effectiveRules.bufferMinutes) {
        currentTime.setMinutes(currentTime.getMinutes() + effectiveRules.bufferMinutes);
      }
    }

    // Check if there's a slot after the last task
    if (currentTime < endOfDay) {
      const slotDuration = (endOfDay.getTime() - currentTime.getTime()) / (1000 * 60);
      if (slotDuration >= durationMinutes) {
        const slotEndTime = new Date(currentTime);
        slotEndTime.setMinutes(slotEndTime.getMinutes() + durationMinutes);
        if (slotEndTime <= endOfDay) {
          slots.push({
            startTime: new Date(currentTime),
            endTime: slotEndTime,
          });
        }
      }
    }

    return slots;
  }

  /**
   * Get default rules
   */
  getDefaultRules(): SchedulingRules {
    return { ...this.defaultRules };
  }
}
