/**
 * Coordination Context Value Object
 * 
 * Collective-specific context for multi-agent coordination.
 * Manages task graph, agent assignments, and coordination state.
 */

import { TaskConfig } from './task-config.vo';

export type CoordinationStrategy = 'voting' | 'consensus' | 'hierarchical' | 'sequential';

export interface CoordinationContextProps {
  strategy: CoordinationStrategy;
  maxParallelTasks: number;
  taskGraph: Map<string, TaskConfig>;
  childAgentAssignments: Map<string, readonly string[]>; // agentId -> taskIds
  deadlockDetectionEnabled: boolean;
  eventLog?: readonly CoordinationEvent[];
}

export interface CoordinationEvent {
  timestamp: Date;
  type:
    | 'task-started'
    | 'task-completed'
    | 'task-failed'
    | 'deadlock-detected'
    | 'agent-joined'
    | 'agent-left'
    | 'coordination-paused'
    | 'coordination-resumed';
  sourceAgentId?: string;
  data: Record<string, unknown>;
}

/**
 * Immutable coordination context for Collective agents
 */
export class CoordinationContext {
  private constructor(
    public readonly strategy: CoordinationStrategy,
    public readonly maxParallelTasks: number,
    public readonly taskGraph: Map<string, TaskConfig>,
    public readonly childAgentAssignments: Map<string, readonly string[]>,
    public readonly deadlockDetectionEnabled: boolean,
    public readonly eventLog: readonly CoordinationEvent[],
  ) {}

  /**
   * Create with validation
   */
  static create(props: CoordinationContextProps): CoordinationContext {
    if (props.maxParallelTasks < 1) {
      throw new Error('maxParallelTasks must be at least 1');
    }

    if (props.taskGraph.size === 0) {
      throw new Error('Task graph must contain at least one task');
    }

    if (props.childAgentAssignments.size === 0) {
      throw new Error('At least one agent must be assigned tasks');
    }

    // Validate no tasks are orphaned
    const assignedTasks = new Set<string>();
    for (const tasks of props.childAgentAssignments.values()) {
      tasks.forEach(t => assignedTasks.add(t));
    }

    for (const taskId of props.taskGraph.keys()) {
      if (!assignedTasks.has(taskId)) {
        throw new Error(`Task "${taskId}" is not assigned to any agent`);
      }
    }

    return new CoordinationContext(
      props.strategy,
      props.maxParallelTasks,
      props.taskGraph,
      props.childAgentAssignments,
      props.deadlockDetectionEnabled,
      props.eventLog || [],
    );
  }

  /**
   * Create empty coordination context
   */
  static empty(): CoordinationContext {
    return new CoordinationContext(
      'hierarchical',
      5,
      new Map(),
      new Map(),
      true,
      [],
    );
  }

  /**
   * Get all tasks
   */
  getTasks(): readonly TaskConfig[] {
    return Array.from(this.taskGraph.values());
  }

  /**
   * Get tasks for a specific agent
   */
  getTasksForAgent(agentId: string): readonly TaskConfig[] {
    const taskIds = this.childAgentAssignments.get(agentId) || [];
    return taskIds
      .map(id => this.taskGraph.get(id))
      .filter((task): task is TaskConfig => task !== undefined);
  }

  /**
   * Check for circular dependencies in task graph
   * Returns null if no cycle, or taskIds forming the cycle
   */
  detectCyclicDependency(): string[] | null {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (taskId: string, path: string[]): string[] | null => {
      visited.add(taskId);
      recursionStack.add(taskId);
      path.push(taskId);

      const task = this.taskGraph.get(taskId);
      if (!task) return null;

      for (const depId of task.dependencies) {
        if (!visited.has(depId)) {
          const cycle = hasCycle(depId, [...path]);
          if (cycle) return cycle;
        } else if (recursionStack.has(depId)) {
          // Found cycle
          const cycleStart = path.indexOf(depId);
          return path.slice(cycleStart);
        }
      }

      recursionStack.delete(taskId);
      return null;
    };

    for (const taskId of this.taskGraph.keys()) {
      if (!visited.has(taskId)) {
        const cycle = hasCycle(taskId, []);
        if (cycle) return cycle;
      }
    }

    return null;
  }

  /**
   * Detect potential deadlocks (all agents waiting for each other)
   */
  detectDeadlock(): boolean {
    if (this.taskGraph.size === 0) return false;

    // Check if there's any task with no dependencies
    for (const task of this.getTasks()) {
      if (!task.hasDependencies()) {
        return false; // At least one task can start
      }
    }

    return true; // All tasks have dependencies - potential deadlock
  }

  /**
   * Add event to log
   */
  addEvent(event: CoordinationEvent): CoordinationContext {
    const newLog = [...this.eventLog, event];
    return new CoordinationContext(
      this.strategy,
      this.maxParallelTasks,
      this.taskGraph,
      this.childAgentAssignments,
      this.deadlockDetectionEnabled,
      newLog,
    );
  }

  /**
   * Get recent events (last N)
   */
  getRecentEvents(count: number): readonly CoordinationEvent[] {
    return this.eventLog.slice(-count);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: CoordinationEvent['type']): readonly CoordinationEvent[] {
    return this.eventLog.filter(e => e.type === type);
  }

  /**
   * Check if coordination is currently active (has tasks in progress)
   */
  hasActiveTasks(): boolean {
    return this.getEventsByType('task-started').length >
      this.getEventsByType('task-completed').length;
  }

  /**
   * Convert to plain object
   */
  toPlain(): Record<string, unknown> {
    return {
      strategy: this.strategy,
      maxParallelTasks: this.maxParallelTasks,
      taskCount: this.taskGraph.size,
      agentCount: this.childAgentAssignments.size,
      deadlockDetectionEnabled: this.deadlockDetectionEnabled,
      eventLogSize: this.eventLog.length,
      hasActiveTasks: this.hasActiveTasks(),
    };
  }
}
