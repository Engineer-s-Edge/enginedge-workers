/**
 * Tool Metrics Adapter
 *
 * Implements metrics tracking for tool executions.
 */

import { Injectable } from '@nestjs/common';
import { IToolMetrics } from '../../domain/ports/tool.ports';

interface ToolMetricsData {
  totalExecutions: number;
  successCount: number;
  totalDuration: number;
  errorCount: number;
  errors: string[];
}

@Injectable()
export class ToolMetrics implements IToolMetrics {
  private metrics = new Map<string, ToolMetricsData>();

  /**
   * Record a tool execution
   */
  async recordExecution(toolName: string, duration: number, success: boolean): Promise<void> {
    const data = this.getOrCreateMetrics(toolName);
    
    data.totalExecutions++;
    data.totalDuration += duration;
    
    if (success) {
      data.successCount++;
    }
  }

  /**
   * Record a tool error
   */
  async recordError(toolName: string, error: string): Promise<void> {
    const data = this.getOrCreateMetrics(toolName);
    
    data.errorCount++;
    data.errors.push(error);
    
    // Keep only last 100 errors
    if (data.errors.length > 100) {
      data.errors.shift();
    }
  }

  /**
   * Get metrics for a specific tool
   */
  async getMetrics(toolName: string): Promise<{
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    errorCount: number;
  }> {
    const data = this.metrics.get(toolName);
    
    if (!data) {
      return {
        totalExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        errorCount: 0,
      };
    }

    return {
      totalExecutions: data.totalExecutions,
      successRate: data.totalExecutions > 0 ? data.successCount / data.totalExecutions : 0,
      averageDuration: data.totalExecutions > 0 ? data.totalDuration / data.totalExecutions : 0,
      errorCount: data.errorCount,
    };
  }

  private getOrCreateMetrics(toolName: string): ToolMetricsData {
    let data = this.metrics.get(toolName);
    
    if (!data) {
      data = {
        totalExecutions: 0,
        successCount: 0,
        totalDuration: 0,
        errorCount: 0,
        errors: [],
      };
      this.metrics.set(toolName, data);
    }
    
    return data;
  }
}
