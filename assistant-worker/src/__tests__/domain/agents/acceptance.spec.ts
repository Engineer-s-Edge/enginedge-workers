import { Agent } from '../../../domain/entities/agent.entity';
import { AgentConfig } from '../../../domain/value-objects/agent-config.vo';
import { AgentCapability } from '../../../domain/value-objects/agent-capability.vo';
import { Message } from '../../../domain/value-objects/message.vo';
import { AgentType } from '../../../domain/enums/agent-type.enum';

const fullCapability = (): AgentCapability =>
  AgentCapability.create({
    executionModel: 'chain-of-thought',
    canUseTools: true,
    canStreamResults: true,
    canPauseResume: true,
    canCoordinate: false,
    supportsParallelExecution: true,
    maxInputTokens: 8192,
    maxOutputTokens: 4096,
    supportedMemoryTypes: ['buffer', 'summary', 'entity'],
    timeoutMs: 300000,
  });

describe('End-to-End - Complete Workflows', () => {
  test('should execute basic agent workflow', () => {
    const config = AgentConfig.create({
      model: 'gpt-4',
      temperature: 0.5,
      maxTokens: 2000,
    });
    const capability = fullCapability();
    const agent = Agent.create('E2E Agent', AgentType.REACT, config, capability);

    expect(agent).toBeInstanceOf(Agent);
    expect(agent.isReady()).toBe(true);
    expect(agent.isProcessing()).toBe(false);
  });

  test('should handle multi-step conversation workflow', () => {
    const config = AgentConfig.create({ model: 'gpt-4', temperature: 0.6 });
    const capability = fullCapability();
    let agent = Agent.create('Conversational', AgentType.EXPERT, config, capability);

    const step1 = Message.user('What is machine learning?');
    const step2 = Message.assistant('Machine learning is a subset of AI...');
    const step3 = Message.user('How does it differ from deep learning?');

    let memory = agent.getMemory();
    memory = memory.addMessage(step1);
    memory = memory.addMessage(step2);
    memory = memory.addMessage(step3);
    agent = agent.withMemory(memory);

    expect(agent.getMemory().getMessageCount()).toBe(3);
    const messages = agent.getMemory().getMessages();
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
    expect(messages[2].role).toBe('user');
  });

  test('should support context preservation across turns', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = fullCapability();
    let agent = Agent.create('Context Agent', AgentType.GENIUS, config, capability);

    const systemContext = Message.system('You are a helpful research assistant');
    let memory = agent.getMemory().addMessage(systemContext);

    for (let i = 0; i < 5; i++) {
      const userMsg = Message.user(`Question ${i + 1}`);
      const assistantMsg = Message.assistant(`Answer ${i + 1}`);
      memory = memory.addMessage(userMsg).addMessage(assistantMsg);
    }

    agent = agent.withMemory(memory);
    expect(agent.getMemory().getMessageCount()).toBe(11); // 1 system + 5*2 messages
  });

  test('should maintain conversation coherence', () => {
    const config = AgentConfig.create({ model: 'gpt-4', temperature: 0.7 });
    const capability = fullCapability();
    let agent = Agent.create('Coherent', AgentType.EXPERT, config, capability);

    const topic = Message.system('Topic: Climate Change');
    let memory = agent.getMemory().addMessage(topic);

    const q1 = Message.user('What causes climate change?');
    const a1 = Message.assistant('Primary causes include greenhouse gas emissions...');
    memory = memory.addMessage(q1).addMessage(a1);

    const q2 = Message.user('What are the consequences?');
    const a2 = Message.assistant('Consequences include rising temperatures...');
    memory = memory.addMessage(q2).addMessage(a2);

    agent = agent.withMemory(memory);
    const recentMessages = agent.getMemory().getRecentMessages(3);
    expect(recentMessages.length).toBe(3);
  });
});

describe('End-to-End - Business Logic Validation', () => {
  test('should validate agent configuration constraints', () => {
    const config = AgentConfig.create({
      model: 'gpt-4',
      temperature: 0.5,
      maxTokens: 4096,
    });
    const capability = fullCapability();
    const agent = Agent.create('Constrained', AgentType.REACT, config, capability);

    expect(agent.config).toBeDefined();
    expect(agent.capability).toBeDefined();
    expect(agent.capability.maxInputTokens).toBe(8192);
    expect(agent.capability.maxOutputTokens).toBe(4096);
  });

  test('should enforce timeout constraints', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const quickCapability = AgentCapability.create({
      executionModel: 'chain-of-thought',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: false,
      maxInputTokens: 4096,
      maxOutputTokens: 2048,
      supportedMemoryTypes: ['buffer'],
      timeoutMs: 5000,
    });

    const agent = Agent.create('Quick', AgentType.REACT, config, quickCapability);
    expect(agent.capability.timeoutMs).toBe(5000);
  });

  test('should support streaming capability declaration', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const streamingCapability = AgentCapability.create({
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

    const agent = Agent.create('Streamer', AgentType.REACT, config, streamingCapability);
    expect(agent.capability.canStreamResults).toBe(true);
  });

  test('should track agent mutation history through immutability', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = fullCapability();
    const agent1 = Agent.create('V1', AgentType.REACT, config, capability);

    const msg1 = Message.user('First message');
    const mem2 = agent1.getMemory().addMessage(msg1);
    const agent2 = agent1.withMemory(mem2);

    expect(agent1.getMemory().getMessageCount()).toBe(0);
    expect(agent2.getMemory().getMessageCount()).toBe(1);
    expect(agent1).not.toBe(agent2); // Different instances
    expect(agent1.id).toBe(agent2.id); // Same agent id
  });
});

describe('End-to-End - System Stability', () => {
  test('should handle large conversation history', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = fullCapability();
    let agent = Agent.create('LargeHistory', AgentType.EXPERT, config, capability);

    let memory = agent.getMemory();
    for (let i = 0; i < 100; i++) {
      const msg = i % 2 === 0 ? Message.user(`Q${i}`) : Message.assistant(`A${i}`);
      memory = memory.addMessage(msg);
    }
    agent = agent.withMemory(memory);

    expect(agent.getMemory().getMessageCount()).toBe(100);
  });

  test('should handle memory role filtering correctly', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = fullCapability();
    let agent = Agent.create('RoleFilter', AgentType.REACT, config, capability);

    let memory = agent.getMemory();
    memory = memory.addMessage(Message.system('System prompt'));
    memory = memory.addMessage(Message.user('User query'));
    memory = memory.addMessage(Message.assistant('Agent response'));
    memory = memory.addMessage(Message.user('Follow-up'));
    memory = memory.addMessage(Message.assistant('Follow-up response'));

    agent = agent.withMemory(memory);

    const systemMsgs = agent.getMemory().getMessagesByRole('system');
    const userMsgs = agent.getMemory().getMessagesByRole('user');
    const assistantMsgs = agent.getMemory().getMessagesByRole('assistant');

    expect(systemMsgs.length).toBe(1);
    expect(userMsgs.length).toBe(2);
    expect(assistantMsgs.length).toBe(2);
  });

  test('should maintain state consistency under stress', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = fullCapability();
    let agents = Array.from({ length: 10 }, (_, i) =>
      Agent.create(`StressAgent${i}`, AgentType.REACT, config, capability)
    );

    agents = agents.map((agent) => {
      let memory = agent.getMemory();
      for (let j = 0; j < 20; j++) {
        const msg = j % 2 === 0 ? Message.user(`Q${j}`) : Message.assistant(`A${j}`);
        memory = memory.addMessage(msg);
      }
      return agent.withMemory(memory);
    });

    agents.forEach((agent) => {
      expect(agent.isReady()).toBe(true);
      expect(agent.getMemory().getMessageCount()).toBe(20);
    });
  });

  test('should recover from memory operations', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = fullCapability();
    let agent = Agent.create('Recovery', AgentType.EXPERT, config, capability);

    let memory = agent.getMemory();
    memory = memory.addMessage(Message.user('First'));
    memory = memory.addMessage(Message.assistant('Response'));
    agent = agent.withMemory(memory);
    expect(agent.getMemory().getMessageCount()).toBe(2);

    // Clear and restart
    agent = agent.withMemory(agent.getMemory().clear());
    expect(agent.getMemory().isEmpty()).toBe(true);

    // Resume operation
    memory = agent.getMemory().addMessage(Message.user('Restarted'));
    agent = agent.withMemory(memory);
    expect(agent.getMemory().getMessageCount()).toBe(1);
  });

  test('should handle agent configuration updates', () => {
    const config1 = AgentConfig.create({ model: 'gpt-4', temperature: 0.5 });
    const capability = fullCapability();
    let agent = Agent.create('ConfigUpdate', AgentType.REACT, config1, capability);

    expect(agent.config).toBeDefined();

    const config2 = AgentConfig.create({ model: 'gpt-4', temperature: 0.8 });
    agent = agent.withConfig(config2);

    expect(agent.config).toBeDefined();
  });
});

describe('End-to-End - Agent Type Workflows', () => {
  test('should support React agent workflow', () => {
    const config = AgentConfig.create({ model: 'gpt-4', temperature: 0.5 });
    const capability = AgentCapability.create({
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

    let agent = Agent.create('React', AgentType.REACT, config, capability);
    expect(agent.agentType).toBe(AgentType.REACT);

    const memory = agent.getMemory().addMessage(Message.user('Analyze this problem'));
    agent = agent.withMemory(memory);
    expect(agent.getMemory().getMessageCount()).toBe(1);
  });

  test('should support Expert agent workflow', () => {
    const config = AgentConfig.create({ model: 'gpt-4', temperature: 0.6 });
    const capability = fullCapability();
    let agent = Agent.create('Expert', AgentType.EXPERT, config, capability);
    expect(agent.agentType).toBe(AgentType.EXPERT);

    let memory = agent.getMemory();
    memory = memory.addMessage(Message.user('Research topic X'));
    memory = memory.addMessage(Message.assistant('Here is my research on topic X...'));
    agent = agent.withMemory(memory);

    expect(agent.getMemory().getMessageCount()).toBe(2);
  });

  test('should support Genius agent workflow', () => {
    const config = AgentConfig.create({ model: 'gpt-4', temperature: 0.7 });
    const capability = fullCapability();
    let agent = Agent.create('Genius', AgentType.GENIUS, config, capability);
    expect(agent.agentType).toBe(AgentType.GENIUS);

    let memory = agent.getMemory();
    memory = memory.addMessage(Message.user('Learn this pattern'));
    memory = memory.addMessage(Message.assistant('Pattern learned and generalized'));
    agent = agent.withMemory(memory);

    expect(agent.getMemory().getMessageCount()).toBe(2);
  });

  test('should support Graph agent workflow', () => {
    const config = AgentConfig.create({ model: 'gpt-4', temperature: 0.5 });
    const graphCapability = AgentCapability.create({
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

    let agent = Agent.create('Graph', AgentType.GRAPH, config, graphCapability);
    expect(agent.agentType).toBe(AgentType.GRAPH);

    let memory = agent.getMemory();
    memory = memory.addMessage(Message.user('Process DAG: A->B->C'));
    agent = agent.withMemory(memory);

    expect(agent.getMemory().getMessageCount()).toBe(1);
  });

  test('should support Collective agent workflow', () => {
    const config = AgentConfig.create({ model: 'gpt-4', temperature: 0.5 });
    const collectiveCapability = AgentCapability.create({
      executionModel: 'dag',
      canUseTools: true,
      canStreamResults: true,
      canPauseResume: false,
      canCoordinate: false,
      supportsParallelExecution: true,
      maxInputTokens: 8192,
      maxOutputTokens: 4096,
      supportedMemoryTypes: ['buffer', 'summary'],
      timeoutMs: 120000,
    });

    let agent = Agent.create('Collective', AgentType.COLLECTIVE, config, collectiveCapability);
    expect(agent.agentType).toBe(AgentType.COLLECTIVE);

    const memory = agent.getMemory();
    const memory2 = memory.addMessage(Message.user('Coordinate subtasks'));
    const memory3 = memory2.addMessage(Message.assistant('Coordinating workers...'));
    agent = agent.withMemory(memory3);

    expect(agent.getMemory().getMessageCount()).toBe(2);
  });
});

describe('End-to-End - Message Semantics', () => {
  test('should preserve message semantics across operations', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = fullCapability();
    let agent = Agent.create('Semantics', AgentType.REACT, config, capability);

    const userMsg = Message.user('Original question');
    const assistantMsg = Message.assistant('Original answer');

    const memory = agent.getMemory().addMessage(userMsg).addMessage(assistantMsg);
    agent = agent.withMemory(memory);

    const retrieved = agent.getMemory().getMessages();
    expect(retrieved[0].role).toBe('user');
    expect(retrieved[0].content).toBe('Original question');
    expect(retrieved[1].role).toBe('assistant');
    expect(retrieved[1].content).toBe('Original answer');
  });

  test('should maintain message timestamps', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = fullCapability();
    let agent = Agent.create('Timestamps', AgentType.REACT, config, capability);

    const msg1 = Message.user('First');
    const msg2 = Message.assistant('Second');

    const memory = agent.getMemory().addMessage(msg1).addMessage(msg2);
    agent = agent.withMemory(memory);

    const messages = agent.getMemory().getMessages();
    expect(messages[0].timestamp).toBeInstanceOf(Date);
    expect(messages[1].timestamp).toBeInstanceOf(Date);
    expect(messages[0].timestamp.getTime()).toBeLessThanOrEqual(messages[1].timestamp.getTime());
  });

  test('should support message metadata', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = fullCapability();
    let agent = Agent.create('Metadata', AgentType.REACT, config, capability);

    const msgWithMeta = Message.user('Query with context', { source: 'api', userId: '123' });

    const memory = agent.getMemory().addMessage(msgWithMeta);
    agent = agent.withMemory(memory);

    const retrieved = agent.getMemory().getMessages()[0];
    expect(retrieved.metadata).toBeDefined();
    expect(retrieved.metadata?.source).toBe('api');
    expect(retrieved.metadata?.userId).toBe('123');
  });
});

describe('End-to-End - Performance Acceptance', () => {
  test('should create and configure agents within time budget', () => {
    const startTime = performance.now();

    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = fullCapability();
    const agents = Array.from({ length: 5 }, (_, i) =>
      Agent.create(`PerfAgent${i}`, AgentType.REACT, config, capability)
    );

    const endTime = performance.now();
    expect(agents.length).toBe(5);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
  });

  test('should handle message bulk operations within time budget', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = fullCapability();
    let agent = Agent.create('BulkPerf', AgentType.REACT, config, capability);

    const startTime = performance.now();

    let memory = agent.getMemory();
    for (let i = 0; i < 50; i++) {
      const msg = i % 2 === 0 ? Message.user(`Q${i}`) : Message.assistant(`A${i}`);
      memory = memory.addMessage(msg);
    }
    agent = agent.withMemory(memory);

    const endTime = performance.now();
    expect(agent.getMemory().getMessageCount()).toBe(50);
    expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
  });

  test('should query message history efficiently', () => {
    const config = AgentConfig.create({ model: 'gpt-4' });
    const capability = fullCapability();
    let agent = Agent.create('QueryPerf', AgentType.REACT, config, capability);

    let memory = agent.getMemory();
    for (let i = 0; i < 100; i++) {
      memory = memory.addMessage(Message.user(`Message ${i}`));
    }
    agent = agent.withMemory(memory);

    const startTime = performance.now();

    const userMsgs = agent.getMemory().getMessagesByRole('user');
    const recent = agent.getMemory().getRecentMessages(10);

    const endTime = performance.now();
    expect(userMsgs.length).toBe(100);
    expect(recent.length).toBe(10);
    expect(endTime - startTime).toBeLessThan(50); // Queries should be very fast
  });
});
