/**
 * Todoist Actor - Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  TodoistActor,
  TodoistArgs,
  TodoistOutput,
} from '@infrastructure/tools/actors/todoist.actor';

describe('TodoistActor', () => {
  let actor: TodoistActor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TodoistActor],
    }).compile();

    actor = module.get<TodoistActor>(TodoistActor);
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(actor.name).toBe('todoist-actor');
      expect(actor.description).toBe(
        'Provides integration with Todoist API for task management',
      );
    });

    it('should have correct category and auth requirements', () => {
      expect(actor.category).toBeDefined();
      expect(actor.requiresAuth).toBe(true);
    });
  });

  describe('Authentication', () => {
    it('should return error when API token is missing', async () => {
      const args: TodoistArgs = {
        operation: 'create-task',
        content: 'Test Task',
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Todoist API token is required');
      expect(result.error?.name).toBe('AuthenticationError');
    });
  });

  describe('Create Task', () => {
    const validArgs: TodoistArgs = {
      operation: 'create-task',
      apiToken: 'test-api-token',
      content: 'Review code changes',
      description:
        'Review the latest pull request for the authentication module',
      projectId: 'project-123',
      dueDate: '2024-01-15',
      priority: 3,
      labels: ['work', 'urgent'],
    };

    it('should create a task successfully', async () => {
      const result = await actor.execute({
        name: 'todoist-actor',
        args: validArgs as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect((result.output as TodoistOutput).operation).toBe('create-task');
      expect((result.output as TodoistOutput).id).toMatch(/^task-\d+$/);
    });

    it('should return error when content is missing', async () => {
      const args: TodoistArgs = {
        operation: 'create-task',
        apiToken: 'test-api-token',
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Task content is required');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Update Task', () => {
    it('should update a task successfully', async () => {
      const args: TodoistArgs = {
        operation: 'update-task',
        apiToken: 'test-api-token',
        taskId: 'task-123',
        content: 'Updated task content',
        priority: 4,
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect((result.output as TodoistOutput).operation).toBe('update-task');
      expect((result.output as TodoistOutput).updated).toBe(true);
    });

    it('should return error when taskId is missing', async () => {
      const args: TodoistArgs = {
        operation: 'update-task',
        apiToken: 'test-api-token',
        content: 'Updated content',
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Task ID is required for task update');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Complete Task', () => {
    it('should complete a task successfully', async () => {
      const args: TodoistArgs = {
        operation: 'complete-task',
        apiToken: 'test-api-token',
        taskId: 'task-123',
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect((result.output as TodoistOutput).operation).toBe('complete-task');
      expect((result.output as TodoistOutput).updated).toBe(true);
    });

    it('should return error when taskId is missing', async () => {
      const args: TodoistArgs = {
        operation: 'complete-task',
        apiToken: 'test-api-token',
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Task ID is required for task completion',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Delete Task', () => {
    it('should delete a task successfully', async () => {
      const args: TodoistArgs = {
        operation: 'delete-task',
        apiToken: 'test-api-token',
        taskId: 'task-123',
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect((result.output as TodoistOutput).operation).toBe('delete-task');
      expect((result.output as TodoistOutput).deleted).toBe(true);
    });

    it('should return error when taskId is missing', async () => {
      const args: TodoistArgs = {
        operation: 'delete-task',
        apiToken: 'test-api-token',
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Task ID is required for task deletion',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Get Task', () => {
    it('should get a task successfully', async () => {
      const args: TodoistArgs = {
        operation: 'get-task',
        apiToken: 'test-api-token',
        taskId: 'task-123',
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect((result.output as TodoistOutput).operation).toBe('get-task');
      expect((result.output as TodoistOutput).task).toBeDefined();
      const task = (result.output as TodoistOutput).task as {
        id: string;
        content: string;
      };
      expect(task.id).toBe('task-123');
      expect(task.content).toBe('Sample Task');
    });

    it('should return error when taskId is missing', async () => {
      const args: TodoistArgs = {
        operation: 'get-task',
        apiToken: 'test-api-token',
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Task ID is required');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('List Tasks', () => {
    it('should list tasks successfully', async () => {
      const args: TodoistArgs = {
        operation: 'list-tasks',
        apiToken: 'test-api-token',
        filter: 'today',
        limit: 50,
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect((result.output as TodoistOutput).operation).toBe('list-tasks');
      expect((result.output as TodoistOutput).tasks).toBeDefined();
      expect(Array.isArray((result.output as TodoistOutput).tasks)).toBe(true);
      expect((result.output as TodoistOutput).tasks!.length).toBeGreaterThan(0);
    });
  });

  describe('Create Project', () => {
    it('should create a project successfully', async () => {
      const args: TodoistArgs = {
        operation: 'create-project',
        apiToken: 'test-api-token',
        projectName: 'New Project',
        parentId: 'parent-123',
        color: 30,
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect((result.output as TodoistOutput).operation).toBe('create-project');
      expect((result.output as TodoistOutput).id).toMatch(/^project-\d+$/);
    });

    it('should return error when projectName is missing', async () => {
      const args: TodoistArgs = {
        operation: 'create-project',
        apiToken: 'test-api-token',
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Project name is required');
      expect(result.error?.name).toBe('ValidationError');
    });
  });

  describe('Get Projects', () => {
    it('should get projects successfully', async () => {
      const args: TodoistArgs = {
        operation: 'get-projects',
        apiToken: 'test-api-token',
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(true);
      expect((result.output as TodoistOutput).operation).toBe('get-projects');
      expect((result.output as TodoistOutput).projects).toBeDefined();
      expect(Array.isArray((result.output as TodoistOutput).projects)).toBe(
        true,
      );
      expect((result.output as TodoistOutput).projects!.length).toBeGreaterThan(
        0,
      );
    });
  });

  describe('Error Handling', () => {
    it('should return error for unsupported operation', async () => {
      const args = {
        operation: 'invalid-operation' as unknown as 'create-task',
        apiToken: 'test-api-token',
      };

      const result = await actor.execute({
        name: 'todoist-actor',
        args: args as unknown as Record<string, unknown>,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe(
        'Unsupported operation: invalid-operation',
      );
      expect(result.error?.name).toBe('ValidationError');
    });
  });
});
