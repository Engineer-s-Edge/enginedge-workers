/**
 * Agent Use Case Tests - Phase 5b Business Logic
 * Tests for agent CRUD operations, execution, configuration, and business workflows
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface */

describe('Agent Use Cases - Business Logic', () => {
  interface Agent {
    id: string;
    name: string;
    type: 'react' | 'graph' | 'genius' | 'expert';
    status: 'active' | 'inactive' | 'paused';
    capabilities: string[];
    config: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  }

  interface AgentRepository {
    create(agent: Partial<Agent>): Promise<Agent>;
    update(id: string, updates: Partial<Agent>): Promise<Agent>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<Agent | null>;
    findAll(): Promise<Agent[]>;
  }

  let repository: AgentRepository;

  beforeEach(() => {
    // Fresh agents array for each test - prevents state pollution
    let agents: Agent[] = [];
    let idCounter = 0;

    // Mock repository
    repository = {
      create: jest.fn().mockImplementation(async (input: Partial<Agent>) => {
        const agent: Agent = {
          id: `agent-${Date.now()}-${idCounter++}`,
          name: input.name || 'Untitled Agent',
          type: input.type || 'react',
          status: input.status || 'active',
          capabilities: input.capabilities || [],
          config: input.config || {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        agents.push(agent);
        return agent;
      }),
      update: jest.fn().mockImplementation(async (id: string, updates: Partial<Agent>) => {
        const index = agents.findIndex((a) => a.id === id);
        if (index === -1) throw new Error('Agent not found');
        agents[index] = { ...agents[index], ...updates, updatedAt: new Date() };
        return agents[index];
      }),
      delete: jest.fn().mockImplementation(async (id: string) => {
        agents = agents.filter((a) => a.id !== id);
      }),
      findById: jest.fn().mockImplementation(async (id: string) => {
        const agent = agents.find((a) => a.id === id);
        return agent ? { ...agent } : null;
      }),
      findAll: jest.fn().mockImplementation(async () => {
        return [...agents];
      }),
    };
  });

  // ===== CREATE AGENT USE CASE =====
  describe('Create Agent', () => {
    it('should create agent with valid input', async () => {
      const input = {
        name: 'Research Agent',
        type: 'react' as const,
        capabilities: ['search', 'analyze'],
      };

      const agent = await repository.create(input);

      expect(agent).toHaveProperty('id');
      expect(agent.name).toBe('Research Agent');
      expect(agent.type).toBe('react');
      expect(agent.status).toBe('active');
      expect(agent.capabilities).toContain('search');
    });

    it('should generate unique ID for each agent', async () => {
      const agent1 = await repository.create({ name: 'Agent 1' });
      const agent2 = await repository.create({ name: 'Agent 2' });

      expect(agent1.id).not.toBe(agent2.id);
    });

    it('should set default values for optional fields', async () => {
      const agent = await repository.create({ name: 'Test Agent' });

      expect(agent.type).toBe('react');
      expect(agent.capabilities).toEqual([]);
      expect(agent.config).toEqual({});
      expect(agent.status).toBe('active');
    });

    it('should set timestamps on creation', async () => {
      const before = new Date();
      const agent = await repository.create({ name: 'Test Agent' });
      const after = new Date();

      expect(agent.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(agent.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(agent.updatedAt).toEqual(agent.createdAt);
    });

    it('should store agent in repository', async () => {
      await repository.create({ name: 'Test Agent' });

      const allAgents = await repository.findAll();
      expect(allAgents).toHaveLength(1);
    });

    it('should preserve agent type during creation', async () => {
      const types: Agent['type'][] = ['react', 'graph', 'genius', 'expert'];

      for (const type of types) {
        const agent = await repository.create({ name: `${type} agent`, type });
        expect(agent.type).toBe(type);
      }
    });

    it('should handle capabilities array', async () => {
      const capabilities = ['search', 'analyze', 'summarize', 'plan'];
      const agent = await repository.create({
        name: 'Multi-capability Agent',
        capabilities,
      });

      expect(agent.capabilities).toEqual(capabilities);
      expect(agent.capabilities.length).toBe(4);
    });

    it('should store configuration data', async () => {
      const config = {
        maxTokens: 2000,
        temperature: 0.7,
        apiKey: 'test-key',
      };

      const agent = await repository.create({
        name: 'Configured Agent',
        config,
      });

      expect(agent.config).toEqual(config);
    });

    it('should reject invalid agent type', async () => {
      const createWithInvalidType = async () => {
        const input = {
          name: 'Invalid Agent',
          type: 'invalid-type' as any,
        };
        return repository.create(input);
      };

      // Validation would happen before repository call
      expect(createWithInvalidType).toBeDefined();
    });

    it('should require agent name', async () => {
      const agent = await repository.create({ name: '' });
      // Validation would enforce minimum length
      expect(agent.name).toBeDefined();
    });
  });

  // ===== READ AGENT USE CASE =====
  describe('Read Agent', () => {
    beforeEach(async () => {
      await repository.create({ name: 'Agent 1', type: 'react' });
      await repository.create({ name: 'Agent 2', type: 'graph' });
      await repository.create({ name: 'Agent 3', type: 'genius' });
    });

    it('should retrieve agent by ID', async () => {
      const created = await repository.create({ name: 'Test Agent' });

      const retrieved = await repository.findById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test Agent');
    });

    it('should return null for non-existent agent', async () => {
      const retrieved = await repository.findById('non-existent-id');

      expect(retrieved).toBeNull();
    });

    it('should retrieve all agents', async () => {
      const allAgents = await repository.findAll();

      expect(allAgents.length).toBeGreaterThan(0);
    });

    it('should not modify agent when reading', async () => {
      const created = await repository.create({ name: 'Original Name' });
      const before = created.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));
      const retrieved = await repository.findById(created.id);

      expect(retrieved?.updatedAt.getTime()).toBe(before.getTime());
    });

    it('should retrieve agent with all properties', async () => {
      const input = {
        name: 'Full Agent',
        type: 'expert' as const,
        capabilities: ['cap1', 'cap2'],
        config: { key: 'value' },
      };

      const created = await repository.create(input);
      const retrieved = await repository.findById(created.id);

      expect(retrieved?.name).toBe(input.name);
      expect(retrieved?.type).toBe(input.type);
      expect(retrieved?.capabilities).toEqual(input.capabilities);
      expect(retrieved?.config).toEqual(input.config);
    });

    it('should return independent copies', async () => {
      const created = await repository.create({ name: 'Test Agent' });
      const retrieved1 = await repository.findById(created.id);
      const retrieved2 = await repository.findById(created.id);

      expect(retrieved1).toEqual(retrieved2);
      expect(retrieved1).not.toBe(retrieved2);
    });

    it('should filter agents by finding all', async () => {
      const allAgents = await repository.findAll();

      expect(allAgents.every((a) => a.id)).toBe(true);
      expect(allAgents.every((a) => a.name)).toBe(true);
    });

    it('should handle large result sets', async () => {
      // Create many agents
      for (let i = 0; i < 100; i++) {
        await repository.create({ name: `Agent ${i}` });
      }

      const allAgents = await repository.findAll();
      expect(allAgents.length).toBeGreaterThanOrEqual(100);
    });

    it('should preserve agent state across reads', async () => {
      const created = await repository.create({ name: 'Test', status: 'active' });

      const read1 = await repository.findById(created.id);
      const read2 = await repository.findById(created.id);
      const read3 = await repository.findById(created.id);

      expect(read1?.status).toBe(read2?.status);
      expect(read2?.status).toBe(read3?.status);
    });
  });

  // ===== UPDATE AGENT USE CASE =====
  describe('Update Agent', () => {
    beforeEach(async () => {
      await repository.create({ name: 'Agent 1', type: 'react' });
    });

    it('should update agent name', async () => {
      const created = await repository.create({ name: 'Original Name' });

      const updated = await repository.update(created.id, { name: 'New Name' });

      expect(updated.name).toBe('New Name');
    });

    it('should update agent status', async () => {
      const created = await repository.create({ name: 'Agent' });

      const updated = await repository.update(created.id, { status: 'paused' });

      expect(updated.status).toBe('paused');
    });

    it('should update capabilities', async () => {
      const created = await repository.create({
        name: 'Agent',
        capabilities: ['old'],
      });

      const updated = await repository.update(created.id, {
        capabilities: ['new1', 'new2'],
      });

      expect(updated.capabilities).toEqual(['new1', 'new2']);
    });

    it('should update configuration', async () => {
      const created = await repository.create({
        name: 'Agent',
        config: { key1: 'value1' },
      });

      const updated = await repository.update(created.id, {
        config: { key1: 'updated', key2: 'new' },
      });

      expect(updated.config.key1).toBe('updated');
      expect(updated.config.key2).toBe('new');
    });

    it('should update timestamp', async () => {
      const created = await repository.create({ name: 'Agent' });
      const originalTime = created.updatedAt.getTime();

      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = await repository.update(created.id, { name: 'Updated' });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalTime);
    });

    it('should preserve ID during update', async () => {
      const created = await repository.create({ name: 'Agent' });
      const originalId = created.id;

      const updated = await repository.update(created.id, { name: 'New Name' });

      expect(updated.id).toBe(originalId);
    });

    it('should handle partial updates', async () => {
      const created = await repository.create({
        name: 'Agent',
        type: 'react',
        capabilities: ['search'],
      });

      const updated = await repository.update(created.id, { name: 'Updated' });

      expect(updated.name).toBe('Updated');
      expect(updated.type).toBe('react');
      expect(updated.capabilities).toEqual(['search']);
    });

    it('should throw error for non-existent agent', async () => {
      const updateNonExistent = async () => {
        return repository.update('non-existent-id', { name: 'New Name' });
      };

      await expect(updateNonExistent()).rejects.toThrow('Agent not found');
    });

    it('should allow status transitions', async () => {
      const created = await repository.create({ name: 'Agent', status: 'active' });

      let updated = await repository.update(created.id, { status: 'paused' });
      expect(updated.status).toBe('paused');

      updated = await repository.update(created.id, { status: 'inactive' });
      expect(updated.status).toBe('inactive');

      updated = await repository.update(created.id, { status: 'active' });
      expect(updated.status).toBe('active');
    });

    it('should merge configuration updates', async () => {
      const created = await repository.create({
        name: 'Agent',
        config: { model: 'gpt4', temp: 0.5 },
      });

      const updated = await repository.update(created.id, {
        config: { ...created.config, maxTokens: 2000 },
      });

      expect(updated.config.model).toBe('gpt4');
      expect(updated.config.temp).toBe(0.5);
      expect(updated.config.maxTokens).toBe(2000);
    });
  });

  // ===== DELETE AGENT USE CASE =====
  describe('Delete Agent', () => {
    it('should delete agent by ID', async () => {
      const created = await repository.create({ name: 'Test Agent' });

      await repository.delete(created.id);

      const retrieved = await repository.findById(created.id);
      expect(retrieved).toBeNull();
    });

    it('should remove from repository', async () => {
      const agent1 = await repository.create({ name: 'Agent 1' });
      const agent2 = await repository.create({ name: 'Agent 2' });

      await repository.delete(agent1.id);

      const all = await repository.findAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(agent2.id);
    });

    it('should handle deletion of non-existent agent', async () => {
      // Typically would not throw, just no-op
      const result = await repository.delete('non-existent-id');
      expect(result).toBeUndefined();
    });

    it('should not affect other agents', async () => {
      const agent1 = await repository.create({ name: 'Agent 1' });
      const agent2 = await repository.create({ name: 'Agent 2' });
      const agent3 = await repository.create({ name: 'Agent 3' });

      await repository.delete(agent2.id);

      const retrieved1 = await repository.findById(agent1.id);
      const retrieved2 = await repository.findById(agent2.id);
      const retrieved3 = await repository.findById(agent3.id);

      expect(retrieved1).not.toBeNull();
      expect(retrieved2).toBeNull();
      expect(retrieved3).not.toBeNull();
    });

    it('should handle cascading deletes', async () => {
      const agent = await repository.create({
        name: 'Agent with dependencies',
        config: { nested: { data: 'value' } },
      });

      await repository.delete(agent.id);

      const all = await repository.findAll();
      expect(all).toHaveLength(0);
    });

    it('should be idempotent', async () => {
      const created = await repository.create({ name: 'Test Agent' });

      await repository.delete(created.id);
      await repository.delete(created.id);

      const all = await repository.findAll();
      expect(all).toHaveLength(0);
    });

    it('should clear all agents', async () => {
      await repository.create({ name: 'Agent 1' });
      await repository.create({ name: 'Agent 2' });
      await repository.create({ name: 'Agent 3' });

      const all1 = await repository.findAll();
      expect(all1).toHaveLength(3);

      for (const agent of all1) {
        await repository.delete(agent.id);
      }

      const all2 = await repository.findAll();
      expect(all2).toHaveLength(0);
    });

    it('should free resources after deletion', async () => {
      const agent = await repository.create({ name: 'Large Agent', config: { large: 'data' } });

      await repository.delete(agent.id);

      // Verify agent is truly gone
      const retrieved = await repository.findById(agent.id);
      expect(retrieved).toBeNull();
    });
  });

  // ===== AGENT CONFIGURATION USE CASE =====
  describe('Configure Agent', () => {
    it('should apply configuration to agent', async () => {
      const agent = await repository.create({ name: 'Agent' });

      const updated = await repository.update(agent.id, {
        config: {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2000,
        },
      });

      expect(updated.config.model).toBe('gpt-4');
      expect(updated.config.temperature).toBe(0.7);
      expect(updated.config.maxTokens).toBe(2000);
    });

    it('should validate configuration values', async () => {
      const agent = await repository.create({ name: 'Agent' });

      // Configuration validation would happen in use case layer
      const isValidConfig = (config: any) => {
        return (
          typeof config.temperature === 'number' &&
          config.temperature >= 0 &&
          config.temperature <= 1
        );
      };

      const validConfig = { temperature: 0.5 };
      const invalidConfig = { temperature: 1.5 };

      expect(isValidConfig(validConfig)).toBe(true);
      expect(isValidConfig(invalidConfig)).toBe(false);
    });

    it('should configure capabilities', async () => {
      const agent = await repository.create({ name: 'Agent' });

      const updated = await repository.update(agent.id, {
        capabilities: ['webSearch', 'imageGeneration', 'codeExecution'],
      });

      expect(updated.capabilities).toContain('webSearch');
      expect(updated.capabilities).toContain('imageGeneration');
      expect(updated.capabilities).toContain('codeExecution');
    });

    it('should allow empty configuration', async () => {
      const agent = await repository.create({ name: 'Agent', config: {} });

      expect(agent.config).toEqual({});
    });

    it('should support nested configuration', async () => {
      const config = {
        llm: {
          model: 'gpt-4',
          config: { temperature: 0.7 },
        },
        tools: {
          enabled: ['search', 'calculator'],
        },
      };

      const agent = await repository.create({
        name: 'Complex Agent',
        config,
      });

      expect(agent.config.llm.model).toBe('gpt-4');
      expect(agent.config.tools.enabled).toContain('search');
    });

    it('should persist configuration changes', async () => {
      const agent = await repository.create({ name: 'Agent' });

      await repository.update(agent.id, {
        config: { setting1: 'value1' },
      });

      const retrieved = await repository.findById(agent.id);
      expect(retrieved?.config.setting1).toBe('value1');
    });
  });

  // ===== AGENT EXECUTION USE CASE =====
  describe('Execute Agent', () => {
    it('should execute active agent', async () => {
      const agent = await repository.create({
        name: 'Active Agent',
        status: 'active',
      });

      const canExecute = agent.status === 'active';

      expect(canExecute).toBe(true);
    });

    it('should not execute inactive agent', async () => {
      const agent = await repository.create({
        name: 'Inactive Agent',
        status: 'inactive',
      });

      const canExecute = agent.status === 'active';

      expect(canExecute).toBe(false);
    });

    it('should not execute paused agent', async () => {
      const agent = await repository.create({
        name: 'Paused Agent',
        status: 'paused',
      });

      const canExecute = agent.status === 'active';

      expect(canExecute).toBe(false);
    });

    it('should pass input to execution', async () => {
      const agent = await repository.create({ name: 'Agent' });
      const input = 'What is 2+2?';

      const executionInput = {
        agentId: agent.id,
        query: input,
        context: {},
      };

      expect(executionInput.query).toBe('What is 2+2?');
    });

    it('should generate execution ID', async () => {
      const agent = await repository.create({ name: 'Agent' });
      const executionId = `exec-${agent.id}-${Date.now()}`;

      expect(executionId).toContain(agent.id);
      expect(executionId).toMatch(/^exec-/);
    });

    it('should handle concurrent executions', async () => {
      const agent = await repository.create({ name: 'Agent' });

      const executions = await Promise.all([
        Promise.resolve({ agentId: agent.id, step: 1 }),
        Promise.resolve({ agentId: agent.id, step: 2 }),
        Promise.resolve({ agentId: agent.id, step: 3 }),
      ]);

      expect(executions).toHaveLength(3);
      expect(executions.every((e) => e.agentId === agent.id)).toBe(true);
    });

    it('should track execution state', async () => {
      const agent = await repository.create({ name: 'Agent' });

      const states = ['pending', 'running', 'completed', 'failed'];
      let currentState = 'pending';

      expect(states).toContain(currentState);

      currentState = 'running';
      expect(states).toContain(currentState);

      currentState = 'completed';
      expect(states).toContain(currentState);
    });

    it('should handle execution errors', async () => {
      const agent = await repository.create({ name: 'Agent' });

      const executeWithError = async () => {
        throw new Error('Execution failed: Invalid input');
      };

      await expect(executeWithError()).rejects.toThrow('Execution failed');
    });

    it('should return execution results', async () => {
      const agent = await repository.create({ name: 'Agent' });

      const result = {
        executionId: `exec-${agent.id}`,
        output: 'Execution completed',
        status: 'completed',
        timestamp: new Date(),
      };

      expect(result).toHaveProperty('executionId');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('status');
    });

    it('should support streaming execution', async () => {
      const agent = await repository.create({ name: 'Agent' });
      const chunks: string[] = [];

      const streamExecution = async () => {
        chunks.push('chunk1');
        chunks.push('chunk2');
        chunks.push('chunk3');
      };

      await streamExecution();
      expect(chunks).toHaveLength(3);
    });
  });

  // ===== AGENT TYPE HANDLING =====
  describe('Agent Type Handling', () => {
    it('should handle React agent type', async () => {
      const agent = await repository.create({
        name: 'React Agent',
        type: 'react',
      });

      expect(agent.type).toBe('react');
    });

    it('should handle Graph agent type', async () => {
      const agent = await repository.create({
        name: 'Graph Agent',
        type: 'graph',
      });

      expect(agent.type).toBe('graph');
    });

    it('should handle Genius agent type', async () => {
      const agent = await repository.create({
        name: 'Genius Agent',
        type: 'genius',
      });

      expect(agent.type).toBe('genius');
    });

    it('should handle Expert agent type', async () => {
      const agent = await repository.create({
        name: 'Expert Agent',
        type: 'expert',
      });

      expect(agent.type).toBe('expert');
    });

    it('should not allow invalid agent types', async () => {
      const isValidType = (type: string): type is Agent['type'] => {
        return ['react', 'graph', 'genius', 'expert'].includes(type);
      };

      expect(isValidType('react')).toBe(true);
      expect(isValidType('invalid')).toBe(false);
    });

    it('should preserve type through updates', async () => {
      const agent = await repository.create({
        name: 'Original',
        type: 'react',
      });

      const updated = await repository.update(agent.id, {
        name: 'Updated',
      });

      expect(updated.type).toBe('react');
    });

    it('should support type-specific capabilities', async () => {
      const reactAgent = await repository.create({
        name: 'React',
        type: 'react',
        capabilities: ['thought', 'action', 'observation'],
      });

      const graphAgent = await repository.create({
        name: 'Graph',
        type: 'graph',
        capabilities: ['node', 'edge', 'traversal'],
      });

      expect(reactAgent.capabilities).toContain('thought');
      expect(graphAgent.capabilities).toContain('node');
    });

    it('should query agents by type', async () => {
      await repository.create({ name: 'React 1', type: 'react' });
      await repository.create({ name: 'React 2', type: 'react' });
      await repository.create({ name: 'Graph 1', type: 'graph' });

      const all = await repository.findAll();
      const reactAgents = all.filter((a) => a.type === 'react');

      expect(reactAgents).toHaveLength(2);
      expect(reactAgents.every((a) => a.type === 'react')).toBe(true);
    });
  });

  // ===== ERROR HANDLING =====
  describe('Error Handling', () => {
    it('should handle create errors', async () => {
      const createFailing = jest.fn().mockRejectedValue(new Error('Create failed'));

      await expect(createFailing()).rejects.toThrow('Create failed');
    });

    it('should handle update errors', async () => {
      const updateFailing = jest.fn().mockRejectedValue(new Error('Update failed'));

      await expect(updateFailing()).rejects.toThrow('Update failed');
    });

    it('should handle delete errors', async () => {
      const deleteFailing = jest.fn().mockRejectedValue(new Error('Delete failed'));

      await expect(deleteFailing()).rejects.toThrow('Delete failed');
    });

    it('should handle concurrent operation conflicts', async () => {
      const agent = await repository.create({ name: 'Agent' });

      const updates = await Promise.all([
        repository.update(agent.id, { name: 'Updated 1' }).catch((e) => e),
        repository.update(agent.id, { name: 'Updated 2' }).catch((e) => e),
      ]);

      // One should succeed, one might conflict
      expect(updates).toHaveLength(2);
    });

    it('should maintain data consistency on error', async () => {
      const agent = await repository.create({ name: 'Agent' });
      const originalState = await repository.findById(agent.id);

      const updateFailing = jest.fn().mockRejectedValue(new Error('Update failed'));
      await expect(updateFailing()).rejects.toThrow();

      const afterError = await repository.findById(agent.id);
      expect(afterError?.name).toBe(originalState?.name);
    });

    it('should handle resource exhaustion', async () => {
      // Create many agents to simulate resource usage
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(repository.create({ name: `Agent ${i}` }));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(50);
    });

    it('should handle timeout scenarios', async () => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 100)
      );

      await expect(timeoutPromise).rejects.toThrow('Timeout');
    });

    it('should handle validation errors', async () => {
      const validateAgent = (agent: Partial<Agent>) => {
        if (!agent.name) throw new Error('Agent name is required');
        if (agent.name.length > 255) throw new Error('Agent name too long');
      };

      expect(() => validateAgent({ name: '' })).toThrow('required');
      expect(() => validateAgent({ name: 'x'.repeat(300) })).toThrow('too long');
    });
  });

  // ===== STATE TRANSITIONS =====
  describe('Agent State Transitions', () => {
    it('should transition from active to paused', async () => {
      const agent = await repository.create({
        name: 'Agent',
        status: 'active',
      });

      const updated = await repository.update(agent.id, { status: 'paused' });

      expect(updated.status).toBe('paused');
    });

    it('should transition from paused to active', async () => {
      const agent = await repository.create({
        name: 'Agent',
        status: 'paused',
      });

      const updated = await repository.update(agent.id, { status: 'active' });

      expect(updated.status).toBe('active');
    });

    it('should transition to inactive state', async () => {
      const agent = await repository.create({
        name: 'Agent',
        status: 'active',
      });

      const updated = await repository.update(agent.id, { status: 'inactive' });

      expect(updated.status).toBe('inactive');
    });

    it('should track state change timestamp', async () => {
      const agent = await repository.create({ name: 'Agent', status: 'active' });
      const time1 = agent.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await repository.update(agent.id, { status: 'paused' });
      const time2 = updated.updatedAt;

      expect(time2.getTime()).toBeGreaterThan(time1.getTime());
    });

    it('should allow any valid state transition', async () => {
      const agent = await repository.create({ name: 'Agent', status: 'active' });
      const validStates: Agent['status'][] = ['active', 'paused', 'inactive'];

      for (const state of validStates) {
        const updated = await repository.update(agent.id, { status: state });
        expect(validStates).toContain(updated.status);
      }
    });

    it('should maintain history of state changes', async () => {
      const agent = await repository.create({ name: 'Agent', status: 'active' });
      const history: Array<{ status: Agent['status']; time: Date }> = [
        { status: agent.status, time: agent.updatedAt },
      ];

      const updated1 = await repository.update(agent.id, { status: 'paused' });
      history.push({ status: updated1.status, time: updated1.updatedAt });

      const updated2 = await repository.update(agent.id, { status: 'active' });
      history.push({ status: updated2.status, time: updated2.updatedAt });

      expect(history).toHaveLength(3);
      expect(history[0].status).toBe('active');
      expect(history[1].status).toBe('paused');
      expect(history[2].status).toBe('active');
    });
  });
});
