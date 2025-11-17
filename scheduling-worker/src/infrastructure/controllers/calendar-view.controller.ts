import {
  Controller,
  Get,
  Query,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { TaskService } from '../../application/services/task.service';

/**
 * Calendar View Controller
 *
 * REST API endpoints for calendar views (day, week, month, agenda)
 *
 * Infrastructure Layer - HTTP adapter
 */
@ApiTags('Calendar View')
@Controller('scheduling/calendar')
export class CalendarViewController {
  private readonly logger = new Logger(CalendarViewController.name);

  constructor(private readonly taskService: TaskService) {
    this.logger.log('CalendarViewController initialized');
  }

  /**
   * Get day view data
   */
  @Get('day')
  @ApiOperation({ summary: 'Get day view data' })
  @ApiQuery({ name: 'date', required: true, description: 'Date in YYYY-MM-DD format' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 200, description: 'Day view data retrieved' })
  async getDayView(
    @Query('date') date: string,
    @Query('userId') userId: string,
  ) {
    this.logger.log(`Getting day view for date: ${date}`);

    const dateObj = new Date(date);
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    const tasks = await this.taskService.getTasks({
      userId,
      startDate: startOfDay,
      endDate: endOfDay,
    });

    return {
      date: date,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        startTime: t.startTime,
        endTime: t.endTime,
        category: t.category,
        priority: t.priority,
        isLocked: t.isLocked,
        completionStatus: t.completionStatus,
      })),
      locked: false, // Would check day lock status
    };
  }

  /**
   * Get week view data
   */
  @Get('week')
  @ApiOperation({ summary: 'Get week view data' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Start date in YYYY-MM-DD format' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 200, description: 'Week view data retrieved' })
  async getWeekView(
    @Query('startDate') startDate: string,
    @Query('userId') userId: string,
  ) {
    this.logger.log(`Getting week view starting from: ${startDate}`);

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(endDateObj.getDate() + 7);

    const tasks = await this.taskService.getTasks({
      userId,
      startDate: startDateObj,
      endDate: endDateObj,
    });

    // Group tasks by day
    const tasksByDay: Record<string, any[]> = {};
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDateObj);
      day.setDate(day.getDate() + i);
      const dayStr = day.toISOString().split('T')[0];
      tasksByDay[dayStr] = [];
    }

    tasks.forEach((task) => {
      const taskDate = task.startTime.toISOString().split('T')[0];
      if (tasksByDay[taskDate]) {
        tasksByDay[taskDate].push({
          id: task.id,
          title: task.title,
          startTime: task.startTime,
          endTime: task.endTime,
          category: task.category,
          priority: task.priority,
          isLocked: task.isLocked,
          completionStatus: task.completionStatus,
        });
      }
    });

    return {
      startDate: startDate,
      tasksByDay,
    };
  }

  /**
   * Get month view data
   */
  @Get('month')
  @ApiOperation({ summary: 'Get month view data' })
  @ApiQuery({ name: 'year', required: true, type: Number })
  @ApiQuery({ name: 'month', required: true, type: Number })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 200, description: 'Month view data retrieved' })
  async getMonthView(
    @Query('year') year: number,
    @Query('month') month: number,
    @Query('userId') userId: string,
  ) {
    this.logger.log(`Getting month view for ${year}-${month}`);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const tasks = await this.taskService.getTasks({
      userId,
      startDate,
      endDate,
    });

    // Group tasks by day
    const tasksByDay: Record<string, any[]> = {};
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayStr = date.toISOString().split('T')[0];
      tasksByDay[dayStr] = [];
    }

    tasks.forEach((task) => {
      const taskDate = task.startTime.toISOString().split('T')[0];
      if (tasksByDay[taskDate]) {
        tasksByDay[taskDate].push({
          id: task.id,
          title: task.title,
          startTime: task.startTime,
          endTime: task.endTime,
          category: task.category,
          priority: task.priority,
          isLocked: task.isLocked,
          completionStatus: task.completionStatus,
        });
      }
    });

    return {
      year,
      month,
      tasksByDay,
    };
  }

  /**
   * Get agenda view data
   */
  @Get('agenda')
  @ApiOperation({ summary: 'Get agenda view data' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 200, description: 'Agenda view data retrieved' })
  async getAgendaView(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId: string,
  ) {
    this.logger.log(`Getting agenda view from ${startDate} to ${endDate}`);

    const tasks = await this.taskService.getTasks({
      userId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    // Sort by start time
    const sortedTasks = tasks.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    return {
      startDate,
      endDate,
      tasks: sortedTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        startTime: t.startTime,
        endTime: t.endTime,
        location: t.location,
        category: t.category,
        priority: t.priority,
        isLocked: t.isLocked,
        completionStatus: t.completionStatus,
        tags: t.tags,
      })),
    };
  }
}
