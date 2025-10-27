/**
 * ToolService - Application Layer
 *
 * Orchestrates tool execution with validation, caching, and metrics.
 * Acts as the main entry point for tool operations.
 */

import { Injectable, Inject } from '@nestjs/common';
import { IToolValidator, IToolCache, IToolMetrics } from '@domain/ports/tool.ports';
import { ToolCall, ToolResult } from '@domain/entities/tool.entities';
import { ToolRegistry } from './tool-registry.service';

@Injectable()
export class ToolService {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    @Inject('IToolValidator') private readonly validator: IToolValidator,
    @Inject('IToolCache') private readonly cache?: IToolCache,
    @Inject('IToolMetrics') private readonly metrics?: IToolMetrics,
  ) {}

  /**
   * Execute a tool by name
   */
  async executeTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.toolRegistry.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    // Set dependencies on the tool
    tool.setDependencies?.(this.validator, this.cache, this.metrics);

    const call: ToolCall = {
      name: toolName,
      args,
    };

    return await tool.execute(call);
  }

  /**
   * Execute multiple tools in parallel
   */
  async executeTools(tools: Array<{ name: string; args: Record<string, unknown> }>): Promise<ToolResult[]> {
    const promises = tools.map(({ name, args }) => this.executeTool(name, args));
    return await Promise.all(promises);
  }

  /**
   * Execute multiple tools sequentially
   */
  async executeToolsSequential(tools: Array<{ name: string; args: Record<string, unknown> }>): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const { name, args } of tools) {
      const result = await this.executeTool(name, args);
      results.push(result);
    }

    return results;
  }

  /**
   * Validate tool input without executing
   */
  async validateToolInput(toolName: string, input: unknown): Promise<boolean> {
    const tool = this.toolRegistry.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    return await this.validator.validateToolInput(toolName, input);
  }

  /**
   * Get tool execution statistics
   */
  async getToolMetrics(toolName: string): Promise<{
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    errorCount: number;
  } | null> {
    if (!this.metrics) {
      return null;
    }

    return await this.metrics.getMetrics(toolName);
  }

  /**
   * Clear cache for a specific tool
   */
  async clearToolCache(toolName: string): Promise<void> {
    if (!this.cache) {
      return;
    }

    await this.cache.invalidate(`${toolName}:*`);
  }

  /**
   * Clear all tool caches
   */
  async clearAllCaches(): Promise<void> {
    if (!this.cache) {
      return;
    }

    await this.cache.invalidate('*');
  }

  /**
   * Get available tools summary
   */
  getAvailableTools(): {
    total: number;
    actors: number;
    retrievers: number;
    tools: Array<{
      name: string;
      description: string;
      type: 'actor' | 'retriever';
    }>;
  } {
    const counts = this.toolRegistry.getToolCount();
    const tools = this.toolRegistry.getToolInfos().map(info => ({
      name: info.name,
      description: info.description,
      type: info.type,
    }));

    return {
      ...counts,
      tools,
    };
  }
}