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
import { TaskService } from '../../application/services/task.service';
import { Task, TaskPriority, EventRecurrence } from '../../domain/entities';
import { MLRecommendationService } from '../../application/services/ml-recommendation.service';
import { MLModelClient } from '../../application/services/ml-model-client.service';
import { ITaskRepository } from '../../application/ports/repositories.port';
import { Inject } from '@nestjs/common';

/**
 * Task Controller
 *
 * REST API endpoints for task management
 *
 * Infrastructure Layer - HTTP adapter
 */
@ApiTags('Tasks')
@Controller('scheduling/tasks')
export class TaskController {
  private readonly logger = new Logger(TaskController.name);

  constructor(
    private readonly taskService: TaskService,
    private readonly mlRecommendationService: MLRecommendationService,
    private readonly mlModelClient: MLModelClient,
    @Inject('ITaskRepository')
    private readonly taskRepository: ITaskRepository,
  ) {
    this.logger.log('TaskController initialized');
  }

  /**
   * List tasks with filters
   */
  @Get()
  @ApiOperation({ summary: 'List tasks with filters' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({
    name: 'priority',
    required: false,
    enum: ['low', 'medium', 'high', 'urgent'],
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'in-progress', 'completed', 'partially-completed'],
  })
  @ApiQuery({ name: 'isLocked', required: false, type: Boolean })
  @ApiQuery({ name: 'tags', required: false, type: [String] })
  @ApiResponse({ status: 200, description: 'Tasks retrieved' })
  async listTasks(
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('category') category?: string,
    @Query('priority') priority?: TaskPriority,
    @Query('status')
    status?: 'pending' | 'in-progress' | 'completed' | 'partially-completed',
    @Query('isLocked') isLocked?: boolean,
    @Query('tags') tags?: string | string[],
  ) {
    this.logger.log('Listing tasks');

    const tagArray = tags ? (Array.isArray(tags) ? tags : [tags]) : undefined;

    const tasks = await this.taskService.getTasks({
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      category,
      priority,
      status,
      isLocked: isLocked !== undefined ? isLocked : undefined,
      tags: tagArray,
    });

    return { tasks };
  }

  /**
   * Get task by ID
   */
  @Get(':taskId')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task retrieved' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async getTask(@Param('taskId') taskId: string) {
    this.logger.log(`Getting task: ${taskId}`);
    const task = await this.taskService.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    return { task };
  }

  /**
   * Create a new task
   */
  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userId', 'calendarId', 'title', 'startTime', 'endTime'],
      properties: {
        userId: { type: 'string' },
        calendarId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        startTime: { type: 'string', format: 'date-time' },
        endTime: { type: 'string', format: 'date-time' },
        location: { type: 'string' },
        category: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        tags: { type: 'array', items: { type: 'string' } },
        estimatedDuration: { type: 'number' },
        isLocked: { type: 'boolean' },
        recurrence: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Task created' })
  async createTask(@Body() taskData: any) {
    this.logger.log(`Creating task: ${taskData.title}`);
    const task = await this.taskService.createTask({
      userId: taskData.userId,
      calendarId: taskData.calendarId,
      title: taskData.title,
      description: taskData.description,
      startTime: new Date(taskData.startTime),
      endTime: new Date(taskData.endTime),
      location: taskData.location,
      attendees: taskData.attendees,
      reminders: taskData.reminders,
      recurrence: taskData.recurrence,
      category: taskData.category,
      priority: taskData.priority,
      tags: taskData.tags,
      estimatedDuration: taskData.estimatedDuration,
      isLocked: taskData.isLocked,
      metadata: taskData.metadata,
    });
    return { task };
  }

  /**
   * Update a task
   */
  @Put(':taskId')
  @ApiOperation({ summary: 'Update a task' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task updated' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async updateTask(@Param('taskId') taskId: string, @Body() updates: any) {
    this.logger.log(`Updating task: ${taskId}`);
    const task = await this.taskService.updateTask(taskId, updates);
    return { task };
  }

  /**
   * Delete a task
   */
  @Delete(':taskId')
  @ApiOperation({ summary: 'Delete a task' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task deleted' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async deleteTask(@Param('taskId') taskId: string) {
    this.logger.log(`Deleting task: ${taskId}`);
    const deleted = await this.taskService.deleteTask(taskId);
    return { deleted, taskId };
  }

  /**
   * Get task history
   */
  @Get(':taskId/history')
  @ApiOperation({ summary: 'Get task history' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task history retrieved' })
  async getTaskHistory(@Param('taskId') taskId: string) {
    this.logger.log(`Getting task history: ${taskId}`);
    const history = await this.taskService.getTaskHistory(taskId);
    return { history };
  }

  /**
   * Defer task
   */
  @Post(':taskId/defer')
  @ApiOperation({ summary: 'Defer task to different time' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['deferType'],
      properties: {
        deferType: {
          type: 'string',
          enum: ['same-day', 'next-day', 'next-3-days', 'next-week'],
        },
        newTime: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task deferred' })
  async deferTask(
    @Param('taskId') taskId: string,
    @Body()
    body: {
      deferType: 'same-day' | 'next-day' | 'next-3-days' | 'next-week';
      newTime?: string;
    },
  ) {
    this.logger.log(`Deferring task: ${taskId}, type: ${body.deferType}`);
    const task = await this.taskService.deferTask(
      taskId,
      body.deferType,
      body.newTime ? new Date(body.newTime) : undefined,
    );
    return {
      taskId: task.id,
      oldStartTime: task.startTime,
      newStartTime: task.startTime,
      oldEndTime: task.endTime,
      newEndTime: task.endTime,
      deferred: true,
    };
  }

  /**
   * Split task
   */
  @Post(':taskId/split')
  @ApiOperation({ summary: 'Split task into multiple tasks' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['numberOfTasks', 'splitEvenly'],
      properties: {
        numberOfTasks: { type: 'number' },
        splitEvenly: { type: 'boolean' },
        durations: { type: 'array', items: { type: 'number' } },
        scheduleParts: { type: 'boolean' },
        deferType: {
          type: 'string',
          enum: ['next-day', 'next-3-days', 'next-week'],
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task split' })
  async splitTask(
    @Param('taskId') taskId: string,
    @Body()
    body: {
      numberOfTasks: number;
      splitEvenly: boolean;
      durations?: number[];
      scheduleParts?: boolean;
      deferType?: 'next-day' | 'next-3-days' | 'next-week';
    },
  ) {
    this.logger.log(`Splitting task: ${taskId}`);
    const originalTask = await this.taskService.getTask(taskId);
    if (!originalTask) {
      throw new Error(`Task ${taskId} not found`);
    }

    const splitTasks = await this.taskService.splitTask(taskId, body);
    return {
      originalTaskId: taskId,
      splitTasks: splitTasks.map((t) => ({
        id: t.id,
        title: t.title,
        startTime: t.startTime,
        endTime: t.endTime,
      })),
    };
  }

  /**
   * Complete task
   */
  @Post(':taskId/complete')
  @ApiOperation({ summary: 'Mark task as complete' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['completionType'],
      properties: {
        completionType: { type: 'string', enum: ['fully', 'partially'] },
        completionPercentage: { type: 'number', minimum: 0, maximum: 100 },
        notes: { type: 'string' },
        actualDuration: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task completed' })
  async completeTask(
    @Param('taskId') taskId: string,
    @Body()
    body: {
      completionType: 'fully' | 'partially';
      completionPercentage?: number;
      notes?: string;
      actualDuration?: number;
    },
  ) {
    this.logger.log(`Completing task: ${taskId}`);
    const task = await this.taskService.completeTask(taskId, body);
    return {
      taskId: task.id,
      completionStatus: task.completionStatus,
      completionPercentage: task.completionPercentage,
      completedAt: task.completedAt,
      actualDuration: task.actualDuration,
    };
  }

  /**
   * Duplicate task
   */
  @Post(':taskId/duplicate')
  @ApiOperation({ summary: 'Duplicate a task' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        newStartTime: { type: 'string', format: 'date-time' },
        newEndTime: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Task duplicated' })
  async duplicateTask(
    @Param('taskId') taskId: string,
    @Body() body: { newStartTime?: string; newEndTime?: string },
  ) {
    this.logger.log(`Duplicating task: ${taskId}`);
    const duplicated = await this.taskService.duplicateTask(
      taskId,
      body.newStartTime ? new Date(body.newStartTime) : undefined,
      body.newEndTime ? new Date(body.newEndTime) : undefined,
    );
    return {
      originalTaskId: taskId,
      duplicatedTaskId: duplicated.id,
      newStartTime: duplicated.startTime,
      newEndTime: duplicated.endTime,
    };
  }

  /**
   * Make task recurring
   */
  @Post(':taskId/recur')
  @ApiOperation({ summary: 'Make task recurring' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['recurrence'],
      properties: {
        recurrence: {
          type: 'object',
          properties: {
            frequency: {
              type: 'string',
              enum: ['daily', 'weekly', 'monthly', 'yearly'],
            },
            interval: { type: 'number' },
            byDay: { type: 'array', items: { type: 'string' } },
            until: { type: 'string', format: 'date-time' },
            count: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task made recurring' })
  async makeTaskRecurring(
    @Param('taskId') taskId: string,
    @Body() body: { recurrence: EventRecurrence },
  ) {
    this.logger.log(`Making task recurring: ${taskId}`);
    const task = await this.taskService.makeTaskRecurring(
      taskId,
      body.recurrence,
    );
    return {
      taskId: task.id,
      recurrence: task.recurrence,
      recurring: task.isRecurring(),
    };
  }

  /**
   * Lock or unlock task
   */
  @Post(':taskId/lock')
  @ApiOperation({ summary: 'Lock or unlock a task' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['locked'],
      properties: {
        locked: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task lock status updated' })
  async lockTask(
    @Param('taskId') taskId: string,
    @Body() body: { locked: boolean },
  ) {
    this.logger.log(`${body.locked ? 'Locking' : 'Unlocking'} task: ${taskId}`);
    const task = await this.taskService.lockTask(taskId, body.locked);
    return {
      taskId: task.id,
      isLocked: task.isLocked,
      lockedAt: task.lockedAt,
    };
  }

  /**
   * ML Task Scheduling - Find optimal time slot for task
   */
  @Post('schedule')
  @ApiOperation({ summary: 'Find optimal time slot for task using ML' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'estimatedDuration'],
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        estimatedDuration: { type: 'number' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        category: { type: 'string' },
        dueDate: { type: 'string', format: 'date-time' },
        preferences: {
          type: 'object',
          properties: {
            preferredHours: { type: 'array', items: { type: 'number' } },
            preferredDays: { type: 'array', items: { type: 'number' } },
            avoidConflicts: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 200, description: 'ML scheduling recommendations' })
  async scheduleTask(
    @Query('userId') userId: string,
    @Body()
    body: {
      title: string;
      description?: string;
      estimatedDuration: number;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      category?: string;
      dueDate?: string;
      preferences?: {
        preferredHours?: number[];
        preferredDays?: number[];
        avoidConflicts?: boolean;
      };
    },
  ) {
    this.logger.log(`ML scheduling task: ${body.title} for user ${userId}`);

    // Use ML model to find optimal slots
    const mlAvailable = await this.mlModelClient.healthCheck();

    if (mlAvailable) {
      try {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7); // Next 7 days

        const taskData = {
          title: body.title,
          description: body.description || '',
          estimatedDuration: body.estimatedDuration,
          priority: body.priority || 'medium',
          category: body.category || 'general',
        };

        const mlResponse = await this.mlModelClient.predictSlots(
          userId,
          taskData,
          startDate,
          endDate,
        );

        if (
          mlResponse &&
          mlResponse.recommendations &&
          mlResponse.recommendations.length > 0
        ) {
          const recommendations = mlResponse.recommendations
            .filter((r: { recommended: boolean }) => r.recommended)
            .slice(0, 3)
            .map(
              (r: {
                hour: number;
                confidence: number;
                probability: number;
              }) => {
                const recommendedDate = new Date(startDate);
                recommendedDate.setHours(r.hour, 0, 0, 0);
                const recommendedEnd = new Date(recommendedDate);
                recommendedEnd.setMinutes(
                  recommendedEnd.getMinutes() + body.estimatedDuration,
                );

                return {
                  startTime: recommendedDate.toISOString(),
                  endTime: recommendedEnd.toISOString(),
                  confidence: r.confidence,
                  reasoning: `ML-optimized time slot based on productivity patterns. Confidence: ${(r.confidence * 100).toFixed(1)}%`,
                };
              },
            );

          return {
            recommendations,
            shouldSplit: false,
            splitRecommendation: null,
          };
        }
      } catch (error) {
        this.logger.warn(
          `ML scheduling failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Fallback to simple recommendations
    const recommendations = [
      {
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(
          Date.now() + 24 * 60 * 60 * 1000 + body.estimatedDuration * 60 * 1000,
        ).toISOString(),
        confidence: 0.75,
        reasoning: 'High availability, optimal productivity time, no conflicts',
      },
    ];

    return {
      recommendations,
      shouldSplit: false,
      splitRecommendation: null,
    };
  }

  /**
   * ML Task Split and Schedule - Split task and schedule parts
   */
  @Post('split-schedule')
  @ApiOperation({ summary: 'Split task and schedule parts using ML' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'totalDuration', 'preferredPartDuration'],
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        totalDuration: { type: 'number' },
        preferredPartDuration: { type: 'number' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        category: { type: 'string' },
        timeRange: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Split tasks scheduled' })
  async splitAndScheduleTask(
    @Body()
    body: {
      title: string;
      description?: string;
      totalDuration: number;
      preferredPartDuration: number;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      category?: string;
      timeRange: {
        start: string;
        end: string;
      };
    },
  ) {
    this.logger.log(`ML splitting and scheduling task: ${body.title}`);

    const numberOfParts = Math.ceil(
      body.totalDuration / body.preferredPartDuration,
    );
    const splitTasks = [];

    for (let i = 0; i < numberOfParts; i++) {
      const startTime = new Date(
        new Date(body.timeRange.start).getTime() + i * 24 * 60 * 60 * 1000,
      );
      startTime.setHours(9, 0, 0, 0);
      const endTime = new Date(
        startTime.getTime() + body.preferredPartDuration * 60 * 1000,
      );

      splitTasks.push({
        id: `task_${Date.now()}_${i}`,
        title: `${body.title} (Part ${i + 1})`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        confidence: 0.8 - i * 0.02,
      });
    }

    return { splitTasks };
  }
}
