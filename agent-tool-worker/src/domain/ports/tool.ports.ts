/**
 * Domain Ports for Tool System
 *
 * Interfaces defining contracts for external dependencies.
 * These will be implemented by infrastructure adapters.
 */

import { ToolCall, ToolResult } from '../entities/tool.entities';

export interface ITool {
  readonly name: string;
  readonly description: string;
  readonly type: 'actor' | 'retriever';

  execute(call: ToolCall): Promise<ToolResult>;
  validate(input: unknown): boolean;
  setDependencies?(
    validator: IToolValidator,
    cache?: IToolCache,
    metrics?: IToolMetrics,
  ): void;
}

export interface IActor extends ITool {
  readonly type: 'actor';
  readonly requiresAuth: boolean;
  readonly category: string;
}

export interface IRetriever extends ITool {
  readonly type: 'retriever';
  readonly retrievalType: string;
  readonly caching: boolean;
}

export interface IToolValidator {
  validateToolInput(toolName: string, input: unknown): Promise<boolean>;
  validateToolOutput(toolName: string, output: unknown): Promise<boolean>;
}

export interface IToolCache {
  get(key: string): Promise<ToolResult | null>;
  set(key: string, result: ToolResult, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

export interface IToolMetrics {
  recordExecution(
    toolName: string,
    duration: number,
    success: boolean,
  ): Promise<void>;
  recordError(toolName: string, error: string): Promise<void>;
  getMetrics(toolName: string): Promise<{
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    errorCount: number;
  }>;
}
