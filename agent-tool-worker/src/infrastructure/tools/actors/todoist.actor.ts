/**
 * Todoist Actor - Infrastructure Layer
 *
 * Provides integration with Todoist API for task management.
 */

import { Injectable } from '@nestjs/common';
import { BaseActor } from '@domain/tools/base/base-actor';
import {
  ActorConfig,
  ErrorEvent,
} from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, ActorCategory } from '@domain/entities/tool.entities';

export type TodoistOperation =
  | 'create-task'
  | 'update-task'
  | 'complete-task'
  | 'delete-task'
  | 'get-task'
  | 'list-tasks'
  | 'create-project'
  | 'get-projects';

export interface TodoistArgs {
  operation: TodoistOperation;
  // Authentication
  apiToken?: string;
  // For create-task/update-task
  taskId?: string;
  content?: string;
  description?: string;
  projectId?: string;
  dueDate?: string; // ISO 8601 format
  priority?: number; // 1-4 (4 is highest)
  labels?: string[];
  // For complete-task/delete-task/get-task
  // For list-tasks
  filter?: string; // Todoist filter query
  limit?: number;
  // For create-project
  projectName?: string;
  parentId?: string;
  color?: number;
}

export interface TodoistOutput extends ToolOutput {
  success: boolean;
  operation: TodoistOperation;
  // For create-task/create-project
  id?: string;
  // For get-task
  task?: unknown;
  // For list-tasks
  tasks?: unknown[];
  // For get-projects
  projects?: unknown[];
  // For operations that return affected items
  updated?: boolean;
  deleted?: boolean;
}

@Injectable()
export class TodoistActor extends BaseActor<TodoistArgs, TodoistOutput> {
  readonly name = 'todoist-actor';
  readonly description =
    'Provides integration with Todoist API for task management';

  readonly errorEvents: ErrorEvent[];

  readonly metadata: ActorConfig;

  get category(): ActorCategory {
    return ActorCategory.EXTERNAL_PRODUCTIVITY;
  }

  get requiresAuth(): boolean {
    return true;
  }

  constructor() {
    const errorEvents = [
      new ErrorEvent(
        'AuthenticationError',
        'Invalid or expired API token',
        false,
      ),
      new ErrorEvent('RateLimitError', 'API rate limit exceeded', true),
      new ErrorEvent('NetworkError', 'Network connectivity issue', true),
      new ErrorEvent('ValidationError', 'Invalid request parameters', false),
      new ErrorEvent('NotFoundError', 'Task or project not found', false),
    ];

    const metadata = new ActorConfig(
      'todoist-actor',
      'Todoist API integration',
      'Create, read, update, and manage Todoist tasks and projects',
      {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: [
              'create-task',
              'update-task',
              'complete-task',
              'delete-task',
              'get-task',
              'list-tasks',
              'create-project',
              'get-projects',
            ],
          },
          apiToken: { type: 'string' },
          taskId: { type: 'string' },
          content: { type: 'string' },
          description: { type: 'string' },
          projectId: { type: 'string' },
          dueDate: { type: 'string', format: 'date' },
          priority: { type: 'number', minimum: 1, maximum: 4 },
          labels: { type: 'array', items: { type: 'string' } },
          filter: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 200 },
          projectName: { type: 'string' },
          parentId: { type: 'string' },
          color: { type: 'number', minimum: 0, maximum: 49 },
        },
        required: ['operation'],
      },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          operation: {
            type: 'string',
            enum: [
              'create-task',
              'update-task',
              'complete-task',
              'delete-task',
              'get-task',
              'list-tasks',
              'create-project',
              'get-projects',
            ],
          },
          id: { type: 'string' },
          task: { type: 'object' },
          tasks: { type: 'array', items: { type: 'object' } },
          projects: { type: 'array', items: { type: 'object' } },
          updated: { type: 'boolean' },
          deleted: { type: 'boolean' },
        },
        required: ['success', 'operation'],
      },
      [],
      ActorCategory.EXTERNAL_PRODUCTIVITY,
      true,
    );

    super(metadata, errorEvents);

    this.errorEvents = errorEvents;
    this.metadata = metadata;
  }

  protected async act(args: TodoistArgs): Promise<TodoistOutput> {
    // Validate authentication
    if (!args.apiToken) {
      throw Object.assign(new Error('Todoist API token is required'), {
        name: 'AuthenticationError',
      });
    }

    switch (args.operation) {
      case 'create-task':
        return this.createTask(args);
      case 'update-task':
        return this.updateTask(args);
      case 'complete-task':
        return this.completeTask(args);
      case 'delete-task':
        return this.deleteTask(args);
      case 'get-task':
        return this.getTask(args);
      case 'list-tasks':
        return this.listTasks(args);
      case 'create-project':
        return this.createProject(args);
      case 'get-projects':
        return this.getProjects(args);
      default:
        throw Object.assign(
          new Error(`Unsupported operation: ${args.operation}`),
          {
            name: 'ValidationError',
          },
        );
    }
  }

  private async createTask(args: TodoistArgs): Promise<TodoistOutput> {
    if (!args.content) {
      throw Object.assign(new Error('Task content is required'), {
        name: 'ValidationError',
      });
    }

    try {
      // Simulate API call - In real implementation, this would call Todoist API
      const taskId = `task-${Date.now()}`;

      return {
        success: true,
        operation: 'create-task',
        id: taskId,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async updateTask(args: TodoistArgs): Promise<TodoistOutput> {
    if (!args.taskId) {
      throw Object.assign(new Error('Task ID is required for task update'), {
        name: 'ValidationError',
      });
    }

    try {
      // Simulate API call
      return {
        success: true,
        operation: 'update-task',
        updated: true,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async completeTask(args: TodoistArgs): Promise<TodoistOutput> {
    if (!args.taskId) {
      throw Object.assign(
        new Error('Task ID is required for task completion'),
        {
          name: 'ValidationError',
        },
      );
    }

    try {
      // Simulate API call
      return {
        success: true,
        operation: 'complete-task',
        updated: true,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async deleteTask(args: TodoistArgs): Promise<TodoistOutput> {
    if (!args.taskId) {
      throw Object.assign(new Error('Task ID is required for task deletion'), {
        name: 'ValidationError',
      });
    }

    try {
      // Simulate API call
      return {
        success: true,
        operation: 'delete-task',
        deleted: true,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async getTask(args: TodoistArgs): Promise<TodoistOutput> {
    if (!args.taskId) {
      throw Object.assign(new Error('Task ID is required'), {
        name: 'ValidationError',
      });
    }

    try {
      // Simulate API call
      const mockTask = {
        id: args.taskId,
        content: 'Sample Task',
        description: 'This is a sample task',
        project_id: 'project-123',
        priority: 3,
        due: { date: '2024-01-15' },
        labels: ['work', 'urgent'],
        completed: false,
      };

      return {
        success: true,
        operation: 'get-task',
        task: mockTask,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async listTasks(args: TodoistArgs): Promise<TodoistOutput> {
    // In a real implementation, args would be used for filter and limit parameters
    try {
      // Simulate API call
      const mockTasks = [
        {
          id: 'task-1',
          content: 'Review pull request',
          project_id: 'project-123',
          priority: 4,
          due: { date: '2024-01-15' },
          labels: ['work'],
        },
        {
          id: 'task-2',
          content: 'Update documentation',
          project_id: 'project-123',
          priority: 2,
          due: { date: '2024-01-16' },
          labels: ['documentation'],
        },
      ];

      return {
        success: true,
        operation: 'list-tasks',
        tasks: mockTasks,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async createProject(args: TodoistArgs): Promise<TodoistOutput> {
    if (!args.projectName) {
      throw Object.assign(new Error('Project name is required'), {
        name: 'ValidationError',
      });
    }

    try {
      // Simulate API call
      const projectId = `project-${Date.now()}`;

      return {
        success: true,
        operation: 'create-project',
        id: projectId,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private async getProjects(args: TodoistArgs): Promise<TodoistOutput> {
    // In a real implementation, args might be used for filtering projects
    try {
      // Simulate API call
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Work',
          color: 30,
          parent_id: null,
        },
        {
          id: 'project-2',
          name: 'Personal',
          color: 40,
          parent_id: null,
        },
      ];

      return {
        success: true,
        operation: 'get-projects',
        projects: mockProjects,
      };
    } catch (error: unknown) {
      throw this.handleApiError(error);
    }
  }

  private handleApiError(error: unknown): Error {
    // In a real implementation, this would parse Todoist API errors
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown API error';

    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      return Object.assign(new Error('Invalid or expired API token'), {
        name: 'AuthenticationError',
      });
    }

    if (
      errorMessage.includes('429') ||
      errorMessage.includes('Too Many Requests')
    ) {
      return Object.assign(new Error('API rate limit exceeded'), {
        name: 'RateLimitError',
      });
    }

    if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
      return Object.assign(new Error('Task or project not found'), {
        name: 'NotFoundError',
      });
    }

    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return Object.assign(new Error('Network connectivity issue'), {
        name: 'NetworkError',
      });
    }

    return Object.assign(new Error(`Todoist API error: ${errorMessage}`), {
      name: 'ApiError',
    });
  }
}
