import { BadRequestException } from '@nestjs/common';
import { CollectiveAgentController } from '@infrastructure/controllers/collective-agent.controller';
import { AgentService } from '@application/services/agent.service';
import { ExecuteAgentUseCase } from '@application/use-cases/execute-agent.use-case';
import { MessageQueueService } from '@application/services/collective/message-queue.service';
import { TaskAssignmentService } from '@application/services/collective/task-assignment.service';
import { SharedMemoryService } from '@application/services/collective/shared-memory.service';
import { CollectiveAgent } from '@domain/agents/collective-agent/collective-agent';
import {
  CollectiveTask,
  TaskLevel,
  TaskState,
} from '@domain/entities/collective-task.entity';

interface TestLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

describe('CollectiveAgentController task hierarchy helpers', () => {
  const mockAgentService = {
    getAgentInstance: jest.fn(),
  };
  const mockExecuteAgentUseCase: Partial<ExecuteAgentUseCase> = {};
  const mockMessageQueue: Partial<MessageQueueService> = {};
  const mockTaskAssignment: Partial<TaskAssignmentService> = {};
  const mockSharedMemory: Partial<SharedMemoryService> = {};
  const mockLogger: TestLogger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  let controller: CollectiveAgentController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CollectiveAgentController(
      mockAgentService as unknown as AgentService,
      mockExecuteAgentUseCase as unknown as ExecuteAgentUseCase,
      mockMessageQueue as unknown as MessageQueueService,
      mockTaskAssignment as unknown as TaskAssignmentService,
      mockSharedMemory as unknown as SharedMemoryService,
      mockLogger,
    );
  });

  const sampleTimestamp = new Date('2025-01-01T00:00:00.000Z');

  const makeTask = (
    id: string,
    overrides: Partial<CollectiveTask> = {},
  ): CollectiveTask => ({
    id,
    collectiveId: 'collective-1',
    title: `Task ${id}`,
    description: `Description for ${id}`,
    level: TaskLevel.TASK,
    state: TaskState.UNASSIGNED,
    parentTaskId: overrides.parentTaskId,
    childTaskIds: overrides.childTaskIds ?? [],
    assignedAgentId: overrides.assignedAgentId,
    allowedAgentIds: overrides.allowedAgentIds ?? [],
    dependencies: overrides.dependencies ?? [],
    blockedBy: overrides.blockedBy ?? [],
    priority: overrides.priority ?? 50,
    metadata: overrides.metadata ?? { createdBy: 'tests' },
    createdAt: sampleTimestamp,
    updatedAt: sampleTimestamp,
  });

  const createStubAgent = (
    children: CollectiveTask[],
    parent?: CollectiveTask | null,
  ): CollectiveAgent => {
    const stub = {
      getChildTasks: jest.fn().mockReturnValue(children),
      getParentTask: jest.fn().mockReturnValue(parent ?? undefined),
    } as Partial<CollectiveAgent>;

    Object.setPrototypeOf(stub, CollectiveAgent.prototype);

    return stub as CollectiveAgent;
  };

  describe('getTaskChildren', () => {
    it('formats and returns child tasks for the given parent', async () => {
      const childTask = makeTask('child-1', {
        dependencies: ['dep-1'],
        blockedBy: ['dep-1'],
        childTaskIds: [],
      });
      const collectiveAgent = createStubAgent([childTask], undefined);
      mockAgentService.getAgentInstance.mockResolvedValue(collectiveAgent);

      const result = await controller.getTaskChildren(
        'agent-123',
        'parent-1',
        'user-1',
      );

      expect(collectiveAgent.getChildTasks).toHaveBeenCalledWith('parent-1');
      expect(result).toMatchObject({
        agentId: 'agent-123',
        taskId: 'parent-1',
        total: 1,
      });
      expect(result.children).toHaveLength(1);
      expect(result.children[0]).toMatchObject({
        id: childTask.id,
        title: childTask.title,
        dependencies: childTask.dependencies,
        blockedBy: childTask.blockedBy,
        childTaskIds: childTask.childTaskIds,
      });
      expect(typeof result.generatedAt).toBe('string');
    });

    it('throws when userId is missing', async () => {
      await expect(
        controller.getTaskChildren('agent-123', 'parent-1', ''),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getTaskParent', () => {
    it('returns formatted parent metadata when available', async () => {
      const parentTask = makeTask('parent-1', {
        childTaskIds: ['child-1'],
      });
      const collectiveAgent = createStubAgent([], parentTask);
      mockAgentService.getAgentInstance.mockResolvedValue(collectiveAgent);

      const result = await controller.getTaskParent(
        'agent-123',
        'child-1',
        'user-1',
      );

      expect(collectiveAgent.getParentTask).toHaveBeenCalledWith('child-1');
      expect(result.parent).toMatchObject({
        id: parentTask.id,
        childTaskIds: parentTask.childTaskIds,
      });
      expect(result.parent?.title).toBe(parentTask.title);
      expect(typeof result.generatedAt).toBe('string');
    });

    it('returns null when the task has no parent', async () => {
      const collectiveAgent = createStubAgent([], undefined);
      mockAgentService.getAgentInstance.mockResolvedValue(collectiveAgent);

      const result = await controller.getTaskParent(
        'agent-123',
        'child-1',
        'user-1',
      );

      expect(collectiveAgent.getParentTask).toHaveBeenCalledWith('child-1');
      expect(result.parent).toBeNull();
    });
  });
});
