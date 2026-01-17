/**
 * Todoist Retriever - Unit Tests
 *
 * Tests the Todoist retriever implementation for task search and filtering functionality.
 * Uses mocked axios for API interaction and comprehensive error scenario testing.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  TodoistRetriever,
  TodoistArgs,
} from '@infrastructure/tools/retrievers/todoist.retriever';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TodoistRetriever', () => {
  let retriever: TodoistRetriever;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TodoistRetriever],
    }).compile();

    retriever = module.get<TodoistRetriever>(TodoistRetriever);

    // Reset all mocks
    jest.clearAllMocks();

    // Set required environment variables
    process.env.TODOIST_API_TOKEN = 'test-todoist-token';
  });

  afterEach(() => {
    delete process.env.TODOIST_API_TOKEN;
  });

  describe('Basic Properties', () => {
    it('should have correct name and description', () => {
      expect(retriever.name).toBe('todoist-retriever');
      expect(retriever.description).toContain('Todoist');
    });

    it('should have metadata configured', () => {
      expect(retriever.metadata).toBeDefined();
      expect(retriever.metadata.name).toBe('todoist-retriever');
    });

    it('should have error events configured', () => {
      expect(retriever.errorEvents).toBeDefined();
      expect(retriever.errorEvents.length).toBeGreaterThan(0);
      expect(
        retriever.errorEvents.some((e) => e.name === 'todoist-auth-failed'),
      ).toBe(true);
      expect(
        retriever.errorEvents.some((e) => e.name === 'todoist-rate-limit'),
      ).toBe(true);
    });

    it('should have correct retrieval type and caching settings', () => {
      expect(retriever.retrievalType).toBe('API_DATA');
      expect(retriever.caching).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should reject max_results greater than 200', async () => {
      const args: TodoistArgs = {
        query: 'test',
        max_results: 201,
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain(
        'max_results must be between 1 and 200',
      );
    });

    it('should reject max_results less than 1', async () => {
      const args: TodoistArgs = {
        query: 'test',
        max_results: 0,
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain(
        'max_results must be between 1 and 200',
      );
    });

    it('should reject negative offset', async () => {
      const args: TodoistArgs = {
        query: 'test',
        offset: -1,
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('offset must be non-negative');
    });

    it('should reject invalid priority values', async () => {
      const args: TodoistArgs = {
        query: 'test',
        priority: [5],
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });
      expect(result.success).toBe(false);
      expect(result.error!.message).toContain(
        'Priority levels must be between 1 and 4',
      );
    });

    it('should accept valid max_results', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { tasks: [] },
      });

      const args: TodoistArgs = {
        query: 'test',
        max_results: 50,
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Task Queries', () => {
    it('should search for tasks by query', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          tasks: [
            {
              id: 'task-123',
              project_id: 'proj-1',
              content: 'Buy groceries',
              is_completed: false,
              labels: ['shopping'],
              priority: 2,
              created_at: '2023-12-01T10:00:00Z',
              creator_id: 'user-1',
              order: 1,
              comment_count: 0,
              url: 'https://todoist.com/app/task/task-123',
            },
          ],
        },
      });

      const args: TodoistArgs = {
        query: 'groceries',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.total_results).toBe(1);
      expect(result.output!.tasks[0].content).toBe('Buy groceries');
    });

    it('should filter tasks by project', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          tasks: [],
        },
      });

      const args: TodoistArgs = {
        project_id: 'proj-123',
      };

      await retriever.execute({ name: 'todoist-retriever', args });

      expect(mockedAxios.get).toHaveBeenCalled();
      const callParams = mockedAxios.get.mock.calls[0][1]?.params;
      expect(callParams?.filter).toContain('project = proj-123');
    });

    it('should filter tasks by priority level', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          tasks: [
            {
              id: 'urgent-task',
              project_id: 'proj-1',
              content: 'Urgent work',
              is_completed: false,
              labels: [],
              priority: 4,
              created_at: '2023-12-01T10:00:00Z',
              creator_id: 'user-1',
              order: 1,
              comment_count: 0,
              url: 'https://todoist.com/app/task/urgent-task',
            },
          ],
        },
      });

      const args: TodoistArgs = {
        priority_level: 'urgent',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.tasks[0].priority_label).toBe('urgent');
    });

    it('should filter tasks by specific priority values', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { tasks: [] },
      });

      const args: TodoistArgs = {
        priority: [1, 3],
      };

      await retriever.execute({ name: 'todoist-retriever', args });

      expect(mockedAxios.get).toHaveBeenCalled();
      const callParams = mockedAxios.get.mock.calls[0][1]?.params;
      expect(callParams?.filter).toContain('priority = 1');
      expect(callParams?.filter).toContain('priority = 3');
    });

    it('should filter by task completion status', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          tasks: [
            {
              id: 'task-comp',
              project_id: 'proj-1',
              content: 'Completed task',
              is_completed: true,
              labels: [],
              priority: 1,
              created_at: '2023-12-01T10:00:00Z',
              creator_id: 'user-1',
              order: 1,
              comment_count: 0,
              url: 'https://todoist.com/app/task/task-comp',
            },
          ],
        },
      });

      const args: TodoistArgs = {
        status: 'completed',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.tasks[0].is_completed).toBe(true);
    });

    it('should filter by due date', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          tasks: [
            {
              id: 'task-due',
              project_id: 'proj-1',
              content: 'Due today',
              is_completed: false,
              labels: [],
              priority: 2,
              due: { date: '2023-12-25' },
              created_at: '2023-12-01T10:00:00Z',
              creator_id: 'user-1',
              order: 1,
              comment_count: 0,
              url: 'https://todoist.com/app/task/task-due',
            },
          ],
        },
      });

      const args: TodoistArgs = {
        due_date: '2023-12-25',
      };

      await retriever.execute({ name: 'todoist-retriever', args });

      expect(mockedAxios.get).toHaveBeenCalled();
      const callParams = mockedAxios.get.mock.calls[0][1]?.params;
      expect(callParams?.filter).toContain('due = 2023-12-25');
    });

    it('should filter by due date range', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { tasks: [] },
      });

      const args: TodoistArgs = {
        due_after: '2023-12-01',
        due_before: '2023-12-31',
      };

      await retriever.execute({ name: 'todoist-retriever', args });

      expect(mockedAxios.get).toHaveBeenCalled();
      const callParams = mockedAxios.get.mock.calls[0][1]?.params;
      expect(callParams?.filter).toContain('due after 2023-12-01');
      expect(callParams?.filter).toContain('due before 2023-12-31');
    });
  });

  describe('Sorting', () => {
    it('should sort by due date ascending', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { tasks: [] },
      });

      const args: TodoistArgs = {
        sort_by: 'due_date',
        sort_order: 'asc',
      };

      await retriever.execute({ name: 'todoist-retriever', args });

      expect(mockedAxios.get).toHaveBeenCalled();
      const callParams = mockedAxios.get.mock.calls[0][1]?.params;
      expect(callParams?.sort_by).toContain('due_date');
      expect(callParams?.sort_by).toContain('asc');
    });

    it('should sort by priority descending', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { tasks: [] },
      });

      const args: TodoistArgs = {
        sort_by: 'priority',
        sort_order: 'desc',
      };

      await retriever.execute({ name: 'todoist-retriever', args });

      expect(mockedAxios.get).toHaveBeenCalled();
      const callParams = mockedAxios.get.mock.calls[0][1]?.params;
      expect(callParams?.sort_by).toContain('priority');
      expect(callParams?.sort_by).toContain('desc');
    });
  });

  describe('Pagination', () => {
    it('should support max_results limit', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { tasks: [] },
      });

      const args: TodoistArgs = {
        max_results: 50,
      };

      await retriever.execute({ name: 'todoist-retriever', args });

      expect(mockedAxios.get).toHaveBeenCalled();
      const callParams = mockedAxios.get.mock.calls[0][1]?.params;
      expect(callParams?.limit).toBe(50);
    });

    it('should support offset pagination', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { tasks: [] },
      });

      const args: TodoistArgs = {
        offset: 20,
      };

      await retriever.execute({ name: 'todoist-retriever', args });

      expect(mockedAxios.get).toHaveBeenCalled();
      const callParams = mockedAxios.get.mock.calls[0][1]?.params;
      expect(callParams?.offset).toBe(20);
    });
  });

  describe('Error Handling - Authentication', () => {
    it('should handle missing API token', async () => {
      delete process.env.TODOIST_API_TOKEN;

      const args: TodoistArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('token');
    });

    it('should handle 401 unauthorized error', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 401,
          data: { error: { message: 'Invalid token' } },
        },
      });

      const args: TodoistArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('authentication failed');
    });

    it('should handle 403 forbidden error', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 403,
          data: { error: { message: 'Permission denied' } },
        },
      });

      const args: TodoistArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('authentication failed');
    });
  });

  describe('Error Handling - Invalid Resource', () => {
    it('should handle 404 resource not found error', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 404,
          data: { error: { message: 'Task not found' } },
        },
      });

      const args: TodoistArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('not found');
    });
  });

  describe('Error Handling - Rate Limiting', () => {
    it('should handle 429 rate limit error', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 429,
          data: { error: { message: 'Rate limit exceeded' } },
        },
      });

      const args: TodoistArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('rate limit exceeded');
    });
  });

  describe('Error Handling - Bad Request', () => {
    it('should handle 400 bad request error', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 400,
          data: { error: { message: 'Invalid filter format' } },
        },
      });

      const args: TodoistArgs = {
        filter: 'invalid_filter',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('API error');
    });
  });

  describe('Error Handling - Network', () => {
    it('should handle network timeout', async () => {
      mockedAxios.get.mockRejectedValueOnce(
        new Error('timeout of 30000ms exceeded'),
      );

      const args: TodoistArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('timeout');
    });

    it('should handle ECONNREFUSED network error', async () => {
      mockedAxios.get.mockRejectedValueOnce(
        new Error('ECONNREFUSED: Connection refused'),
      );

      const args: TodoistArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('Network connectivity');
    });
  });

  describe('Response Transformation', () => {
    it('should correctly transform task data', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          tasks: [
            {
              id: 'task-trans',
              project_id: 'proj-123',
              section_id: 'sec-456',
              content: 'Complete project',
              description: 'Finish the migration work',
              is_completed: false,
              labels: ['work', 'urgent'],
              priority: 3,
              due: {
                date: '2023-12-25',
                datetime: '2023-12-25T10:00:00Z',
                string: 'Monday Dec 25',
                is_recurring: false,
              },
              created_at: '2023-12-01T10:00:00Z',
              creator_id: 'user-1',
              comment_count: 3,
              url: 'https://todoist.com/app/task/task-trans',
            },
          ],
        },
      });

      const args: TodoistArgs = {
        query: 'Complete',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(true);
      const task = result.output!.tasks[0];
      expect(task.task_id).toBe('task-trans');
      expect(task.content).toBe('Complete project');
      expect(task.description).toBe('Finish the migration work');
      expect(task.priority_label).toBe('high');
      expect(task.labels).toContain('work');
      expect(task.due_date).toBe('2023-12-25');
      expect(task.comment_count).toBe(3);
    });

    it('should convert priority to labels', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          tasks: [
            {
              id: 'p1',
              project_id: 'p',
              content: 'P1',
              is_completed: false,
              labels: [],
              priority: 1,
              created_at: '2023-12-01T10:00:00Z',
              creator_id: 'u1',
              order: 1,
              comment_count: 0,
              url: 'https://todoist.com',
            },
            {
              id: 'p2',
              project_id: 'p',
              content: 'P2',
              is_completed: false,
              labels: [],
              priority: 2,
              created_at: '2023-12-01T10:00:00Z',
              creator_id: 'u1',
              order: 2,
              comment_count: 0,
              url: 'https://todoist.com',
            },
            {
              id: 'p3',
              project_id: 'p',
              content: 'P3',
              is_completed: false,
              labels: [],
              priority: 3,
              created_at: '2023-12-01T10:00:00Z',
              creator_id: 'u1',
              order: 3,
              comment_count: 0,
              url: 'https://todoist.com',
            },
            {
              id: 'p4',
              project_id: 'p',
              content: 'P4',
              is_completed: false,
              labels: [],
              priority: 4,
              created_at: '2023-12-01T10:00:00Z',
              creator_id: 'u1',
              order: 4,
              comment_count: 0,
              url: 'https://todoist.com',
            },
          ],
        },
      });

      const args: TodoistArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.tasks[0].priority_label).toBe('low');
      expect(result.output!.tasks[1].priority_label).toBe('medium');
      expect(result.output!.tasks[2].priority_label).toBe('high');
      expect(result.output!.tasks[3].priority_label).toBe('urgent');
    });

    it('should handle tasks with section_id', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          tasks: [
            {
              id: 'task-sec',
              project_id: 'proj-1',
              section_id: 'sec-123',
              content: 'Sectioned task',
              is_completed: false,
              labels: [],
              priority: 1,
              created_at: '2023-12-01T10:00:00Z',
              creator_id: 'user-1',
              order: 1,
              comment_count: 0,
              url: 'https://todoist.com/app/task/task-sec',
            },
          ],
        },
      });

      const args: TodoistArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.tasks[0].section_id).toBe('sec-123');
    });

    it('should handle empty results', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { tasks: [] },
      });

      const args: TodoistArgs = {
        query: 'nonexistent',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.total_results).toBe(0);
      expect(result.output!.tasks.length).toBe(0);
    });
  });

  describe('Special Cases', () => {
    it('should handle recurring task indication', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          tasks: [
            {
              id: 'recurring',
              project_id: 'proj-1',
              content: 'Weekly review',
              is_completed: false,
              labels: [],
              priority: 2,
              due: {
                date: '2023-12-25',
                is_recurring: true,
              },
              created_at: '2023-12-01T10:00:00Z',
              creator_id: 'user-1',
              order: 1,
              comment_count: 0,
              url: 'https://todoist.com/app/task/recurring',
            },
          ],
        },
      });

      const args: TodoistArgs = {
        query: 'weekly',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(true);
      expect(result.output!.tasks[0].is_recurring).toBe(true);
    });

    it('should apply custom Todoist filter', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { tasks: [] },
      });

      const args: TodoistArgs = {
        filter: '@work & !assigned',
      };

      await retriever.execute({ name: 'todoist-retriever', args });

      expect(mockedAxios.get).toHaveBeenCalled();
      const callParams = mockedAxios.get.mock.calls[0][1]?.params;
      expect(callParams?.filter).toContain('@work & !assigned');
    });

    it('should combine multiple filters', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { tasks: [] },
      });

      const args: TodoistArgs = {
        project_id: 'proj-1',
        priority_level: 'high',
        status: 'active',
      };

      await retriever.execute({ name: 'todoist-retriever', args });

      expect(mockedAxios.get).toHaveBeenCalled();
      const callParams = mockedAxios.get.mock.calls[0][1]?.params;
      expect(callParams?.filter).toContain('project = proj-1');
      expect(callParams?.filter).toContain('priority = 3');
      expect(callParams?.filter).toContain('active');
    });

    it('should handle default pagination limits', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { tasks: [] },
      });

      const args: TodoistArgs = {
        query: 'test',
      };

      await retriever.execute({ name: 'todoist-retriever', args });

      expect(mockedAxios.get).toHaveBeenCalled();
      const callParams = mockedAxios.get.mock.calls[0][1]?.params;
      expect(callParams?.limit).toBe(20);
      expect(callParams?.offset).toBe(0);
    });

    it('should handle task labels correctly', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          tasks: [
            {
              id: 'task-labels',
              project_id: 'proj-1',
              content: 'Task with many labels',
              is_completed: false,
              labels: ['important', 'review', 'deadline'],
              priority: 3,
              created_at: '2023-12-01T10:00:00Z',
              creator_id: 'user-1',
              order: 1,
              comment_count: 2,
              url: 'https://todoist.com/app/task/task-labels',
            },
          ],
        },
      });

      const args: TodoistArgs = {
        query: 'test',
      };

      const result = await retriever.execute({
        name: 'todoist-retriever',
        args,
      });

      expect(result.success).toBe(true);
      const labels = result.output!.tasks[0].labels;
      expect(labels).toHaveLength(3);
      expect(labels).toContain('important');
      expect(labels).toContain('review');
      expect(labels).toContain('deadline');
    });
  });
});
