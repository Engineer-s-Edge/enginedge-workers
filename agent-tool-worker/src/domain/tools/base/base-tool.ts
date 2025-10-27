/**
 * BaseTool - Abstract base class for all tools
 *
 * Provides common execution flow with validation, retries, error handling,
 * and metrics collection. Follows hexagonal architecture principles.
 */

import Ajv, { ValidateFunction } from 'ajv';
import {
  ToolCall,
  ToolResult,
  ToolSuccess,
  ToolFailure,
  ToolError,
  ToolOutput,
} from '../../entities/tool.entities';
import {
  ToolMetadata,
  ErrorEvent,
} from '../../value-objects/tool-config.value-objects';
import { ITool, IToolValidator, IToolCache, IToolMetrics } from '../../ports/tool.ports';

export abstract class BaseTool<TArgs = unknown, TOutput extends ToolOutput = ToolOutput>
  implements ITool
{
  // Metadata - implemented by concrete classes
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly type: 'actor' | 'retriever';
  abstract readonly metadata: ToolMetadata;
  abstract readonly errorEvents: ErrorEvent[];

  // Dependencies - injected by infrastructure
  protected validator?: IToolValidator;
  protected cache?: IToolCache;
  protected metrics?: IToolMetrics;

  private inputValidator?: ValidateFunction;
  private outputValidator?: ValidateFunction;
  private ajv = new Ajv();

  /**
   * Set infrastructure dependencies (called by DI container)
   */
  setDependencies(
    validator: IToolValidator,
    cache?: IToolCache,
    metrics?: IToolMetrics,
  ): void {
    this.validator = validator;
    this.cache = cache;
    this.metrics = metrics;
  }

  /**
   * Public entrypoint for tool execution with full error handling and metrics
   */
  async execute(call: ToolCall): Promise<ToolResult<TArgs, TOutput>> {
    const startTime = new Date();

    try {
      // Validate input
      if (!(await this.validateInput(call.args))) {
        const error: ToolError = {
          name: 'ValidationError',
          message: 'Input does not match schema',
          retryable: false,
        };
        await this.recordMetrics(call.name, startTime, false, error.name);
        return this.createFailure(call, error, startTime) as ToolResult<TArgs, TOutput>;
      }

      // Check cache for retrievers
      if (this.type === 'retriever' && this.cache) {
        const cacheKey = this.generateCacheKey(call);
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          await this.recordMetrics(call.name, startTime, true);
          return cached as ToolResult<TArgs, TOutput>;
        }
      }

      // Execute with retries
      const result = await this.executeWithRetries(call);

      // Validate output
      if (!(await this.validateOutput(result.output))) {
        const error: ToolError = {
          name: 'OutputValidationError',
          message: 'Output does not match schema',
          retryable: false,
        };
        await this.recordMetrics(call.name, startTime, false, error.name);
        return this.createFailure(call, error, startTime) as ToolResult<TArgs, TOutput>;
      }

      // Cache result for retrievers
      if (this.type === 'retriever' && this.cache && result.success) {
        const cacheKey = this.generateCacheKey(call);
        await this.cache.set(cacheKey, result);
      }

      await this.recordMetrics(call.name, startTime, result.success);
      return result;

    } catch (error: unknown) {
      const toolError: ToolError = {
        name: (error as Error)?.name || 'UnknownError',
        message: (error as Error)?.message || 'An unknown error occurred',
        retryable: this.isRetryableError(error),
      };

      await this.recordMetrics(call.name, startTime, false, toolError.name);
      return this.createFailure(call, toolError, startTime) as ToolResult<TArgs, TOutput>;
    }
  }

  /**
   * Validate input using JSON schema
   */
  async validateInput(input: unknown): Promise<boolean> {
    if (!this.validator) return true; // Fallback if no validator provided

    if (!this.inputValidator) {
      this.inputValidator = this.ajv.compile(this.metadata.inputSchema);
    }

    return this.inputValidator(input) as boolean;
  }

  /**
   * Validate output using JSON schema
   */
  async validateOutput(output: unknown): Promise<boolean> {
    if (!this.validator) return true; // Fallback if no validator provided

    if (!this.outputValidator) {
      this.outputValidator = this.ajv.compile(this.metadata.outputSchema);
    }

    return this.outputValidator(output) as boolean;
  }

  /**
   * Execute tool with retry logic
   */
  private async executeWithRetries(call: ToolCall): Promise<ToolResult<TArgs, TOutput>> {
    let lastError: ToolError | null = null;

    for (let attempt = 1; attempt <= this.metadata.retries + 1; attempt++) {
      try {
        const output = await this.executeTool(call.args as TArgs);
        return this.createSuccess(call, output, new Date());
      } catch (error: unknown) {
        lastError = {
          name: (error as Error)?.name || 'ExecutionError',
          message: (error as Error)?.message || 'Tool execution failed',
          retryable: this.isRetryableError(error),
        };

        // Check if we should retry
        if (!lastError.retryable || attempt > this.metadata.retries) {
          break;
        }

        // Wait before retry (exponential backoff)
        await this.delay(Math.pow(2, attempt - 1) * 1000);
      }
    }

    return this.createFailure(call, lastError!, new Date()) as ToolResult<TArgs, TOutput>;
  }

  /**
   * Execute the concrete tool logic (implemented by subclasses)
   */
  protected abstract executeTool(args: TArgs): Promise<TOutput>;

  /**
   * Optional hook for pause-before-use functionality
   */
  protected async onPause(_call: ToolCall): Promise<void> {
    // Default no-op; override in subclasses if needed
  }

  /**
   * Generate cache key for retrievers
   */
  protected generateCacheKey(call: ToolCall): string {
    return `${this.name}:${JSON.stringify(call.args)}`;
  }

  /**
   * Check if an error is retryable based on error events
   */
  private isRetryableError(error: unknown): boolean {
    const errorName = (error as Error)?.name;
    if (!errorName) return false;
    const errorEvent = this.errorEvents.find(e => e.name === errorName);
    return errorEvent?.retryable ?? false;
  }

  /**
   * Record execution metrics
   */
  private async recordMetrics(
    toolName: string,
    startTime: Date,
    success: boolean,
    errorName?: string,
  ): Promise<void> {
    if (!this.metrics) return;

    const duration = Date.now() - startTime.getTime();

    if (success) {
      await this.metrics.recordExecution(toolName, duration, true);
    } else {
      await this.metrics.recordExecution(toolName, duration, false);
      if (errorName) {
        await this.metrics.recordError(toolName, errorName);
      }
    }
  }

  /**
   * Create success result
   */
  private createSuccess(
    call: ToolCall,
    output: TOutput,
    endTime: Date,
  ): ToolSuccess<TArgs, TOutput> {
    return {
      success: true,
      call,
      output,
      startTime: new Date(),
      endTime,
      attempts: 1,
      durationMs: endTime.getTime() - Date.now(),
    };
  }

  /**
   * Create failure result
   */
  private createFailure(
    call: ToolCall,
    error: ToolError,
    startTime: Date,
  ): ToolFailure<TArgs> {
    const endTime = new Date();
    return {
      success: false,
      call,
      error,
      startTime,
      endTime,
      attempts: 1,
      durationMs: endTime.getTime() - startTime.getTime(),
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate method for ITool interface
   */
  validate(input: unknown): boolean {
    // Synchronous validation for interface compatibility
    if (!this.inputValidator) {
      this.inputValidator = this.ajv.compile(this.metadata.inputSchema);
    }
    return this.inputValidator(input) as boolean;
  }
}