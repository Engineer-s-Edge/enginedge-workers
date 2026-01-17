import { Controller, Get, Query, Param, Logger, Inject } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { TaskService } from '../../application/services/task.service';
import { ITaskRepository } from '../../application/ports/repositories.port';

/**
 * Activity & Productivity Dashboard Controller
 *
 * REST API endpoints for activity and productivity analytics
 *
 * Infrastructure Layer - HTTP adapter
 */
@ApiTags('Activity & Productivity')
@Controller()
export class ActivityDashboardController {
  private readonly logger = new Logger(ActivityDashboardController.name);

  constructor(
    private readonly taskService: TaskService,
    @Inject('ITaskRepository')
    private readonly taskRepository: ITaskRepository,
  ) {
    this.logger.log('ActivityDashboardController initialized');
  }

  /**
   * Get task analytics
   */
  @Get('scheduling/tasks/analytics')
  @ApiOperation({ summary: 'Get task completion analytics' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 200, description: 'Task analytics retrieved' })
  async getTaskAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId: string,
  ) {
    this.logger.log(`Getting task analytics from ${startDate} to ${endDate}`);

    const tasks = await this.taskService.getTasks({
      userId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (t) => t.completionStatus === 'completed',
    ).length;
    const inProgressTasks = tasks.filter(
      (t) => t.completionStatus === 'in-progress',
    ).length;
    const pendingTasks = tasks.filter(
      (t) => t.completionStatus === 'pending',
    ).length;
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    // Calculate average durations
    const tasksWithDuration = tasks.filter(
      (t) => t.estimatedDuration || t.actualDuration,
    );
    const avgDuration =
      tasksWithDuration.length > 0
        ? tasksWithDuration.reduce(
            (sum, t) => sum + (t.estimatedDuration || t.getDurationMinutes()),
            0,
          ) / tasksWithDuration.length
        : 0;
    const avgActualDuration =
      tasks.filter((t) => t.actualDuration).length > 0
        ? tasks
            .filter((t) => t.actualDuration)
            .reduce((sum, t) => sum + (t.actualDuration || 0), 0) /
          tasks.filter((t) => t.actualDuration).length
        : 0;

    // On-time completion rate (completed on or before scheduled end time)
    const onTimeCompleted = tasks.filter(
      (t) =>
        t.completionStatus === 'completed' &&
        t.completedAt &&
        t.completedAt <= t.endTime,
    ).length;
    const onTimeCompletionRate =
      completedTasks > 0 ? onTimeCompleted / completedTasks : 0;

    // Group by category
    const byCategory: Record<
      string,
      { completed: number; total: number; completionRate: number }
    > = {};
    tasks.forEach((task) => {
      const category = task.category || 'uncategorized';
      if (!byCategory[category]) {
        byCategory[category] = { completed: 0, total: 0, completionRate: 0 };
      }
      byCategory[category].total++;
      if (task.completionStatus === 'completed') {
        byCategory[category].completed++;
      }
    });

    Object.keys(byCategory).forEach((category) => {
      byCategory[category].completionRate =
        byCategory[category].total > 0
          ? byCategory[category].completed / byCategory[category].total
          : 0;
    });

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      completionRate,
      averageDuration: Math.round(avgDuration),
      averageActualDuration: Math.round(avgActualDuration),
      onTimeCompletionRate,
      byCategory,
    };
  }

  /**
   * Get task statistics
   */
  @Get('scheduling/tasks/stats')
  @ApiOperation({ summary: 'Get task statistics' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 200, description: 'Task statistics retrieved' })
  async getTaskStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId: string,
  ) {
    this.logger.log(`Getting task stats from ${startDate} to ${endDate}`);

    const tasks = await this.taskService.getTasks({
      userId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    // Group by priority
    const byPriority: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };
    tasks.forEach((task) => {
      const priority = task.priority || 'medium';
      byPriority[priority] = (byPriority[priority] || 0) + 1;
    });

    // Group by status
    const byStatus: Record<string, number> = {
      pending: 0,
      'in-progress': 0,
      completed: 0,
      'partially-completed': 0,
    };
    tasks.forEach((task) => {
      byStatus[task.completionStatus] =
        (byStatus[task.completionStatus] || 0) + 1;
    });

    // Locked vs unlocked
    const lockedTasks = tasks.filter((t) => t.isLocked).length;
    const unlockedTasks = tasks.length - lockedTasks;

    return {
      totalTasks: tasks.length,
      byPriority,
      byStatus,
      lockedTasks,
      unlockedTasks,
    };
  }

  /**
   * Get task trends
   */
  @Get('scheduling/tasks/trends')
  @ApiOperation({ summary: 'Get task trends' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({
    name: 'granularity',
    required: false,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily',
  })
  @ApiResponse({ status: 200, description: 'Task trends retrieved' })
  async getTaskTrends(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId: string,
    @Query('granularity') granularity: 'daily' | 'weekly' | 'monthly' = 'daily',
  ) {
    this.logger.log(
      `Getting task trends from ${startDate} to ${endDate}, granularity: ${granularity}`,
    );

    const tasks = await this.taskService.getTasks({
      userId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    // Group by time period based on granularity
    const trends: Record<
      string,
      { total: number; completed: number; completionRate: number }
    > = {};

    tasks.forEach((task) => {
      let periodKey: string;
      const taskDate = new Date(task.startTime);

      if (granularity === 'daily') {
        periodKey = taskDate.toISOString().split('T')[0];
      } else if (granularity === 'weekly') {
        const weekStart = new Date(taskDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
      } else {
        periodKey = `${taskDate.getFullYear()}-${String(taskDate.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!trends[periodKey]) {
        trends[periodKey] = { total: 0, completed: 0, completionRate: 0 };
      }
      trends[periodKey].total++;
      if (task.completionStatus === 'completed') {
        trends[periodKey].completed++;
      }
    });

    // Calculate completion rates
    Object.keys(trends).forEach((key) => {
      trends[key].completionRate =
        trends[key].total > 0 ? trends[key].completed / trends[key].total : 0;
    });

    return { trends, granularity };
  }

  /**
   * Get productivity metrics
   */
  @Get('scheduling/productivity/:userId')
  @ApiOperation({ summary: 'Get productivity metrics' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiResponse({ status: 200, description: 'Productivity metrics retrieved' })
  async getProductivityMetrics(
    @Param('userId') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    this.logger.log(`Getting productivity metrics for user ${userId}`);

    const tasks = await this.taskService.getTasks({
      userId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (t) => t.completionStatus === 'completed',
    ).length;
    const taskCompletionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    // Time utilization (actual time / scheduled time)
    const scheduledTime = tasks.reduce(
      (sum, t) => sum + t.getDurationMinutes(),
      0,
    );
    const actualTime = tasks
      .filter((t) => t.actualDuration)
      .reduce((sum, t) => sum + (t.actualDuration || 0), 0);
    const timeUtilization = scheduledTime > 0 ? actualTime / scheduledTime : 0;

    // Schedule efficiency (tasks completed on time / total completed)
    const onTimeCompleted = tasks.filter(
      (t) =>
        t.completionStatus === 'completed' &&
        t.completedAt &&
        t.completedAt <= t.endTime,
    ).length;
    const scheduleEfficiency =
      completedTasks > 0 ? onTimeCompleted / completedTasks : 0;

    // Punctuality rate (tasks started on time / total tasks)
    // Calculate based on tasks that have actual start time recorded
    const tasksWithActualStart = tasks.filter((t) => {
      // Check if task has metadata with actual start time or was completed
      return t.completedAt && t.completedAt <= t.endTime;
    });
    const onTimeStarted = tasksWithActualStart.length;
    const punctualityRate = totalTasks > 0 ? onTimeStarted / totalTasks : 0;

    // Calculate overall productivity score (weighted combination)
    const components = {
      completionRate: { value: taskCompletionRate, weight: 0.4 },
      scheduleEfficiency: { value: scheduleEfficiency, weight: 0.3 },
      timeUtilization: { value: Math.min(timeUtilization, 1.0), weight: 0.2 },
      punctualityRate: { value: punctualityRate, weight: 0.1 },
    };

    const overallProductivityScore =
      Math.round(
        components.completionRate.value * components.completionRate.weight +
          components.scheduleEfficiency.value *
            components.scheduleEfficiency.weight +
          components.timeUtilization.value * components.timeUtilization.weight +
          components.punctualityRate.value * components.punctualityRate.weight,
      ) * 100;

    return {
      overallProductivityScore,
      taskCompletionRate,
      timeUtilization,
      scheduleEfficiency,
      punctualityRate,
      components,
    };
  }

  /**
   * Get productivity trends
   */
  @Get('scheduling/productivity/trends')
  @ApiOperation({ summary: 'Get productivity trends' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({
    name: 'granularity',
    required: false,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'daily',
  })
  @ApiResponse({ status: 200, description: 'Productivity trends retrieved' })
  async getProductivityTrends(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId: string,
    @Query('granularity') granularity: 'daily' | 'weekly' | 'monthly' = 'daily',
  ) {
    this.logger.log(`Getting productivity trends for user ${userId}`);

    // This would aggregate productivity metrics over time
    // For now, return a simplified version
    const tasks = await this.taskService.getTasks({
      userId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    const trends: Record<string, number> = {};
    // Simplified trend calculation
    tasks.forEach((task) => {
      let periodKey: string;
      const taskDate = new Date(task.startTime);

      if (granularity === 'daily') {
        periodKey = taskDate.toISOString().split('T')[0];
      } else if (granularity === 'weekly') {
        const weekStart = new Date(taskDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
      } else {
        periodKey = `${taskDate.getFullYear()}-${String(taskDate.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!trends[periodKey]) {
        trends[periodKey] = 0;
      }
      if (task.completionStatus === 'completed') {
        trends[periodKey] += 1;
      }
    });

    return { trends, granularity };
  }

  /**
   * Get activity timeline
   */
  @Get('activity/timeline')
  @ApiOperation({ summary: 'Get activity timeline' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 200, description: 'Activity timeline retrieved' })
  async getActivityTimeline(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId: string,
  ) {
    this.logger.log(
      `Getting activity timeline from ${startDate} to ${endDate}`,
    );

    const tasks = await this.taskService.getTasks({
      userId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    // Sort by start time
    const sortedTasks = tasks.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );

    return {
      startDate,
      endDate,
      activities: sortedTasks.map((t) => ({
        id: t.id,
        title: t.title,
        startTime: t.startTime,
        endTime: t.endTime,
        category: t.category,
        completionStatus: t.completionStatus,
        actualDuration: t.actualDuration,
      })),
    };
  }

  /**
   * Get time usage breakdown by category
   */
  @Get('activity/breakdown')
  @ApiOperation({ summary: 'Get time usage breakdown by category' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 200, description: 'Time breakdown retrieved' })
  async getTimeBreakdown(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId: string,
  ) {
    this.logger.log(`Getting time breakdown from ${startDate} to ${endDate}`);

    const tasks = await this.taskService.getTasks({
      userId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    const byCategory: Record<
      string,
      { scheduled: number; actual: number; percentage: number }
    > = {};
    let totalTime = 0;

    tasks.forEach((task) => {
      const category = task.category || 'uncategorized';
      const scheduled = task.getDurationMinutes();
      const actual = task.actualDuration || scheduled;

      if (!byCategory[category]) {
        byCategory[category] = { scheduled: 0, actual: 0, percentage: 0 };
      }

      byCategory[category].scheduled += scheduled;
      byCategory[category].actual += actual;
      totalTime += scheduled;
    });

    // Calculate percentages
    Object.keys(byCategory).forEach((category) => {
      byCategory[category].percentage =
        totalTime > 0 ? (byCategory[category].scheduled / totalTime) * 100 : 0;
    });

    return {
      totalTime,
      byCategory,
    };
  }

  /**
   * Get peak productivity hours heatmap data
   */
  @Get('activity/peak-hours')
  @ApiOperation({ summary: 'Get peak productivity hours heatmap data' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 200, description: 'Peak hours data retrieved' })
  async getPeakHours(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('userId') userId: string,
  ) {
    this.logger.log(`Getting peak hours from ${startDate} to ${endDate}`);

    const tasks = await this.taskService.getTasks({
      userId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    // Count tasks by hour (0-23)
    const hourCounts: Record<number, number> = {};
    for (let hour = 0; hour < 24; hour++) {
      hourCounts[hour] = 0;
    }

    tasks.forEach((task) => {
      const hour = task.startTime.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Find peak hours (hours with most tasks)
    const maxCount = Math.max(...Object.values(hourCounts));
    const peakHours = Object.keys(hourCounts)
      .map(Number)
      .filter((hour) => hourCounts[hour] === maxCount);

    return {
      hourCounts,
      peakHours,
      maxCount,
    };
  }
}
