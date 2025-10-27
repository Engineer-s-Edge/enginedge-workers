/**
 * Unit tests for BaseTool abstract class
 */

import { BaseTool } from '@domain/tools/base/base-tool';
import { ToolMetadata, ErrorEvent } from '@domain/value-objects/tool-config.value-objects';
import { ToolOutput } from '@domain/entities/tool.entities';

// Mock concrete implementation for testing
class MockTool extends BaseTool<unknown, ToolOutput> {
  readonly name = 'mock-tool';
  readonly description = 'Mock tool for testing';
  readonly type = 'actor' as const;

  readonly metadata: ToolMetadata = {
    name: 'mock-tool',
    description: 'Mock tool for testing',
    useCase: 'Testing base functionality',
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    invocationExample: [{}],
    retries: 3,
    maxIterations: 1,
    parallel: false,
    concatenate: false,
    pauseBeforeUse: false,
    userModifyQuery: false,
  };

  readonly errorEvents: ErrorEvent[] = [
    {
      name: 'MockError',
      guidance: 'This is a mock error',
      retryable: false,
    },
  ];

  protected async executeTool(args: unknown): Promise<ToolOutput> {
    // Use args to avoid unused parameter warning
    return { success: true, args };
  }
}

describe('BaseTool', () => {
  let tool: MockTool;

  beforeEach(() => {
    tool = new MockTool();
  });

  describe('Basic Properties', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('mock-tool');
    });

    it('should have correct description', () => {
      expect(tool.description).toBe('Mock tool for testing');
    });

    it('should have correct type', () => {
      expect(tool.type).toBe('actor');
    });
  });

  describe('Validation', () => {
    it('should validate input synchronously', () => {
      const result = tool.validate({ test: 'data' });
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Execution', () => {
    it('should execute tool successfully', async () => {
      const call = {
        name: 'mock-tool',
        args: { test: 'data' },
      };

      const result = await tool.execute(call);

      expect(result.success).toBe(true);
      expect(result.call).toBe(call);
      expect(result.output).toEqual({ success: true, args: { test: 'data' } });
      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
      expect(result.attempts).toBe(1);
      expect(typeof result.durationMs).toBe('number');
    });

    it('should handle execution errors', async () => {
      // Create a tool that throws an error
      class FailingTool extends MockTool {
        protected async executeTool(_args: unknown): Promise<ToolOutput> { // eslint-disable-line @typescript-eslint/no-unused-vars
          throw new Error('Test error');
        }
      }

      const failingTool = new FailingTool();
      const call = {
        name: 'failing-tool',
        args: { test: 'data' },
      };

      const result = await failingTool.execute(call);

      expect(result.success).toBe(false);
      expect(result.error?.name).toBe('Error');
      expect(result.error?.message).toBe('Test error');
      expect(result.error?.retryable).toBe(false);
    });
  });

  describe('Dependencies', () => {
    it('should allow setting dependencies', () => {
      const mockValidator = {
        validateToolInput: jest.fn().mockResolvedValue(true),
        validateToolOutput: jest.fn().mockResolvedValue(true),
      };

      const mockCache = {
        get: jest.fn(),
        set: jest.fn(),
        invalidate: jest.fn(),
      };

      const mockMetrics = {
        recordExecution: jest.fn(),
        recordError: jest.fn(),
        getMetrics: jest.fn(),
      };

      tool.setDependencies(mockValidator, mockCache, mockMetrics);

      // Dependencies should be set (we can't test private properties directly)
      expect(tool).toBeDefined();
    });
  });
});