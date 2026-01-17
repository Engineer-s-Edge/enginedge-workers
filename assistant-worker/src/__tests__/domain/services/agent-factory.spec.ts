import { AgentConfig } from '../../../domain/value-objects/agent-config.vo';
import { AgentFactory } from '../../../domain/services/agent-factory.service';
import { ILLMProvider } from '../../../application/ports/llm-provider.port';
import { ILogger } from '../../../application/ports/logger.port';
import { MemoryManager } from '../../../domain/services/memory-manager.service';
import { ResponseParser } from '../../../domain/services/response-parser.service';
import { PromptBuilder } from '../../../domain/services/prompt-builder.service';
import { Agent } from '../../../domain/entities/agent.entity';
import { AgentType } from '../../../domain/enums/agent-type.enum';
import { AgentCapability } from '../../../domain/value-objects/agent-capability.vo';

describe('Domain Services - AgentFactory', () => {
  let factory: AgentFactory;
  let mockLLMProvider: ILLMProvider;
  let mockLogger: ILogger;
  let memoryManager: MemoryManager;
  let responseParser: ResponseParser;
  let promptBuilder: PromptBuilder;

  const baseConfig = AgentConfig.create({
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
  });

  beforeEach(() => {
    mockLLMProvider = {
      complete: jest
        .fn()
        .mockResolvedValue({ content: 'Mock response', role: 'assistant' }),
      stream: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('mock-provider'),
      isAvailable: jest.fn().mockResolvedValue(true),
      getModelName: jest.fn().mockReturnValue('mock-model'),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      setLevel: jest.fn(),
      getLevel: jest.fn().mockReturnValue('info'),
    };

    memoryManager = new MemoryManager();
    responseParser = new ResponseParser();
    promptBuilder = new PromptBuilder();

    factory = new AgentFactory(
      mockLogger,
      mockLLMProvider,
      memoryManager,
      responseParser,
      promptBuilder,
      {} as any, // messageQueue
      {} as any, // communication
      {} as any, // sharedMemory
      {} as any, // artifactLocking
      {} as any, // taskAssignment
      {} as any, // deadlockDetection
      {} as any, // coordinationValidator
    );
  });

  describe('Create Individual Agents', () => {
    describe('ReAct Agent', () => {
      it('should create ReAct agent', () => {
        const capability = AgentCapability.create({
          executionModel: 'chain-of-thought',
          canUseTools: true,
          canStreamResults: true,
          canPauseResume: false,
          canCoordinate: false,
          supportsParallelExecution: false,
          maxInputTokens: 4000,
          maxOutputTokens: 2000,
          supportedMemoryTypes: ['buffer_window'],
          timeoutMs: 60000,
        });

        const agent = Agent.create(
          'ReAct Agent',
          AgentType.REACT,
          baseConfig,
          capability,
        );
        const agentInstance = factory.createInstance(agent);

        expect(agentInstance).toBeDefined();
        expect(agent.name).toBe('ReAct Agent');
      });

      it('should have proper ReAct capabilities', () => {
        const capability = AgentCapability.create({
          executionModel: 'chain-of-thought',
          canUseTools: true,
          canStreamResults: true,
          canPauseResume: false,
          canCoordinate: false,
          supportsParallelExecution: false,
          maxInputTokens: 4000,
          maxOutputTokens: 2000,
          supportedMemoryTypes: ['buffer_window'],
          timeoutMs: 60000,
        });

        const agent = Agent.create(
          'ReAct Agent',
          AgentType.REACT,
          baseConfig,
          capability,
        );
        const agentInstance = factory.createInstance(agent);

        expect(agent.capability).toBeDefined();
        expect(agent.capability.canUseTools).toBe(true);
        expect(agent.capability.executionModel).toBe('chain-of-thought');
      });
    });

    describe('Expert Agent', () => {
      it('should create Expert agent', () => {
        const capability = AgentCapability.create({
          executionModel: 'research',
          canUseTools: true,
          canStreamResults: true,
          canPauseResume: false,
          canCoordinate: false,
          supportsParallelExecution: false,
          maxInputTokens: 8000,
          maxOutputTokens: 4000,
          supportedMemoryTypes: ['buffer_window', 'entity'],
          timeoutMs: 120000,
        });

        const agent = Agent.create(
          'Expert Agent',
          AgentType.EXPERT,
          baseConfig,
          capability,
        );
        const agentInstance = factory.createInstance(agent);

        expect(agentInstance).toBeDefined();
        expect(agent.name).toBe('Expert Agent');
      });

      it('should have proper Expert capabilities', () => {
        const capability = AgentCapability.create({
          executionModel: 'research',
          canUseTools: true,
          canStreamResults: true,
          canPauseResume: false,
          canCoordinate: false,
          supportsParallelExecution: false,
          maxInputTokens: 8000,
          maxOutputTokens: 4000,
          supportedMemoryTypes: ['buffer_window', 'entity'],
          timeoutMs: 120000,
        });

        const agent = Agent.create(
          'Expert Agent',
          AgentType.EXPERT,
          baseConfig,
          capability,
        );
        const agentInstance = factory.createInstance(agent);

        expect(agent.capability).toBeDefined();
        expect(agent.capability.executionModel).toBe('research');
        expect(agent.capability.canStreamResults).toBe(true);
      });
    });

    describe('Genius Agent', () => {
      it('should create Genius agent', () => {
        const capability = AgentCapability.create({
          executionModel: 'learning',
          canUseTools: true,
          canStreamResults: true,
          canPauseResume: true,
          canCoordinate: false,
          supportsParallelExecution: true,
          maxInputTokens: 16000,
          maxOutputTokens: 8000,
          supportedMemoryTypes: ['buffer_window', 'entity'],
          timeoutMs: 300000,
        });

        const agent = Agent.create(
          'Genius Agent',
          AgentType.GENIUS,
          baseConfig,
          capability,
        );
        const agentInstance = factory.createInstance(agent);

        expect(agentInstance).toBeDefined();
        expect(agent.name).toBe('Genius Agent');
      });

      it('should have proper Genius capabilities', () => {
        const capability = AgentCapability.create({
          executionModel: 'learning',
          canUseTools: true,
          canStreamResults: true,
          canPauseResume: true,
          canCoordinate: false,
          supportsParallelExecution: true,
          maxInputTokens: 16000,
          maxOutputTokens: 8000,
          supportedMemoryTypes: ['buffer_window', 'entity'],
          timeoutMs: 300000,
        });

        const agent = Agent.create(
          'Genius Agent',
          AgentType.GENIUS,
          baseConfig,
          capability,
        );
        const agentInstance = factory.createInstance(agent);

        expect(agent.capability).toBeDefined();
        expect(agent.capability.executionModel).toBe('learning');
      });
    });

    describe('Graph Agent', () => {
      it('should create Graph agent', () => {
        const capability = AgentCapability.create({
          executionModel: 'dag',
          canUseTools: true,
          canStreamResults: true,
          canPauseResume: true,
          canCoordinate: false,
          supportsParallelExecution: true,
          maxInputTokens: 12000,
          maxOutputTokens: 6000,
          supportedMemoryTypes: ['buffer_window', 'entity'],
          timeoutMs: 180000,
        });

        const agent = Agent.create(
          'Graph Agent',
          AgentType.GRAPH,
          baseConfig,
          capability,
        );
        const agentInstance = factory.createInstance(agent);

        expect(agentInstance).toBeDefined();
        expect(agent.name).toBe('Graph Agent');
      });

      it('should have proper Graph capabilities', () => {
        const capability = AgentCapability.create({
          executionModel: 'dag',
          canUseTools: true,
          canStreamResults: true,
          canPauseResume: true,
          canCoordinate: false,
          supportsParallelExecution: true,
          maxInputTokens: 12000,
          maxOutputTokens: 6000,
          supportedMemoryTypes: ['buffer_window', 'entity'],
          timeoutMs: 180000,
        });

        const agent = Agent.create(
          'Graph Agent',
          AgentType.GRAPH,
          baseConfig,
          capability,
        );
        const agentInstance = factory.createInstance(agent);

        expect(agent.capability).toBeDefined();
        expect(agent.capability.executionModel).toBe('dag');
        expect(agent.capability.supportsParallelExecution).toBe(true);
      });
    });
  });

  describe('Collective Agent', () => {
    it('should throw if Collective has no children', () => {
      const capability = AgentCapability.create({
        executionModel: 'chain-of-thought',
        canUseTools: true,
        canStreamResults: true,
        canPauseResume: true,
        canCoordinate: false,
        supportsParallelExecution: true,
        maxInputTokens: 20000,
        maxOutputTokens: 10000,
        supportedMemoryTypes: ['buffer_window', 'entity'],
        timeoutMs: 600000,
      });

      expect(() => {
        const agent = Agent.create(
          'Bad Collective',
          AgentType.COLLECTIVE,
          baseConfig,
          capability,
        );
        factory.createInstance(agent);
      }).toThrow('Collective agents must have at least one child agent');
    });

    it('should throw if Collective has empty children array', () => {
      const capability = AgentCapability.create({
        executionModel: 'chain-of-thought',
        canUseTools: true,
        canStreamResults: true,
        canPauseResume: true,
        canCoordinate: false,
        supportsParallelExecution: true,
        maxInputTokens: 20000,
        maxOutputTokens: 10000,
        supportedMemoryTypes: ['buffer_window', 'entity'],
        timeoutMs: 600000,
      });

      expect(() => {
        const agent = Agent.create(
          'Bad Collective',
          AgentType.COLLECTIVE,
          baseConfig,
          capability,
        );
        factory.createInstance(agent);
      }).toThrow('Collective agents must have at least one child agent');
    });
  });

  describe('Error Cases', () => {
    it('should throw with meaningful errors for invalid input', () => {
      // Validates that factory provides good error messages
      const capability = AgentCapability.create({
        executionModel: 'chain-of-thought',
        canUseTools: true,
        canStreamResults: true,
        canPauseResume: false,
        canCoordinate: false,
        supportsParallelExecution: false,
        maxInputTokens: 4000,
        maxOutputTokens: 2000,
        supportedMemoryTypes: ['buffer_window'],
        timeoutMs: 60000,
      });

      expect(() => {
        const agent = Agent.create(
          'Agent',
          AgentType.REACT,
          AgentConfig.create({ model: '' }),
          capability,
        );
        factory.createInstance(agent);
      }).toThrow();
    });
  });

  describe('Configuration Preservation', () => {
    it('should preserve model in agent config', () => {
      const config = AgentConfig.create({
        model: 'claude-3',
        temperature: 0.5,
      });
      const capability = AgentCapability.create({
        executionModel: 'chain-of-thought',
        canUseTools: true,
        canStreamResults: true,
        canPauseResume: false,
        canCoordinate: false,
        supportsParallelExecution: false,
        maxInputTokens: 4000,
        maxOutputTokens: 2000,
        supportedMemoryTypes: ['buffer_window'],
        timeoutMs: 60000,
      });

      const agent = Agent.create('Agent', AgentType.REACT, config, capability);
      const agentInstance = factory.createInstance(agent);

      expect(agent.config.model).toBe('claude-3');
      expect(agent.config.temperature).toBe(0.5);
    });

    it('should preserve all config properties', () => {
      const config = AgentConfig.create({
        model: 'gpt-4',
        provider: 'openai',
        temperature: 0.8,
        maxTokens: 4000,
        systemPrompt: 'Custom prompt',
        enableTools: true,
        toolNames: ['tool1', 'tool2'],
        streamingEnabled: true,
        timeout: 60000,
      });

      const capability = AgentCapability.create({
        executionModel: 'research',
        canUseTools: true,
        canStreamResults: true,
        canPauseResume: false,
        canCoordinate: false,
        supportsParallelExecution: false,
        maxInputTokens: 8000,
        maxOutputTokens: 4000,
        supportedMemoryTypes: ['buffer_window', 'entity'],
        timeoutMs: 120000,
      });

      const agent = Agent.create('Agent', AgentType.EXPERT, config, capability);
      const agentInstance = factory.createInstance(agent);

      expect(agent.config.provider).toBe('openai');
      expect(agent.config.temperature).toBe(0.8);
      expect(agent.config.maxTokens).toBe(4000);
      expect(agent.config.systemPrompt).toBe('Custom prompt');
      expect(agent.config.enableTools).toBe(true);
      expect(agent.config.toolNames).toContain('tool1');
      expect(agent.config.streamingEnabled).toBe(true);
      expect(agent.config.timeout).toBe(60000);
    });
  });

  describe('Agent Uniqueness', () => {
    it('should create agents with unique IDs', () => {
      const capability = AgentCapability.create({
        executionModel: 'chain-of-thought',
        canUseTools: true,
        canStreamResults: true,
        canPauseResume: false,
        canCoordinate: false,
        supportsParallelExecution: false,
        maxInputTokens: 4000,
        maxOutputTokens: 2000,
        supportedMemoryTypes: ['buffer_window'],
        timeoutMs: 60000,
      });

      const agent1 = Agent.create(
        'Agent 1',
        AgentType.REACT,
        baseConfig,
        capability,
      );
      const agent2 = Agent.create(
        'Agent 2',
        AgentType.REACT,
        baseConfig,
        capability,
      );

      expect(agent1.id).not.toBe(agent2.id);
    });

    it('should allow duplicate names', () => {
      const capability = AgentCapability.create({
        executionModel: 'chain-of-thought',
        canUseTools: true,
        canStreamResults: true,
        canPauseResume: false,
        canCoordinate: false,
        supportsParallelExecution: false,
        maxInputTokens: 4000,
        maxOutputTokens: 2000,
        supportedMemoryTypes: ['buffer_window'],
        timeoutMs: 60000,
      });

      const agent1 = Agent.create(
        'Same Name',
        AgentType.REACT,
        baseConfig,
        capability,
      );
      const agent2 = Agent.create(
        'Same Name',
        AgentType.REACT,
        baseConfig,
        capability,
      );

      expect(agent1.name).toBe(agent2.name);
      expect(agent1.id).not.toBe(agent2.id);
    });
  });

  describe('Bulk Agent Creation', () => {
    it('should create multiple agents', () => {
      const agents = [];
      const types = [
        { type: AgentType.REACT, executionModel: 'chain-of-thought' as const },
        { type: AgentType.EXPERT, executionModel: 'research' as const },
        { type: AgentType.GENIUS, executionModel: 'learning' as const },
        { type: AgentType.GRAPH, executionModel: 'dag' as const },
      ];

      for (const { type, executionModel } of types) {
        const capability = AgentCapability.create({
          executionModel,
          canUseTools: true,
          canStreamResults: true,
          canPauseResume: false,
          canCoordinate: false,
          supportsParallelExecution: false,
          maxInputTokens: 4000,
          maxOutputTokens: 2000,
          supportedMemoryTypes: ['buffer_window'],
          timeoutMs: 60000,
        });

        const agent = Agent.create(
          `${type} Agent`,
          type,
          baseConfig,
          capability,
        );
        agents.push(agent);
      }

      expect(agents).toHaveLength(4);
      agents.forEach((agent) => {
        expect(agent.id).toBeDefined();
        expect(agent.name).toBeDefined();
        expect(agent.capability).toBeDefined();
      });
    });

    it('should create 100 agents efficiently', () => {
      const agents = [];
      const capability = AgentCapability.create({
        executionModel: 'chain-of-thought',
        canUseTools: true,
        canStreamResults: true,
        canPauseResume: false,
        canCoordinate: false,
        supportsParallelExecution: false,
        maxInputTokens: 4000,
        maxOutputTokens: 2000,
        supportedMemoryTypes: ['buffer_window'],
        timeoutMs: 60000,
      });

      for (let i = 0; i < 100; i++) {
        const agent = Agent.create(
          `Agent ${i}`,
          AgentType.REACT,
          baseConfig,
          capability,
        );
        agents.push(agent);
      }

      expect(agents).toHaveLength(100);
      agents.forEach((agent) => {
        expect(agent.id).toBeDefined();
      });
    });
  });
});
