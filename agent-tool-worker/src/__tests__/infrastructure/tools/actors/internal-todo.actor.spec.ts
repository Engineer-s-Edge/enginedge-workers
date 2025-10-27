/**
 * Internal Todo Actor Unit Tests
 *
 * Tests for todo list management and task tracking functionality.
 */

import { InternalTodoActor, TodoArgs, TodoOutput } from '@infrastructure/tools/actors/internal-todo.actor';

describe('InternalTodoActor', () => {
  let actor: InternalTodoActor;

  beforeEach(() => {
    actor = new InternalTodoActor();
  });

  describe('Create Todo', () => {
    it('should create a basic todo', async () => {
      const args: TodoArgs = {
        operation: 'create',
        title: 'Test Todo'
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as TodoOutput).operation).toBe('create');
      expect((result.output as TodoOutput).todo).toBeDefined();

      const todo = (result.output as TodoOutput).todo!;
      expect(todo.title).toBe('Test Todo');
      expect(todo.status).toBe('pending');
      expect(todo.priority).toBe('medium');
      expect(todo.tags).toEqual([]);
      expect(todo.createdAt).toBeInstanceOf(Date);
      expect(todo.updatedAt).toBeInstanceOf(Date);
      expect(todo.id).toMatch(/^todo-\d+-[a-z0-9]+$/);
    });

    it('should create a todo with all fields', async () => {
      const dueDate = new Date('2025-12-31T23:59:59Z');
      const args: TodoArgs = {
        operation: 'create',
        title: 'Complete project',
        description: 'Finish the Q4 project deliverables',
        priority: 'high',
        tags: ['work', 'urgent'],
        dueDate: dueDate.toISOString(),
        assignee: 'john.doe@example.com'
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      const todo = (result.output as TodoOutput).todo!;
      expect(todo.title).toBe('Complete project');
      expect(todo.description).toBe('Finish the Q4 project deliverables');
      expect(todo.priority).toBe('high');
      expect(todo.tags).toEqual(['work', 'urgent']);
      expect(todo.dueDate).toEqual(dueDate);
      expect(todo.assignee).toBe('john.doe@example.com');
    });

    it('should reject creation without title', async () => {
      const args: TodoArgs = {
        operation: 'create'
        // Missing title
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Title is required');
    });
  });

  describe('Update Todo', () => {
    let todoId: string;

    beforeEach(async () => {
      // Create a todo for testing updates
      const createArgs: TodoArgs = {
        operation: 'create',
        title: 'Original Todo',
        description: 'Original description',
        priority: 'low'
      };

      const createResult = await actor.execute({ name: 'internal-todo-actor', args: createArgs as unknown as Record<string, unknown> });
      todoId = (createResult.output as TodoOutput).todo!.id;
    });

    it('should update todo status', async () => {
      const args: TodoArgs = {
        operation: 'update',
        id: todoId,
        status: 'completed'
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      const todo = (result.output as TodoOutput).todo!;
      expect(todo.status).toBe('completed');
      expect(todo.updatedAt.getTime()).toBeGreaterThanOrEqual(todo.createdAt.getTime());
    });

    it('should update multiple fields', async () => {
      const args: TodoArgs = {
        operation: 'update',
        id: todoId,
        title: 'Updated Title',
        description: 'Updated description',
        priority: 'high',
        tags: ['updated'],
        assignee: 'jane.smith@example.com'
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      const todo = (result.output as TodoOutput).todo!;
      expect(todo.title).toBe('Updated Title');
      expect(todo.description).toBe('Updated description');
      expect(todo.priority).toBe('high');
      expect(todo.tags).toEqual(['updated']);
      expect(todo.assignee).toBe('jane.smith@example.com');
    });

    it('should reject update without ID', async () => {
      const args: TodoArgs = {
        operation: 'update',
        status: 'completed'
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Todo ID is required');
    });

    it('should reject update of non-existent todo', async () => {
      const args: TodoArgs = {
        operation: 'update',
        id: 'non-existent-id',
        status: 'completed'
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });
  });

  describe('List Todos', () => {
    beforeEach(async () => {
      // Create multiple todos for testing
      const todos = [
        { title: 'High Priority', priority: 'high' as const, tags: ['urgent'] },
        { title: 'Medium Priority', priority: 'medium' as const, tags: ['normal'] },
        { title: 'Low Priority', priority: 'low' as const, tags: ['minor'] },
        { title: 'Completed Task', priority: 'medium' as const, status: 'completed' as const }
      ];

      for (const todoData of todos) {
        const args: TodoArgs = {
          operation: 'create',
          ...todoData
        };
        await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });
      }
    });

    it('should list all todos', async () => {
      const args: TodoArgs = {
        operation: 'list'
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as TodoOutput).todos).toHaveLength(4);
      expect((result.output as TodoOutput).total).toBe(4);
    });

    it('should filter by status', async () => {
      const args: TodoArgs = {
        operation: 'list',
        filter: { status: ['completed'] }
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as TodoOutput).todos).toHaveLength(1);
      expect((result.output as TodoOutput).todos![0].title).toBe('Completed Task');
    });

    it('should filter by priority', async () => {
      const args: TodoArgs = {
        operation: 'list',
        filter: { priority: ['high'] }
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as TodoOutput).todos).toHaveLength(1);
      expect((result.output as TodoOutput).todos![0].title).toBe('High Priority');
    });

    it('should filter by tags', async () => {
      const args: TodoArgs = {
        operation: 'list',
        filter: { tags: ['urgent'] }
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as TodoOutput).todos).toHaveLength(1);
      expect((result.output as TodoOutput).todos![0].tags).toContain('urgent');
    });

    it('should apply pagination', async () => {
      const args: TodoArgs = {
        operation: 'list',
        limit: 2,
        offset: 1
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as TodoOutput).todos).toHaveLength(2);
      expect((result.output as TodoOutput).total).toBe(4);
    });

    it('should sort by creation date (newest first)', async () => {
      const args: TodoArgs = {
        operation: 'list'
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      const todos = (result.output as TodoOutput).todos!;
      // Should be sorted newest first
      for (let i = 0; i < todos.length - 1; i++) {
        expect(todos[i].createdAt.getTime()).toBeGreaterThanOrEqual(todos[i + 1].createdAt.getTime());
      }
    });
  });

  describe('Get Todo', () => {
    let todoId: string;

    beforeEach(async () => {
      const createArgs: TodoArgs = {
        operation: 'create',
        title: 'Test Todo for Get'
      };

      const createResult = await actor.execute({ name: 'internal-todo-actor', args: createArgs as unknown as Record<string, unknown> });
      todoId = (createResult.output as TodoOutput).todo!.id;
    });

    it('should get existing todo', async () => {
      const args: TodoArgs = {
        operation: 'get',
        id: todoId
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as TodoOutput).found).toBe(true);
      expect((result.output as TodoOutput).todo!.id).toBe(todoId);
    });

    it('should return found=false for non-existent todo', async () => {
      const args: TodoArgs = {
        operation: 'get',
        id: 'non-existent-id'
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as TodoOutput).found).toBe(false);
      expect((result.output as TodoOutput).todo).toBeUndefined();
    });

    it('should reject get without ID', async () => {
      const args: TodoArgs = {
        operation: 'get'
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Todo ID is required');
    });
  });

  describe('Delete Todo', () => {
    let todoId: string;

    beforeEach(async () => {
      const createArgs: TodoArgs = {
        operation: 'create',
        title: 'Todo to Delete'
      };

      const createResult = await actor.execute({ name: 'internal-todo-actor', args: createArgs as unknown as Record<string, unknown> });
      todoId = (createResult.output as TodoOutput).todo!.id;
    });

    it('should delete existing todo', async () => {
      const args: TodoArgs = {
        operation: 'delete',
        id: todoId
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as TodoOutput).todo!.id).toBe(todoId);

      // Verify it's actually deleted
      const getArgs: TodoArgs = {
        operation: 'get',
        id: todoId
      };

      const getResult = await actor.execute({ name: 'internal-todo-actor', args: getArgs as unknown as Record<string, unknown> });
      expect((getResult.output as TodoOutput).found).toBe(false);
    });

    it('should reject delete without ID', async () => {
      const args: TodoArgs = {
        operation: 'delete'
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Todo ID is required');
    });

    it('should reject delete of non-existent todo', async () => {
      const args: TodoArgs = {
        operation: 'delete',
        id: 'non-existent-id'
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });
  });

  describe('Validation', () => {
    it('should reject invalid operation', async () => {
      const args = {
        operation: 'invalid' as unknown
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Unsupported operation');
    });
  });

  describe('Due Date Filtering', () => {
    beforeEach(async () => {
      const todos = [
        { title: 'Overdue', dueDate: '2025-01-01T00:00:00Z' },
        { title: 'Due Soon', dueDate: '2025-12-31T00:00:00Z' },
        { title: 'Future', dueDate: '2026-01-01T00:00:00Z' }
      ];

      for (const todoData of todos) {
        const args: TodoArgs = {
          operation: 'create',
          ...todoData
        };
        await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });
      }
    });

    it('should filter by due date range', async () => {
      const args: TodoArgs = {
        operation: 'list',
        filter: {
          dueAfter: '2024-12-01T00:00:00Z',
          dueBefore: '2025-06-01T00:00:00Z'
        }
      };

      const result = await actor.execute({ name: 'internal-todo-actor', args: args as unknown as Record<string, unknown> });

      expect(result.success).toBe(true);
      expect((result.output as TodoOutput).todos).toHaveLength(1);
      expect((result.output as TodoOutput).todos![0].title).toBe('Overdue');
    });
  });
});