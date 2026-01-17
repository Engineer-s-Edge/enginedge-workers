import { Test, TestingModule } from '@nestjs/testing';
import { GeniusAgentController } from '@infrastructure/controllers/genius-agent.controller';
import { AgentService } from '@application/services/agent.service';
import { ExecuteAgentUseCase } from '@application/use-cases/execute-agent.use-case';
import { ExpertPoolManager } from '@domain/services/expert-pool-manager.service';
import { GeniusExpertRuntimeService } from '@application/services/genius/genius-expert-runtime.service';
import { GeniusAgentOrchestrator } from '@application/services/genius-agent.orchestrator';
import { LearningModeAdapter } from '@infrastructure/adapters/implementations/learning-mode.adapter';
import { ValidationAdapter } from '@infrastructure/adapters/implementations/validation.adapter';
import { TopicCatalogAdapter } from '@infrastructure/adapters/implementations/topic-catalog.adapter';
import { ValidationWorkflowService } from '@application/services/validation-workflow.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GeniusAgent } from '@domain/agents/genius-agent/genius-agent';

describe('GeniusAgentController', () => {
  let controller: GeniusAgentController;
  let agentService: AgentService;
  let expertPoolManager: ExpertPoolManager;
  let expertRuntime: GeniusExpertRuntimeService;
  let topicCatalogAdapter: TopicCatalogAdapter;

  const mockAgentService = {
    getAgent: jest.fn(),
    getAgentInstance: jest.fn(),
  };

  const mockExecuteAgentUseCase = {
    execute: jest.fn(),
  };

  const mockExpertPoolManager = {
    getExpert: jest.fn(),
    markExpertBusy: jest.fn(),
    markExpertAvailable: jest.fn(),
    getExpertsForAgent: jest.fn(),
  };

  const mockExpertRuntime = {
    assignTopics: jest.fn(),
    pauseExpert: jest.fn(),
    resumeExpert: jest.fn(),
  };

  const mockGeniusOrchestrator = {
    getStatistics: jest.fn(),
  };

  const mockLearningModeAdapter = {
    setMode: jest.fn(),
    getMode: jest.fn(),
  };

  const mockValidationAdapter = {
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
  };

  const mockTopicCatalogAdapter = {
    addTopic: jest.fn(),
  };

  const mockValidationWorkflow = {
    processQueueItem: jest.fn(),
  };

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeniusAgentController],
      providers: [
        { provide: AgentService, useValue: mockAgentService },
        { provide: ExecuteAgentUseCase, useValue: mockExecuteAgentUseCase },
        { provide: ExpertPoolManager, useValue: mockExpertPoolManager },
        { provide: GeniusExpertRuntimeService, useValue: mockExpertRuntime },
        { provide: GeniusAgentOrchestrator, useValue: mockGeniusOrchestrator },
        { provide: LearningModeAdapter, useValue: mockLearningModeAdapter },
        { provide: ValidationAdapter, useValue: mockValidationAdapter },
        { provide: TopicCatalogAdapter, useValue: mockTopicCatalogAdapter },
        {
          provide: ValidationWorkflowService,
          useValue: mockValidationWorkflow,
        },
        { provide: 'ILogger', useValue: mockLogger },
      ],
    }).compile();

    controller = module.get<GeniusAgentController>(GeniusAgentController);
    agentService = module.get<AgentService>(AgentService);
    expertPoolManager = module.get<ExpertPoolManager>(ExpertPoolManager);
    expertRuntime = module.get<GeniusExpertRuntimeService>(
      GeniusExpertRuntimeService,
    );
    topicCatalogAdapter = module.get<TopicCatalogAdapter>(TopicCatalogAdapter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reassignExpertTopics', () => {
    const agentId = 'agent-123';
    const expertId = 'expert-456';
    const userId = 'user-789';
    const topics = [
      { title: 'Topic A', priority: 5, summary: 'Summary A' },
      { title: 'Topic B', priority: 3 },
    ];

    it('should reassign topics successfully', async () => {
      mockAgentService.getAgent.mockResolvedValue({});
      mockExpertPoolManager.getExpert.mockResolvedValue({ id: expertId });
      mockExpertRuntime.assignTopics.mockReturnValue({
        assignedTopics: [
          { topicId: 'topic-1', title: 'Topic A', lastUpdated: new Date() },
          { topicId: 'topic-2', title: 'Topic B', lastUpdated: new Date() },
        ],
      });
      mockTopicCatalogAdapter.addTopic.mockResolvedValue({ success: true });

      const result = await controller.reassignExpertTopics(agentId, expertId, {
        userId,
        topics,
      });

      expect(mockAgentService.getAgent).toHaveBeenCalledWith(agentId, userId);
      expect(mockExpertPoolManager.getExpert).toHaveBeenCalledWith(expertId);
      expect(mockExpertRuntime.assignTopics).toHaveBeenCalledWith(
        agentId,
        expertId,
        expect.arrayContaining([
          expect.objectContaining({ title: 'Topic A' }),
          expect.objectContaining({ title: 'Topic B' }),
        ]),
      );
      expect(mockExpertPoolManager.markExpertBusy).toHaveBeenCalledWith(
        expertId,
      );
      expect(mockTopicCatalogAdapter.addTopic).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('expertId', expertId);
      expect(result).toHaveProperty('assignments');
    });

    it('should throw BadRequestException if topics are empty', async () => {
      await expect(
        controller.reassignExpertTopics(agentId, expertId, {
          userId,
          topics: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if expert not found', async () => {
      mockAgentService.getAgent.mockResolvedValue({});
      mockExpertPoolManager.getExpert.mockResolvedValue(null);

      await expect(
        controller.reassignExpertTopics(agentId, expertId, { userId, topics }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('pauseExpert', () => {
    const agentId = 'agent-123';
    const expertId = 'expert-456';
    const userId = 'user-789';
    const reason = 'maintenance';

    it('should pause expert successfully', async () => {
      mockAgentService.getAgent.mockResolvedValue({});
      mockExpertPoolManager.getExpert.mockResolvedValue({ id: expertId });
      mockExpertRuntime.pauseExpert.mockReturnValue({
        assignedTopics: [],
      });

      const result = await controller.pauseExpert(agentId, expertId, {
        userId,
        reason,
      });

      expect(mockAgentService.getAgent).toHaveBeenCalledWith(agentId, userId);
      expect(mockExpertRuntime.pauseExpert).toHaveBeenCalledWith(
        agentId,
        expertId,
        reason,
      );
      expect(mockExpertPoolManager.markExpertBusy).toHaveBeenCalledWith(
        expertId,
      );
      expect(result).toHaveProperty('paused', true);
    });

    it('should throw NotFoundException if expert not found', async () => {
      mockAgentService.getAgent.mockResolvedValue({});
      mockExpertPoolManager.getExpert.mockResolvedValue(null);

      await expect(
        controller.pauseExpert(agentId, expertId, { userId, reason }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resumeExpert', () => {
    const agentId = 'agent-123';
    const expertId = 'expert-456';
    const userId = 'user-789';
    const note = 'back to work';

    it('should resume expert successfully', async () => {
      mockAgentService.getAgent.mockResolvedValue({});
      mockExpertPoolManager.getExpert.mockResolvedValue({ id: expertId });
      mockExpertRuntime.resumeExpert.mockReturnValue({
        assignedTopics: [],
      });

      const result = await controller.resumeExpert(agentId, expertId, {
        userId,
        note,
      });

      expect(mockAgentService.getAgent).toHaveBeenCalledWith(agentId, userId);
      expect(mockExpertRuntime.resumeExpert).toHaveBeenCalledWith(
        agentId,
        expertId,
        note,
      );
      expect(mockExpertPoolManager.markExpertAvailable).toHaveBeenCalledWith(
        expertId,
      );
      expect(result).toHaveProperty('paused', false);
    });
  });
});
