import { BaseAgent } from '../../../domain/agents/agent.base';
import { ExecutionContext, ExecutionResult } from '../../../domain/entities';
import { ILogger } from '../../../domain/ports/logger.port';
import { ILLMProvider } from '../../../domain/ports/llm-provider.port';

// Create a concrete implementation for testing
class TestAgent extends BaseAgent {
  protected async run(
    input: string,
    context: ExecutionContext,
  ): Promise<ExecutionResult> {
    return {
      status: 'success',
      output: 'test output',
      metadata: {},
    };
  }

  protected async *runStream(
    input: string,
    context: ExecutionContext,
  ): AsyncGenerator<string> {
    yield 'test';
    yield ' ';
    yield 'output';
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let mockLogger: ILogger;
  let mockLLM: ILLMProvider;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      setLevel: jest.fn(),
      getLevel: jest.fn().mockReturnValue('info'),
    } as unknown as ILogger;

    mockLLM = {
      generate: jest.fn(),
      generateStream: jest.fn(),
    } as unknown as ILLMProvider;

    agent = new TestAgent(mockLLM, mockLogger);
  });

  describe('execute', () => {
    it('should successfully execute and return result', async () => {
      const result = await agent.execute('test input');

      expect(result.status).toBe('success');
      expect(result.output).toBe('test output');
      expect((agent as any).internalState.status).toBe('complete');
    });

    it('should emit events during execution', async () => {
      const emitSpy = jest.spyOn((agent as any).eventEmitter, 'emit');

      await agent.execute('test input');

      expect(emitSpy).toHaveBeenCalledWith('agent:started', expect.any(Object));
      expect(emitSpy).toHaveBeenCalledWith(
        'agent:completed',
        expect.any(Object),
      );
    });
  });

  describe('stream', () => {
    it('should stream tokens', async () => {
      const tokens: string[] = [];

      for await (const token of agent.stream('test input')) {
        tokens.push(token);
      }

      expect(tokens).toEqual(['test', ' ', 'output']);
      expect((agent as any).internalState.status).toBe('complete');
    });

    it('should emit streaming events', async () => {
      const emitSpy = jest.spyOn((agent as any).eventEmitter, 'emit');

      const tokens: string[] = [];
      for await (const token of agent.stream('test input')) {
        tokens.push(token);
      }

      expect(emitSpy).toHaveBeenCalledWith(
        'agent:stream_started',
        expect.any(Object),
      );
      expect(emitSpy).toHaveBeenCalledWith(
        'agent:stream_completed',
        expect.any(Object),
      );
    });
  });

  describe('abort', () => {
    it('should abort execution', () => {
      agent.abort();
      expect((agent as any).internalState.status).toBe('aborted');
    });
  });
});
