import { Injectable, Logger } from '@nestjs/common';
import { TimeSlot } from '../../domain/value-objects/time-slot.value-object';
import { Habit } from '../../domain/entities/habit.entity';
import { Goal } from '../../domain/entities/goal.entity';

export interface Task {
  id: string;
  title: string;
  durationMinutes: number;
  priority: number; // 1-5
  deadline?: Date;
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime';
  type: 'habit' | 'goal';
  sourceId: string; // habitId or goalId
  isRecurring: boolean;
  metadata?: Record<string, unknown>;
}

export interface ScheduledTask extends Task {
  scheduledSlot: TimeSlot;
  scheduledAt: Date;
}

export interface SchedulingResult {
  scheduled: ScheduledTask[];
  unscheduled: Task[];
  conflicts: { task: Task; reason: string }[];
}

@Injectable()
export class TaskSchedulerService {
  private readonly logger = new Logger(TaskSchedulerService.name);

  /**
   * Schedule tasks into available time slots
   */
  scheduleTasks(tasks: Task[], availableSlots: TimeSlot[]): SchedulingResult {
    this.logger.debug(
      `Scheduling ${tasks.length} tasks into ${availableSlots.length} available slots`,
    );

    const scheduled: ScheduledTask[] = [];
    const unscheduled: Task[] = [];
    const conflicts: { task: Task; reason: string }[] = [];

    // Sort tasks by priority (highest first), then by deadline (soonest first)
    const sortedTasks = this.prioritizeTasks(tasks);

    // Track remaining available slots
    let remainingSlots = [...availableSlots];

    for (const task of sortedTasks) {
      const result = this.findBestSlotForTask(task, remainingSlots);

      if (result.slot) {
        // Schedule the task
        const scheduledTask: ScheduledTask = {
          ...task,
          scheduledSlot: result.slot,
          scheduledAt: new Date(),
        };
        scheduled.push(scheduledTask);

        // Update remaining slots
        remainingSlots = this.removeUsedSlot(remainingSlots, result.slot);

        this.logger.debug(
          `Scheduled task "${task.title}" at ${result.slot.startTime.toISOString()}`,
        );
      } else {
        // Could not schedule
        unscheduled.push(task);
        conflicts.push({
          task,
          reason: result.reason || 'No suitable slot found',
        });

        this.logger.warn(
          `Could not schedule task "${task.title}": ${result.reason}`,
        );
      }
    }

    this.logger.log(
      `Scheduling complete: ${scheduled.length} scheduled, ${unscheduled.length} unscheduled`,
    );

    return { scheduled, unscheduled, conflicts };
  }

  /**
   * Prioritize tasks for scheduling
   */
  prioritizeTasks(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      // First: Priority (higher = more important)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Second: Deadline (sooner = higher priority)
      if (a.deadline && b.deadline) {
        return a.deadline.getTime() - b.deadline.getTime();
      }
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && b.deadline) return 1;

      // Third: Duration (shorter tasks first for easier fitting)
      return a.durationMinutes - b.durationMinutes;
    });
  }

  /**
   * Find the best time slot for a task
   */
  private findBestSlotForTask(
    task: Task,
    availableSlots: TimeSlot[],
  ): { slot: TimeSlot | null; reason?: string } {
    // Filter slots that can fit the task
    const fittingSlots = availableSlots.filter((slot) =>
      slot.canFitDuration(task.durationMinutes),
    );

    if (fittingSlots.length === 0) {
      return {
        slot: null,
        reason: `No slot large enough for ${task.durationMinutes} minutes`,
      };
    }

    // Apply preferred time of day filter
    const preferredSlots = this.filterByPreferredTime(task, fittingSlots);

    if (preferredSlots.length === 0 && task.preferredTimeOfDay !== 'anytime') {
      // Fall back to any time if preferred time not available
      this.logger.debug(
        `No slots match preferred time "${task.preferredTimeOfDay}" for task "${task.title}", using any available slot`,
      );
    }

    const slotsToConsider =
      preferredSlots.length > 0 ? preferredSlots : fittingSlots;

    // Score each slot and pick the best
    const scoredSlots = slotsToConsider.map((slot) => ({
      slot,
      score: this.scoreSlot(task, slot),
    }));

    scoredSlots.sort((a, b) => b.score - a.score);

    const bestSlot = scoredSlots[0].slot;

    // Allocate the exact duration from the start of the slot
    const [allocatedSlot] = bestSlot.allocateStart(task.durationMinutes);
    return { slot: allocatedSlot };
  }

  /**
   * Filter slots by task's preferred time of day
   */
  private filterByPreferredTime(task: Task, slots: TimeSlot[]): TimeSlot[] {
    if (!task.preferredTimeOfDay || task.preferredTimeOfDay === 'anytime') {
      return slots;
    }

    return slots.filter((slot) => {
      const hour = slot.startTime.getHours();

      switch (task.preferredTimeOfDay) {
        case 'morning':
          return hour >= 6 && hour < 12;
        case 'afternoon':
          return hour >= 12 && hour < 17;
        case 'evening':
          return hour >= 17 && hour < 22;
        default:
          return true;
      }
    });
  }

  /**
   * Score a slot for a task (higher = better fit)
   */
  private scoreSlot(task: Task, slot: TimeSlot): number {
    let score = 0;

    // Prefer slots that are closer to the task duration (minimize wasted time)
    const slotDuration = slot.getDurationMinutes();
    const wastedTime = slotDuration - task.durationMinutes;
    score += 100 - wastedTime; // Less waste = higher score

    // Prefer earlier slots (get things done sooner)
    const hourOfDay = slot.startTime.getHours();
    score += (24 - hourOfDay) * 2;

    // Prefer slots during working hours (9 AM - 6 PM)
    if (slot.isDuringWorkingHours('09:00', '18:00')) {
      score += 50;
    }

    // Bonus for matching preferred time of day
    if (task.preferredTimeOfDay) {
      const matchesPreference =
        this.filterByPreferredTime(task, [slot]).length > 0;
      if (matchesPreference) {
        score += 100;
      }
    }

    // Penalty for scheduling too far in the future (if deadline exists)
    if (task.deadline) {
      const daysUntilDeadline = Math.floor(
        (task.deadline.getTime() - slot.startTime.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (daysUntilDeadline < 0) {
        score -= 1000; // Heavily penalize past-deadline slots
      } else if (daysUntilDeadline > 7) {
        score -= daysUntilDeadline * 5; // Slight penalty for distant slots
      }
    }

    return score;
  }

  /**
   * Remove a used slot from available slots
   */
  private removeUsedSlot(slots: TimeSlot[], usedSlot: TimeSlot): TimeSlot[] {
    const result: TimeSlot[] = [];

    for (const slot of slots) {
      if (!slot.overlapsWith(usedSlot)) {
        // No overlap, keep the slot
        result.push(slot);
      } else {
        // Overlap exists, split the slot
        const splits = this.splitSlotByUsed(slot, usedSlot);
        result.push(...splits);
      }
    }

    return result;
  }

  /**
   * Split a slot by removing a used portion
   */
  private splitSlotByUsed(slot: TimeSlot, usedSlot: TimeSlot): TimeSlot[] {
    const result: TimeSlot[] = [];

    // Time before the used slot
    if (slot.startTime < usedSlot.startTime) {
      result.push(new TimeSlot(slot.startTime, usedSlot.startTime));
    }

    // Time after the used slot
    if (slot.endTime > usedSlot.endTime) {
      result.push(new TimeSlot(usedSlot.endTime, slot.endTime));
    }

    return result;
  }

  /**
   * Split a large task into smaller subtasks
   */
  splitLargeTask(task: Task, maxDurationMinutes: number): Task[] {
    if (task.durationMinutes <= maxDurationMinutes) {
      return [task];
    }

    const numSubtasks = Math.ceil(task.durationMinutes / maxDurationMinutes);
    const subtasks: Task[] = [];

    for (let i = 0; i < numSubtasks; i++) {
      const remainingDuration = task.durationMinutes - i * maxDurationMinutes;
      const subtaskDuration = Math.min(maxDurationMinutes, remainingDuration);

      subtasks.push({
        ...task,
        id: `${task.id}_part${i + 1}`,
        title: `${task.title} (Part ${i + 1}/${numSubtasks})`,
        durationMinutes: subtaskDuration,
        metadata: {
          ...task.metadata,
          isSubtask: true,
          parentTaskId: task.id,
          partNumber: i + 1,
          totalParts: numSubtasks,
        },
      });
    }

    return subtasks;
  }

  /**
   * Convert a Habit to a Task
   */
  habitToTask(habit: Habit): Task {
    return {
      id: `habit_${habit.id}`,
      title: habit.name,
      durationMinutes: habit.estimatedDurationMinutes || 30,
      priority: habit.priority,
      preferredTimeOfDay: habit.preferredTimeOfDay,
      type: 'habit',
      sourceId: habit.id,
      isRecurring: true,
      metadata: {
        frequency: habit.frequency,
        description: habit.description,
      },
    };
  }

  /**
   * Convert a Goal to a Task
   */
  goalToTask(goal: Goal, estimatedDuration?: number): Task {
    const remainingMinutes =
      (goal.estimatedTimeRequired || 0) - (goal.timeSpent || 0);
    const durationMinutes = estimatedDuration || remainingMinutes;

    return {
      id: `goal_${goal.id}`,
      title: goal.title,
      durationMinutes: Math.min(durationMinutes, 240), // Max 4 hours per session
      priority: goal.priority,
      deadline: goal.targetDate || undefined,
      preferredTimeOfDay: 'anytime',
      type: 'goal',
      sourceId: goal.id,
      isRecurring: false,
      metadata: {
        progressPercentage: goal.progressPercentage,
        description: goal.description,
        milestones: goal.milestones,
      },
    };
  }

  /**
   * Convert time string (HH:MM) to time of day
   */
  private timeStringToTimeOfDay(
    timeString: string,
  ): 'morning' | 'afternoon' | 'evening' | 'anytime' {
    const [hours] = timeString.split(':').map(Number);

    if (hours >= 6 && hours < 12) return 'morning';
    if (hours >= 12 && hours < 17) return 'afternoon';
    if (hours >= 17 && hours < 22) return 'evening';
    return 'anytime';
  }
}
