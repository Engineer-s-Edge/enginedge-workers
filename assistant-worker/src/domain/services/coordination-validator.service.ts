/**
 * Coordination Validator Service
 *
 * Validates Collective agent configurations for deadlocks and inconsistencies.
 * Ensures coordination context is well-formed before execution.
 */

import { Injectable } from '@nestjs/common';
import { CoordinationContext } from '../value-objects/coordination-context.vo';
import { TaskConfig } from '../value-objects/task-config.vo';
import { AgentReference } from '../value-objects/agent-reference.vo';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Service for validating Collective agent coordination
 */
@Injectable()
export class CoordinationValidatorService {
  /**
   * Validate a coordination context
   */
  validateContext(context: CoordinationContext): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for cycles
    const cycle = context.detectCyclicDependency();
    if (cycle) {
      errors.push(
        `Circular dependency detected in task graph: ${cycle.join(' → ')}`,
      );
    }

    // Check for potential deadlocks
    if (context.detectDeadlock()) {
      errors.push('All tasks have dependencies - potential deadlock detected');
    }

    // Check for orphaned tasks
    const assignedTasks = new Set<string>();
    for (const tasks of context.childAgentAssignments.values()) {
      tasks.forEach((t) => assignedTasks.add(t));
    }

    for (const taskId of context.taskGraph.keys()) {
      if (!assignedTasks.has(taskId)) {
        errors.push(`Task "${taskId}" is not assigned to any agent`);
      }
    }

    // Check for orphaned agents
    const tasksPerAgent = new Map<string, number>();
    for (const [agentId, tasks] of context.childAgentAssignments.entries()) {
      tasksPerAgent.set(agentId, tasks.length);
      if (tasks.length === 0) {
        warnings.push(`Agent "${agentId}" has no assigned tasks`);
      }
    }

    // Check for unbalanced workload
    if (tasksPerAgent.size > 0) {
      const counts = Array.from(tasksPerAgent.values());
      const maxCount = Math.max(...counts);
      const minCount = Math.min(...counts);
      const imbalance = maxCount / (minCount || 1);

      if (imbalance > 2) {
        warnings.push(
          `Unbalanced task distribution: some agents have ${maxCount}x more tasks than others`,
        );
      }
    }

    // Check task validity
    for (const task of context.getTasks()) {
      if (task.assignedAgentTypes.length === 0) {
        errors.push(`Task "${task.taskId}" has no assigned agent types`);
      }

      // Check dependencies exist
      for (const depId of task.dependencies) {
        if (!context.taskGraph.has(depId)) {
          errors.push(
            `Task "${task.taskId}" depends on non-existent task "${depId}"`,
          );
        }
      }

      // Check timeout validity
      if (task.timeoutMs < 100) {
        errors.push(`Task "${task.taskId}" timeout is too short (< 100ms)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate child agents for a Collective
   */
  validateChildAgents(
    childAgents: readonly AgentReference[],
    maxChildren: number,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check count
    if (childAgents.length === 0) {
      errors.push('Collective must have at least one child agent');
    }

    if (childAgents.length > maxChildren) {
      errors.push(
        `Collective exceeds maximum child agents: ${childAgents.length} > ${maxChildren}`,
      );
    }

    // Check for duplicates
    const seenIds = new Set<string>();
    for (const agent of childAgents) {
      if (seenIds.has(agent.agentId)) {
        errors.push(`Duplicate child agent: "${agent.agentId}"`);
      }
      seenIds.add(agent.agentId);
    }

    // Check for circular references (child → parent)
    // Note: This would need access to parent Agent to fully validate
    // For now, we just ensure child IDs are valid
    for (const agent of childAgents) {
      if (!agent.agentId || agent.agentId.trim().length === 0) {
        errors.push('Child agent has invalid ID');
      }

      if (!agent.name || agent.name.trim().length === 0) {
        warnings.push(`Child agent "${agent.agentId}" has empty name`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate task configuration
   */
  validateTask(task: TaskConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!task.taskId || task.taskId.trim().length === 0) {
      errors.push('Task ID is required');
    }

    if (!task.description || task.description.trim().length === 0) {
      errors.push('Task description is required');
    }

    if (task.assignedAgentTypes.length === 0) {
      errors.push('Task must have at least one assigned agent type');
    }

    if (task.priority < 0 || task.priority > 100) {
      errors.push('Task priority must be between 0 and 100');
    }

    if (task.maxRetries < 0) {
      errors.push('Task maxRetries cannot be negative');
    }

    if (task.timeoutMs < 100) {
      errors.push('Task timeout must be at least 100ms');
    }

    if (task.maxRetries === 0 && task.assignedAgentTypes.length > 1) {
      warnings.push(
        `Task with no retries assigned to multiple agent types might fail if first agent fails`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check for common configuration issues
   */
  identifyIssues(context: CoordinationContext): string[] {
    const issues: string[] = [];

    // Check if all tasks have same priority
    const priorities = new Set(context.getTasks().map((t) => t.priority));
    if (priorities.size === 1 && priorities.has(50)) {
      issues.push(
        'All tasks have default priority - consider setting differentiated priorities',
      );
    }

    // Check if any task has very long timeout
    for (const task of context.getTasks()) {
      if (task.timeoutMs > 600000) {
        // 10 minutes
        issues.push(
          `Task "${task.taskId}" has very long timeout (${task.timeoutMs}ms) - may cause coordination delays`,
        );
      }
    }

    // Check for tasks with no dependencies at intermediate positions
    const allTaskIds = new Set(context.taskGraph.keys());
    let independentCount = 0;
    for (const task of context.getTasks()) {
      if (!task.hasDependencies()) {
        independentCount++;
      }
    }

    if (independentCount > 1 && independentCount < allTaskIds.size) {
      issues.push(
        `Multiple independent tasks detected - coordination strategy may not handle parallel starts effectively`,
      );
    }

    // Check strategy compatibility
    if (context.strategy === 'sequential' && context.maxParallelTasks > 1) {
      issues.push(
        'Sequential coordination strategy used but maxParallelTasks > 1 - these settings conflict',
      );
    }

    return issues;
  }

  /**
   * Get a full validation report
   */
  getFullReport(context: CoordinationContext): Record<string, unknown> {
    const contextValidation = this.validateContext(context);
    const issues = this.identifyIssues(context);

    return {
      timestamp: new Date().toISOString(),
      context: {
        strategy: context.strategy,
        taskCount: context.taskGraph.size,
        agentCount: context.childAgentAssignments.size,
        maxParallelTasks: context.maxParallelTasks,
      },
      validation: contextValidation,
      issues,
      summary: {
        taskGraph: {
          nodes: context.taskGraph.size,
          edges: Array.from(context.getTasks()).reduce(
            (sum, task) => sum + task.dependencies.length,
            0,
          ),
          hasCycles: contextValidation.errors.some((e) =>
            e.includes('Circular dependency'),
          ),
        },
        coordination: {
          hasDeadlock: contextValidation.errors.some((e) =>
            e.includes('deadlock'),
          ),
          isBalanced: contextValidation.warnings.every(
            (w) => !w.includes('Unbalanced'),
          ),
        },
      },
    };
  }
}
