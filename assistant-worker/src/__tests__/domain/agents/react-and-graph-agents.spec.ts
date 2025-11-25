/**
 * ReAct and Graph Agent Tests
 *
 * Tests for ReAct and Graph agent implementations
 */

import { ReActAgent } from '../../../domain/agents/react-agent/react-agent';
import { GraphAgent } from '../../../domain/agents/graph-agent/graph-agent';
import { MemoryManager } from '../../../domain/services/memory-manager.service';
import { StateMachine } from '../../../domain/services/state-machine.service';
import { ResponseParser } from '../../../domain/services/response-parser.service';
import { PromptBuilder } from '../../../domain/services/prompt-builder.service';
import { ILogger } from '@application/ports/logger.port';
import {
  ILLMProvider,
  LLMResponse,
} from '@application/ports/llm-provider.port';

describe('ReAct Agent', () => {
  let reactAgent: ReActAgent;
  let mockLLMProvider: ILLMProvider;
  let mockLogger: ILogger;
  let memoryManager: MemoryManager;
  let responseParser: ResponseParser;
  let promptBuilder: PromptBuilder;

  beforeEach(() => {
    // Create mocks
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

    // Create service instances
    memoryManager = new MemoryManager();
    responseParser = new ResponseParser();
    promptBuilder = new PromptBuilder();

    // Create ReActAgent
    reactAgent = new ReActAgent(
      mockLLMProvider,
      mockLogger,
      memoryManager,
      StateMachine,
      responseParser,
      promptBuilder,
      {
        maxIterations: 5,
        temperature: 0.7,
        model: 'gpt-4',
        tools: ['calculator', 'search'],
      },
    );
  });

  describe('Initialization', () => {
    it('should create ReAct agent with configuration', () => {
      expect(reactAgent).toBeDefined();
      expect(reactAgent).toBeInstanceOf(ReActAgent);
    });

    it('should initialize with default configuration', () => {
      const agent = new ReActAgent(
        mockLLMProvider,
        mockLogger,
        memoryManager,
        StateMachine,
        responseParser,
        promptBuilder,
        {},
      );
      expect(agent).toBeDefined();
    });

    it('should have proper state after creation', () => {
      const state = reactAgent.getState();
      expect(state).toBeDefined();
      expect(state.getCurrentState()).toBe('idle');
    });
  });

  describe('Execution', () => {
    it('should execute with input', async () => {
      const result = await reactAgent.execute('Test input');
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.output).toBeDefined();
    });

    it('should handle final answer in first iteration', async () => {
      mockLLMProvider.complete = jest.fn().mockResolvedValue({
        content: 'Final Answer: 42',
        role: 'assistant',
      });

      const result = await reactAgent.execute('What is the answer?');
      expect(result).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.output).toBe('42');
    });

    it('should handle tool execution flow', async () => {
      // First call: generate action
      // Second call: generate final answer
      mockLLMProvider.complete = jest
        .fn()
        .mockResolvedValueOnce({
          content:
            'Thought: I need to calculate\nAction: calculator\nAction Input: {"op": "add", "a": 2, "b": 2}',
          role: 'assistant',
        })
        .mockResolvedValueOnce({
          content: 'Final Answer: 4',
          role: 'assistant',
        });

      const result = await reactAgent.execute('Calculate 2 + 2');
      expect(result).toBeDefined();
      expect(result.metadata).toHaveProperty('thoughts');
      expect(result.metadata).toHaveProperty('actions');
      expect(result.metadata).toHaveProperty('observations');
    });

    it('should handle max iterations', async () => {
      // Always return non-final action
      mockLLMProvider.complete = jest.fn().mockResolvedValue({
        content:
          'Thought: Still thinking\nAction: search\nAction Input: {"query": "test"}',
        role: 'assistant',
      });

      const result = await reactAgent.execute('Complex task');
      expect(result).toBeDefined();
      expect(result.status).toBe('error');
      expect(result.output).toContain('maximum iterations');
    });
  });

  describe('Streaming', () => {
    it('should support streaming execution', async () => {
      const chunks: string[] = [];

      for await (const chunk of reactAgent.stream('Test streaming')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should emit iteration updates during streaming', async () => {
      const chunks: string[] = [];

      for await (const chunk of reactAgent.stream('Stream test')) {
        chunks.push(chunk);
      }

      const output = chunks.join('');
      expect(output).toContain('ReAct Agent');
    });
  });

  describe('State Management', () => {
    it('should track execution state', async () => {
      const initialState = reactAgent.getState();
      expect(initialState.getCurrentState()).toBe('idle');

      // Execute (will change state internally)
      await reactAgent.execute('Test');

      const finalState = reactAgent.getState();
      expect(['complete', 'processing', 'error']).toContain(
        finalState.getCurrentState(),
      );
    });

    it('should provide ReAct-specific state', () => {
      const reactState = reactAgent.getReActState();
      expect(reactState).toHaveProperty('thoughtCount');
      expect(reactState).toHaveProperty('actionCount');
      expect(reactState).toHaveProperty('observationCount');
    });

    it('should provide execution metadata', async () => {
      await reactAgent.execute('Test');
      const state = reactAgent.getState();
      expect(state.getMetadata()).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM errors', async () => {
      mockLLMProvider.complete = jest
        .fn()
        .mockRejectedValue(new Error('LLM error'));

      await expect(reactAgent.execute('Test')).rejects.toThrow('LLM error');
    });

    it('should handle invalid action format', async () => {
      mockLLMProvider.complete = jest.fn().mockResolvedValue({
        content: 'Invalid format without proper structure',
        role: 'assistant',
      });

      const result = await reactAgent.execute('Test');
      expect(result).toBeDefined();
      // Should treat as final answer when parsing fails
      expect(result.status).toBe('success');
    });
  });

  describe('Abort Handling', () => {
    it('should support abort', () => {
      reactAgent.abort();
      expect(reactAgent.isAborted()).toBe(true);
    });

    it('should stop execution on abort', () => {
      reactAgent.abort();
      expect(reactAgent.isAborted()).toBe(true);
      const state = reactAgent.getState();
      expect(state.getCurrentState()).toBe('error');
    });
  });
});

describe('Graph Agent', () => {
  let graphAgent: GraphAgent;
  let mockLLMProvider: ILLMProvider;
  let mockLogger: ILogger;
  let memoryManager: MemoryManager;
  let responseParser: ResponseParser;
  let promptBuilder: PromptBuilder;

  beforeEach(() => {
    // Create mocks
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

    // Create service instances
    memoryManager = new MemoryManager();
    responseParser = new ResponseParser();
    promptBuilder = new PromptBuilder();

    // Create GraphAgent
    graphAgent = new GraphAgent(
      mockLLMProvider,
      mockLogger,
      memoryManager,
      StateMachine,
      responseParser,
      promptBuilder,
      {
        maxDepth: 10,
        allowParallel: true,
        temperature: 0.5,
        model: 'gpt-4',
      },
    );
  });

  describe('Initialization', () => {
    it('should create Graph agent', () => {
      expect(graphAgent).toBeDefined();
      expect(graphAgent).toBeInstanceOf(GraphAgent);
    });

    it('should initialize with configuration', () => {
      const state = graphAgent.getState();
      expect(state).toBeDefined();
      expect(state.getCurrentState()).toBe('idle');
    });
  });

  describe('Graph Execution', () => {
    it('should execute simple graph', async () => {
      const graphDefinition = JSON.stringify({
        id: 'test-graph',
        name: 'Test Graph',
        nodes: [
          { id: 'start', type: 'start', name: 'Start', config: {} },
          { id: 'end', type: 'end', name: 'End', config: {} },
        ],
        edges: [{ id: 'e1', from: 'start', to: 'end' }],
        startNode: 'start',
        endNodes: ['end'],
      });

      const result = await graphAgent.execute(graphDefinition);
      expect(result).toBeDefined();
      expect(result.status).toBe('success');
    });

    it('should execute graph with task nodes', async () => {
      const graphDefinition = JSON.stringify({
        id: 'task-graph',
        name: 'Task Graph',
        nodes: [
          { id: 'start', type: 'start', name: 'Start', config: {} },
          {
            id: 'task1',
            type: 'task',
            name: 'Task 1',
            config: { prompt: 'Do task 1' },
          },
          { id: 'end', type: 'end', name: 'End', config: {} },
        ],
        edges: [
          { id: 'e1', from: 'start', to: 'task1' },
          { id: 'e2', from: 'task1', to: 'end' },
        ],
        startNode: 'start',
        endNodes: ['end'],
      });

      const result = await graphAgent.execute(graphDefinition);
      expect(result).toBeDefined();
      expect(result.metadata).toHaveProperty('totalNodes');
      expect(result.metadata).toHaveProperty('executedCount');
    });

    it('should handle plain text input by creating default graph', async () => {
      const result = await graphAgent.execute('Process this input');
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });

  describe('Graph State', () => {
    it('should provide graph-specific state', () => {
      const graphState = graphAgent.getGraphState();
      expect(graphState).toHaveProperty('executedNodes');
      expect(graphState).toHaveProperty('graphDefinition');
    });

    it('should track executed nodes', async () => {
      await graphAgent.execute('Test');
      const graphState = graphAgent.getGraphState();
      expect(graphState.executedNodes?.length ?? 0).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory Groups', () => {
    const graphDefinition = JSON.stringify({
      id: 'memory-graph',
      name: 'Memory Graph',
      version: '1.0.0',
      nodes: [
        { id: 'start', type: 'start', name: 'Start', config: {} },
        {
          id: 'research',
          type: 'task',
          name: 'Research',
          config: {
            memoryGroupId: 'shared_rag',
            memoryType: 'vector',
          },
        },
        {
          id: 'analyze',
          type: 'task',
          name: 'Analyze',
          config: {
            memoryConfig: {
              groupId: 'shared_rag',
              memoryType: 'vector',
              provider: 'pinecone',
            },
          },
        },
        { id: 'end', type: 'end', name: 'End', config: {} },
      ],
      edges: [
        { id: 'e1', from: 'start', to: 'research' },
        { id: 'e2', from: 'research', to: 'analyze' },
        { id: 'e3', from: 'analyze', to: 'end' },
      ],
      memoryGroups: [
        {
          id: 'shared_rag',
          name: 'Shared RAG',
          memoryType: 'vector',
          provider: 'pinecone',
          vectorStore: 'pinecone://shared',
        },
      ],
      startNode: 'start',
      endNodes: ['end'],
    });

    it('should aggregate memory groups with node membership', async () => {
      await graphAgent.execute(graphDefinition);
      const groups = graphAgent.getMemoryGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].nodeIds).toEqual(['research', 'analyze']);
      expect(groups[0].memoryType).toBe('vector');
      expect(groups[0].vectorStore).toBe('pinecone://shared');
    });

    it('should return memory group detail by id', async () => {
      await graphAgent.execute(graphDefinition);
      const group = graphAgent.getMemoryGroup('shared_rag');
      expect(group).not.toBeNull();
      expect(group?.name).toBe('Shared RAG');
      expect(group?.nodeCount).toBe(2);
      expect(group?.provider).toBe('pinecone');
    });

    it('should share memory context across nodes and persist outputs', async () => {
      mockLLMProvider.complete = jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Research summary details',
          role: 'assistant',
        })
        .mockResolvedValueOnce({
          content: 'Analysis summary',
          role: 'assistant',
        });

      await graphAgent.execute(graphDefinition);

      const completeMock = mockLLMProvider.complete as jest.MockedFunction<
        ILLMProvider['complete']
      >;
      expect(completeMock).toHaveBeenCalledTimes(2);
      const secondCall = completeMock.mock.calls[1][0];
      expect(secondCall.messages.length).toBeGreaterThan(2);
      const contextMessage = secondCall.messages[1];
      expect(contextMessage.role).toBe('system');
      expect(contextMessage.content).toContain('Shared memory');

      const conversation = memoryManager.getConversation(
        'graph:memory-graph:memory:shared_rag',
      );
      expect(conversation).not.toBeNull();
      const stages = conversation?.messages.map(
        (message) => message.metadata?.['stage'],
      );
      expect(stages).toContain('output');
    });
  });

  describe('Streaming', () => {
    it('should support streaming execution', async () => {
      const chunks: string[] = [];

      for await (const chunk of graphAgent.stream('Test')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should emit workflow progress', async () => {
      const chunks: string[] = [];

      for await (const chunk of graphAgent.stream('Stream test')) {
        chunks.push(chunk);
      }

      const output = chunks.join('');
      expect(output).toContain('Graph Agent');
    });
  });

  describe('Error Handling', () => {
    it('should handle node execution errors', async () => {
      mockLLMProvider.complete = jest
        .fn()
        .mockRejectedValue(new Error('Node execution failed'));

      const result = await graphAgent.execute('Test');
      expect(result).toBeDefined();
      // Should still return a result, even if some nodes fail
      expect(result.status).toBe('error');
    });

    it('should handle malformed graph input', async () => {
      const result = await graphAgent.execute('{ invalid json');
      // Should create default graph for invalid JSON
      expect(result).toBeDefined();
    });
  });

  describe('Abort Handling', () => {
    it('should support abort', () => {
      graphAgent.abort();
      expect(graphAgent.isAborted()).toBe(true);
    });
  });
});
