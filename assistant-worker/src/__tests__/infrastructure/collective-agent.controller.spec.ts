import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CollectiveAgentController } from '../../infrastructure/controllers/collective-agent.controller';
import { AgentService } from '../../application/services/agent.service';
import { ExecuteAgentUseCase } from '../../application/use-cases/execute-agent.use-case';
import { MessageQueueService } from '../../application/services/collective/message-queue.service';
import { TaskAssignmentService } from '../../application/services/collective/task-assignment.service';
import { SharedMemoryService } from '../../application/services/collective/shared-memory.service';
import { CollectiveAgent } from '../../domain/agents/collective-agent/collective-agent';
import { Agent } from '../../domain/entities/agent.entity';
import { TaskLevel, TaskState } from '../../domain/entities/collective-task.entity';

// Mock CollectiveAgent prototype to satisfy instanceof checks
// We need to access the prototype from the actual class
const mockCollectiveAgentPrototype = Object.create(CollectiveAgent.prototype);

describe('CollectiveAgentController', () => {
  let controller: CollectiveAgentController;
  let agentService: jest.Mocked<AgentService>;
  let executeAgentUseCase: jest.Mocked<ExecuteAgentUseCase>;
  let messageQueue: jest.Mocked<MessageQueueService>;
  let taskAssignment: jest.Mocked<TaskAssignmentService>;
  let sharedMemory: jest.Mocked<SharedMemoryService>;

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  // Mock Agent Instance with prototype chain for instanceof checks
  // We use Object.create(mockCollectiveAgentPrototype) so (instance instanceof CollectiveAgent) is true
  const mockInstance = Object.assign(Object.create(mockCollectiveAgentPrototype), {
      getCollectiveState: jest.fn(),
      getChildTasks: jest.fn(),
      getParentTask: jest.fn(),
  });

  const mockAgentEntity = Object.assign(Object.create(Agent.prototype), {
      id: 'agent-123',
      name: 'My Collective',
      agentType: 'collective',
      config: {},
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date()
  });

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Default mock implementation
    mockInstance.getCollectiveState.mockReturnValue({
        subAgents: [],
        subAgentStats: [],
        activeTasks: 0,
        pendingAssignments: 0,
        completedAssignments: 0,
        conflicts: 0
    });
    mockInstance.getChildTasks.mockReturnValue([]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectiveAgentController],
      providers: [
        {
          provide: AgentService,
          useValue: {
            createAgent: jest.fn(),
            getAgentInstance: jest.fn(),
          },
        },
        {
          provide: ExecuteAgentUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: MessageQueueService,
          useValue: {
             getAgentQueueMetrics: jest.fn().mockReturnValue({ depth: 0 }),
          },
        },
        {
          provide: TaskAssignmentService,
          useValue: {
              getAgentLoad: jest.fn().mockReturnValue(0),
          },
        },
        {
          provide: SharedMemoryService,
          useValue: {},
        },
        {
          provide: 'ILogger',
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<CollectiveAgentController>(CollectiveAgentController);
    agentService = module.get(AgentService);
    executeAgentUseCase = module.get(ExecuteAgentUseCase);
    messageQueue = module.get(MessageQueueService);
    taskAssignment = module.get(TaskAssignmentService);
    sharedMemory = module.get(SharedMemoryService);
  });

  describe('createCollectiveAgent', () => {
    it('should create a collective agent', async () => {
       (agentService.createAgent as jest.Mock).mockResolvedValue(mockAgentEntity);

       const result = await controller.createCollectiveAgent({
           name: 'My Collective',
           userId: 'user-1',
       });

       expect(agentService.createAgent).toHaveBeenCalledWith(
           expect.objectContaining({ name: 'My Collective', agentType: 'collective' }),
           'user-1'
       );
       expect(result).toMatchObject({
           id: 'agent-123',
           type: 'collective'
       });
    });
  });

  describe('orchestrateTask', () => {
      it('should execute orchestrateTask', async () => {
          (executeAgentUseCase.execute as jest.Mock).mockResolvedValue({ status: 'queued' } as any);
          
          const result = await controller.orchestrateTask('agent-123', {
              userId: 'user-1',
              task: 'Do something',
          });

          expect(executeAgentUseCase.execute).toHaveBeenCalledWith(
              expect.objectContaining({ agentId: 'agent-123', input: 'Do something' })
          );
          expect(result.status).toBe('queued');
      });
  });

  describe('getSubAgents', () => {
      it('should return sub-agents list with metrics', async () => {
          (agentService.getAgentInstance as jest.Mock).mockResolvedValue(mockInstance);
          mockInstance.getCollectiveState.mockReturnValue({
              subAgents: [
                  { 
                      agentId: 'sub-1', 
                      name: 'Sub 1', 
                      type: 'researcher', 
                      isActive: true, 
                      createdAt: new Date(), 
                      specialties: [], 
                      loadFactor: 0.5, 
                      successRate: 0.9 
                  }
              ],
              subAgentStats: [
                  { agentId: 'sub-1', tasksCompleted: 10, tasksFailed: 0, averageExecutionTime: 100 }
              ]
          });

          const result = await controller.getSubAgents('agent-123', 'user-1');

          expect(agentService.getAgentInstance).toHaveBeenCalledWith('agent-123', 'user-1');
          expect(messageQueue.getAgentQueueMetrics).toHaveBeenCalledWith('sub-1');
          expect(taskAssignment.getAgentLoad).toHaveBeenCalledWith('sub-1');
          expect(result.subAgents).toHaveLength(1);
          expect(result.subAgents[0].agentId).toBe('sub-1');
          expect(result.subAgents[0].stats).toMatchObject({ tasksCompleted: 10 });
      });

      it('should throw BadRequest if agent is not collective', async () => {
          (agentService.getAgentInstance as jest.Mock).mockResolvedValue({}); // Not collective
          
          await expect(controller.getSubAgents('agent-123', 'user-1'))
            .rejects.toThrow(BadRequestException);
      });
  });

  describe('getTaskChildren', () => {
    it('returns formatted child tasks', async () => {
        (agentService.getAgentInstance as jest.Mock).mockResolvedValue(mockInstance);
        const childTask = {
            id: 'child-1',
            collectiveId: 'c1',
            title: 'Child Task',
            level: TaskLevel.TASK,
            state: TaskState.UNASSIGNED,
            childTaskIds: [],
            dependencies: [],
            blockedBy: [],
            priority: 50,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date()
        };
        mockInstance.getChildTasks.mockReturnValue([childTask]);

        const result = await controller.getTaskChildren('agent-123', 'parent-1', 'user-1');
        
        expect(mockInstance.getChildTasks).toHaveBeenCalledWith('parent-1');
        expect(result.children).toHaveLength(1);
        expect(result.children[0].id).toBe('child-1');
    });
  });

});
