import { Test, TestingModule } from '@nestjs/testing';
import { ExpertAgentController } from '../../infrastructure/controllers/expert-agent.controller';
import { AgentService } from '@application/services/agent.service';
import { ExecuteAgentUseCase } from '@application/use-cases/execute-agent.use-case';
import { StreamAgentExecutionUseCase } from '@application/use-cases/stream-agent-execution.use-case';
import { ExpertAgent, ResearchPhase } from '@domain/agents/expert-agent';
import { BadRequestException } from '@nestjs/common';


describe('ExpertAgentController', () => {
  let controller: ExpertAgentController;
  let agentService: jest.Mocked<AgentService>;
  let executeAgentUseCase: jest.Mocked<ExecuteAgentUseCase>;
  let streamAgentExecutionUseCase: jest.Mocked<StreamAgentExecutionUseCase>;

  const mockAgentId = 'test-agent-id';
  const mockUserId = 'test-user-id';

  const mockExpertAgentState = {
    researchPhase: ResearchPhase.ANALYSIS,
    topics: [],
    sources: [
      {
        id: 'source-1',
        url: 'http://example.com',
        title: 'Example Source',
        content: 'Content',
        extractedAt: new Date(),
        credibilityScore: 0.9,
        relevanceScore: 0.8,
        summary: 'Summary',
        author: 'Author',
        publishedDate: new Date(),
      },
    ],
    evidence: [
      {
        id: 'evidence-1',
        sourceId: 'source-1',
        content: 'Evidence content',
        confidence: 0.95,
        context: 'Context',
        keywords: ['key'],
        sourceUrl: 'http://example.com',
      }
    ],
    contradictions: [],
    phaseResults: [],
    currentTopicIndex: 0,
  };

  const mockExpertAgent = {
    getResearchState: jest.fn().mockReturnValue(mockExpertAgentState),
    getResearchReport: jest.fn().mockReturnValue(null),
    synthesizePhase: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const mockAgentService = {
      getAgentInstance: jest.fn(),
    };

    const mockExecuteUseCase = {
      execute: jest.fn(),
    };

    const mockStreamUseCase = {
      execute: jest.fn(),
    };

    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpertAgentController],
      providers: [
        {
          provide: AgentService,
          useValue: mockAgentService,
        },
        {
          provide: ExecuteAgentUseCase,
          useValue: mockExecuteUseCase,
        },
        {
          provide: StreamAgentExecutionUseCase,
          useValue: mockStreamUseCase,
        },
        {
          provide: 'ILogger',
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<ExpertAgentController>(ExpertAgentController);
    agentService = module.get(AgentService);
    executeAgentUseCase = module.get(ExecuteAgentUseCase);
    streamAgentExecutionUseCase = module.get(StreamAgentExecutionUseCase);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getResearchSources', () => {
    it('should return research sources correctly', async () => {
      const mockInstance = Object.create(ExpertAgent.prototype);
      Object.assign(mockInstance, {
        getResearchState: jest.fn().mockReturnValue(mockExpertAgentState),
        getResearchReport: jest.fn().mockReturnValue(null),
        synthesizePhase: jest.fn().mockResolvedValue({}),
      });

      agentService.getAgentInstance.mockResolvedValue(mockInstance);

      const result = await controller.getResearchSources(mockAgentId, mockUserId);

      expect(agentService.getAgentInstance).toHaveBeenCalledWith(mockAgentId, mockUserId);
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].id).toBe('source-1');
      expect(result.phase).toBe(ResearchPhase.ANALYSIS);
      expect(result.metrics).toBeDefined();
    });

    it('should throw BadRequestException if userId is missing', async () => {
      await expect(controller.getResearchSources(mockAgentId, '')).rejects.toThrow(BadRequestException);
    });

    it('should throw if agent is not an ExpertAgent', async () => {
      agentService.getAgentInstance.mockResolvedValue({} as any); // Not an ExpertAgent instance
      
      // Since instanceof check might fail if we don't return actual instance or mock prototype chain
      // But in the controller code: if (!(instance instanceof ExpertAgent))
      // So if verified by class, we need to handle that.
      // But for simple mock object, instanceof check usually fails.
      
      // To satisfy instanceof:
      Object.setPrototypeOf(mockExpertAgent, ExpertAgent.prototype);
      agentService.getAgentInstance.mockResolvedValue({} as any); // Plain object

      await expect(controller.getResearchSources(mockAgentId, mockUserId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getEvidence', () => {
    it('should return evidence correctly', async () => {
        const mockInstance = Object.create(ExpertAgent.prototype);
        Object.assign(mockInstance, {
            getResearchState: jest.fn().mockReturnValue(mockExpertAgentState),
        });
        
        agentService.getAgentInstance.mockResolvedValue(mockInstance);
  
        const result = await controller.getEvidence(mockAgentId, mockUserId);
  
        expect(result.evidence).toHaveLength(1);
        expect(result.evidence[0].id).toBe('evidence-1');
      });
  });
});
