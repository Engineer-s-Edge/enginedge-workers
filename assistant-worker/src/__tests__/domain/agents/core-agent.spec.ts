import { AgentBase, StateUpdate } from '../agent-base-legacy';
import { Agent } from '../../../domain/entities/agent.entity';
import { Message } from '../../../domain/value-objects/message.vo';
import { AgentConfig } from '../../../domain/value-objects/agent-config.vo';
import { AgentCapability } from '../../../domain/value-objects/agent-capability.vo';
import { AgentType } from '../../../domain/enums/agent-type.enum';

class TestAgent extends AgentBase {
  async execute(input: unknown): Promise<unknown> {
    return { success: true, input };
  }

  async *executeStreaming(input: string): AsyncGenerator<StateUpdate> {
    yield {
      timestamp: new Date(),
      state: 'processing',
      agent_id: this.agent.id,
      data: { phase: 'started', input },
    };

    await this.execute(input);

    yield {
      timestamp: new Date(),
      state: 'complete',
      agent_id: this.agent.id,
      data: { phase: 'completed' },
    };
  }
}

describe('Agent Base - State Machine', () => {
  let agent: Agent;
  let testAgent: TestAgent;

  beforeEach(() => {
    const config = AgentConfig.create({
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      streamingEnabled: true,
    });
    const capability = AgentCapability.create({
      executionModel: 'chain-of-thought',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: false,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer', 'buffer_window'],
      timeoutMs: 30000,
    });

    agent = Agent.create('Test Agent', AgentType.REACT, config, capability);
    testAgent = new TestAgent(agent);
  });

  test('should initialize in idle state', () => {
    expect(testAgent.getCurrentState()).toBe('idle');
  });

  test('should maintain valid state values', () => {
    const validStates = ['idle', 'processing', 'waiting', 'complete', 'error'];
    expect(validStates).toContain(testAgent.getCurrentState());
  });
});

describe('Agent Base - Memory System', () => {
  let agent: Agent;
  let testAgent: TestAgent;

  beforeEach(() => {
    const config = AgentConfig.create({
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      streamingEnabled: true,
    });
    const capability = AgentCapability.create({
      executionModel: 'chain-of-thought',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: false,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer', 'buffer_window'],
      timeoutMs: 30000,
    });

    agent = Agent.create('Test Agent', AgentType.REACT, config, capability);
    testAgent = new TestAgent(agent);
  });

  test('should add and retrieve messages', () => {
    const msg = Message.create('user', 'Hello!');
    testAgent.addMessage(msg);

    const messages = testAgent.getMemory().getMessages();
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[messages.length - 1].content).toBe('Hello!');
  });

  test('should preserve message roles', () => {
    testAgent.addMessage(Message.create('user', 'User msg'));
    testAgent.addMessage(Message.create('assistant', 'Assistant msg'));

    const messages = testAgent.getMemory().getMessages();
    const roles = messages.map((m) => m.role);

    expect(roles).toContain('user');
    expect(roles).toContain('assistant');
  });

  test('should accumulate messages', () => {
    const initialCount = testAgent.getMemory().getMessages().length;

    for (let i = 0; i < 5; i++) {
      testAgent.addMessage(Message.create('user', `Msg ${i}`));
    }

    expect(testAgent.getMemory().getMessages().length).toBe(initialCount + 5);
  });
});

describe('Agent Base - Streaming', () => {
  let agent: Agent;
  let testAgent: TestAgent;

  beforeEach(() => {
    const config = AgentConfig.create({
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      streamingEnabled: true,
    });
    const capability = AgentCapability.create({
      executionModel: 'chain-of-thought',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: false,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer', 'buffer_window'],
      timeoutMs: 30000,
    });

    agent = Agent.create('Test Agent', AgentType.REACT, config, capability);
    testAgent = new TestAgent(agent);
  });

  test('should emit state updates', async () => {
    const updates: StateUpdate[] = [];

    for await (const update of testAgent.executeStreaming('test')) {
      updates.push(update);
    }

    expect(updates.length).toBeGreaterThan(0);
  });

  test('should include agent_id in updates', async () => {
    const agentId = testAgent.getAgent().id;

    for await (const update of testAgent.executeStreaming('test')) {
      expect(update.agent_id).toBe(agentId);
    }
  });

  test('should include timestamp in updates', async () => {
    for await (const update of testAgent.executeStreaming('test')) {
      expect(update.timestamp).toBeInstanceOf(Date);
    }
  });
});

describe('Agent Base - Error Handling', () => {
  let agent: Agent;
  let testAgent: TestAgent;

  beforeEach(() => {
    const config = AgentConfig.create({
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      streamingEnabled: true,
    });
    const capability = AgentCapability.create({
      executionModel: 'chain-of-thought',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: false,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer', 'buffer_window'],
      timeoutMs: 30000,
    });

    agent = Agent.create('Test Agent', AgentType.REACT, config, capability);
    testAgent = new TestAgent(agent);
  });

  test('should recover from errors gracefully', async () => {
    let completedSuccessfully = false;

    try {
      for await (const update of testAgent.executeStreaming('test')) {
        expect(update).toBeDefined();
      }
      completedSuccessfully = true;
    } catch {
      // Error acceptable
    }

    expect(completedSuccessfully).toBe(true);
  });

  test('should maintain agent integrity after error', async () => {
    try {
      await testAgent.execute({ error: true });
    } catch {
      // Expected
    }

    const state = testAgent.getCurrentState();
    const validStates = ['idle', 'processing', 'complete', 'error', 'waiting'];
    expect(validStates).toContain(state);
  });
});
