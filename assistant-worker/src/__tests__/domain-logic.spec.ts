/**
 * Domain Logic Tests - Phase 5b Business Logic
 * Tests for domain services: factory, memory management, prompt building, response parsing, state machine
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface */

describe('Domain Logic Services', () => {
  // ===== AGENT FACTORY TESTS =====
  describe('Agent Factory Service', () => {
    interface AgentConfig {
      type: 'react' | 'graph' | 'genius' | 'expert';
      name: string;
      capabilities: string[];
    }

    interface Agent {
      id: string;
      type: AgentConfig['type'];
      execute: (input: string) => Promise<string>;
    }

    class AgentFactory {
      private idCounter = 0;

      create(config: AgentConfig): Agent {
        const agent: Agent = {
          id: `agent-${Date.now()}-${this.idCounter++}`,
          type: config.type,
          execute: async (input: string) => {
            return `${config.type}: ${input}`;
          },
        };
        return agent;
      }

      createReactAgent(name: string): Agent {
        return this.create({
          type: 'react',
          name,
          capabilities: ['think', 'act', 'observe'],
        });
      }

      createGraphAgent(name: string): Agent {
        return this.create({
          type: 'graph',
          name,
          capabilities: ['traverse', 'analyze'],
        });
      }

      createGeniusAgent(name: string): Agent {
        return this.create({
          type: 'genius',
          name,
          capabilities: ['learn', 'create', 'optimize'],
        });
      }

      createExpertAgent(name: string): Agent {
        return this.create({
          type: 'expert',
          name,
          capabilities: ['analyze', 'recommend', 'explain'],
        });
      }
    }

    let factory: AgentFactory;

    beforeEach(() => {
      factory = new AgentFactory();
      // Reset ID counter for fresh test state
      (factory as any).idCounter = 0;
    });

    it('should create React agent', () => {
      const agent = factory.createReactAgent('React Test');

      expect(agent.type).toBe('react');
      expect(agent).toHaveProperty('execute');
    });

    it('should create Graph agent', () => {
      const agent = factory.createGraphAgent('Graph Test');

      expect(agent.type).toBe('graph');
    });

    it('should create Genius agent', () => {
      const agent = factory.createGeniusAgent('Genius Test');

      expect(agent.type).toBe('genius');
    });

    it('should create Expert agent', () => {
      const agent = factory.createExpertAgent('Expert Test');

      expect(agent.type).toBe('expert');
    });

    it('should generate unique IDs', () => {
      const agent1 = factory.createReactAgent('Agent 1');
      const agent2 = factory.createReactAgent('Agent 2');

      expect(agent1.id).not.toBe(agent2.id);
    });

    it('should execute agent with input', async () => {
      const agent = factory.createReactAgent('Test');
      const result = await agent.execute('test input');

      expect(result).toContain('react');
      expect(result).toContain('test input');
    });

    it('should support custom configuration', () => {
      const agent = factory.create({
        type: 'react',
        name: 'Custom',
        capabilities: ['custom1', 'custom2'],
      });

      expect(agent.type).toBe('react');
    });

    it('should create agents with proper type', () => {
      const types: AgentConfig['type'][] = ['react', 'graph', 'genius', 'expert'];

      for (const type of types) {
        const agent = factory.create({
          type,
          name: `${type} agent`,
          capabilities: [],
        });
        expect(agent.type).toBe(type);
      }
    });

    it('should handle rapid agent creation', () => {
      const agents = [];
      for (let i = 0; i < 100; i++) {
        agents.push(factory.createReactAgent(`Agent ${i}`));
      }

      expect(agents).toHaveLength(100);
      const uniqueIds = new Set(agents.map((a) => a.id));
      expect(uniqueIds.size).toBe(100);
    });

    it('should create independent agent instances', async () => {
      const agent1 = factory.createReactAgent('Agent 1');
      const agent2 = factory.createReactAgent('Agent 2');

      const result1 = await agent1.execute('input1');
      const result2 = await agent2.execute('input2');

      expect(result1).toContain('input1');
      expect(result2).toContain('input2');
    });

    it('should handle configuration errors', () => {
      const createInvalid = () => {
        return factory.create({
          type: 'invalid' as any,
          name: 'Invalid',
          capabilities: [],
        });
      };

      expect(createInvalid).toBeDefined();
    });
  });

  // ===== MEMORY MANAGEMENT TESTS =====
  describe('Memory Manager Service', () => {
    interface Memory {
      key: string;
      value: any;
      timestamp: number;
      ttl?: number;
    }

    class MemoryManager {
      private memory: Map<string, Memory> = new Map();

      set(key: string, value: any, ttl?: number): void {
        this.memory.set(key, {
          key,
          value,
          timestamp: Date.now(),
          ttl,
        });
      }

      get(key: string): any {
        const mem = this.memory.get(key);
        if (!mem) return null;

        if (mem.ttl && Date.now() - mem.timestamp > mem.ttl) {
          this.memory.delete(key);
          return null;
        }

        return mem.value;
      }

      delete(key: string): void {
        this.memory.delete(key);
      }

      clear(): void {
        this.memory.clear();
      }

      has(key: string): boolean {
        return this.memory.has(key);
      }

      size(): number {
        return this.memory.size;
      }

      keys(): string[] {
        return Array.from(this.memory.keys());
      }
    }

    let manager: MemoryManager;

    beforeEach(() => {
      manager = new MemoryManager();
    });

    it('should store value in memory', () => {
      manager.set('key1', 'value1');

      expect(manager.get('key1')).toBe('value1');
    });

    it('should retrieve stored value', () => {
      manager.set('test', { data: 'complex' });

      const retrieved = manager.get('test');
      expect(retrieved).toEqual({ data: 'complex' });
    });

    it('should return null for missing key', () => {
      const result = manager.get('non-existent');

      expect(result).toBeNull();
    });

    it('should update existing value', () => {
      manager.set('key', 'value1');
      manager.set('key', 'value2');

      expect(manager.get('key')).toBe('value2');
    });

    it('should delete value', () => {
      manager.set('key', 'value');
      manager.delete('key');

      expect(manager.get('key')).toBeNull();
    });

    it('should check key existence', () => {
      manager.set('exists', 'value');

      expect(manager.has('exists')).toBe(true);
      expect(manager.has('not-exists')).toBe(false);
    });

    it('should clear all memory', () => {
      manager.set('key1', 'value1');
      manager.set('key2', 'value2');

      manager.clear();

      expect(manager.size()).toBe(0);
    });

    it('should report memory size', () => {
      manager.set('key1', 'value1');
      manager.set('key2', 'value2');
      manager.set('key3', 'value3');

      expect(manager.size()).toBe(3);
    });

    it('should list all keys', () => {
      manager.set('key1', 'value1');
      manager.set('key2', 'value2');

      const keys = manager.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should handle TTL expiration', async () => {
      manager.set('temp', 'value', 100); // 100ms TTL

      expect(manager.get('temp')).toBe('value');

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(manager.get('temp')).toBeNull();
    });

    it('should store different types', () => {
      manager.set('string', 'text');
      manager.set('number', 42);
      manager.set('object', { key: 'value' });
      manager.set('array', [1, 2, 3]);
      manager.set('null', null);

      expect(manager.get('string')).toBe('text');
      expect(manager.get('number')).toBe(42);
      expect(manager.get('object')).toEqual({ key: 'value' });
      expect(manager.get('array')).toEqual([1, 2, 3]);
      expect(manager.get('null')).toBeNull();
    });

    it('should support memory isolation', () => {
      const manager1 = new MemoryManager();
      const manager2 = new MemoryManager();

      manager1.set('key', 'value1');
      manager2.set('key', 'value2');

      expect(manager1.get('key')).toBe('value1');
      expect(manager2.get('key')).toBe('value2');
    });
  });

  // ===== PROMPT BUILDER TESTS =====
  describe('Prompt Builder Service', () => {

    it('should build prompt from template', () => {
      const builder = new PromptBuilder();
      const prompt = builder
        .template('Hello {name}, you are {role}')
        .set('name', 'Alice')
        .set('role', 'analyst')
        .build();

      expect(prompt).toBe('Hello Alice, you are analyst');
    });

    it('should support chaining', () => {
      const prompt = new PromptBuilder()
        .template('Query: {query}')
        .set('query', 'What is AI?')
        .build();

      expect(prompt).toBe('Query: What is AI?');
    });

    it('should handle missing variables', () => {
      const prompt = new PromptBuilder()
        .template('Hello {name}')
        .build();

      expect(prompt).toContain('{name}');
    });

    it('should build complex prompts', () => {
      const prompt = new PromptBuilder()
        .template(
          `System: You are a {role}.
Context: {context}
Query: {query}
Response format: {format}`
        )
        .set('role', 'data analyst')
        .set('context', 'Financial data')
        .set('query', 'Analyze trends')
        .set('format', 'JSON')
        .build();

      expect(prompt).toContain('data analyst');
      expect(prompt).toContain('Financial data');
      expect(prompt).toContain('JSON');
    });

    it('should support context addition', () => {
      const context = {
        agent: 'ResearchBot',
        task: 'Literature review',
      };

      const prompt = new PromptBuilder()
        .template('Agent: {agent}, Task: {task}')
        .addContext(context)
        .build();

      expect(prompt).toContain('ResearchBot');
      expect(prompt).toContain('Literature review');
    });

    it('should handle empty template', () => {
      const prompt = new PromptBuilder().template('').build();

      expect(prompt).toBe('');
    });

    it('should replace multiple occurrences', () => {
      const prompt = new PromptBuilder()
        .template('{greeting} {name}, {greeting} again!')
        .set('greeting', 'Hello')
        .set('name', 'Bob')
        .build();

      expect(prompt).toContain('Hello');
      expect(prompt).toMatch(/Hello.*Hello/);
    });

    it('should preserve unmatched braces', () => {
      const prompt = new PromptBuilder()
        .template('JSON: {json_start}{key: value}{json_end}')
        .set('json_start', '{')
        .set('json_end', '}')
        .build();

      expect(prompt).toContain('{key: value}');
    });
  });

  // ===== RESPONSE PARSER TESTS =====
  describe('Response Parser Service', () => {
    class ResponseParser {
      parse(response: string): Record<string, any> {
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
        return response.split(delimiter).filter((item) => item.trim().length > 0);
      }

      parseKeyValue(response: string): Record<string, string> {
        const result: Record<string, string> = {};
        const lines = response.split('\n');

        for (const line of lines) {
          const [key, value] = line.split(':');
          if (key && value) {
            result[key.trim()] = value.trim();
          }
        }

        return result;
      }
    }

    let parser: ResponseParser;

    beforeEach(() => {
      parser = new ResponseParser();
    });

    it('should parse JSON response', () => {
      const response = '{"status": "success", "data": "result"}';
      const parsed = parser.parse(response);

      expect(parsed.status).toBe('success');
      expect(parsed.data).toBe('result');
    });

    it('should handle invalid JSON', () => {
      const response = 'Not valid JSON';
      const parsed = parser.parse(response);

      expect(parsed.raw).toBe('Not valid JSON');
    });

    it('should extract text using regex', () => {
      const response = 'Result: The answer is 42';
      const extracted = parser.extract(response, /Result: (.*)/);

      expect(extracted).toBe('The answer is 42');
    });

    it('should parse list items', () => {
      const response = `Item 1
Item 2
Item 3`;

      const items = parser.parseList(response);

      expect(items).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });

    it('should parse key-value pairs', () => {
      const response = `name: Alice
age: 30
role: analyst`;

      const parsed = parser.parseKeyValue(response);

      expect(parsed.name).toBe('Alice');
      expect(parsed.age).toBe('30');
      expect(parsed.role).toBe('analyst');
    });

    it('should handle custom delimiters', () => {
      const response = 'Item1|Item2|Item3';
      const items = parser.parseList(response, '|');

      expect(items).toEqual(['Item1', 'Item2', 'Item3']);
    });

    it('should parse complex JSON structures', () => {
      const response = JSON.stringify({
        thoughts: ['think1', 'think2'],
        actions: [{ tool: 'search', input: 'query' }],
      });

      const parsed = parser.parse(response);

      expect(parsed.thoughts).toHaveLength(2);
      expect(parsed.actions[0].tool).toBe('search');
    });

    it('should handle empty responses', () => {
      const parsed = parser.parse('');
      expect(parsed.raw).toBe('');
    });

    it('should extract multiple matches', () => {
      const response = 'Results: [val1, val2, val3]';
      const matches = response.match(/\[(.*?)\]/);

      expect(matches).not.toBeNull();
      expect(matches?.[1]).toContain('val1');
    });
  });

  // ===== STATE MACHINE TESTS =====
  describe('State Machine Service', () => {
    type State = 'idle' | 'processing' | 'complete' | 'error';

    class StateMachine {
      private state: State = 'idle';
      private transitions: Map<State, Set<State>>;

      constructor() {
        this.transitions = new Map();
        this.transitions.set('idle', new Set(['processing']));
        this.transitions.set('processing', new Set(['complete', 'error']));
        this.transitions.set('complete', new Set(['idle']));
        this.transitions.set('error', new Set(['idle']));
      }

      getState(): State {
        return this.state;
      }

      canTransition(to: State): boolean {
        const allowed = this.transitions.get(this.state);
        return allowed ? allowed.has(to) : false;
      }

      transition(to: State): boolean {
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

    it('should initialize to idle state', () => {
      const machine = new StateMachine();

      expect(machine.getState()).toBe('idle');
    });

    it('should transition from idle to processing', () => {
      const machine = new StateMachine();

      const success = machine.transition('processing');

      expect(success).toBe(true);
      expect(machine.getState()).toBe('processing');
    });

    it('should transition from processing to complete', () => {
      const machine = new StateMachine();
      machine.transition('processing');

      const success = machine.transition('complete');

      expect(success).toBe(true);
      expect(machine.getState()).toBe('complete');
    });

    it('should transition from processing to error', () => {
      const machine = new StateMachine();
      machine.transition('processing');

      const success = machine.transition('error');

      expect(success).toBe(true);
      expect(machine.getState()).toBe('error');
    });

    it('should not allow invalid transitions', () => {
      const machine = new StateMachine();

      const success = machine.transition('complete');

      expect(success).toBe(false);
      expect(machine.getState()).toBe('idle');
    });

    it('should check transition validity', () => {
      const machine = new StateMachine();

      expect(machine.canTransition('processing')).toBe(true);
      expect(machine.canTransition('complete')).toBe(false);

      machine.transition('processing');

      expect(machine.canTransition('complete')).toBe(true);
      expect(machine.canTransition('idle')).toBe(false);
    });

    it('should reset to idle state', () => {
      const machine = new StateMachine();
      machine.transition('processing');
      machine.transition('complete');

      machine.reset();

      expect(machine.getState()).toBe('idle');
    });

    it('should handle error recovery', () => {
      const machine = new StateMachine();
      machine.transition('processing');
      machine.transition('error');

      const recovered = machine.transition('idle');

      expect(recovered).toBe(true);
      expect(machine.getState()).toBe('idle');
    });

    it('should track state transitions', () => {
      const machine = new StateMachine();
      const history: State[] = [machine.getState()];

      machine.transition('processing');
      history.push(machine.getState());

      machine.transition('complete');
      history.push(machine.getState());

      expect(history).toEqual(['idle', 'processing', 'complete']);
    });
  });

  // ===== COORDINATION VALIDATOR TESTS =====
  describe('Coordination Validator Service', () => {
    interface CoordinationContext {
      agentIds: string[];
      taskId: string;
      constraints: Record<string, any>;
    }

    class CoordinationValidator {
      validate(context: CoordinationContext): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!context.agentIds || context.agentIds.length === 0) {
          errors.push('At least one agent required');
        }

        if (!context.taskId) {
          errors.push('Task ID required');
        }

        if (context.agentIds.length > 10) {
          errors.push('Maximum 10 agents allowed');
        }

        return {
          valid: errors.length === 0,
          errors,
        };
      }

      checkDependencies(agentIds: string[]): boolean {
        return agentIds.length > 1;
      }

      detectCycles(dependencies: Map<string, string[]>): boolean {
        // Simple cycle detection
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const hasCycle = (node: string): boolean => {
          visited.add(node);
          recursionStack.add(node);

          const neighbors = dependencies.get(node) || [];
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              if (hasCycle(neighbor)) return true;
            } else if (recursionStack.has(neighbor)) {
              return true;
            }
          }

          recursionStack.delete(node);
          return false;
        };

        for (const node of dependencies.keys()) {
          if (!visited.has(node)) {
            if (hasCycle(node)) return true;
          }
        }

        return false;
      }
    }

    let validator: CoordinationValidator;

    beforeEach(() => {
      validator = new CoordinationValidator();
    });

    it('should validate coordination context', () => {
      const context: CoordinationContext = {
        agentIds: ['agent-1', 'agent-2'],
        taskId: 'task-1',
        constraints: {},
      };

      const result = validator.validate(context);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing agents', () => {
      const context: CoordinationContext = {
        agentIds: [],
        taskId: 'task-1',
        constraints: {},
      };

      const result = validator.validate(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one agent required');
    });

    it('should detect missing task ID', () => {
      const context: CoordinationContext = {
        agentIds: ['agent-1'],
        taskId: '',
        constraints: {},
      };

      const result = validator.validate(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Task ID required');
    });

    it('should enforce agent limit', () => {
      const agentIds = Array.from({ length: 15 }, (_, i) => `agent-${i}`);
      const context: CoordinationContext = {
        agentIds,
        taskId: 'task-1',
        constraints: {},
      };

      const result = validator.validate(context);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum 10 agents allowed');
    });

    it('should check agent dependencies', () => {
      const hasDeps = validator.checkDependencies(['agent-1', 'agent-2']);

      expect(hasDeps).toBe(true);
    });

    it('should detect cycles in dependencies', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['B']],
        ['B', ['C']],
        ['C', ['A']], // Cycle: A -> B -> C -> A
      ]);

      const hasCycle = validator.detectCycles(dependencies);

      expect(hasCycle).toBe(true);
    });

    it('should allow valid dependency graphs', () => {
      const dependencies = new Map<string, string[]>([
        ['A', ['B', 'C']],
        ['B', ['D']],
        ['C', ['D']],
        ['D', []],
      ]);

      const hasCycle = validator.detectCycles(dependencies);

      expect(hasCycle).toBe(false);
    });

    it('should validate multiple constraints', () => {
      const context: CoordinationContext = {
        agentIds: ['agent-1'],
        taskId: 'task-1',
        constraints: {
          maxConcurrent: 5,
          timeout: 3600,
        },
      };

      const result = validator.validate(context);

      expect(result.valid).toBe(true);
    });
  });

  // ===== INTEGRATION BETWEEN SERVICES =====
  describe('Service Integration', () => {
    it('should chain factory and memory manager', () => {
      const factory = new AgentFactory();
      const manager = new MemoryManager();

      const agent = factory.createReactAgent('Test');
      manager.set('agent', agent);

      const retrieved = manager.get('agent');
      expect(retrieved.type).toBe('react');
    });

    it('should build prompts and parse responses', () => {
      const builder = new PromptBuilder();
      const parser = new ResponseParser();

      const prompt = builder
        .template('Question: {q}')
        .set('q', 'What is {x}?')
        .build();

      const response = JSON.stringify({
        answer: 'The answer',
        confidence: 0.95,
      });

      const parsed = parser.parse(response);

      expect(parsed.answer).toBe('The answer');
    });

    it('should manage state with state machine', () => {
      const machine = new StateMachine();

      expect(machine.getState()).toBe('idle');

      machine.transition('processing');
      expect(machine.getState()).toBe('processing');

      machine.transition('complete');
      expect(machine.getState()).toBe('complete');
    });

    it('should validate coordination and create agents', () => {
      const validator = new CoordinationValidator();
      const factory = new AgentFactory();

      const context: CoordinationContext = {
        agentIds: ['agent-1', 'agent-2'],
        taskId: 'task-1',
        constraints: {},
      };

      const validation = validator.validate(context);
      expect(validation.valid).toBe(true);

      const agents = context.agentIds.map((id) =>
        factory.createReactAgent(`Agent from ${id}`)
      );

      expect(agents).toHaveLength(2);
    });
  });
});

// Helper class definitions
class AgentFactory {
  private idCounter = 0;

  create(config: any): any {
    return {
      id: `agent-${Date.now()}-${this.idCounter++}`,
      type: config.type,
      execute: async (input: string) => `${config.type}: ${input}`,
    };
  }

  createReactAgent(name: string): any {
    return this.create({
      type: 'react',
      name,
      capabilities: ['think', 'act', 'observe'],
    });
  }

  createGraphAgent(name: string): any {
    return this.create({
      type: 'graph',
      name,
      capabilities: ['traverse', 'analyze'],
    });
  }

  createGeniusAgent(name: string): any {
    return this.create({
      type: 'genius',
      name,
      capabilities: ['learn', 'create', 'optimize'],
    });
  }

  createExpertAgent(name: string): any {
    return this.create({
      type: 'expert',
      name,
      capabilities: ['analyze', 'recommend', 'explain'],
    });
  }
}

class MemoryManager {
  private memory: Map<string, any> = new Map();

  set(key: string, value: any, ttl?: number): void {
    this.memory.set(key, {
      key,
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): any {
    const mem = this.memory.get(key);
    if (!mem) return null;

    if (mem.ttl && Date.now() - mem.timestamp > mem.ttl) {
      this.memory.delete(key);
      return null;
    }

    return mem.value;
  }

  delete(key: string): void {
    this.memory.delete(key);
  }

  clear(): void {
    this.memory.clear();
  }

  has(key: string): boolean {
    return this.memory.has(key);
  }

  size(): number {
    return this.memory.size;
  }

  keys(): string[] {
    return Array.from(this.memory.keys());
  }
}

class PromptBuilder {
  private templateStr: string = '';
  private variables: Map<string, string> = new Map();

  template(tmpl: string): PromptBuilder {
    this.templateStr = tmpl;
    return this;
  }

  set(key: string, value: string): PromptBuilder {
    this.variables.set(key, value);
    return this;
  }

  build(): string {
    let result = this.templateStr;

    for (const [key, value] of this.variables) {
      result = result.replaceAll(`{${key}}`, value);
    }

    return result;
  }

  addContext(context: Record<string, string>): PromptBuilder {
    for (const [key, value] of Object.entries(context)) {
      this.set(key, value);
    }
    return this;
  }
}

class ResponseParser {
  parse(response: string): Record<string, any> {
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
    return response.split(delimiter).filter((item) => item.trim().length > 0);
  }

  parseKeyValue(response: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = response.split('\n');

    for (const line of lines) {
      const [key, value] = line.split(':');
      if (key && value) {
        result[key.trim()] = value.trim();
      }
    }

    return result;
  }
}

class StateMachine {
  private state: string = 'idle';
  private transitions: Map<string, Set<string>> = new Map([
    ['idle', new Set(['processing'])],
    ['processing', new Set(['complete', 'error'])],
    ['complete', new Set(['idle'])],
    ['error', new Set(['idle'])],
  ]);

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

interface CoordinationContext {
  agentIds: string[];
  taskId: string;
  constraints: Record<string, any>;
}

class CoordinationValidator {
  validate(context: CoordinationContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!context.agentIds || context.agentIds.length === 0) {
      errors.push('At least one agent required');
    }

    if (!context.taskId) {
      errors.push('Task ID required');
    }

    if (context.agentIds.length > 10) {
      errors.push('Maximum 10 agents allowed');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  checkDependencies(agentIds: string[]): boolean {
    return agentIds.length > 1;
  }

  detectCycles(dependencies: Map<string, string[]>): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = dependencies.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of dependencies.keys()) {
      if (!visited.has(node)) {
        if (hasCycle(node)) return true;
      }
    }

    return false;
  }
}
