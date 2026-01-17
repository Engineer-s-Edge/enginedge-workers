import { Test, TestingModule } from '@nestjs/testing';
import { ReActAgentController } from '../../infrastructure/controllers/react-agent.controller';
import { AgentService } from '../../application/services/agent.service';
import { ExecuteAgentUseCase } from '../../application/use-cases/execute-agent.use-case';
import { StreamAgentExecutionUseCase } from '../../application/use-cases/stream-agent-execution.use-case';
import { ReActAgent } from '../../domain/agents/react-agent/react-agent';
import { Agent } from '../../domain/entities/agent.entity';
import { BadRequestException } from '@nestjs/common';

// Mock ReActAgent class
// We use Object.create to handle instanceof checks, similar to how we handled ExpertAgent
const mockReActAgentPrototype = Object.create(ReActAgent.prototype);

describe('ReActAgentController', () => {
  let controller: ReActAgentController;
  let agentService: jest.Mocked<AgentService>;
  let executeAgentUseCase: jest.Mocked<ExecuteAgentUseCase>;
  let streamAgentExecutionUseCase: jest.Mocked<StreamAgentExecutionUseCase>;

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockAgentInstance = Object.assign(
    Object.create(mockReActAgentPrototype),
    {
      getReasoningTrace: jest.fn(),
      getState: jest.fn(),
      registerTool: jest.fn(),
      getRegisteredTools: jest.fn(),
    },
  );

  const mockAgentEntity = Object.assign(Object.create(Agent.prototype), {
    id: 'agent-123',
    name: 'Test Agent',
    agentType: 'react',
    config: {
      toolNames: ['tool1'],
    },
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    mockAgentInstance.getReasoningTrace.mockReturnValue({
      thinkingSteps: [],
      toolExecutions: [],
      thoughts: [],
      actions: [],
      observations: [],
    });
    mockAgentInstance.getState.mockReturnValue({
      getCurrentState: () => 'idle',
      getMetadata: () => ({
        iterations: 0,
        lastUpdate: new Date().toISOString(),
      }),
    });
    mockAgentInstance.getRegisteredTools.mockReturnValue(['tool1']);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReActAgentController],
      providers: [
        {
          provide: AgentService,
          useValue: {
            createAgent: jest.fn(),
            getAgent: jest.fn(),
            getAgentInstance: jest.fn(),
            updateAgent: jest.fn(),
          },
        },
        {
          provide: ExecuteAgentUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: StreamAgentExecutionUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: 'ILogger',
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<ReActAgentController>(ReActAgentController);
    agentService = module.get(AgentService);
    executeAgentUseCase = module.get(ExecuteAgentUseCase);
    streamAgentExecutionUseCase = module.get(StreamAgentExecutionUseCase);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createReActAgent', () => {
    it('should create a react agent', async () => {
      const mockResult = {
        id: 'agent-123',
        ...mockAgentEntity,
      };

      agentService.createAgent.mockResolvedValue(mockResult as any);

      const dto = {
        name: 'My ReAct Agent',
        userId: 'user-1',
        tools: ['calculator'],
      };

      const result = await controller.createReActAgent(dto);

      expect(agentService.createAgent).toHaveBeenCalledWith(
        {
          name: dto.name,
          agentType: 'react',
          config: {
            maxIterations: 10,
            tools: ['calculator'],
            temperature: 0.7,
          },
        },
        dto.userId,
      );
      expect(result).toMatchObject({
        id: 'agent-123',
        type: 'react',
        config: { tools: ['calculator'] },
      });
    });
  });

  describe('executeWithReasoning', () => {
    it('should execute agent and return reasoning', async () => {
      executeAgentUseCase.execute.mockResolvedValue({
        executionId: 'exec-1',
        status: 'completed',
        metadata: {
          thoughts: [{ reasoning: 'thinking', timestamp: new Date() }],
        },
      } as any);

      const result = await controller.executeWithReasoning('agent-123', {
        input: 'solve this',
        userId: 'user-1',
        showReasoning: true,
      });

      expect(executeAgentUseCase.execute).toHaveBeenCalledWith({
        agentId: 'agent-123',
        userId: 'user-1',
        input: 'solve this',
      });
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning?.thoughts).toHaveLength(1);
    });
  });

  describe('getReasoningHistory', () => {
    it('should return reasoning history', async () => {
      agentService.getAgent.mockResolvedValue(mockAgentEntity);
      agentService.getAgentInstance.mockResolvedValue(mockAgentInstance);

      const result = await controller.getReasoningHistory(
        'agent-123',
        'user-1',
      );

      expect(agentService.getAgentInstance).toHaveBeenCalledWith(
        'agent-123',
        'user-1',
      );
      expect(mockAgentInstance.getReasoningTrace).toHaveBeenCalled();
      expect(result.agentId).toBe('agent-123');
      expect(result.status).toBe('idle');
    });

    it('should throw BadRequest if agent is not ReAct agent', async () => {
      const notReActAgent = { ...mockAgentEntity, agentType: 'genius' };
      agentService.getAgent.mockResolvedValue(notReActAgent as any);
      agentService.getAgentInstance.mockResolvedValue({} as any); // Not ReAct instance

      await expect(
        controller.getReasoningHistory('agent-123', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addTool', () => {
    it('should add a new tool to usage config', async () => {
      agentService.getAgent.mockResolvedValue(mockAgentEntity);
      agentService.getAgentInstance.mockResolvedValue(mockAgentInstance);
      agentService.updateAgent.mockResolvedValue(mockAgentEntity);

      const result = await controller.addTool('agent-123', {
        userId: 'user-1',
        toolName: 'new-tool',
      });

      expect(agentService.updateAgent).toHaveBeenCalledWith(
        'agent-123',
        expect.objectContaining({
          config: expect.objectContaining({
            toolNames: ['tool1', 'new-tool'],
          }),
        }),
        'user-1',
      );
      expect(mockAgentInstance.registerTool).toHaveBeenCalledWith('new-tool');
      expect(result.success).toBe(true);
    });

    it('should not update if tool already exists', async () => {
      agentService.getAgent.mockResolvedValue(mockAgentEntity);
      agentService.getAgentInstance.mockResolvedValue(mockAgentInstance);

      const result = await controller.addTool('agent-123', {
        userId: 'user-1',
        toolName: 'tool1', // Already exists
      });

      expect(agentService.updateAgent).not.toHaveBeenCalled();
      expect(mockAgentInstance.registerTool).toHaveBeenCalledWith('tool1'); // Should still register on instance
      expect(result.success).toBe(true);
      expect(result.message).toContain('already registered');
    });
  });
});
