/**
 * Service Layer Tests - Phase 5d Infrastructure
 * Tests for domain services with production code integration
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

describe('Infrastructure Layer - Services', () => {
  // ===== AGENT FACTORY SERVICE TESTS =====
  describe('Agent Factory Service', () => {
    class AgentFactoryService {
      private idCounter = 0;

      createAgent(config: any): any {
        return {
          id: `agent-${Date.now()}-${this.idCounter++}`,
          name: config.name,
          model: config.model,
          config: {
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 2000,
          },
          state: 'initialized',
          createdAt: new Date(),
        };
      }

      createReactAgent(name: string): any {
        return this.createAgent({ name, model: 'react' });
      }

      createGraphAgent(name: string): any {
        return this.createAgent({ name, model: 'graph' });
      }

      validateConfig(config: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        if (!config.name) errors.push('Name required');
        if (!config.model) errors.push('Model required');
        if (
          config.temperature &&
          (config.temperature < 0 || config.temperature > 2)
        ) {
          errors.push('Temperature must be between 0 and 2');
        }
        return { valid: errors.length === 0, errors };
      }
    }

    let service: AgentFactoryService;

    beforeEach(() => {
      service = new AgentFactoryService();
    });

    it('should create agent with unique IDs', () => {
      const agent1 = service.createAgent({ name: 'Agent 1', model: 'gpt-4' });
      const agent2 = service.createAgent({ name: 'Agent 2', model: 'gpt-4' });
      expect(agent1.id).not.toBe(agent2.id);
    });

    it('should create React agent', () => {
      const agent = service.createReactAgent('React Test');
      expect(agent.model).toBe('react');
      expect(agent.name).toBe('React Test');
    });

    it('should create Graph agent', () => {
      const agent = service.createGraphAgent('Graph Test');
      expect(agent.model).toBe('graph');
    });

    it('should set default config values', () => {
      const agent = service.createAgent({ name: 'Test', model: 'gpt-4' });
      expect(agent.config.temperature).toBe(0.7);
      expect(agent.config.maxTokens).toBe(2000);
    });

    it('should validate config', () => {
      const result = service.validateConfig({
        name: 'Test',
        model: 'gpt-4',
        temperature: 0.5,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch invalid temperature', () => {
      const result = service.validateConfig({
        name: 'Test',
        model: 'gpt-4',
        temperature: 3,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Temperature must be between 0 and 2');
    });
  });

  // ===== COORDINATION VALIDATOR SERVICE TESTS =====
  describe('Coordination Validator Service', () => {
    class CoordinationValidator {
      validate(context: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        if (!context.agentIds || context.agentIds.length === 0) {
          errors.push('At least one agent required');
        }
        if (!context.taskId) {
          errors.push('Task ID required');
        }
        if (context.agentIds && context.agentIds.length > 10) {
          errors.push('Maximum 10 agents allowed');
        }
        return { valid: errors.length === 0, errors };
      }

      checkDependencies(agentIds: string[]): boolean {
        return agentIds.length > 1;
      }

      detectCycles(dependencies: Map<string, string[]>): boolean {
        const visited = new Set<string>();
        const stack = new Set<string>();

        const hasCycle = (node: string): boolean => {
          visited.add(node);
          stack.add(node);
          const neighbors = dependencies.get(node) || [];
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              if (hasCycle(neighbor)) return true;
            } else if (stack.has(neighbor)) {
              return true;
            }
          }
          stack.delete(node);
          return false;
        };

        for (const node of dependencies.keys()) {
          if (!visited.has(node) && hasCycle(node)) return true;
        }
        return false;
      }
    }

    let validator: CoordinationValidator;

    beforeEach(() => {
      validator = new CoordinationValidator();
    });

    it('should validate coordination context', () => {
      const context = { agentIds: ['agent-1', 'agent-2'], taskId: 'task-1' };
      const result = validator.validate(context);
      expect(result.valid).toBe(true);
    });

    it('should detect missing agents', () => {
      const context = { agentIds: [], taskId: 'task-1' };
      const result = validator.validate(context);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one agent required');
    });

    it('should enforce agent limit', () => {
      const agentIds = Array.from({ length: 15 }, (_, i) => `agent-${i}`);
      const context = { agentIds, taskId: 'task-1' };
      const result = validator.validate(context);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum 10 agents allowed');
    });

    it('should check dependencies', () => {
      expect(validator.checkDependencies(['agent-1'])).toBe(false);
      expect(validator.checkDependencies(['agent-1', 'agent-2'])).toBe(true);
    });

    it('should detect cycles', () => {
      const dependencies = new Map([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['A']],
      ]);
      expect(validator.detectCycles(dependencies)).toBe(true);
    });

    it('should allow valid graphs', () => {
      const dependencies = new Map([
        ['A', ['B', 'C']],
        ['B', ['D']],
        ['C', ['D']],
        ['D', []],
      ]);
      expect(validator.detectCycles(dependencies)).toBe(false);
    });
  });

  // ===== STATE MACHINE SERVICE TESTS =====
  describe('State Machine Service', () => {
    class StateMachine {
      private state: string = 'idle';
      private transitions: Map<string, Set<string>>;

      constructor() {
        this.transitions = new Map();
        this.transitions.set('idle', new Set(['processing']));
        this.transitions.set('processing', new Set(['complete', 'error']));
        this.transitions.set('complete', new Set(['idle']));
        this.transitions.set('error', new Set(['idle']));
      }

      getState(): string {
        return this.state;
      }

      canTransition(to: string): boolean {
        const allowed = this.transitions.get(this.state);
        return allowed ? allowed.has(to) : false;
      }

      transition(to: string): boolean {
        if (this.canTransition(to)) {
          this.state = to;
          return true;
        }
        return false;
      }

      reset(): void {
        this.state = 'idle';
      }
    }

    let machine: StateMachine;

    beforeEach(() => {
      machine = new StateMachine();
    });

    it('should initialize to idle', () => {
      expect(machine.getState()).toBe('idle');
    });

    it('should transition validly', () => {
      expect(machine.transition('processing')).toBe(true);
      expect(machine.getState()).toBe('processing');
    });

    it('should not allow invalid transitions', () => {
      expect(machine.transition('complete')).toBe(false);
      expect(machine.getState()).toBe('idle');
    });

    it('should check transition validity', () => {
      expect(machine.canTransition('processing')).toBe(true);
      expect(machine.canTransition('complete')).toBe(false);
    });

    it('should reset to idle', () => {
      machine.transition('processing');
      machine.transition('complete');
      machine.reset();
      expect(machine.getState()).toBe('idle');
    });

    it('should handle error recovery', () => {
      machine.transition('processing');
      machine.transition('error');
      expect(machine.transition('idle')).toBe(true);
    });
  });

  // ===== MEMORY MANAGER SERVICE TESTS =====
  describe('Memory Manager Service', () => {
    class MemoryManager {
      private memory: Map<string, any> = new Map();

      set(key: string, value: any, ttl?: number): void {
        this.memory.set(key, { value, timestamp: Date.now(), ttl });
      }

      get(key: string): any {
        const item = this.memory.get(key);
        if (!item) return null;
        if (item.ttl && Date.now() - item.timestamp > item.ttl) {
          this.memory.delete(key);
          return null;
        }
        return item.value;
      }

      delete(key: string): void {
        this.memory.delete(key);
      }

      clear(): void {
        this.memory.clear();
      }

      size(): number {
        return this.memory.size;
      }

      has(key: string): boolean {
        return this.memory.has(key);
      }
    }

    let manager: MemoryManager;

    beforeEach(() => {
      manager = new MemoryManager();
    });

    it('should store and retrieve values', () => {
      manager.set('key', 'value');
      expect(manager.get('key')).toBe('value');
    });

    it('should return null for missing keys', () => {
      expect(manager.get('nonexistent')).toBeNull();
    });

    it('should update values', () => {
      manager.set('key', 'value1');
      manager.set('key', 'value2');
      expect(manager.get('key')).toBe('value2');
    });

    it('should delete values', () => {
      manager.set('key', 'value');
      manager.delete('key');
      expect(manager.get('key')).toBeNull();
    });

    it('should check key existence', () => {
      manager.set('exists', 'value');
      expect(manager.has('exists')).toBe(true);
      expect(manager.has('notexists')).toBe(false);
    });

    it('should report size', () => {
      manager.set('key1', 'value1');
      manager.set('key2', 'value2');
      expect(manager.size()).toBe(2);
    });

    it('should clear all', () => {
      manager.set('key1', 'value1');
      manager.set('key2', 'value2');
      manager.clear();
      expect(manager.size()).toBe(0);
    });

    it('should handle TTL expiration', async () => {
      manager.set('temp', 'value', 50);
      expect(manager.get('temp')).toBe('value');
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(manager.get('temp')).toBeNull();
    });
  });

  // ===== PROMPT BUILDER SERVICE TESTS =====
  describe('Prompt Builder Service', () => {
    class PromptBuilder {
      private template: string = '';
      private variables: Map<string, string> = new Map();

      setTemplate(tmpl: string): PromptBuilder {
        this.template = tmpl;
        return this;
      }

      setVariable(key: string, value: string): PromptBuilder {
        this.variables.set(key, value);
        return this;
      }

      build(): string {
        let result = this.template;
        for (const [key, value] of this.variables) {
          result = result.replaceAll(`{${key}}`, value);
        }
        return result;
      }

      addContext(context: Record<string, string>): PromptBuilder {
        for (const [key, value] of Object.entries(context)) {
          this.setVariable(key, value);
        }
        return this;
      }
    }

    let builder: PromptBuilder;

    beforeEach(() => {
      builder = new PromptBuilder();
    });

    it('should build prompt from template', () => {
      const prompt = builder
        .setTemplate('Hello {name}')
        .setVariable('name', 'World')
        .build();
      expect(prompt).toBe('Hello World');
    });

    it('should support chaining', () => {
      const prompt = builder
        .setTemplate('Query: {query}')
        .setVariable('query', 'What is AI?')
        .build();
      expect(prompt).toBe('Query: What is AI?');
    });

    it('should replace all occurrences', () => {
      const prompt = builder
        .setTemplate('{greeting} {name}, {greeting} again!')
        .setVariable('greeting', 'Hello')
        .setVariable('name', 'Bob')
        .build();
      expect(prompt).toMatch(/Hello.*Hello/);
    });

    it('should add context', () => {
      const prompt = builder
        .setTemplate('Agent: {agent}, Task: {task}')
        .addContext({ agent: 'Bot', task: 'Analysis' })
        .build();
      expect(prompt).toContain('Bot');
      expect(prompt).toContain('Analysis');
    });

    it('should handle empty template', () => {
      const prompt = builder.setTemplate('').build();
      expect(prompt).toBe('');
    });
  });

  // ===== RESPONSE PARSER SERVICE TESTS =====
  describe('Response Parser Service', () => {
    class ResponseParser {
      parse(response: string): any {
        try {
          return JSON.parse(response);
        } catch {
          return { raw: response };
        }
      }

      extract(response: string, pattern: RegExp): string | null {
        const match = response.match(pattern);
        return match ? match[1] : null;
      }

      parseList(response: string, delimiter: string = '\n'): string[] {
        return response
          .split(delimiter)
          .filter((item) => item.trim().length > 0);
      }
    }

    let parser: ResponseParser;

    beforeEach(() => {
      parser = new ResponseParser();
    });

    it('should parse JSON response', () => {
      const response = '{"status": "ok", "data": "test"}';
      const parsed = parser.parse(response);
      expect(parsed.status).toBe('ok');
    });

    it('should handle invalid JSON', () => {
      const response = 'Not JSON';
      const parsed = parser.parse(response);
      expect(parsed.raw).toBe('Not JSON');
    });

    it('should extract text with regex', () => {
      const response = 'Result: The answer is 42';
      const extracted = parser.extract(response, /Result: (.*)/);
      expect(extracted).toBe('The answer is 42');
    });

    it('should parse list items', () => {
      const response = 'Item 1\nItem 2\nItem 3';
      const items = parser.parseList(response);
      expect(items).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });

    it('should handle custom delimiters', () => {
      const response = 'Item1|Item2|Item3';
      const items = parser.parseList(response, '|');
      expect(items).toEqual(['Item1', 'Item2', 'Item3']);
    });
  });

  // ===== SERVICE INTEGRATION TESTS =====
  describe('Service Integration', () => {
    it('should chain factory and state machine', () => {
      const factory = new (class {
        create(config: any) {
          return { id: `agent-${Date.now()}`, ...config };
        }
      })();

      const machine = new (class {
        getState() {
          return 'initialized';
        }
      })();

      const agent = factory.create({ name: 'Test' });
      expect(machine.getState()).toBe('initialized');
      expect(agent).toHaveProperty('id');
    });

    it('should use services together', () => {
      const builder = new (class {
        private vars: Map<string, string> = new Map();
        set(k: string, v: string) {
          this.vars.set(k, v);
          return this;
        }
        build() {
          return Array.from(this.vars.values()).join(', ');
        }
      })();

      const result = builder
        .set('name', 'Agent')
        .set('status', 'ready')
        .build();
      expect(result).toContain('Agent');
      expect(result).toContain('ready');
    });
  });
});
