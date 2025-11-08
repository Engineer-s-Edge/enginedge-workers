/**
 * Internal Todo Actor - Infrastructure Layer
 *
 * Manages agent todo lists and task tracking for internal workflow management.
 */

import { Injectable, Inject } from '@nestjs/common';
import { BaseActor } from '@domain/tools/base/base-actor';
import {
  ActorConfig,
  ErrorEvent,
} from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput, ActorCategory } from '@domain/entities/tool.entities';
import { Db } from 'mongodb';

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
  readonly description =
    'Manages agent todo lists and task tracking for internal workflow management';

  readonly errorEvents: ErrorEvent[];

  readonly metadata: ActorConfig;

  private readonly collection;

  constructor(@Inject('MONGODB_DB') private readonly db: Db) {
    const errorEvents = [
      new ErrorEvent(
        'TodoNotFound',
        'The specified todo item was not found',
        false,
      ),
      new ErrorEvent('ValidationError', 'Invalid todo data provided', false),
      new ErrorEvent(
        'DuplicateTodo',
        'A todo with this ID already exists',
        false,
      ),
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
            description: 'The operation to perform',
          },
          title: {
            type: 'string',
            minLength: 1,
            maxLength: 200,
            description: 'Todo title (required for create)',
          },
          description: {
            type: 'string',
            maxLength: 1000,
            description: 'Todo description',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Todo priority level',
          },
          tags: {
            type: 'array',
            items: { type: 'string', maxLength: 50 },
            maxItems: 10,
            description: 'Tags for categorization',
          },
          dueDate: {
            type: 'string',
            format: 'date-time',
            description: 'Due date in ISO format',
          },
          assignee: {
            type: 'string',
            maxLength: 100,
            description: 'Person assigned to this todo',
          },
          id: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Todo ID (required for update/delete/get)',
          },
          status: {
            type: 'string',
            enum: ['pending', 'in-progress', 'completed', 'cancelled'],
            description: 'Todo status (for update)',
          },
          filter: {
            type: 'object',
            properties: {
              status: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['pending', 'in-progress', 'completed', 'cancelled'],
                },
              },
              priority: {
                type: 'array',
                items: { type: 'string', enum: ['low', 'medium', 'high'] },
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
              assignee: {
                type: 'string',
              },
              dueBefore: {
                type: 'string',
                format: 'date-time',
              },
              dueAfter: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            default: 50,
            description: 'Maximum number of todos to return',
          },
          offset: {
            type: 'number',
            minimum: 0,
            default: 0,
            description: 'Number of todos to skip',
          },
        },
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
              assignee: { type: 'string' },
            },
          },
          todos: {
            type: 'array',
            items: { $ref: '#/properties/todo' },
          },
          total: { type: 'number' },
          found: { type: 'boolean' },
        },
      },
      [
        {
          operation: 'create',
          title: 'Review pull request #123',
          description: 'Review the changes in the authentication module',
          priority: 'high',
          tags: ['review', 'auth'],
        },
        {
          operation: 'list',
          filter: { status: ['pending', 'in-progress'] },
          limit: 10,
        },
        {
          operation: 'update',
          id: 'todo-123',
          status: 'completed',
        },
      ],
      ActorCategory.INTERNAL_SANDBOX,
      false,
    );

    super(metadata, errorEvents);
    this.metadata = metadata;
    this.errorEvents = errorEvents;

    this.collection = this.db.collection<TodoItem>('todos');

    // Create indexes for better query performance
    this.collection
      .createIndexes([
        { key: { id: 1 }, unique: true },
        { key: { status: 1 } },
        { key: { priority: 1 } },
        { key: { assignee: 1 } },
        { key: { dueDate: 1 } },
        { key: { createdAt: -1 } },
      ])
      .catch(() => {
        // Indexes may already exist, ignore errors
      });
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
        return await this.createTodo(args);
      case 'update':
        return await this.updateTodo(args);
      case 'list':
        return await this.listTodos(args);
      case 'delete':
        return await this.deleteTodo(args);
      case 'get':
        return await this.getTodo(args);
      default:
        throw Object.assign(
          new Error(`Unsupported operation: ${args.operation}`),
          {
            name: 'ValidationError',
          },
        );
    }
  }

  private async createTodo(args: TodoArgs): Promise<TodoOutput> {
    if (!args.title) {
      throw Object.assign(new Error('Title is required for todo creation'), {
        name: 'ValidationError',
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
      assignee: args.assignee,
    };

    await this.collection.insertOne(todo);

    return {
      success: true,
      operation: 'create',
      todo,
    };
  }

  private async updateTodo(args: TodoArgs): Promise<TodoOutput> {
    if (!args.id) {
      throw Object.assign(new Error('Todo ID is required for update'), {
        name: 'ValidationError',
      });
    }

    const updateData: Partial<TodoItem> = {
      updatedAt: new Date(),
    };

    if (args.status !== undefined) {
      updateData.status = args.status;
    }
    if (args.title !== undefined) {
      updateData.title = args.title;
    }
    if (args.description !== undefined) {
      updateData.description = args.description;
    }
    if (args.priority !== undefined) {
      updateData.priority = args.priority;
    }
    if (args.tags !== undefined) {
      updateData.tags = args.tags;
    }
    if (args.dueDate !== undefined) {
      updateData.dueDate = args.dueDate ? new Date(args.dueDate) : undefined;
    }
    if (args.assignee !== undefined) {
      updateData.assignee = args.assignee;
    }

    const result = await this.collection.findOneAndUpdate(
      { id: args.id },
      { $set: updateData },
      { returnDocument: 'after' },
    );

    if (!result) {
      throw Object.assign(new Error(`Todo with ID ${args.id} not found`), {
        name: 'TodoNotFound',
      });
    }

    return {
      success: true,
      operation: 'update',
      todo: result,
    };
  }

  private async listTodos(args: TodoArgs): Promise<TodoOutput> {
    const query: any = {};

    // Apply filters
    if (args.filter) {
      if (args.filter.status && args.filter.status.length > 0) {
        query.status = { $in: args.filter.status };
      }
      if (args.filter.priority && args.filter.priority.length > 0) {
        query.priority = { $in: args.filter.priority };
      }
      if (args.filter.tags && args.filter.tags.length > 0) {
        query.tags = { $in: args.filter.tags };
      }
      if (args.filter.assignee) {
        query.assignee = args.filter.assignee;
      }
      if (args.filter.dueBefore || args.filter.dueAfter) {
        query.dueDate = {};
        if (args.filter.dueBefore) {
          query.dueDate.$lte = new Date(args.filter.dueBefore);
        }
        if (args.filter.dueAfter) {
          query.dueDate.$gte = new Date(args.filter.dueAfter);
        }
      }
    }

    const limit = args.limit || 50;
    const offset = args.offset || 0;

    const [todos, total] = await Promise.all([
      this.collection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
      this.collection.countDocuments(query),
    ]);

    return {
      success: true,
      operation: 'list',
      todos,
      total,
    };
  }

  private async deleteTodo(args: TodoArgs): Promise<TodoOutput> {
    if (!args.id) {
      throw Object.assign(new Error('Todo ID is required for deletion'), {
        name: 'ValidationError',
      });
    }

    const todo = await this.collection.findOneAndDelete({ id: args.id });

    if (!todo) {
      throw Object.assign(new Error(`Todo with ID ${args.id} not found`), {
        name: 'TodoNotFound',
      });
    }

    return {
      success: true,
      operation: 'delete',
      todo,
    };
  }

  private async getTodo(args: TodoArgs): Promise<TodoOutput> {
    if (!args.id) {
      throw Object.assign(new Error('Todo ID is required'), {
        name: 'ValidationError',
      });
    }

    const todo = await this.collection.findOne({ id: args.id });

    return {
      success: true,
      operation: 'get',
      todo: todo || undefined,
      found: !!todo,
    };
  }

  private generateId(): string {
    return `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
