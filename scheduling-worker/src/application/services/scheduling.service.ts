import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { TimeSlotService, WorkingHours } from './time-slot.service';
import {
  TaskSchedulerService,
  Task,
  ScheduledTask,
} from './task-scheduler.service';
import { HabitService } from './habit.service';
import { GoalService } from './goal.service';
import { ICalendarEventRepository } from '../ports/repositories.port';
import { CalendarEvent } from '../../domain/entities/calendar-event.entity';
import { IGoogleCalendarApiService } from '../ports/google-calendar.port';
import { TimeSlot } from '../../domain/value-objects/time-slot.value-object';
import { MetricsAdapter } from '../../infrastructure/adapters/monitoring/metrics.adapter';

export interface ScheduleOptions {
  userId: string;
  calendarId?: string;
  date?: Date;
  workingHours?: WorkingHours;
  bufferMinutes?: number;
  includeWeekends?: boolean;
  maxTaskDuration?: number;
  autoCommit?: boolean;
}

export interface SchedulePreview {
  date: Date;
  scheduledTasks: ScheduledTask[];
  unscheduledTasks: Task[];
  conflicts: { task: Task; reason: string }[];
  totalScheduledMinutes: number;
  totalAvailableMinutes: number;
  utilizationRate: number;
}

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(
    private readonly timeSlotService: TimeSlotService,
    private readonly taskSchedulerService: TaskSchedulerService,
    private readonly habitService: HabitService,
    private readonly goalService: GoalService,
    @Inject('ICalendarEventRepository')
    private readonly eventRepository: ICalendarEventRepository,
    @Inject('IGoogleCalendarApiService')
    private readonly calendarApi: IGoogleCalendarApiService,
    @Optional()
    private readonly metricsAdapter?: MetricsAdapter,
  ) {}

  /**
   * Main scheduling orchestration - schedule tasks for a date
   */
  async scheduleForDate(options: ScheduleOptions): Promise<SchedulePreview> {
    const {
      userId,
      calendarId = 'primary',
      date = new Date(),
      workingHours = { startHour: 9, endHour: 17, daysOfWeek: [1, 2, 3, 4, 5] },
      bufferMinutes = 5,
      includeWeekends = false,
      maxTaskDuration = 120,
    } = options;

    this.logger.log(
      `Scheduling tasks for user ${userId} on ${date.toDateString()}`,
    );

    // Step 1: Get existing calendar events
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const events = await this.eventRepository.findInTimeRange(
      calendarId,
      startOfDay,
      endOfDay,
    );

    this.logger.debug(`Found ${events.length} existing calendar events`);

    // Step 2: Find available time slots
    const availableSlots = this.timeSlotService.findAvailableSlots(
      events,
      startOfDay,
      endOfDay,
      {
        workingHours,
        bufferMinutes,
        minSlotDuration: 15,
        includeWeekends,
      },
    );

    const totalAvailableMinutes = availableSlots.reduce(
      (sum, slot) => sum + slot.getDurationMinutes(),
      0,
    );

    this.logger.debug(
      `Found ${availableSlots.length} available slots (${totalAvailableMinutes} minutes total)`,
    );

    // Step 3: Get tasks to schedule (unmet habits + active goals)
    const tasks = await this.getTasksForDate(userId, date);

    // Split large tasks if needed
    const processedTasks = tasks.flatMap((task) =>
      this.taskSchedulerService.splitLargeTask(task, maxTaskDuration),
    );

    this.logger.debug(`Prepared ${processedTasks.length} tasks for scheduling`);

    // Step 4: Schedule tasks into available slots
    const result = this.taskSchedulerService.scheduleTasks(
      processedTasks,
      availableSlots,
    );

    // Step 5: Calculate metrics
    const totalScheduledMinutes = result.scheduled.reduce(
      (sum, task) => sum + task.durationMinutes,
      0,
    );

    const utilizationRate =
      totalAvailableMinutes > 0
        ? (totalScheduledMinutes / totalAvailableMinutes) * 100
        : 0;

    this.logger.log(
      `Scheduling complete: ${result.scheduled.length}/${processedTasks.length} tasks scheduled (${utilizationRate.toFixed(1)}% utilization)`,
    );

    // Record metrics
    if (this.metricsAdapter) {
      result.scheduled.forEach((task) => {
        this.metricsAdapter!.incrementTasksScheduled(task.type);
      });
      if (result.conflicts.length > 0) {
        this.metricsAdapter.incrementSchedulingConflicts();
      }
    }

    return {
      date,
      scheduledTasks: result.scheduled,
      unscheduledTasks: result.unscheduled,
      conflicts: result.conflicts,
      totalScheduledMinutes,
      totalAvailableMinutes,
      utilizationRate,
    };
  }

  /**
   * Preview schedule without committing to calendar
   */
  async previewSchedule(options: ScheduleOptions): Promise<SchedulePreview> {
    return this.scheduleForDate(options);
  }

  /**
   * Commit scheduled tasks to calendar
   */
  async commitSchedule(
    userId: string,
    calendarId: string,
    preview: SchedulePreview,
  ): Promise<CalendarEvent[]> {
    this.logger.log(
      `Committing ${preview.scheduledTasks.length} tasks to calendar`,
    );

    const createdEvents: CalendarEvent[] = [];

    for (const scheduledTask of preview.scheduledTasks) {
      const event = this.scheduledTaskToCalendarEvent(
        scheduledTask,
        userId,
        calendarId,
      );

      // Save to local repository
      const savedEvent = await this.eventRepository.save(event);

      // Push to Google Calendar
      await this.calendarApi.createEvent(calendarId, savedEvent);

      createdEvents.push(savedEvent);
    }

    this.logger.log(
      `Successfully committed ${createdEvents.length} events to calendar`,
    );

    // Record metrics
    if (this.metricsAdapter) {
      // Tasks are already counted in scheduleForDate, but we can track commits here if needed
    }

    return createdEvents;
  }

  /**
   * Schedule and commit in one operation
   */
  async scheduleAndCommit(options: ScheduleOptions): Promise<{
    preview: SchedulePreview;
    events: CalendarEvent[];
  }> {
    const preview = await this.scheduleForDate(options);

    const events = await this.commitSchedule(
      options.userId,
      options.calendarId || 'primary',
      preview,
    );

    return { preview, events };
  }

  /**
   * Get all tasks that need to be scheduled for a date
   */
  private async getTasksForDate(userId: string, _date: Date): Promise<Task[]> {
    const tasks: Task[] = [];

    // Get unmet habits for the date
    const unmetHabits = await this.habitService.getUnmetHabits(userId);
    const habitsDueToday = unmetHabits.filter((habit) => habit.isDueToday());

    for (const habit of habitsDueToday) {
      tasks.push(this.taskSchedulerService.habitToTask(habit));
    }

    this.logger.debug(`Found ${habitsDueToday.length} habits due today`);

    // Get active goals that need work
    const activeGoals = await this.goalService.getActiveGoals(userId);
    const goalsThatNeedWork = activeGoals.filter(
      (goal) => goal.progressPercentage < 100 && !goal.isOverdue(),
    );

    // Allocate time for each goal (1-2 hours per day depending on priority)
    for (const goal of goalsThatNeedWork) {
      const sessionDuration = goal.priority >= 4 ? 120 : 60; // High priority = 2 hours
      tasks.push(this.taskSchedulerService.goalToTask(goal, sessionDuration));
    }

    this.logger.debug(`Found ${goalsThatNeedWork.length} goals that need work`);

    return tasks;
  }

  /**
   * Convert a scheduled task to a calendar event
   */
  private scheduledTaskToCalendarEvent(
    scheduledTask: ScheduledTask,
    userId: string,
    calendarId: string,
  ): CalendarEvent {
    const event = new CalendarEvent(
      `scheduled_${scheduledTask.id}_${Date.now()}`,
      calendarId,
      scheduledTask.title,
      this.generateEventDescription(scheduledTask),
      scheduledTask.scheduledSlot.startTime,
      scheduledTask.scheduledSlot.endTime,
      null, // location
      [], // attendees
      [{ method: 'popup', minutes: 15 }], // reminders
      null, // recurrence
      new Date(), // createdAt
      new Date(), // updatedAt
      'internal', // source
      {
        scheduledTaskId: scheduledTask.id,
        taskType: scheduledTask.type,
        sourceId: scheduledTask.sourceId,
        priority: scheduledTask.priority.toString(),
        isAutoScheduled: 'true',
      },
    );

    return event;
  }

  /**
   * Generate event description from task
   */
  private generateEventDescription(scheduledTask: ScheduledTask): string {
    const lines: string[] = [];

    lines.push(`🤖 Auto-scheduled by EnginEdge`);
    lines.push('');

    if (
      scheduledTask.metadata?.description &&
      typeof scheduledTask.metadata.description === 'string'
    ) {
      lines.push(scheduledTask.metadata.description);
      lines.push('');
    }

    lines.push(
      `Type: ${scheduledTask.type === 'habit' ? '🔄 Habit' : '🎯 Goal'}`,
    );
    lines.push(`Priority: ${'⭐'.repeat(scheduledTask.priority)}`);
    lines.push(`Duration: ${scheduledTask.durationMinutes} minutes`);

    if (scheduledTask.deadline) {
      lines.push(`Deadline: ${scheduledTask.deadline.toDateString()}`);
    }

    if (scheduledTask.metadata?.isSubtask) {
      lines.push(
        `Part ${scheduledTask.metadata.partNumber} of ${scheduledTask.metadata.totalParts}`,
      );
    }

    return lines.join('\n');
  }

  /**
   * Get calendar color for task type
   */
  private getColorForTaskType(type: 'habit' | 'goal'): string {
    return type === 'habit' ? '7' : '9'; // Blue for habits, purple for goals
  }

  /**
   * Manually place a task in a specific time slot
   */
  async manuallyScheduleTask(
    userId: string,
    calendarId: string,
    task: Task,
    startTime: Date,
  ): Promise<CalendarEvent> {
    this.logger.log(
      `Manually scheduling task "${task.title}" at ${startTime.toISOString()}`,
    );

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + task.durationMinutes);

    const scheduledTask: ScheduledTask = {
      ...task,
      scheduledSlot: new TimeSlot(startTime, endTime),
      scheduledAt: new Date(),
    };

    const event = this.scheduledTaskToCalendarEvent(
      scheduledTask,
      userId,
      calendarId,
    );

    // Save locally
    const savedEvent = await this.eventRepository.save(event);

    // Push to Google Calendar
    await this.calendarApi.createEvent(calendarId, savedEvent);

    return savedEvent;
  }

  /**
   * Reschedule all auto-scheduled tasks for a date
   */
  async rescheduleForDate(options: ScheduleOptions): Promise<SchedulePreview> {
    const { calendarId = 'primary', date = new Date() } = options;

    this.logger.log(`Rescheduling tasks for ${date.toDateString()}`);

    // Find and delete existing auto-scheduled events
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const events = await this.eventRepository.findInTimeRange(
      calendarId,
      startOfDay,
      endOfDay,
    );

    const autoScheduledEvents = events.filter(
      (event) => event.metadata?.isAutoScheduled === 'true',
    );

    // Delete auto-scheduled events
    for (const event of autoScheduledEvents) {
      await this.eventRepository.delete(event.id);
      await this.calendarApi.deleteEvent(calendarId, event.id);
    }

    this.logger.debug(
      `Removed ${autoScheduledEvents.length} auto-scheduled events`,
    );

    // Re-run scheduling
    return this.scheduleForDate(options);
  }
}
