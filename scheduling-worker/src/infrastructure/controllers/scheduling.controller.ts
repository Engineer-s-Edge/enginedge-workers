import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import {
  SchedulingService,
  ScheduleOptions,
  SchedulePreview,
} from '../../application/services/scheduling.service';
import {
  TaskCompletionService,
  CompletionStats,
} from '../../application/services/task-completion.service';
import { TimeSlotService } from '../../application/services/time-slot.service';
import { CalendarEvent } from '../../domain/entities/calendar-event.entity';
import {
  Task,
  ScheduledTask,
} from '../../application/services/task-scheduler.service';

class ScheduleRequestDto {
  userId!: string;
  calendarId?: string;
  date?: string; // ISO date string
  workingHoursStart?: number;
  workingHoursEnd?: number;
  workingDays?: number[];
  bufferMinutes?: number;
  includeWeekends?: boolean;
  maxTaskDuration?: number;
}

class ManualScheduleDto {
  userId!: string;
  calendarId?: string;
  task!: Task;
  startTime!: string; // ISO datetime string
}

class CompleteTaskDto {
  scheduledTask!: ScheduledTask;
  completionRate?: number;
  actualStart?: string;
  actualEnd?: string;
  notes?: string;
}

@ApiTags('Scheduling')
@Controller('schedule')
export class SchedulingController {
  private readonly logger = new Logger(SchedulingController.name);

  constructor(
    private readonly schedulingService: SchedulingService,
    private readonly taskCompletionService: TaskCompletionService,
    private readonly timeSlotService: TimeSlotService,
  ) {}

  @Post('preview')
  @ApiOperation({ summary: 'Preview schedule for a date without committing' })
  @ApiResponse({
    status: 200,
    description: 'Schedule preview generated',
  })
  async previewSchedule(
    @Body() dto: ScheduleRequestDto,
  ): Promise<SchedulePreview> {
    this.logger.log(`Generating schedule preview for user ${dto.userId}`);

    const options = this.dtoToOptions(dto);
    return this.schedulingService.previewSchedule(options);
  }

  @Post('commit')
  @ApiOperation({ summary: 'Schedule and commit tasks to calendar' })
  @ApiResponse({
    status: 201,
    description: 'Tasks scheduled and committed to calendar',
  })
  async commitSchedule(@Body() dto: ScheduleRequestDto): Promise<{
    preview: SchedulePreview;
    events: CalendarEvent[];
  }> {
    this.logger.log(`Scheduling and committing for user ${dto.userId}`);

    const options = this.dtoToOptions(dto);
    return this.schedulingService.scheduleAndCommit(options);
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's scheduled items" })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'calendarId', required: false })
  @ApiResponse({
    status: 200,
    description: "Today's schedule",
  })
  async getTodaySchedule(
    @Query('userId') userId: string,
    @Query('calendarId') calendarId?: string,
  ): Promise<SchedulePreview> {
    this.logger.log(`Getting today's schedule for user ${userId}`);

    const options: ScheduleOptions = {
      userId,
      calendarId: calendarId || 'primary',
      date: new Date(),
    };

    return this.schedulingService.previewSchedule(options);
  }

  @Post('manual')
  @ApiOperation({ summary: 'Manually schedule a task at a specific time' })
  @ApiResponse({
    status: 201,
    description: 'Task scheduled manually',
  })
  async manualSchedule(@Body() dto: ManualScheduleDto): Promise<CalendarEvent> {
    this.logger.log(`Manually scheduling task "${dto.task.title}"`);

    return this.schedulingService.manuallyScheduleTask(
      dto.userId,
      dto.calendarId || 'primary',
      dto.task,
      new Date(dto.startTime),
    );
  }

  @Post('reschedule')
  @ApiOperation({ summary: 'Reschedule all auto-scheduled tasks for a date' })
  @ApiResponse({
    status: 200,
    description: 'Tasks rescheduled',
  })
  async reschedule(@Body() dto: ScheduleRequestDto): Promise<SchedulePreview> {
    this.logger.log(`Rescheduling tasks for user ${dto.userId}`);

    const options = this.dtoToOptions(dto);
    return this.schedulingService.rescheduleForDate(options);
  }

  @Delete(':eventId')
  @ApiOperation({ summary: 'Remove a scheduled task from calendar' })
  @ApiParam({ name: 'eventId', type: String })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'calendarId', required: false })
  @ApiResponse({
    status: 204,
    description: 'Scheduled task removed',
  })
  async removeScheduledTask(
    @Param('eventId') eventId: string,
    @Query('userId') userId: string,
    @Query('calendarId') calendarId?: string,
  ): Promise<void> {
    this.logger.log(`Removing scheduled task ${eventId}`);

    // This would need to be implemented in the scheduling service
    // For now, just log it
    this.logger.warn('Remove scheduled task not yet implemented');
  }

  @Post('complete')
  @ApiOperation({ summary: 'Mark a scheduled task as completed' })
  @ApiResponse({
    status: 200,
    description: 'Task marked as completed',
  })
  async completeTask(@Body() dto: CompleteTaskDto) {
    this.logger.log(`Completing task "${dto.scheduledTask.title}"`);

    return this.taskCompletionService.completeTask(
      dto.scheduledTask,
      dto.completionRate || 100,
      dto.actualStart ? new Date(dto.actualStart) : undefined,
      dto.actualEnd ? new Date(dto.actualEnd) : undefined,
      dto.notes,
    );
  }

  @Post('skip')
  @ApiOperation({ summary: 'Mark a scheduled task as skipped' })
  @ApiResponse({
    status: 200,
    description: 'Task marked as skipped',
  })
  async skipTask(
    @Body() dto: { scheduledTask: ScheduledTask; reason?: string },
  ) {
    this.logger.log(`Skipping task "${dto.scheduledTask.title}"`);

    return this.taskCompletionService.skipTask(dto.scheduledTask, dto.reason);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get completion statistics' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiResponse({
    status: 200,
    description: 'Completion statistics',
  })
  async getStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<CompletionStats> {
    this.logger.log(`Getting stats from ${startDate} to ${endDate}`);

    return this.taskCompletionService.getCompletionStats(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('slots')
  @ApiOperation({ summary: 'Get available time slots for scheduling' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'date', required: true })
  @ApiQuery({ name: 'duration', required: true })
  @ApiResponse({
    status: 200,
    description: 'Available time slots',
  })
  async getAvailableSlots(
    @Query('userId') _userId: string,
    @Query('date') date: string,
    @Query('duration') duration: number,
  ) {
    this.logger.log(
      `Getting available slots for duration ${duration} on ${date}`,
    );

    const startDate = new Date(date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    return this.timeSlotService.findSlotsForDuration(
      [], // No events for now - would need to fetch from calendar
      duration,
      startDate,
      endDate,
    );
  }

  @Post('conflicts/resolve')
  @ApiOperation({ summary: 'Resolve scheduling conflicts' })
  @ApiBody({
    schema: {
      properties: {
        userId: { type: 'string' },
        conflictingTasks: { type: 'array' },
        strategy: {
          type: 'string',
          enum: ['priority', 'deadline', 'duration'],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Conflicts resolved',
  })
  async resolveConflicts(
    @Body()
    dto: {
      userId: string;
      conflictingTasks: ScheduledTask[];
      strategy: 'priority' | 'deadline' | 'duration';
    },
  ) {
    this.logger.log(
      `Resolving conflicts for ${dto.userId} with strategy: ${dto.strategy}`,
    );

    // Sort tasks based on resolution strategy
    const sorted = [...dto.conflictingTasks].sort((a, b) => {
      if (dto.strategy === 'priority') {
        return b.priority - a.priority;
      } else if (dto.strategy === 'deadline' && a.deadline && b.deadline) {
        return a.deadline.getTime() - b.deadline.getTime();
      } else {
        return a.durationMinutes - b.durationMinutes; // Shorter tasks first
      }
    });

    return {
      resolvedTasks: sorted,
      strategy: dto.strategy,
    };
  }

  private dtoToOptions(dto: ScheduleRequestDto): ScheduleOptions {
    return {
      userId: dto.userId,
      calendarId: dto.calendarId,
      date: dto.date ? new Date(dto.date) : new Date(),
      workingHours:
        dto.workingHoursStart && dto.workingHoursEnd
          ? {
              startHour: dto.workingHoursStart,
              endHour: dto.workingHoursEnd,
              daysOfWeek: dto.workingDays || [1, 2, 3, 4, 5],
            }
          : undefined,
      bufferMinutes: dto.bufferMinutes,
      includeWeekends: dto.includeWeekends,
      maxTaskDuration: dto.maxTaskDuration,
    };
  }
}
