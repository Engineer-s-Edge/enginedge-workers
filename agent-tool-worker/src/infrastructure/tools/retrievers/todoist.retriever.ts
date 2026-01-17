/**
 * Todoist Retriever
 *
 * Retrieves tasks, projects, and sections from Todoist with comprehensive filtering,
 * sorting, and search capabilities. Supports Todoist REST API v2 integration with
 * token-based authentication.
 *
 * Features:
 * - Task search and filtering
 * - Project and section listing
 * - Task priority and status filtering
 * - Due date filtering and sorting
 * - Pagination support
 * - Comprehensive error handling
 * - Token-based authentication
 */

import { Injectable } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { BaseRetriever } from '../../../domain/tools/base/base-retriever';
import {
  RetrieverConfig,
  ErrorEvent,
} from '../../../domain/value-objects/tool-config.value-objects';
import {
  ToolOutput,
  RAGConfig,
  RetrievalType,
} from '../../../domain/entities/tool.entities';

export interface TodoistArgs extends Record<string, unknown> {
  query?: string;
  filter?: string;
  project_id?: string;
  section_id?: string;
  priority?: number[];
  priority_level?: 'urgent' | 'high' | 'medium' | 'low';
  status?: 'active' | 'completed';
  due_date?: string;
  due_before?: string;
  due_after?: string;
  sort_by?: 'due_date' | 'priority' | 'string' | 'created';
  sort_order?: 'asc' | 'desc';
  max_results?: number;
  offset?: number;
}

interface TodoistTask {
  id: string;
  project_id: string;
  section_id?: string;
  content: string;
  description?: string;
  is_completed: boolean;
  labels: string[];
  priority: number;
  due?: {
    date?: string;
    datetime?: string;
    string?: string;
    timezone?: string;
    is_recurring: boolean;
  };
  created_at: string;
  creator_id: string;
  assignee_id?: string;
  order: number;
  comment_count: number;
  url: string;
}

interface TodoistApiResponse {
  tasks?: TodoistTask[];
  projects?: Array<{
    id: string;
    name: string;
    is_favorite: boolean;
    is_inbox_project: boolean;
  }>;
  sections?: Array<{
    id: string;
    project_id: string;
    order: number;
    name: string;
  }>;
}

export interface TodoistOutput extends ToolOutput {
  success: boolean;
  query?: string;
  total_results: number;
  filter_applied?: string;
  tasks: Array<{
    task_id: string;
    content: string;
    description?: string;
    is_completed: boolean;
    priority: number;
    priority_label: string;
    labels: string[];
    project_id: string;
    section_id?: string;
    due_date?: string;
    due_datetime?: string;
    due_string?: string;
    is_recurring: boolean;
    created_at: string;
    comment_count: number;
    url: string;
  }>;
}

@Injectable()
export class TodoistRetriever extends BaseRetriever<
  TodoistArgs,
  TodoistOutput
> {
  readonly inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for task content',
      },
      filter: {
        type: 'string',
        description: 'Todoist filter expression for advanced filtering',
      },
      project_id: {
        type: 'string',
        description: 'Filter by project ID',
      },
      section_id: {
        type: 'string',
        description: 'Filter by section ID',
      },
      priority: {
        type: 'array',
        items: { type: 'number' },
        description: 'Filter by priority levels (1-4)',
      },
      priority_level: {
        type: 'string',
        enum: ['urgent', 'high', 'medium', 'low'],
        description: 'Filter by priority level',
      },
      status: {
        type: 'string',
        enum: ['active', 'completed'],
        description: 'Filter by task status',
        default: 'active',
      },
      due_date: {
        type: 'string',
        description: 'Filter by due date (YYYY-MM-DD format)',
        format: 'date',
      },
      due_before: {
        type: 'string',
        description: 'Filter for tasks due before date (YYYY-MM-DD)',
        format: 'date',
      },
      due_after: {
        type: 'string',
        description: 'Filter for tasks due after date (YYYY-MM-DD)',
        format: 'date',
      },
      sort_by: {
        type: 'string',
        enum: ['due_date', 'priority', 'string', 'created'],
        description: 'Sort field',
        default: 'due_date',
      },
      sort_order: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order',
        default: 'asc',
      },
      max_results: {
        type: 'number',
        description: 'Maximum tasks to return',
        minimum: 1,
        maximum: 200,
        default: 20,
      },
      offset: {
        type: 'number',
        description: 'Offset for pagination',
        minimum: 0,
        default: 0,
      },
    },
    required: [],
  };

  readonly outputSchema = {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      query: { type: 'string' },
      total_results: { type: 'number' },
      filter_applied: { type: 'string' },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            task_id: { type: 'string' },
            content: { type: 'string' },
            description: { type: 'string' },
            is_completed: { type: 'boolean' },
            priority: { type: 'number' },
            priority_label: { type: 'string' },
            labels: { type: 'array', items: { type: 'string' } },
            project_id: { type: 'string' },
            section_id: { type: 'string' },
            due_date: { type: 'string', format: 'date' },
            due_datetime: { type: 'string', format: 'date-time' },
            due_string: { type: 'string' },
            is_recurring: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            comment_count: { type: 'number' },
            url: { type: 'string' },
          },
        },
      },
    },
    required: ['success', 'total_results', 'tasks'],
  };

  readonly name = 'todoist-retriever';
  readonly description =
    'Search and retrieve tasks from Todoist with filtering, sorting, and status tracking';
  readonly retrievalType: RetrievalType = RetrievalType.API_DATA;

  readonly metadata = new RetrieverConfig(
    this.name,
    this.description,
    'Todoist task search and retrieval',
    this.inputSchema,
    this.outputSchema,
    [],
    this.retrievalType,
    this.caching,
    {},
  );

  readonly errorEvents: ErrorEvent[] = [
    new ErrorEvent(
      'todoist-auth-failed',
      'Todoist authentication failed',
      false,
    ),
    new ErrorEvent('todoist-api-error', 'Todoist API request failed', true),
    new ErrorEvent(
      'todoist-invalid-project',
      'Invalid project ID provided',
      false,
    ),
    new ErrorEvent(
      'todoist-network-error',
      'Network connectivity issue with Todoist API',
      true,
    ),
    new ErrorEvent(
      'todoist-rate-limit',
      'Todoist API rate limit exceeded',
      true,
    ),
  ];

  public get caching(): boolean {
    return false; // Tasks change frequently
  }

  protected async retrieve(
    args: TodoistArgs & { ragConfig: RAGConfig },
  ): Promise<TodoistOutput> {
    // Manual input validation
    if (
      args.max_results !== undefined &&
      (args.max_results < 1 || args.max_results > 200)
    ) {
      throw new Error('max_results must be between 1 and 200');
    }
    if (args.offset !== undefined && args.offset < 0) {
      throw new Error('offset must be non-negative');
    }
    if (args.priority && args.priority.some((p) => p < 1 || p > 4)) {
      throw new Error('Priority levels must be between 1 and 4');
    }

    try {
      const response = await this.sendTodoistRequest(args);

      return {
        success: true,
        query: args.query,
        total_results: response.data.tasks?.length || 0,
        filter_applied: this.buildFilterDescription(args),
        tasks: this.transformTasks(response.data.tasks || []),
      };
    } catch (error: unknown) {
      return this.handleTodoistError(error);
    }
  }

  private async sendTodoistRequest(
    args: TodoistArgs,
  ): Promise<AxiosResponse<TodoistApiResponse>> {
    const token = process.env.TODOIST_API_TOKEN;
    if (!token) {
      throw new Error('Todoist API token not configured');
    }

    const filters: string[] = [];

    // Build filter from arguments
    if (args.status) {
      filters.push(
        `(status = ${args.status === 'completed' ? 'done' : 'active'})`,
      );
    }

    if (args.project_id) {
      filters.push(`project = ${args.project_id}`);
    }

    if (args.section_id) {
      filters.push(`section = ${args.section_id}`);
    }

    if (args.priority_level) {
      const priorityMap = { urgent: 4, high: 3, medium: 2, low: 1 };
      filters.push(`priority = ${priorityMap[args.priority_level]}`);
    } else if (args.priority && args.priority.length > 0) {
      const priorityFilter = args.priority
        .map((p) => `priority = ${p}`)
        .join(' | ');
      filters.push(`(${priorityFilter})`);
    }

    if (args.due_date) {
      filters.push(`due = ${args.due_date}`);
    }

    if (args.due_before) {
      filters.push(`due before ${args.due_before}`);
    }

    if (args.due_after) {
      filters.push(`due after ${args.due_after}`);
    }

    let filterQuery = filters.join(' & ');

    if (args.filter) {
      filterQuery = filterQuery
        ? `${filterQuery} & ${args.filter}`
        : args.filter;
    }

    const params: Record<string, unknown> = {
      limit: Math.min(args.max_results || 20, 200),
      offset: args.offset || 0,
    };

    if (args.query) {
      params.text = args.query;
    }

    if (filterQuery) {
      params.filter = filterQuery;
    }

    if (args.sort_by) {
      const sortDirection = args.sort_order === 'desc' ? 'desc' : 'asc';
      params.sort_by = `${args.sort_by} ${sortDirection}`;
    }

    return axios.get<TodoistApiResponse>(
      'https://api.todoist.com/rest/v2/tasks',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        params,
        timeout: 30000,
      },
    );
  }

  private buildFilterDescription(args: TodoistArgs): string | undefined {
    const parts: string[] = [];

    if (args.status) {
      parts.push(`Status: ${args.status}`);
    }
    if (args.project_id) {
      parts.push(`Project: ${args.project_id}`);
    }
    if (args.priority_level) {
      parts.push(`Priority: ${args.priority_level}`);
    }
    if (args.due_date) {
      parts.push(`Due: ${args.due_date}`);
    }

    return parts.length > 0 ? parts.join(' | ') : undefined;
  }

  private transformTasks(tasks: TodoistTask[]): TodoistOutput['tasks'] {
    return tasks.map((task) => ({
      task_id: task.id,
      content: task.content,
      description: task.description,
      is_completed: task.is_completed,
      priority: task.priority,
      priority_label: this.getPriorityLabel(task.priority),
      labels: task.labels,
      project_id: task.project_id,
      section_id: task.section_id,
      due_date: task.due?.date,
      due_datetime: task.due?.datetime,
      due_string: task.due?.string,
      is_recurring: task.due?.is_recurring || false,
      created_at: task.created_at,
      comment_count: task.comment_count,
      url: task.url,
    }));
  }

  private getPriorityLabel(priority: number): string {
    const labels: Record<number, string> = {
      4: 'urgent',
      3: 'high',
      2: 'medium',
      1: 'low',
    };
    return labels[priority] || 'unknown';
  }

  private handleTodoistError(error: unknown): never {
    let errorMessage = 'Unknown error occurred while accessing Todoist API';

    // Check for axios-like error structure (works with mocks and real axios errors)
    const axiosLikeError = error as {
      isAxiosError?: boolean;
      response?: { status?: number; data?: { error?: { message?: string } } };
      message?: string;
    };

    if (axios.isAxiosError(error) || axiosLikeError.isAxiosError) {
      const status = axiosLikeError.response?.status;
      const message =
        axiosLikeError.response?.data?.error?.message || axiosLikeError.message;

      if (status === 401 || status === 403) {
        errorMessage = 'Todoist authentication failed - check API token';
      } else if (status === 404) {
        errorMessage = 'Todoist resource not found';
      } else if (status === 429) {
        errorMessage = 'Todoist API rate limit exceeded - retry later';
      } else if (status === 400) {
        errorMessage = `Todoist API error: ${message}`;
      } else {
        errorMessage = `Todoist API error: ${message}`;
      }
    } else if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'Todoist API request timeout';
      } else if (
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED')
      ) {
        errorMessage = 'Network connectivity issue with Todoist API';
      } else if (error.message.includes('token not configured')) {
        errorMessage = error.message;
      } else if (
        error.message.includes('max_results') ||
        error.message.includes('offset') ||
        error.message.includes('Priority')
      ) {
        errorMessage = error.message;
      }
    }

    throw new Error(errorMessage);
  }
}
