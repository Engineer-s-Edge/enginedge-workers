import { Injectable, Logger, Inject } from '@nestjs/common';
import { Task, TaskCompletionStatus, TaskPriority, EventAttendee, EventReminder, EventRecurrence } from '../../domain/entities';
import { ITaskRepository } from '../ports/repositories.port';

/**
 * Task Application Service
 *
 * Business logic for task management
 *
 * Application Layer - Orchestrates domain logic
 */
@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @Inject('ITaskRepository')
    private readonly taskRepository: ITaskRepository,
  ) {
    this.logger.log('TaskService initialized');
  }

  /**
   * Create a new task
   */
  async createTask(data: {
    userId: string;
    calendarId: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    attendees?: EventAttendee[];
    reminders?: EventReminder[];
    recurrence?: EventRecurrence | null;
    category?: string;
    priority?: TaskPriority;
    tags?: string[];
    estimatedDuration?: number;
    isLocked?: boolean;
    metadata?: Record<string, any>;
  }): Promise<Task> {
    this.logger.log(`Creating task for user: ${data.userId}`);

    const task = new Task(
      this.generateId(),
      data.calendarId,
      data.title,
      data.description || null,
      data.startTime,
      data.endTime,
      data.location || null,
      data.attendees || [],
      data.reminders || [],
      data.recurrence || null,
      new Date(),
      new Date(),
      'internal',
      { ...data.metadata, userId: data.userId },
      'pending',
      0,
      data.isLocked || false,
      data.estimatedDuration,
      undefined,
      data.category,
      data.priority,
      data.tags,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    const saved = await this.taskRepository.save(task);
    this.logger.log(`Created task: ${saved.id}`);

    return saved;
  }

  /**
   * Get task by ID
   */
  async getTask(id: string): Promise<Task | null> {
    return await this.taskRepository.findById(id);
  }

  /**
   * Get tasks with filters
   */
  async getTasks(filters: {
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    category?: string;
    priority?: TaskPriority;
    status?: TaskCompletionStatus;
    isLocked?: boolean;
    tags?: string[];
  }): Promise<Task[]> {
    return await this.taskRepository.findWithFilters(filters);
  }

  /**
   * Update a task
   */
  async updateTask(id: string, updates: {
    title?: string;
    description?: string | null;
    location?: string | null;
    attendees?: EventAttendee[];
    reminders?: EventReminder[];
    recurrence?: EventRecurrence | null;
    category?: string;
    priority?: TaskPriority;
    tags?: string[];
    estimatedDuration?: number;
    metadata?: Record<string, any>;
  }): Promise<Task> {
    this.logger.log(`Updating task: ${id}`);

    const existing = await this.taskRepository.findById(id);
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }

    const updated = existing.updateTask(updates);
    return await this.taskRepository.update(updated);
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<boolean> {
    this.logger.log(`Deleting task: ${id}`);
    return await this.taskRepository.delete(id);
  }

  /**
   * Defer task to different time
   */
  async deferTask(id: string, deferType: 'same-day' | 'next-day' | 'next-3-days' | 'next-week', newTime?: Date): Promise<Task> {
    this.logger.log(`Deferring task: ${id}, type: ${deferType}`);

    const task = await this.taskRepository.findById(id);
    if (!task) {
      throw new Error(`Task ${id} not found`);
    }

    let newStartTime: Date;
    let newEndTime: Date;
    const duration = task.getDurationMinutes();

    if (deferType === 'same-day') {
      if (!newTime) {
        throw new Error('New time is required for same-day deferral');
      }
      newStartTime = newTime;
      newEndTime = new Date(newTime.getTime() + duration * 60 * 1000);
    } else {
      const now = new Date();
      let targetDate = new Date(task.startTime);

      if (deferType === 'next-day') {
        targetDate.setDate(targetDate.getDate() + 1);
      } else if (deferType === 'next-3-days') {
        targetDate.setDate(targetDate.getDate() + 3);
      } else if (deferType === 'next-week') {
        targetDate.setDate(targetDate.getDate() + 7);
      }

      // Keep the same time of day
      newStartTime = new Date(targetDate);
      newStartTime.setHours(task.startTime.getHours(), task.startTime.getMinutes(), 0, 0);
      newEndTime = new Date(newStartTime.getTime() + duration * 60 * 1000);
    }

    const deferred = task.defer(newStartTime, newEndTime);
    return await this.taskRepository.update(deferred);
  }

  /**
   * Split task into multiple tasks
   */
  async splitTask(id: string, options: {
    numberOfTasks: number;
    splitEvenly: boolean;
    durations?: number[];
    scheduleParts?: boolean;
    deferType?: 'next-day' | 'next-3-days' | 'next-week';
  }): Promise<Task[]> {
    this.logger.log(`Splitting task: ${id} into ${options.numberOfTasks} parts`);

    const task = await this.taskRepository.findById(id);
    if (!task) {
      throw new Error(`Task ${id} not found`);
    }

    const totalDuration = task.getDurationMinutes();
    const durations: number[] = [];

    if (options.splitEvenly) {
      const partDuration = Math.floor(totalDuration / options.numberOfTasks);
      for (let i = 0; i < options.numberOfTasks; i++) {
        durations.push(partDuration);
      }
      // Add remainder to last task
      const remainder = totalDuration % options.numberOfTasks;
      if (remainder > 0) {
        durations[durations.length - 1] += remainder;
      }
    } else {
      if (!options.durations || options.durations.length !== options.numberOfTasks) {
        throw new Error('Durations array must match number of tasks');
      }
      durations.push(...options.durations);
    }

    const splitTasks: Task[] = [];
    const splitFromTaskId = task.splitFromTaskId || task.id;

    for (let i = 0; i < options.numberOfTasks; i++) {
      const partDuration = durations[i];
      let partStartTime: Date;
      let partEndTime: Date;

      if (options.scheduleParts && i > 0) {
        // Schedule subsequent parts
        const previousPart = splitTasks[i - 1];
        let targetDate = new Date(previousPart.endTime);

        if (options.deferType === 'next-day') {
          targetDate.setDate(targetDate.getDate() + 1);
        } else if (options.deferType === 'next-3-days') {
          targetDate.setDate(targetDate.getDate() + 3);
        } else if (options.deferType === 'next-week') {
          targetDate.setDate(targetDate.getDate() + 7);
        } else {
          // Default: next day
          targetDate.setDate(targetDate.getDate() + 1);
        }

        partStartTime = new Date(targetDate);
        partStartTime.setHours(task.startTime.getHours(), task.startTime.getMinutes(), 0, 0);
      } else {
        // First part or not scheduling
        partStartTime = new Date(task.startTime);
        if (i > 0) {
          const previousPart = splitTasks[i - 1];
          partStartTime = new Date(previousPart.endTime);
        }
      }

      partEndTime = new Date(partStartTime.getTime() + partDuration * 60 * 1000);

      const partTask = new Task(
        this.generateId(),
        task.calendarId,
        `${task.title} (Part ${i + 1})`,
        task.description,
        partStartTime,
        partEndTime,
        task.location,
        task.attendees,
        task.reminders,
        null, // No recurrence for split parts
        new Date(),
        new Date(),
        task.source,
        { ...task.metadata },
        'pending',
        0,
        false,
        partDuration,
        undefined,
        task.category,
        task.priority,
        task.tags,
        undefined,
        splitFromTaskId,
        undefined,
        undefined,
      );

      splitTasks.push(await this.taskRepository.save(partTask));
    }

    // Mark original task as split (or delete if all parts scheduled)
    if (options.scheduleParts) {
      await this.taskRepository.delete(id);
    }

    return splitTasks;
  }

  /**
   * Complete a task
   */
  async completeTask(id: string, options: {
    completionType: 'fully' | 'partially';
    completionPercentage?: number;
    notes?: string;
    actualDuration?: number;
  }): Promise<Task> {
    this.logger.log(`Completing task: ${id}`);

    const task = await this.taskRepository.findById(id);
    if (!task) {
      throw new Error(`Task ${id} not found`);
    }

    let completed: Task;

    if (options.completionType === 'fully') {
      completed = task.markComplete(options.actualDuration, options.notes);
    } else {
      if (!options.completionPercentage) {
        throw new Error('Completion percentage is required for partial completion');
      }
      completed = task.markPartiallyComplete(
        options.completionPercentage,
        options.actualDuration,
        options.notes,
      );
    }

    return await this.taskRepository.update(completed);
  }

  /**
   * Duplicate a task
   */
  async duplicateTask(id: string, newStartTime?: Date, newEndTime?: Date): Promise<Task> {
    this.logger.log(`Duplicating task: ${id}`);

    const task = await this.taskRepository.findById(id);
    if (!task) {
      throw new Error(`Task ${id} not found`);
    }

    const duplicated = task.duplicate(this.generateId(), newStartTime, newEndTime);
    return await this.taskRepository.save(duplicated);
  }

  /**
   * Make task recurring
   */
  async makeTaskRecurring(id: string, recurrence: EventRecurrence): Promise<Task> {
    this.logger.log(`Making task recurring: ${id}`);

    const task = await this.taskRepository.findById(id);
    if (!task) {
      throw new Error(`Task ${id} not found`);
    }

    const updated = task.updateTask({ recurrence });
    return await this.taskRepository.update(updated);
  }

  /**
   * Lock or unlock a task
   */
  async lockTask(id: string, locked: boolean): Promise<Task> {
    this.logger.log(`${locked ? 'Locking' : 'Unlocking'} task: ${id}`);

    const task = await this.taskRepository.findById(id);
    if (!task) {
      throw new Error(`Task ${id} not found`);
    }

    const updated = task.setLocked(locked);
    return await this.taskRepository.update(updated);
  }

  /**
   * Get task history (for audit)
   */
  async getTaskHistory(id: string): Promise<any[]> {
    // This would typically be implemented with an audit log
    // For now, return basic task info
    const task = await this.taskRepository.findById(id);
    if (!task) {
      throw new Error(`Task ${id} not found`);
    }

    return [
      {
        taskId: task.id,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completionStatus: task.completionStatus,
        completionPercentage: task.completionPercentage,
        isLocked: task.isLocked,
        lockedAt: task.lockedAt,
        completedAt: task.completedAt,
      },
    ];
  }

  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
