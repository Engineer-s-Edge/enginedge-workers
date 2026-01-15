import { Test, TestingModule } from '@nestjs/testing';
import { GraphAgentController } from '../../infrastructure/controllers/graph-agent.controller';
import { AgentService } from '../../application/services/agent.service';
import { ExecuteAgentUseCase } from '../../application/use-cases/execute-agent.use-case';
import { CheckpointService } from '../../application/services/checkpoint.service';

describe('GraphAgentController', () => {
  let controller: GraphAgentController;
  let agentService: jest.Mocked<AgentService>;
  let executeAgentUseCase: jest.Mocked<ExecuteAgentUseCase>;
  let checkpointService: jest.Mocked<CheckpointService>;

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GraphAgentController],
      providers: [
        {
          provide: AgentService,
          useValue: {
            createAgent: jest.fn(),
            getGraphAgentExecutionState: jest.fn(),
            getAgentInstance: jest.fn(),
            resumeGraphAgent: jest.fn(),
            pauseGraphAgent: jest.fn(),
            provideGraphAgentUserInput: jest.fn(),
            provideGraphAgentUserApproval: jest.fn(),
          },
        },
        {
          provide: ExecuteAgentUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: CheckpointService,
          useValue: {
            createCheckpoint: jest.fn(),
          },
        },
        {
          provide: 'ILogger',
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<GraphAgentController>(GraphAgentController);
    agentService = module.get(AgentService);
    executeAgentUseCase = module.get(ExecuteAgentUseCase);
    checkpointService = module.get(CheckpointService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createGraphAgent', () => {
    it('should create a graph agent', async () => {
      const mockResult = {
        id: 'agent-123',
        state: {},
        config: {},
      };
      
      agentService.createAgent.mockResolvedValue(mockResult as any);

      const dto = {
        name: 'My Graph Agent',
        userId: 'user-1',
        workflow: {
          nodes: [{ id: 'start', type: 'start' }],
          edges: [],
        },
      };

      const result = await controller.createGraphAgent(dto);

      expect(agentService.createAgent).toHaveBeenCalledWith(
        {
          name: dto.name,
          agentType: 'graph',
          config: { workflow: dto.workflow },
        },
        dto.userId,
      );
      expect(result).toEqual({
        id: 'agent-123',
        name: dto.name,
        type: 'graph',
        workflow: dto.workflow,
        createdAt: expect.any(String),
      });
    });
  });

  describe('executeWorkflow', () => {
    it('should execute the workflow', async () => {
      executeAgentUseCase.execute.mockResolvedValue({
        executionId: 'exec-1',
        status: 'queued',
      } as any);

      const body = {
        input: 'start',
        userId: 'user-1',
        startNode: 'start',
      };

      const result = await controller.executeWorkflow('agent-123', body);

      expect(executeAgentUseCase.execute).toHaveBeenCalledWith({
        agentId: 'agent-123',
        userId: body.userId,
        input: body.input,
        context: { startNode: body.startNode },
      });
      expect(result).toEqual({
        executionId: 'exec-1',
        status: 'queued',
      });
    });
  });

  describe('getWorkflowState', () => {
    it('should return workflow state', async () => {
      const mockState = {
        isPaused: false,
        currentNodeIds: ['node-1'],
        executedNodes: [],
      };
      
      agentService.getGraphAgentExecutionState.mockResolvedValue(mockState as any);

      const result = await controller.getWorkflowState('agent-123', 'user-1');

      expect(agentService.getGraphAgentExecutionState).toHaveBeenCalledWith('agent-123', 'user-1');
      expect(result).toEqual({
        agentId: 'agent-123',
        ...mockState,
      });
    });
  });

  describe('pauseGraph', () => {
    it('should pause the graph', async () => {
      agentService.pauseGraphAgent.mockResolvedValue({ checkpointId: 'cp-1' });

      const result = await controller.pauseGraph('agent-123', {
        userId: 'user-1',
        reason: 'user request',
      });

      expect(agentService.pauseGraphAgent).toHaveBeenCalledWith('agent-123', 'user-1', {
        reason: 'user request',
      });
      expect(result).toEqual({ success: true, checkpointId: 'cp-1' });
    });
  });

  describe('resumeFromCheckpoint', () => {
    it('should resume the graph', async () => {
      agentService.resumeGraphAgent.mockResolvedValue({ ok: true, message: 'Resumed' });

      const result = await controller.resumeFromCheckpoint('agent-123', {
        userId: 'user-1',
        checkpointId: 'cp-1',
      });

      expect(agentService.resumeGraphAgent).toHaveBeenCalledWith('agent-123', 'user-1', 'cp-1');
      expect(result).toEqual({ success: true, message: 'Resumed' });
    });
  });

  describe('provideUserInput', () => {
    it('should provide user input', async () => {
      agentService.provideGraphAgentUserInput.mockResolvedValue(undefined);

      const result = await controller.provideUserInput('agent-123', {
        userId: 'user-1',
        nodeId: 'node-1',
        input: { decision: 'approve' },
      });

      expect(agentService.provideGraphAgentUserInput).toHaveBeenCalledWith(
        'agent-123',
        'user-1',
        'node-1',
        { decision: 'approve' },
      );
      expect(result).toMatchObject({ success: true });
    });
  });

  describe('createCheckpoint', () => {
    it('should create a checkpoint from current state', async () => {
      const mockInstance = {
        getGraphState: jest.fn().mockReturnValue({ some: 'state' }),
      };
      agentService.getAgentInstance.mockResolvedValue(mockInstance as any);
      
      checkpointService.createCheckpoint.mockResolvedValue({
        id: 'cp-123',
        name: 'My Checkpoint',
        createdAt: new Date(),
        // other props
      } as any);

      const result = await controller.createCheckpoint('agent-123', {
        userId: 'user-1',
        name: 'My Checkpoint',
      });

      expect(agentService.getAgentInstance).toHaveBeenCalledWith('agent-123', 'user-1');
      expect(mockInstance.getGraphState).toHaveBeenCalled();
      expect(checkpointService.createCheckpoint).toHaveBeenCalledWith(
        'agent-123',
        'user-1',
        { some: 'state' },
        'My Checkpoint',
      );
      expect(result).toMatchObject({
        checkpointId: 'cp-123',
        agentId: 'agent-123',
        name: 'My Checkpoint',
      });
    });
    
    it('should use empty state if instance does not have getGraphState', async () => {
      const mockInstance = {}; // No methods
      agentService.getAgentInstance.mockResolvedValue(mockInstance as any);
      
      checkpointService.createCheckpoint.mockResolvedValue({
        id: 'cp-123',
        createdAt: new Date(),
      } as any);

      await controller.createCheckpoint('agent-123', { userId: 'user-1' });

      expect(checkpointService.createCheckpoint).toHaveBeenCalledWith(
        'agent-123',
        'user-1',
        {}, // Empty state
        undefined,
      );
    });
  });
});
