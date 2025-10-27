/**
 * Internal Todo Actor - Infrastructure Layer
 *
 * Manages agent todo lists and task tracking for internal workflow management.
 */

import { Injectable } from '@nestjs/common';
import { BaseActor } from '@domain/tools/base/base-actor';
import { ActorConfig, ErrorEvent } from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, ActorCategory } from '@domain/entities/tool.entities';

export type TodoOperation = 'create' | 'update' | 'list' | 'delete' | 'get';

export type TodoStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  assignee?: string;
}

export interface TodoArgs {
  operation: TodoOperation;
  // For create
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: TodoStatus;
  tags?: string[];
  dueDate?: string; // ISO date string
  assignee?: string;
  // For update
  id?: string;
  // For list/get
  filter?: {
    status?: TodoStatus[];
    priority?: ('low' | 'medium' | 'high')[];
    tags?: string[];
    assignee?: string;
    dueBefore?: string; // ISO date string
    dueAfter?: string; // ISO date string
  };
  limit?: number;
  offset?: number;
}

export interface TodoOutput extends ToolOutput {
  success: boolean;
  operation: TodoOperation;
  // For create/update/delete
  todo?: TodoItem;
  // For list
  todos?: TodoItem[];
  total?: number;
  // For get
  found?: boolean;
}

@Injectable()
export class InternalTodoActor extends BaseActor<TodoArgs, TodoOutput> {
  readonly name = 'internal-todo-actor';
  readonly description = 'Manages agent todo lists and task tracking for internal workflow management';

  readonly errorEvents: ErrorEvent[];

  readonly metadata: ActorConfig;

  // In-memory storage for todos (in production, this would be a database)
  private todos: Map<string, TodoItem> = new Map();

  constructor() {
    const errorEvents = [
      new ErrorEvent('TodoNotFound', 'The specified todo item was not found', false),
      new ErrorEvent('ValidationError', 'Invalid todo data provided', false),
      new ErrorEvent('DuplicateTodo', 'A todo with this ID already exists', false),
    ];

    const metadata = new ActorConfig(
      'internal-todo-actor',
      'Manages agent todo lists and task tracking',
      'Create, update, list, and manage todo items for agent workflow management',
      {
        type: 'object',
        additionalProperties: false,
        required: ['operation'],
        properties: {
          operation: {
            type: 'string',
            enum: ['create', 'update', 'list', 'delete', 'get'],
            description: 'The operation to perform'
          },
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
            description: 'Todo title (required for create)'
          },
          description: {
            type: 'string',
            maxLength: 1000,
            description: 'Todo description'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Todo priority level'
          },
          tags: {
            type: 'array',
            items: { type: 'string', maxLength: 50 },
            maxItems: 10,
            description: 'Tags for categorization'
          },
          dueDate: {
            type: 'string',
            format: 'date-time',
            description: 'Due date in ISO format'
          },
          assignee: {
            type: 'string',
            maxLength: 100,
            description: 'Person assigned to this todo'
          },
          id: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Todo ID (required for update/delete/get)'
          },
          status: {
            type: 'string',
            enum: ['pending', 'in-progress', 'completed', 'cancelled'],
            description: 'Todo status (for update)'
          },
          filter: {
            type: 'object',
            properties: {
              status: {
                type: 'array',
                items: { type: 'string', enum: ['pending', 'in-progress', 'completed', 'cancelled'] }
              },
              priority: {
                type: 'array',
                items: { type: 'string', enum: ['low', 'medium', 'high'] }
              },
              tags: {
                type: 'array',
                items: { type: 'string' }
              },
              assignee: {
                type: 'string'
              },
              dueBefore: {
                type: 'string',
                format: 'date-time'
              },
              dueAfter: {
                type: 'string',
                format: 'date-time'
              }
            }
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 50,
            description: 'Maximum number of todos to return'
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            description: 'Number of todos to skip'
          }
        }
      },
      {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          operation: { type: 'string' },
          todo: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              status: { type: 'string' },
              priority: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              dueDate: { type: 'string', format: 'date-time' },
              assignee: { type: 'string' }
            }
          },
          todos: {
            type: 'array',
            items: { $ref: '#/properties/todo' }
          },
          total: { type: 'number' },
          found: { type: 'boolean' }
        }
      },
      [
        {
          operation: 'create',
          title: 'Review pull request #123',
          description: 'Review the changes in the authentication module',
          priority: 'high',
          tags: ['review', 'auth']
        },
        {
          operation: 'list',
          filter: { status: ['pending', 'in-progress'] },
          limit: 10
        },
        {
          operation: 'update',
          id: 'todo-123',
          status: 'completed'
        }
      ],
      ActorCategory.INTERNAL_SANDBOX,
      false
    );

    super(metadata, errorEvents);
    this.metadata = metadata;
    this.errorEvents = errorEvents;
  }

  get category(): ActorCategory {
    return ActorCategory.INTERNAL_SANDBOX;
  }

  get requiresAuth(): boolean {
    return false;
  }

  protected async act(args: TodoArgs): Promise<TodoOutput> {
    switch (args.operation) {
      case 'create':
        return this.createTodo(args);
      case 'update':
        return this.updateTodo(args);
      case 'list':
        return this.listTodos(args);
      case 'delete':
        return this.deleteTodo(args);
      case 'get':
        return this.getTodo(args);
      default:
        throw Object.assign(new Error(`Unsupported operation: ${args.operation}`), {
          name: 'ValidationError'
        });
    }
  }

  private createTodo(args: TodoArgs): TodoOutput {
    if (!args.title) {
      throw Object.assign(new Error('Title is required for todo creation'), {
        name: 'ValidationError'
      });
    }

    const id = this.generateId();
    const now = new Date();

    const todo: TodoItem = {
      id,
      title: args.title,
      description: args.description,
      status: args.status || 'pending',
      priority: args.priority || 'medium',
      tags: args.tags || [],
      createdAt: now,
      updatedAt: now,
      dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
      assignee: args.assignee
    };

    this.todos.set(id, todo);

    return {
      success: true,
      operation: 'create',
      todo
    };
  }

  private updateTodo(args: TodoArgs): TodoOutput {
    if (!args.id) {
      throw Object.assign(new Error('Todo ID is required for update'), {
        name: 'ValidationError'
      });
    }

    const todo = this.todos.get(args.id);
    if (!todo) {
      throw Object.assign(new Error(`Todo with ID ${args.id} not found`), {
        name: 'TodoNotFound'
      });
    }

    // Update fields
    if (args.status !== undefined) {
      todo.status = args.status;
    }
    if (args.title !== undefined) {
      todo.title = args.title;
    }
    if (args.description !== undefined) {
      todo.description = args.description;
    }
    if (args.priority !== undefined) {
      todo.priority = args.priority;
    }
    if (args.tags !== undefined) {
      todo.tags = args.tags;
    }
    if (args.dueDate !== undefined) {
      todo.dueDate = args.dueDate ? new Date(args.dueDate) : undefined;
    }
    if (args.assignee !== undefined) {
      todo.assignee = args.assignee;
    }

    todo.updatedAt = new Date();
    this.todos.set(args.id, todo);

    return {
      success: true,
      operation: 'update',
      todo
    };
  }

  private listTodos(args: TodoArgs): TodoOutput {
    let todos = Array.from(this.todos.values());

    // Apply filters
    if (args.filter) {
      todos = todos.filter(todo => {
        if (args.filter!.status && !args.filter!.status.includes(todo.status)) {
          return false;
        }
        if (args.filter!.priority && !args.filter!.priority.includes(todo.priority || 'medium')) {
          return false;
        }
        if (args.filter!.tags && args.filter!.tags.length > 0) {
          const hasMatchingTag = args.filter!.tags.some(tag =>
            todo.tags?.includes(tag)
          );
          if (!hasMatchingTag) return false;
        }
        if (args.filter!.assignee && todo.assignee !== args.filter!.assignee) {
          return false;
        }
        if (args.filter!.dueBefore && todo.dueDate && todo.dueDate > new Date(args.filter!.dueBefore)) {
          return false;
        }
        if (args.filter!.dueAfter && todo.dueDate && todo.dueDate < new Date(args.filter!.dueAfter)) {
          return false;
        }
        return true;
      });
    }

    // Sort by creation date (newest first)
    todos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const limit = args.limit || 50;
    const offset = args.offset || 0;
    const paginatedTodos = todos.slice(offset, offset + limit);

    return {
      success: true,
      operation: 'list',
      todos: paginatedTodos,
      total: todos.length
    };
  }

  private deleteTodo(args: TodoArgs): TodoOutput {
    if (!args.id) {
      throw Object.assign(new Error('Todo ID is required for deletion'), {
        name: 'ValidationError'
      });
    }

    const todo = this.todos.get(args.id);
    if (!todo) {
      throw Object.assign(new Error(`Todo with ID ${args.id} not found`), {
        name: 'TodoNotFound'
      });
    }

    this.todos.delete(args.id);

    return {
      success: true,
      operation: 'delete',
      todo
    };
  }

  private getTodo(args: TodoArgs): TodoOutput {
    if (!args.id) {
      throw Object.assign(new Error('Todo ID is required'), {
        name: 'ValidationError'
      });
    }

    const todo = this.todos.get(args.id);

    return {
      success: true,
      operation: 'get',
      todo,
      found: !!todo
    };
  }

  private generateId(): string {
    return `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}