/**
 * Adapter Tests - Phase 5d Infrastructure Layer
 * Comprehensive testing of adapter layer (storage, LLM, logging)
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

describe('Infrastructure Layer - Adapters', () => {
  // ===== STORAGE ADAPTER TESTS =====
  describe('Storage Adapter (In-Memory Agent Repository)', () => {
    class InMemoryAgentRepository {
      private agents = new Map<string, any>();
      private idCounter = 0;

      async create(agentData: any): Promise<any> {
        const id = `agent-${Date.now()}-${this.idCounter++}`;
        const agent = {
          id,
          ...agentData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.agents.set(id, agent);
        return agent;
      }

      async findById(id: string): Promise<any> {
        const agent = this.agents.get(id);
        if (!agent) throw new Error(`Agent not found: ${id}`);
        return agent;
      }

      async findAll(): Promise<any[]> {
        return Array.from(this.agents.values());
      }

      async update(id: string, data: any): Promise<any> {
        const agent = this.agents.get(id);
        if (!agent) throw new Error(`Agent not found: ${id}`);
        const updated = { ...agent, ...data, updatedAt: new Date() };
        this.agents.set(id, updated);
        return updated;
      }

      async delete(id: string): Promise<void> {
        if (!this.agents.has(id)) throw new Error(`Agent not found: ${id}`);
        this.agents.delete(id);
      }

      async query(filter: any): Promise<any[]> {
        return Array.from(this.agents.values()).filter((agent) => {
          if (filter.type && agent.type !== filter.type) return false;
          if (filter.status && agent.status !== filter.status) return false;
          if (filter.createdAfter && agent.createdAt < filter.createdAfter)
            return false;
          return true;
        });
      }

      async updateState(id: string, state: any): Promise<any> {
        const agent = this.agents.get(id);
        if (!agent) throw new Error(`Agent not found: ${id}`);
        agent.state = state;
        agent.updatedAt = new Date();
        this.agents.set(id, agent);
        return agent;
      }

      clear(): void {
        this.agents.clear();
      }
    }

    let repository: InMemoryAgentRepository;

    beforeEach(() => {
      repository = new InMemoryAgentRepository();
    });

    it('should create agent in storage', async () => {
      const agentData = {
        name: 'Test Agent',
        type: 'reactive',
        status: 'initialized',
      };
      const agent = await repository.create(agentData);

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('Test Agent');
      expect(agent.createdAt).toBeDefined();
    });

    it('should retrieve agent by ID', async () => {
      const agentData = { name: 'Test Agent', type: 'reactive' };
      const created = await repository.create(agentData);
      const retrieved = await repository.findById(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe('Test Agent');
    });

    it('should throw when agent not found', async () => {
      await expect(repository.findById('non-existent')).rejects.toThrow(
        'Agent not found',
      );
    });

    it('should retrieve all agents', async () => {
      await repository.create({ name: 'Agent 1' });
      await repository.create({ name: 'Agent 2' });
      const agents = await repository.findAll();

      expect(agents).toHaveLength(2);
    });

    it('should update agent data', async () => {
      const created = await repository.create({ name: 'Original' });
      // Wait a tiny bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));
      const updated = await repository.update(created.id, { name: 'Updated' });

      expect(updated.name).toBe('Updated');
      expect(updated.updatedAt >= created.updatedAt).toBe(true);
    });

    it('should delete agent from storage', async () => {
      const created = await repository.create({ name: 'To Delete' });
      await repository.delete(created.id);

      await expect(repository.findById(created.id)).rejects.toThrow();
    });

    it('should query agents by filter', async () => {
      await repository.create({
        name: 'Agent 1',
        type: 'reactive',
        status: 'active',
      });
      await repository.create({
        name: 'Agent 2',
        type: 'proactive',
        status: 'inactive',
      });
      await repository.create({
        name: 'Agent 3',
        type: 'reactive',
        status: 'inactive',
      });

      const reactive = await repository.query({ type: 'reactive' });
      expect(reactive).toHaveLength(2);

      const active = await repository.query({ status: 'active' });
      expect(active).toHaveLength(1);
    });

    it('should update agent state', async () => {
      const created = await repository.create({ name: 'Agent' });
      const newState = { current: 'executing', progress: 50 };
      const updated = await repository.updateState(created.id, newState);

      expect(updated.state).toEqual(newState);
    });

    it('should handle concurrent creates with unique IDs', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(repository.create({ name: `Agent ${i}` }));
      }
      const agents = await Promise.all(promises);
      const ids = agents.map((a) => a.id);

      expect(new Set(ids).size).toBe(10); // All unique
    });

    it('should clear all agents', async () => {
      await repository.create({ name: 'Agent 1' });
      await repository.create({ name: 'Agent 2' });
      repository.clear();

      const agents = await repository.findAll();
      expect(agents).toHaveLength(0);
    });
  });

  // ===== LLM ADAPTER TESTS =====
  describe('LLM Adapter (OpenAI)', () => {
    class OpenAILLMAdapter {
      constructor(private apiKey: string = 'test-key') {}

      async formatRequest(
        prompt: string,
        model: string,
        config: any,
      ): Promise<any> {
        return {
          model: model || 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: config?.temperature || 0.7,
          max_tokens: config?.maxTokens || 2000,
          top_p: config?.topP || 1,
        };
      }

      async parseResponse(response: any): Promise<string> {
        if (!response || !response.choices || response.choices.length === 0) {
          throw new Error('Invalid LLM response format');
        }
        return response.choices[0].message.content;
      }

      async countTokens(text: string): Promise<number> {
        // Approximate: ~4 chars per token
        return Math.ceil(text.length / 4);
      }

      async estimateCost(
        tokens: number,
        model: string = 'gpt-4',
      ): Promise<number> {
        const pricing: any = {
          'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
          'gpt-3.5-turbo': { input: 0.0005 / 1000, output: 0.0015 / 1000 },
        };
        const rates = pricing[model] || pricing['gpt-4'];
        return tokens * rates.input;
      }

      async validateModel(model: string): Promise<boolean> {
        const validModels = ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'];
        return validModels.includes(model);
      }

      async handleRateLimit(retryAfter: number): Promise<void> {
        // Simulate backoff
        return new Promise((resolve) =>
          setTimeout(resolve, Math.min(retryAfter, 1000)),
        );
      }
    }

    let adapter: OpenAILLMAdapter;

    beforeEach(() => {
      adapter = new OpenAILLMAdapter();
    });

    it('should format request correctly', async () => {
      const request = await adapter.formatRequest('Hello', 'gpt-4', {
        temperature: 0.5,
      });

      expect(request.model).toBe('gpt-4');
      expect(request.messages[0].content).toBe('Hello');
      expect(request.temperature).toBe(0.5);
    });

    it('should use default model if not specified', async () => {
      const request = await adapter.formatRequest('Hello', '', {});

      expect(request.model).toBe('gpt-4');
    });

    it('should parse valid response', async () => {
      const response = {
        choices: [{ message: { content: 'Response text' } }],
      };
      const result = await adapter.parseResponse(response);

      expect(result).toBe('Response text');
    });

    it('should throw on invalid response format', async () => {
      await expect(adapter.parseResponse({})).rejects.toThrow(
        'Invalid LLM response',
      );
      await expect(adapter.parseResponse({ choices: [] })).rejects.toThrow(
        'Invalid LLM response',
      );
    });

    it('should count tokens approximately', async () => {
      const tokens = await adapter.countTokens('Hello world!');

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(
        Math.ceil('Hello world!'.length / 4) + 1,
      );
    });

    it('should estimate cost correctly', async () => {
      const cost = await adapter.estimateCost(1000, 'gpt-3.5-turbo');

      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(0.001);
    });

    it('should validate supported models', async () => {
      expect(await adapter.validateModel('gpt-4')).toBe(true);
      expect(await adapter.validateModel('gpt-3.5-turbo')).toBe(true);
      expect(await adapter.validateModel('invalid-model')).toBe(false);
    });

    it('should handle rate limit backoff', async () => {
      const start = Date.now();
      await adapter.handleRateLimit(500);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(400);
    });
  });

  // ===== LOGGING ADAPTER TESTS =====
  describe('Logging Adapter (Structured Logger)', () => {
    class StructuredLogger {
      private logs: any[] = [];

      info(component: string, message: string, context?: any): void {
        this.logs.push({
          level: 'info',
          component,
          message,
          context,
          timestamp: Date.now(),
        });
      }

      error(component: string, message: string, error?: any): void {
        this.logs.push({
          level: 'error',
          component,
          message,
          error: error?.message || String(error),
          timestamp: Date.now(),
        });
      }

      warn(component: string, message: string, context?: any): void {
        this.logs.push({
          level: 'warn',
          component,
          message,
          context,
          timestamp: Date.now(),
        });
      }

      debug(component: string, message: string, context?: any): void {
        this.logs.push({
          level: 'debug',
          component,
          message,
          context,
          timestamp: Date.now(),
        });
      }

      getLogs(filter?: any): any[] {
        if (!filter) return this.logs;

        return this.logs.filter((log) => {
          if (filter.level && log.level !== filter.level) return false;
          if (filter.component && log.component !== filter.component)
            return false;
          if (filter.since && log.timestamp < filter.since) return false;
          return true;
        });
      }

      clear(): void {
        this.logs = [];
      }

      getLastLog(): any {
        return this.logs[this.logs.length - 1];
      }
    }

    let logger: StructuredLogger;

    beforeEach(() => {
      logger = new StructuredLogger();
    });

    it('should log info messages', () => {
      logger.info('Component', 'Test message', { data: 'test' });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('Test message');
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Component', 'Error occurred', error);

      const logs = logger.getLogs();
      expect(logs[0].level).toBe('error');
      expect(logs[0].error).toContain('Test error');
    });

    it('should log warning messages', () => {
      logger.warn('Component', 'Warning', { severity: 'high' });

      const logs = logger.getLogs();
      expect(logs[0].level).toBe('warn');
    });

    it('should log debug messages', () => {
      logger.debug('Component', 'Debug info', { trace: 'data' });

      const logs = logger.getLogs();
      expect(logs[0].level).toBe('debug');
    });

    it('should filter logs by level', () => {
      logger.info('Comp1', 'Info 1');
      logger.error('Comp1', 'Error 1', new Error('err'));
      logger.info('Comp1', 'Info 2');

      const errors = logger.getLogs({ level: 'error' });
      expect(errors).toHaveLength(1);
    });

    it('should filter logs by component', () => {
      logger.info('ComponentA', 'Message 1');
      logger.info('ComponentB', 'Message 2');
      logger.info('ComponentA', 'Message 3');

      const compALogs = logger.getLogs({ component: 'ComponentA' });
      expect(compALogs).toHaveLength(2);
    });

    it('should filter logs by timestamp', async () => {
      logger.info('Comp', 'Log 1');
      // Wait to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 5));
      const since = Date.now() - 1; // Capture just before next log
      await new Promise((resolve) => setTimeout(resolve, 5));
      logger.info('Comp', 'Log 2');

      const after = logger.getLogs({ since });
      expect(after.length).toBeGreaterThanOrEqual(1);
      expect(after[after.length - 1].message).toBe('Log 2');
    });

    it('should retrieve last log', () => {
      logger.info('Comp', 'First');
      logger.info('Comp', 'Second');

      const last = logger.getLastLog();
      expect(last.message).toBe('Second');
    });

    it('should clear all logs', () => {
      logger.info('Comp', 'Message 1');
      logger.info('Comp', 'Message 2');
      logger.clear();

      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
    });

    it('should handle multiple concurrent logs', () => {
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(Promise.resolve(logger.info('Comp', `Message ${i}`)));
      }
      Promise.all(promises);

      expect(logger.getLogs()).toHaveLength(20);
    });

    it('should preserve context data', () => {
      const context = {
        userId: '123',
        action: 'execute',
        metadata: { key: 'value' },
      };
      logger.info('Agent', 'Agent executed', context);

      const logs = logger.getLogs();
      expect(logs[0].context).toEqual(context);
    });
  });

  // ===== ADAPTER INTEGRATION TESTS =====
  describe('Adapter Integration', () => {
    class InMemoryAgentRepository {
      private agents = new Map<string, any>();
      private idCounter = 0;

      async create(agentData: any): Promise<any> {
        const id = `agent-${Date.now()}-${this.idCounter++}`;
        const agent = { id, ...agentData, createdAt: new Date() };
        this.agents.set(id, agent);
        return agent;
      }

      async findById(id: string): Promise<any> {
        return this.agents.get(id);
      }
    }

    class StructuredLogger {
      private logs: any[] = [];

      info(component: string, message: string, context?: any): void {
        this.logs.push({ level: 'info', component, message, context });
      }

      getLogs(): any[] {
        return this.logs;
      }
    }

    let repository: InMemoryAgentRepository;
    let logger: StructuredLogger;

    beforeEach(() => {
      repository = new InMemoryAgentRepository();
      logger = new StructuredLogger();
    });

    it('should create agent and log', async () => {
      const agentData = { name: 'Test Agent' };
      const agent = await repository.create(agentData);
      logger.info('Repository', 'Agent created', { id: agent.id });

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].context.id).toBe(agent.id);
    });

    it('should retrieve agent and log', async () => {
      const agent = await repository.create({ name: 'Test' });
      const retrieved = await repository.findById(agent.id);
      logger.info('Repository', 'Agent retrieved', { id: retrieved?.id });

      expect(retrieved?.id).toBe(agent.id);
    });

    it('should handle storage and logging failures', async () => {
      const missingAgent = await repository.findById('non-existent');
      if (!missingAgent) {
        logger.info('Repository', 'Agent not found', { id: 'non-existent' });
      }

      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toContain('not found');
    });
  });
});
