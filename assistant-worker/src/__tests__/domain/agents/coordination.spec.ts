import { Agent } from '../../../domain/entities/agent.entity';
import { AgentConfig } from '../../../domain/value-objects/agent-config.vo';
import { AgentCapability } from '../../../domain/value-objects/agent-capability.vo';
import { Message } from '../../../domain/value-objects/message.vo';
import { AgentType } from '../../../domain/enums/agent-type.enum';

const defaultCapability = (): AgentCapability =>
  AgentCapability.create({
    executionModel: 'chain-of-thought',
    canUseTools: true,
    canStreamResults: true,
    canPauseResume: false,
    canCoordinate: false,
    supportsParallelExecution: false,
    maxInputTokens: 4096,
    maxOutputTokens: 2048,
    supportedMemoryTypes: ['buffer'],
    timeoutMs: 60000,
  });

describe('Multi-Agent - Agent Registration', () => {
  test('should create multiple agents with different types', () => {
    const config = AgentConfig.create({ model: 'gpt-4', temperature: 0.5 });
    const capability = defaultCapability();

    const reactAgent = Agent.create(
      'React Agent',
      AgentType.REACT,
      config,
      capability,
    );
    const expertAgent = Agent.create(
      'Expert Agent',
      AgentType.EXPERT,
      config,
      capability,
    );
    const geniusAgent = Agent.create(
      'Genius Agent',
      AgentType.GENIUS,
      config,
      capability,
    );

    expect(reactAgent).toBeInstanceOf(Agent);
    expect(expertAgent).toBeInstanceOf(Agent);
    expect(geniusAgent).toBeInstanceOf(Agent);
  });

  test('should preserve agent types during registration', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = AgentCapability.create({
      executionModel: 'dag',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: false,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer'],
      timeoutMs: 60000,
    });

    const graphAgent = Agent.create(
      'Graph',
      AgentType.GRAPH,
      config,
      capability,
    );
    const collectiveAgent = Agent.create(
      'Collective',
      AgentType.COLLECTIVE,
      config,
      capability,
    );

    expect(graphAgent.agentType).toBe(AgentType.GRAPH);
    expect(collectiveAgent.agentType).toBe(AgentType.COLLECTIVE);
  });

  test('should assign unique IDs to agents', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = defaultCapability();

    const agent1 = Agent.create('Agent1', AgentType.REACT, config, capability);
    const agent2 = Agent.create('Agent2', AgentType.REACT, config, capability);

    expect(agent1.id).not.toBe(agent2.id);
  });

  test('should store agent metadata', () => {
    const config = AgentConfig.create({ model: 'gpt-4', temperature: 0.7 });
    const capability = defaultCapability();

    const agent = Agent.create(
      'Metadata Agent',
      AgentType.EXPERT,
      config,
      capability,
    );
    expect(agent.name).toBe('Metadata Agent');
    expect(agent.config).toBeDefined();
    expect(agent.capability).toBeDefined();
  });

  test('should reject empty agent names', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = defaultCapability();

    expect(() =>
      Agent.create('', AgentType.REACT, config, capability),
    ).toThrow();
  });

  test('should reject very long agent names', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = defaultCapability();
    const longName = 'a'.repeat(101);

    expect(() =>
      Agent.create(longName, AgentType.REACT, config, capability),
    ).toThrow();
  });
});

describe('Multi-Agent - Memory Communication', () => {
  let sourceAgent: Agent;
  let targetAgent: Agent;

  beforeEach(() => {
    const config = AgentConfig.create({ model: 'gpt-4', temperature: 0.5 });
    const capability = defaultCapability();

    sourceAgent = Agent.create('Source', AgentType.REACT, config, capability);
    targetAgent = Agent.create('Target', AgentType.EXPERT, config, capability);
  });

  test('should add message to source agent memory', () => {
    const message = Message.user('Hello Target Agent');

    const memory = sourceAgent.getMemory().addMessage(message);
    const updated = sourceAgent.withMemory(memory);

    expect(updated.getMemory().getMessageCount()).toBe(1);
  });

  test('should transfer message between agents', () => {
    const message = Message.assistant('Response from Source');

    const sourceMemory = sourceAgent.getMemory().addMessage(message);
    const sourceUpdated = sourceAgent.withMemory(sourceMemory);

    const targetMemory = targetAgent.getMemory().addMessage(message);
    const targetUpdated = targetAgent.withMemory(targetMemory);

    expect(sourceUpdated.getMemory().getMessageCount()).toBe(1);
    expect(targetUpdated.getMemory().getMessageCount()).toBe(1);
  });

  test('should preserve message order in memory', () => {
    const msg1 = Message.user('First');
    const msg2 = Message.assistant('Second');

    const memory = sourceAgent.getMemory().addMessage(msg1).addMessage(msg2);
    const updated = sourceAgent.withMemory(memory);

    const messages = updated.getMemory().getMessages();
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe('First');
    expect(messages[1].content).toBe('Second');
  });

  test('should support bidirectional communication', () => {
    const fromSource = Message.user('Source to Target');
    const fromTarget = Message.assistant('Target to Source');

    let sourceMem = sourceAgent.getMemory().addMessage(fromSource);
    sourceAgent = sourceAgent.withMemory(sourceMem);

    const targetMem = targetAgent
      .getMemory()
      .addMessage(fromSource)
      .addMessage(fromTarget);
    targetAgent = targetAgent.withMemory(targetMem);

    sourceMem = sourceAgent.getMemory().addMessage(fromTarget);
    sourceAgent = sourceAgent.withMemory(sourceMem);

    expect(sourceAgent.getMemory().getMessageCount()).toBe(2);
    expect(targetAgent.getMemory().getMessageCount()).toBe(2);
  });

  test('should preserve messages during agent state transitions', () => {
    const message = Message.user('Context preservation');

    const memory = sourceAgent.getMemory().addMessage(message);
    sourceAgent = sourceAgent.withMemory(memory);

    expect(sourceAgent.getMemory().getMessageCount()).toBe(1);
  });
});

describe('Multi-Agent - State Coordination', () => {
  let coordinatorAgent: Agent;
  let workerAgent: Agent;

  beforeEach(() => {
    const config = AgentConfig.create({ model: 'gpt-4', temperature: 0.5 });
    const capability = AgentCapability.create({
      executionModel: 'dag',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: true,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer', 'summary'],
      timeoutMs: 120000,
    });

    coordinatorAgent = Agent.create(
      'Coordinator',
      AgentType.COLLECTIVE,
      config,
      capability,
    );
    workerAgent = Agent.create('Worker', AgentType.REACT, config, capability);
  });

  test('should check agent readiness', () => {
    expect(coordinatorAgent.isReady()).toBe(true);
    expect(workerAgent.isReady()).toBe(true);
  });

  test('should track agent processing state', () => {
    expect(coordinatorAgent.isProcessing()).toBe(false);
    expect(workerAgent.isProcessing()).toBe(false);
  });

  test('should support coordinator-worker hierarchy', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const collectiveCapability = AgentCapability.create({
      executionModel: 'dag',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: true,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer'],
      timeoutMs: 60000,
    });
    const workerCapability = defaultCapability();

    const coord = Agent.create(
      'Coordinator',
      AgentType.COLLECTIVE,
      config,
      collectiveCapability,
    );
    const w1 = Agent.create(
      'Worker1',
      AgentType.REACT,
      config,
      workerCapability,
    );
    const w2 = Agent.create(
      'Worker2',
      AgentType.EXPERT,
      config,
      workerCapability,
    );

    expect(coord.agentType).toBe(AgentType.COLLECTIVE);
    expect(w1.agentType).toBe(AgentType.REACT);
    expect(w2.agentType).toBe(AgentType.EXPERT);
  });
});

describe('Multi-Agent - Memory Management', () => {
  let agent1: Agent;
  let agent2: Agent;

  beforeEach(() => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = AgentCapability.create({
      executionModel: 'chain-of-thought',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: false,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer', 'summary'],
      timeoutMs: 60000,
    });

    agent1 = Agent.create('Agent1', AgentType.REACT, config, capability);
    agent2 = Agent.create('Agent2', AgentType.EXPERT, config, capability);
  });

  test('should maintain separate memory for each agent', () => {
    const msg1 = Message.user('Agent1 message');
    const msg2 = Message.user('Agent2 message');

    const mem1 = agent1.getMemory().addMessage(msg1);
    const mem2 = agent2.getMemory().addMessage(msg2);

    agent1 = agent1.withMemory(mem1);
    agent2 = agent2.withMemory(mem2);

    expect(agent1.getMemory().getMessageCount()).toBe(1);
    expect(agent2.getMemory().getMessageCount()).toBe(1);
    expect(agent1.getMemory().getMessages()[0].content).toBe('Agent1 message');
    expect(agent2.getMemory().getMessages()[0].content).toBe('Agent2 message');
  });

  test('should support shared context through messages', () => {
    const shared = Message.system('Shared context');

    const mem1 = agent1.getMemory().addMessage(shared);
    const mem2 = agent2.getMemory().addMessage(shared);

    agent1 = agent1.withMemory(mem1);
    agent2 = agent2.withMemory(mem2);

    expect(agent1.getMemory().getMessageCount()).toBe(1);
    expect(agent2.getMemory().getMessageCount()).toBe(1);
  });

  test('should enforce message ordering', () => {
    const msg1 = Message.user('First');
    const msg2 = Message.assistant('Second');
    const msg3 = Message.user('Third');

    const memory = agent1
      .getMemory()
      .addMessage(msg1)
      .addMessage(msg2)
      .addMessage(msg3);
    agent1 = agent1.withMemory(memory);

    const messages = agent1.getMemory().getMessages();
    expect(messages[0].content).toBe('First');
    expect(messages[1].content).toBe('Second');
    expect(messages[2].content).toBe('Third');
  });

  test('should filter messages by role', () => {
    const messages = [
      Message.user('Q1'),
      Message.assistant('A1'),
      Message.user('Q2'),
    ];

    let memory = agent1.getMemory();
    for (const msg of messages) {
      memory = memory.addMessage(msg);
    }
    agent1 = agent1.withMemory(memory);

    const userMessages = agent1.getMemory().getMessagesByRole('user');
    expect(userMessages.length).toBe(2);
  });

  test('should get recent messages', () => {
    const messages = [
      Message.user('M1'),
      Message.assistant('M2'),
      Message.user('M3'),
      Message.assistant('M4'),
      Message.user('M5'),
    ];

    let memory = agent1.getMemory();
    for (const msg of messages) {
      memory = memory.addMessage(msg);
    }
    agent1 = agent1.withMemory(memory);

    const recent = agent1.getMemory().getRecentMessages(2);
    expect(recent.length).toBe(2);
    expect(recent[0].content).toBe('M4');
    expect(recent[1].content).toBe('M5');
  });
});

describe('Multi-Agent - Error Handling', () => {
  let agent: Agent;

  beforeEach(() => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = defaultCapability();
    agent = Agent.create('Error Handler', AgentType.REACT, config, capability);
  });

  test('should handle agent name validation', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = defaultCapability();

    expect(() => Agent.create('', AgentType.REACT, config, capability)).toThrow(
      'Agent name is required',
    );
  });

  test('should maintain state integrity', () => {
    const message = Message.user('Integrity check');
    const memory = agent.getMemory().addMessage(message);
    agent = agent.withMemory(memory);

    expect(agent.getMemory().getMessageCount()).toBe(1);
    expect(agent.isReady()).toBe(true);
  });

  test('should clear memory when needed', () => {
    const msg1 = Message.user('M1');
    const msg2 = Message.assistant('M2');

    const memory = agent.getMemory().addMessage(msg1).addMessage(msg2);
    agent = agent.withMemory(memory);
    expect(agent.getMemory().getMessageCount()).toBe(2);

    agent = agent.withMemory(agent.getMemory().clear());
    expect(agent.getMemory().isEmpty()).toBe(true);
  });

  test('should check memory emptiness', () => {
    expect(agent.getMemory().isEmpty()).toBe(true);

    const message = Message.user('Test');
    agent = agent.withMemory(agent.getMemory().addMessage(message));
    expect(agent.getMemory().isEmpty()).toBe(false);
  });
});

describe('Multi-Agent - Performance Patterns', () => {
  test('should create agents efficiently', () => {
    const startTime = Date.now();
    const agents = [];

    for (let i = 0; i < 10; i++) {
      const config = AgentConfig.create({ model: 'gpt-4' });
      const capability = defaultCapability();
      agents.push(
        Agent.create(`Agent-${i}`, AgentType.REACT, config, capability),
      );
    }

    const endTime = Date.now();
    expect(agents.length).toBe(10);
    expect(endTime - startTime).toBeLessThan(5000);
  });

  test('should handle bulk message operations', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = defaultCapability();
    let agent = Agent.create('Bulk', AgentType.REACT, config, capability);

    let memory = agent.getMemory();
    for (let i = 0; i < 20; i++) {
      const msg =
        i % 2 === 0
          ? Message.user(`Message ${i}`)
          : Message.assistant(`Message ${i}`);
      memory = memory.addMessage(msg);
    }
    agent = agent.withMemory(memory);

    expect(agent.getMemory().getMessageCount()).toBe(20);
  });

  test('should support multiple agent teams', () => {
    const teams = Array.from({ length: 5 }, () => {
      const config = AgentConfig.create({ model: 'gpt-4' });
      const capability = defaultCapability();

      return Array.from({ length: 3 }, (_, i) =>
        Agent.create(`Team-Agent-${i}`, AgentType.REACT, config, capability),
      );
    });

    expect(teams.length).toBe(5);
    teams.forEach((team) => {
      expect(team.length).toBe(3);
      team.forEach((a) => {
        expect(a).toBeInstanceOf(Agent);
      });
    });
  });

  test('should manage memory efficiently with many agents', () => {
    const agents = Array.from({ length: 50 }, (_, i) => {
      const config = AgentConfig.create({ model: 'gpt-4' });
      const capability = defaultCapability();
      return Agent.create(`MemTest-${i}`, AgentType.REACT, config, capability);
    });

    expect(agents.length).toBe(50);
    agents.forEach((a) => {
      expect(a).toBeInstanceOf(Agent);
    });
  });
});

describe('Multi-Agent - Coordination Patterns', () => {
  test('should support supervisor-worker pattern', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const supervisorCapability = AgentCapability.create({
      executionModel: 'dag',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: true,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer', 'summary'],
      timeoutMs: 60000,
    });

    const supervisor = Agent.create(
      'Supervisor',
      AgentType.COLLECTIVE,
      config,
      supervisorCapability,
    );

    const workerCapability = AgentCapability.create({
      executionModel: 'dag',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: true,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer', 'summary'],
      timeoutMs: 60000,
    });
    const workers = Array.from({ length: 3 }, (_, i) =>
      Agent.create(`Worker-${i}`, AgentType.REACT, config, workerCapability),
    );

    expect(supervisor.agentType).toBe(AgentType.COLLECTIVE);
    expect(workers.length).toBe(3);
    workers.forEach((w) => expect(w.agentType).toBe(AgentType.REACT));
  });

  test('should support pipeline pattern', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = AgentCapability.create({
      executionModel: 'dag',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: false,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer'],
      timeoutMs: 60000,
    });

    const stage1 = Agent.create('Stage1', AgentType.REACT, config, capability);
    const stage2 = Agent.create('Stage2', AgentType.EXPERT, config, capability);
    const stage3 = Agent.create('Stage3', AgentType.GENIUS, config, capability);

    const message = Message.assistant('Pipeline data');

    const stage2Mem = stage2.getMemory().addMessage(message);
    const stage2Updated = stage2.withMemory(stage2Mem);

    const stage3Mem = stage3.getMemory().addMessage(message);
    const stage3Updated = stage3.withMemory(stage3Mem);

    expect(stage1.agentType).toBe(AgentType.REACT);
    expect(stage2Updated.agentType).toBe(AgentType.EXPERT);
    expect(stage3Updated.agentType).toBe(AgentType.GENIUS);
  });

  test('should support fan-out fan-in pattern', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const distributorCapability = AgentCapability.create({
      executionModel: 'dag',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: true,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer'],
      timeoutMs: 60000,
    });

    const distributor = Agent.create(
      'Distributor',
      AgentType.COLLECTIVE,
      config,
      distributorCapability,
    );

    const workerCapability = AgentCapability.create({
      executionModel: 'dag',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: true,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer'],
      timeoutMs: 60000,
    });
    const workers = Array.from({ length: 4 }, (_, i) =>
      Agent.create(`FanOut-${i}`, AgentType.REACT, config, workerCapability),
    );

    const aggregator = Agent.create(
      'Aggregator',
      AgentType.EXPERT,
      config,
      workerCapability,
    );

    expect(distributor.agentType).toBe(AgentType.COLLECTIVE);
    expect(workers.length).toBe(4);
    expect(aggregator.agentType).toBe(AgentType.EXPERT);
  });
});
