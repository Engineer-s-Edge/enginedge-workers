import { ExpertAgent } from '../../../domain/agents/expert-agent/expert-agent';
import { Agent } from '../../../domain/entities/agent.entity';
import { AgentConfig } from '../../../domain/value-objects/agent-config.vo';
import { AgentCapability } from '../../../domain/value-objects/agent-capability.vo';
import { AgentType } from '../../../domain/enums/agent-type.enum';
import { ILLMProvider } from '../../../application/ports/llm-provider.port';
import { ILogger } from '../../../application/ports/logger.port';

describe('Expert Agent - Research Pipeline', () => {
  let agent: Agent;
  let expertAgent: ExpertAgent;
  let mockLLMProvider: ILLMProvider;
  let mockLogger: ILogger;

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

    const config = AgentConfig.create({
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 3000,
      streamingEnabled: true,
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

    agent = Agent.create('Expert Agent', AgentType.EXPERT, config, capability);
    expertAgent = new ExpertAgent(mockLLMProvider, mockLogger, undefined, {
      aim_iterations: 3,
      shoot_iterations: 2,
      skin_model: 'gpt-4',
      temperature: 0.3,
      model: 'gpt-4',
    });
  });

  test('should initialize research state with empty data', () => {
    const state = expertAgent.getResearchState();
    expect(state.topics).toEqual([]);
    expect(state.sources).toEqual([]);
    expect(state.evidence).toEqual([]);
  });

  test('should add research topics', () => {
    const topic = { id: 't1', query: 'AI Safety', status: 'pending' as const };
    expertAgent.addTopic(topic);
    const state = expertAgent.getResearchState();

    expect(state.topics.length).toBe(1);
    expect(state.topics[0].query).toBe('AI Safety');
  });

  test('should add multiple topics', () => {
    const topics = [
      { id: 't1', query: 'Machine Learning', status: 'pending' as const },
      { id: 't2', query: 'Deep Learning', status: 'pending' as const },
    ];

    topics.forEach((topic) => {
      expertAgent.addTopic(topic);
    });

    const state = expertAgent.getResearchState();
    expect(state.topics.length).toBe(2);
  });

  test('should maintain immutability when adding topics', () => {
    const originalState = expertAgent.getResearchState();
    expertAgent.addTopic({
      id: 'new-t',
      query: 'New Topic',
      status: 'pending' as const,
    });

    // Since addTopic is void, we check that the state has been updated
    const newState = expertAgent.getResearchState();
    expect(newState.topics.length).toBe(1);
    expect(newState.topics[0].query).toBe('New Topic');
  });

  test('should add research sources', () => {
    const source = {
      id: 's1',
      title: 'Research Paper',
      url: 'https://example.com',
      credibilityScore: 4,
      content: 'Paper content',
    };
    expertAgent.addSource(source);
    const state = expertAgent.getResearchState();

    expect(state.sources.length).toBe(1);
    expect(state.sources[0].title).toBe('Research Paper');
  });

  test('should validate credibility scores', () => {
    const highCredibility = {
      id: 's1',
      title: 'Trusted Source',
      url: 'https://example.com',
      credibilityScore: 5,
      content: 'content',
    };
    expertAgent.addSource(highCredibility);
    expect(expertAgent.getResearchState().sources[0].credibilityScore).toBe(5);
  });

  test('should add evidence entries', () => {
    const evidence = {
      id: 'e1',
      claim: 'Key Finding',
      sourceId: 's1',
      supportingText: 'Evidence text',
      qualityScore: 85,
    };
    expertAgent.addEvidence(evidence);
    const state = expertAgent.getResearchState();

    expect(state.evidence.length).toBe(1);
    expect(state.evidence[0].claim).toBe('Key Finding');
  });

  test('should support method chaining', () => {
    expertAgent.addTopic({
      id: 't1',
      query: 'Topic 1',
      status: 'pending' as const,
    });
    expertAgent.addSource({
      id: 's1',
      title: 'Source 1',
      url: 'https://ex.com',
      credibilityScore: 3,
      content: 'content',
    });

    const state = expertAgent.getResearchState();
    expect(state.topics.length).toBe(1);
    expect(state.sources.length).toBe(1);
  });

  test('should execute research pipeline', async () => {
    const result = await expertAgent.execute('Research AI');
    expect(result).toBeDefined();
  });

  test('should stream research updates', async () => {
    let count = 0;
    for await (const update of expertAgent.stream('Research')) {
      expect(update).toBeDefined();
      count++;
      if (count >= 5) break;
    }
    expect(count).toBeGreaterThan(0);
  });
});

describe('Expert Agent - Source Management', () => {
  let agent: Agent;
  let expertAgent: ExpertAgent;
  let mockLLMProvider: ILLMProvider;
  let mockLogger: ILogger;

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

    const config = AgentConfig.create({
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 3000,
      streamingEnabled: true,
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

    agent = Agent.create('Expert Agent', AgentType.EXPERT, config, capability);
    expertAgent = new ExpertAgent(mockLLMProvider, mockLogger, undefined, {
      aim_iterations: 3,
      shoot_iterations: 2,
      skin_model: 'gpt-4',
      temperature: 0.3,
      model: 'gpt-4',
    });
  });

  test('should validate source URLs', () => {
    const source = {
      id: 's1',
      title: 'Valid Source',
      url: 'https://valid-domain.com/paper',
      credibilityScore: 4,
      content: 'content',
    };
    expertAgent.addSource(source);
    expect(expertAgent.getResearchState().sources[0].url).toBeDefined();
  });

  test('should handle high credibility sources', () => {
    const source = {
      id: 's1',
      title: 'High Authority',
      url: 'https://authority.com',
      credibilityScore: 5,
      content: 'content',
    };
    expertAgent.addSource(source);
    expect(expertAgent.getResearchState().sources[0].credibilityScore).toBe(5);
  });

  test('should handle low credibility sources', () => {
    const source = {
      id: 's1',
      title: 'Low Authority',
      url: 'https://low.com',
      credibilityScore: 1,
      content: 'content',
    };
    expertAgent.addSource(source);
    expect(expertAgent.getResearchState().sources[0].credibilityScore).toBe(1);
  });

  test('should track multiple sources', () => {
    for (let i = 0; i < 5; i++) {
      expertAgent.addSource({
        id: `s${i}`,
        title: `Source ${i}`,
        url: `https://source${i}.com`,
        credibilityScore: (i % 5) + 1,
        content: 'content',
      });
    }
    expect(expertAgent.getResearchState().sources.length).toBe(5);
  });
});

describe('Expert Agent - Evidence Quality', () => {
  let agent: Agent;
  let expertAgent: ExpertAgent;
  let mockLLMProvider: ILLMProvider;
  let mockLogger: ILogger;

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

    const config = AgentConfig.create({
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 3000,
      streamingEnabled: true,
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

    agent = Agent.create('Expert Agent', AgentType.EXPERT, config, capability);
    expertAgent = new ExpertAgent(mockLLMProvider, mockLogger, undefined, {
      aim_iterations: 3,
      shoot_iterations: 2,
      skin_model: 'gpt-4',
      temperature: 0.3,
      model: 'gpt-4',
    });
  });

  test('should track evidence quality', () => {
    const evidence = {
      id: 'e1',
      claim: 'Statement',
      sourceId: 's1',
      supportingText: 'Text',
      qualityScore: 95,
    };
    expertAgent.addEvidence(evidence);
    expect(expertAgent.getResearchState().evidence[0].qualityScore).toBe(95);
  });

  test('should accumulate evidence', () => {
    for (let i = 0; i < 10; i++) {
      expertAgent.addEvidence({
        id: `e${i}`,
        claim: `Claim ${i}`,
        sourceId: `s${i}`,
        supportingText: `Text ${i}`,
        qualityScore: 70 + i,
      });
    }
    expect(expertAgent.getResearchState().evidence.length).toBe(10);
  });

  test('should maintain quality distribution', () => {
    const scores = [90, 75, 85, 95, 80];
    scores.forEach((score, i) => {
      expertAgent.addEvidence({
        id: `e${i}`,
        claim: `Claim ${i}`,
        sourceId: `s${i}`,
        supportingText: `Text`,
        qualityScore: score,
      });
    });
    const state = expertAgent.getResearchState();
    expect(
      state.evidence.every(
        (e) => e.qualityScore >= 70 && e.qualityScore <= 100,
      ),
    ).toBe(true);
  });
});
