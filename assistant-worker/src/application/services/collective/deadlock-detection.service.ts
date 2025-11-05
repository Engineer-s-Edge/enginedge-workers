/**
 * Deadlock Detection Service
 *
 * Detects circular dependencies in task graph using DFS cycle detection.
 * Enhanced with dependency graph analysis.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import { CollectiveTask, TaskState } from '@domain/entities/collective-task.entity';
import {
  IDeadlockDetectionService,
  DeadlockInfo,
} from '@domain/ports/deadlock-detection.port';

@Injectable()
export class DeadlockDetectionService implements IDeadlockDetectionService {
  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * Detect all deadlocks in a task graph
   */
  async detectDeadlocks(
    tasks: CollectiveTask[],
  ): Promise<DeadlockInfo[]> {
    const blockedTasks = tasks.filter((t) => t.state === TaskState.BLOCKED);
    const deadlocks: DeadlockInfo[] = [];
    const visitedGlobal = new Set<string>();

    for (const task of blockedTasks) {
      const taskId = task.id;

      if (visitedGlobal.has(taskId)) {
        continue;
      }

      const visited = new Set<string>();
      const path: string[] = [];
      const cycle = this.detectCycle(taskId, visited, path, tasks);

      if (cycle && cycle.length > 0) {
        // Mark all tasks in cycle as visited globally
        cycle.forEach((id) => visitedGlobal.add(id));

        // Get involved agents
        const involvedAgents = this.getInvolvedAgents(cycle, tasks);

        // Determine severity
        const severity = this.determineSeverity(cycle, tasks);

        deadlocks.push({
          id: `deadlock-${Date.now()}-${deadlocks.length}`,
          cycle,
          involvedAgents,
          detectedAt: new Date(),
          severity,
        });

        this.logger.warn(`Deadlock detected: ${cycle.join(' → ')}`, {
          severity,
          involvedAgents,
        });
      }
    }

    return deadlocks;
  }

  /**
   * DFS cycle detection
   */
  private detectCycle(
    taskId: string,
    visited: Set<string>,
    path: string[],
    allTasks: CollectiveTask[],
  ): string[] | null {
    // Check if we've found a cycle
    const cycleStartIndex = path.indexOf(taskId);
    if (cycleStartIndex !== -1) {
      // Return the cycle
      return path.slice(cycleStartIndex);
    }

    if (visited.has(taskId)) {
      return null;
    }

    visited.add(taskId);
    path.push(taskId);

    // Find the task
    const task = allTasks.find((t) => t.id === taskId);

    if (!task || !task.blockedBy || task.blockedBy.length === 0) {
      path.pop();
      return null;
    }

    // Explore all blocking tasks
    for (const blockerId of task.blockedBy) {
      const cycle = this.detectCycle(blockerId, visited, path, allTasks);

      if (cycle) {
        return cycle;
      }
    }

    path.pop();
    return null;
  }

  /**
   * Get agents involved in deadlock
   */
  private getInvolvedAgents(cycle: string[], tasks: CollectiveTask[]): string[] {
    const agents = new Set<string>();

    for (const taskId of cycle) {
      const task = tasks.find((t) => t.id === taskId);
      if (task?.assignedAgentId) {
        agents.add(task.assignedAgentId);
      }
    }

    return Array.from(agents);
  }

  /**
   * Determine deadlock severity
   */
  private determineSeverity(
    cycle: string[],
    tasks: CollectiveTask[],
  ): 'low' | 'medium' | 'high' {
    const cycleTasks = tasks.filter((t) => cycle.includes(t.id));

    // High severity: Critical tasks in cycle
    const hasCriticalTasks = cycleTasks.some((t) => t.priority >= 80);
    if (hasCriticalTasks) {
      return 'high';
    }

    // Medium severity: Multiple tasks or long cycle
    if (cycle.length > 3 || cycleTasks.length > 3) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Check if a specific task is in a deadlock
   */
  async isTaskDeadlocked(
    taskId: string,
    tasks: CollectiveTask[],
  ): Promise<boolean> {
    const deadlocks = await this.detectDeadlocks(tasks);
    return deadlocks.some((d) => d.cycle.includes(taskId));
  }

  /**
   * Find potential deadlock risks (tasks that could lead to deadlocks)
   */
  async findDeadlockRisks(tasks: CollectiveTask[]): Promise<string[]> {
    const risks: string[] = [];
    const dependencyGraph = new Map<string, Set<string>>();

    // Build dependency graph
    for (const task of tasks) {
      const dependents = new Set<string>();
      for (const depId of task.dependencies) {
        const depTask = tasks.find((t) => t.id === depId);
        if (depTask) {
          dependents.add(depTask.id);
        }
      }
      dependencyGraph.set(task.id, dependents);
    }

    // Find tasks with many dependencies
    for (const task of tasks) {
      if (task.dependencies.length > 5) {
        risks.push(task.id);
      }

      // Check for bidirectional dependencies
      for (const depId of task.dependencies) {
        const depTask = tasks.find((t) => t.id === depId);
        if (depTask?.dependencies.includes(task.id)) {
          risks.push(task.id);
          risks.push(depId);
        }
      }
    }

    return Array.from(new Set(risks));
  }
}
