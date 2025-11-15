/**
 * Agent Extended Tests
 *
 * Extended coverage tests for ReAct and Graph agents
 */

import { ReActAgent } from '../../../domain/agents/react-agent/react-agent';
import { GraphAgent } from '../../../domain/agents/graph-agent/graph-agent';
import { NodeType } from '../../../domain/agents/graph-agent/graph-agent.types';
import { MemoryManager } from '../../../domain/services/memory-manager.service';
import { StateMachine } from '../../../domain/services/state-machine.service';
import { ResponseParser } from '../../../domain/services/response-parser.service';
import { PromptBuilder } from '../../../domain/services/prompt-builder.service';
import { ILogger } from '@application/ports/logger.port';
import {
  ILLMProvider,
  LLMResponse,
} from '@application/ports/llm-provider.port';

describe('ReAct Agent - Extended Coverage', () => {
  let reactAgent: ReActAgent;
  let mockLLMProvider: ILLMProvider;
  let mockLogger: ILogger;
  let memoryManager: MemoryManager;
  let responseParser: ResponseParser;
  let promptBuilder: PromptBuilder;

  beforeEach(() => {
    mockLLMProvider = {
      complete: jest.fn().mockResolvedValue({
        content: 'Final Answer: Test result',
        role: 'assistant',
        metadata: {},
      } as LLMResponse),
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

    reactAgent = new ReActAgent(
      mockLLMProvider,
      mockLogger,
      memoryManager,
      StateMachine,
      responseParser,
      promptBuilder,
      {
        maxIterations: 10,
        temperature: 0.7,
        model: 'gpt-4',
        systemPrompt: 'Reason step by step',
        tools: ['calculator', 'search'],
      },
    );
  });

  describe('Configuration', () => {
    it('should use custom system prompt', async () => {
      const agent = new ReActAgent(
        mockLLMProvider,
        mockLogger,
        memoryManager,
        StateMachine,
        responseParser,
        promptBuilder,
        {
          systemPrompt: 'Custom system prompt',
        },
      );

      await agent.execute('Test');
      expect(mockLLMProvider.complete).toHaveBeenCalled();
    });

    it('should respect max iterations configuration', async () => {
      mockLLMProvider.complete = jest.fn().mockResolvedValue({
        content:
          'Thought: Thinking\nAction: search\nAction Input: {"query": "test"}',
        role: 'assistant',
      });

      const agent = new ReActAgent(
        mockLLMProvider,
        mockLogger,
        memoryManager,
        StateMachine,
        responseParser,
        promptBuilder,
        {
          maxIterations: 2,
        },
      );

      const result = await agent.execute('Test');
      expect(result.status).toBe('error');
      expect(result.output).toContain('maximum iterations');
    });

    it('should use configured temperature', async () => {
      const agent = new ReActAgent(
        mockLLMProvider,
        mockLogger,
        memoryManager,
        StateMachine,
        responseParser,
        promptBuilder,
        {
          temperature: 0.9,
        },
      );

      await agent.execute('Test');
      expect(mockLLMProvider.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.9,
        }),
      );
    });
  });

  describe('Execution Patterns', () => {
    it('should handle single-step execution', async () => {
      mockLLMProvider.complete = jest.fn().mockResolvedValue({
        content: 'Final Answer: Result',
        role: 'assistant',
      });

      const result = await reactAgent.execute('Simple question');
      expect(result.status).toBe('success');
      expect(result.metadata?.iterations).toBe(1);
    });

    it('should handle multi-step reasoning', async () => {
      let callCount = 0;
      mockLLMProvider.complete = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            content:
              'Thought: Need more info\nAction: search\nAction Input: {"query": "test"}',
            role: 'assistant',
          };
        } else if (callCount === 2) {
          return {
            content:
              'Thought: Now I can answer\nFinal Answer: Based on search, the answer is X',
            role: 'assistant',
          };
        }
        return { content: 'Final Answer: Done', role: 'assistant' };
      });

      const result = await reactAgent.execute('Complex question');
      expect(result.status).toBe('success');
      expect(result.metadata?.iterations).toBeGreaterThan(1);
    });

    it('should track thoughts, actions, and observations', async () => {
      mockLLMProvider.complete = jest
        .fn()
        .mockResolvedValueOnce({
          content:
            'Thought: Analyzing\nAction: calculator\nAction Input: {"op": "add", "a": 2, "b": 2}',
          role: 'assistant',
        })
        .mockResolvedValueOnce({
          content: 'Final Answer: 4',
          role: 'assistant',
        });

      const result = await reactAgent.execute('Calculate 2+2');
      expect(result.metadata?.thoughts).toBeDefined();
      expect(result.metadata?.actions).toBeDefined();
      expect(result.metadata?.observations).toBeDefined();
      expect(Array.isArray(result.metadata?.thoughts)).toBe(true);
    });

    it('should handle tool errors gracefully', async () => {
      mockLLMProvider.complete = jest
        .fn()
        .mockResolvedValueOnce({
          content:
            'Thought: Calculate\nAction: calculator\nAction Input: {"invalid": true}',
          role: 'assistant',
        })
        .mockResolvedValueOnce({
          content: 'Final Answer: Could not calculate',
          role: 'assistant',
        });

      const result = await reactAgent.execute('Test');
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });

  describe('State Management', () => {
    it('should transition through states', async () => {
      const initialState = reactAgent.getState();
      expect(initialState.getCurrentState()).toBe('idle');

      const execution = reactAgent.execute('Test');
      // State should change during execution

      await execution;
      const finalState = reactAgent.getState();
      expect(['complete', 'processing', 'error']).toContain(
        finalState.getCurrentState(),
      );
    });

    it('should track execution steps', async () => {
      await reactAgent.execute('Test');
      const state = reactAgent.getState();
      expect(state.getMetadata()).toBeDefined();
    });

    it('should provide ReAct-specific state', async () => {
      mockLLMProvider.complete = jest.fn().mockResolvedValue({
        content:
          'Thought: Thinking\nAction: search\nAction Input: {"query": "test"}\nFinal Answer: Done',
        role: 'assistant',
      });

      await reactAgent.execute('Test');
      const reactState = reactAgent.getReActState();

      expect(reactState).toHaveProperty('thoughtCount');
      expect(reactState).toHaveProperty('actionCount');
      expect(reactState).toHaveProperty('observationCount');
    });
  });

  describe('Streaming', () => {
    it('should stream execution updates', async () => {
      const chunks: string[] = [];

      for await (const chunk of reactAgent.stream('Test')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      const output = chunks.join('');
      expect(output).toContain('ReAct Agent');
    });

    it('should emit iteration information', async () => {
      mockLLMProvider.complete = jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Thought: Step 1\nAction: search\nAction Input: {}',
          role: 'assistant',
        })
        .mockResolvedValueOnce({
          content: 'Final Answer: Done',
          role: 'assistant',
        });

      const chunks: string[] = [];
      for await (const chunk of reactAgent.stream('Test')) {
        chunks.push(chunk);
      }

      const output = chunks.join('');
      expect(output).toContain('Iteration');
    });

    it('should stream thought process', async () => {
      const chunks: string[] = [];

      for await (const chunk of reactAgent.stream('Explain your reasoning')) {
        chunks.push(chunk);
      }

      const output = chunks.join('');
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit start event', async () => {
      const eventPromise = new Promise((resolve) => {
        reactAgent.on('agent:started', resolve);
      });

      reactAgent.execute('Test');
      const event = await eventPromise;
      expect(event).toBeDefined();
    });

    it('should emit completion event', async () => {
      const eventPromise = new Promise((resolve) => {
        reactAgent.on('agent:completed', resolve);
      });

      await reactAgent.execute('Test');
      const event = await eventPromise;
      expect(event).toBeDefined();
    });

    it('should emit error event on failure', async () => {
      mockLLMProvider.complete = jest
        .fn()
        .mockRejectedValue(new Error('Test error'));

      const eventPromise = new Promise((resolve) => {
        reactAgent.on('agent:error', resolve);
      });

      try {
        await reactAgent.execute('Test');
      } catch {
        // Expected error
      }

      const event = await eventPromise;
      expect(event).toBeDefined();
    });
  });
});

describe('Graph Agent - Extended Coverage', () => {
  let graphAgent: GraphAgent;
  let mockLLMProvider: ILLMProvider;
  let mockLogger: ILogger;
  let memoryManager: MemoryManager;
  let responseParser: ResponseParser;
  let promptBuilder: PromptBuilder;

  beforeEach(() => {
    mockLLMProvider = {
      complete: jest.fn().mockResolvedValue({
        content: 'Task completed',
        role: 'assistant',
        metadata: {},
      } as LLMResponse),
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

    graphAgent = new GraphAgent(
      mockLLMProvider,
      mockLogger,
      memoryManager,
      StateMachine,
      responseParser,
      promptBuilder,
      {
        maxDepth: 20,
        allowParallel: true,
        temperature: 0.5,
        model: 'gpt-4',
      },
    );
  });

  describe('Graph Structures', () => {
    it('should execute linear workflow', async () => {
      const graph = {
        id: 'linear',
        name: 'Linear Workflow',
        nodes: [
          { id: 'start', type: NodeType.START, name: 'Start', config: {} },
          {
            id: 'task1',
            type: NodeType.TASK,
            name: 'Task 1',
            config: { prompt: 'Do task 1' },
          },
          {
            id: 'task2',
            type: NodeType.TASK,
            name: 'Task 2',
            config: { prompt: 'Do task 2' },
          },
          { id: 'end', type: NodeType.END, name: 'End', config: {} },
        ],
        edges: [
          { id: 'e1', from: 'start', to: 'task1' },
          { id: 'e2', from: 'task1', to: 'task2' },
          { id: 'e3', from: 'task2', to: 'end' },
        ],
        startNode: 'start',
        endNodes: ['end'],
      };

      const result = await graphAgent.execute(JSON.stringify(graph));
      expect(result.status).toBe('success');
      expect(result.output).toBeDefined();
    });

    it('should execute branching workflow', async () => {
      const graph = {
        id: 'branch',
        name: 'Branching Workflow',
        nodes: [
          { id: 'start', type: NodeType.START, name: 'Start', config: {} },
          {
            id: 'decision',
            type: NodeType.DECISION,
            name: 'Decision',
            config: { condition: 'true' },
          },
          { id: 'branch1', type: NodeType.TASK, name: 'Branch 1', config: {} },
          { id: 'branch2', type: NodeType.TASK, name: 'Branch 2', config: {} },
          { id: 'end', type: NodeType.END, name: 'End', config: {} },
        ],
        edges: [
          { id: 'e1', from: 'start', to: 'decision' },
          { id: 'e2', from: 'decision', to: 'branch1' },
          { id: 'e3', from: 'decision', to: 'branch2' },
          { id: 'e4', from: 'branch1', to: 'end' },
          { id: 'e5', from: 'branch2', to: 'end' },
        ],
        startNode: 'start',
        endNodes: ['end'],
      };

      const result = await graphAgent.execute(JSON.stringify(graph));
      expect(result).toBeDefined();
    });

    it('should handle parallel execution nodes', async () => {
      const graph = {
        id: 'parallel',
        name: 'Parallel Workflow',
        nodes: [
          { id: 'start', type: NodeType.START, name: 'Start', config: {} },
          {
            id: 'split',
            type: NodeType.PARALLEL_SPLIT,
            name: 'Split',
            config: {},
          },
          { id: 'task1', type: NodeType.TASK, name: 'Task 1', config: {} },
          { id: 'task2', type: NodeType.TASK, name: 'Task 2', config: {} },
          {
            id: 'join',
            type: NodeType.PARALLEL_JOIN,
            name: 'Join',
            config: {},
          },
          { id: 'end', type: NodeType.END, name: 'End', config: {} },
        ],
        edges: [
          { id: 'e1', from: 'start', to: 'split' },
          { id: 'e2', from: 'split', to: 'task1' },
          { id: 'e3', from: 'split', to: 'task2' },
          { id: 'e4', from: 'task1', to: 'join' },
          { id: 'e5', from: 'task2', to: 'join' },
          { id: 'e6', from: 'join', to: 'end' },
        ],
        startNode: 'start',
        endNodes: ['end'],
      };

      const result = await graphAgent.execute(JSON.stringify(graph));
      expect(result).toBeDefined();
    });
  });

  describe('Node Types', () => {
    it('should execute START nodes', async () => {
      const graph = {
        id: 'test',
        name: 'Test',
        nodes: [
          { id: 'start', type: NodeType.START, name: 'Start', config: {} },
          { id: 'end', type: NodeType.END, name: 'End', config: {} },
        ],
        edges: [{ id: 'e1', from: 'start', to: 'end' }],
        startNode: 'start',
        endNodes: ['end'],
      };

      const result = await graphAgent.execute(JSON.stringify(graph));
      expect(result.status).toBe('success');
    });

    it('should execute TASK nodes', async () => {
      const graph = {
        id: 'task',
        name: 'Task Test',
        nodes: [
          { id: 'start', type: NodeType.START, name: 'Start', config: {} },
          {
            id: 'task',
            type: NodeType.TASK,
            name: 'Task',
            config: { prompt: 'Execute task' },
          },
          { id: 'end', type: NodeType.END, name: 'End', config: {} },
        ],
        edges: [
          { id: 'e1', from: 'start', to: 'task' },
          { id: 'e2', from: 'task', to: 'end' },
        ],
        startNode: 'start',
        endNodes: ['end'],
      };

      const result = await graphAgent.execute(JSON.stringify(graph));
      expect(result.status).toBe('success');
      expect(mockLLMProvider.complete).toHaveBeenCalled();
    });

    it('should execute DECISION nodes', async () => {
      const graph = {
        id: 'decision',
        name: 'Decision Test',
        nodes: [
          { id: 'start', type: NodeType.START, name: 'Start', config: {} },
          {
            id: 'decision',
            type: NodeType.DECISION,
            name: 'Decision',
            config: { condition: '1 === 1' },
          },
          { id: 'end', type: NodeType.END, name: 'End', config: {} },
        ],
        edges: [
          { id: 'e1', from: 'start', to: 'decision' },
          { id: 'e2', from: 'decision', to: 'end' },
        ],
        startNode: 'start',
        endNodes: ['end'],
      };

      const result = await graphAgent.execute(JSON.stringify(graph));
      expect(result).toBeDefined();
    });
  });

  describe('State Tracking', () => {
    it('should track executed nodes', async () => {
      const graph = {
        id: 'track',
        name: 'Track Test',
        nodes: [
          { id: 'start', type: NodeType.START, name: 'Start', config: {} },
          { id: 'task', type: NodeType.TASK, name: 'Task', config: {} },
          { id: 'end', type: NodeType.END, name: 'End', config: {} },
        ],
        edges: [
          { id: 'e1', from: 'start', to: 'task' },
          { id: 'e2', from: 'task', to: 'end' },
        ],
        startNode: 'start',
        endNodes: ['end'],
      };

      await graphAgent.execute(JSON.stringify(graph));
      const graphState = graphAgent.getGraphState();

  expect(graphState.executedNodes?.length ?? 0).toBeGreaterThan(0);
      expect(graphState.graphDefinition).toBeDefined();
    });

    it('should provide graph definition in state', async () => {
      await graphAgent.execute('Test');
      const graphState = graphAgent.getGraphState();

      expect(graphState.graphDefinition).toBeDefined();
      expect(graphState.graphDefinition?.nodes).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle node execution failures', async () => {
      mockLLMProvider.complete = jest
        .fn()
        .mockRejectedValue(new Error('Node failed'));

      const graph = {
        id: 'fail',
        name: 'Fail Test',
        nodes: [
          { id: 'start', type: NodeType.START, name: 'Start', config: {} },
          { id: 'task', type: NodeType.TASK, name: 'Task', config: {} },
          { id: 'end', type: NodeType.END, name: 'End', config: {} },
        ],
        edges: [
          { id: 'e1', from: 'start', to: 'task' },
          { id: 'e2', from: 'task', to: 'end' },
        ],
        startNode: 'start',
        endNodes: ['end'],
      };

      const result = await graphAgent.execute(JSON.stringify(graph));
      expect(result.status).toBe('error');
      expect(result.metadata?.errors).toBeDefined();
    });

    it('should create default graph for invalid JSON', async () => {
      const result = await graphAgent.execute('not valid json {{{');
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });

  describe('Streaming', () => {
    it('should stream graph execution', async () => {
      const chunks: string[] = [];

      for await (const chunk of graphAgent.stream('Test')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should emit node progress', async () => {
      const graph = {
        id: 'stream',
        name: 'Stream Test',
        nodes: [
          { id: 'start', type: NodeType.START, name: 'Start', config: {} },
          { id: 'end', type: NodeType.END, name: 'End', config: {} },
        ],
        edges: [{ id: 'e1', from: 'start', to: 'end' }],
        startNode: 'start',
        endNodes: ['end'],
      };

      const chunks: string[] = [];
      for await (const chunk of graphAgent.stream(JSON.stringify(graph))) {
        chunks.push(chunk);
      }

      const output = chunks.join('');
      expect(output).toContain('Graph Agent');
    });
  });
});
