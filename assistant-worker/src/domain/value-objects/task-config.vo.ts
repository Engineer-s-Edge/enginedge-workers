/**
 * Task Configuration Value Object
 * 
 * Describes a task within a Collective agent.
 * Used by Collective agents to coordinate work among child agents.
 */

import { AgentTypeValue } from '../enums/agent-type.enum';

export interface TaskConfigProps {
  taskId: string;
  description: string;
  assignedAgentTypes: readonly AgentTypeValue[];
  dependencies?: readonly string[]; // taskIds
  priority?: number;
  maxRetries?: number;
  timeoutMs?: number;
  inputData?: Record<string, unknown>;
}

/**
 * Immutable task configuration
 */
export class TaskConfig {
  private constructor(
    public readonly taskId: string,
    public readonly description: string,
    public readonly assignedAgentTypes: readonly AgentTypeValue[],
    public readonly dependencies: readonly string[],
    public readonly priority: number,
    public readonly maxRetries: number,
    public readonly timeoutMs: number,
    public readonly inputData: Record<string, unknown>,
  ) {}

  /**
   * Create with validation
   */
  static create(props: TaskConfigProps): TaskConfig {
    if (!props.taskId || props.taskId.trim().length === 0) {
      throw new Error('Task ID is required');
    }

    if (!props.description || props.description.trim().length === 0) {
      throw new Error('Task description is required');
    }

    if (props.assignedAgentTypes.length === 0) {
      throw new Error('At least one agent type must be assigned to task');
    }

    if (props.priority !== undefined && (props.priority < 0 || props.priority > 100)) {
      throw new Error('Priority must be between 0 and 100');
    }

    if (props.maxRetries !== undefined && props.maxRetries < 0) {
      throw new Error('Max retries cannot be negative');
    }

    if (props.timeoutMs !== undefined && props.timeoutMs < 100) {
      throw new Error('Timeout must be at least 100ms');
    }

    return new TaskConfig(
      props.taskId.trim(),
      props.description.trim(),
      props.assignedAgentTypes,
      props.dependencies || [],
      props.priority ?? 50,
      props.maxRetries ?? 3,
      props.timeoutMs ?? 300000, // 5 minutes default
      props.inputData || {},
    );
  }

  /**
   * Check if this task depends on another
   */
  dependsOn(taskId: string): boolean {
    return this.dependencies.includes(taskId);
  }

  /**
   * Check if task has any dependencies
   */
  hasDependencies(): boolean {
    return this.dependencies.length > 0;
  }

  /**
   * Get task as plain object (for persistence/serialization)
   */
  toPlain(): TaskConfigProps {
    return {
      taskId: this.taskId,
      description: this.description,
      assignedAgentTypes: this.assignedAgentTypes,
      dependencies: this.dependencies.length > 0 ? this.dependencies : undefined,
      priority: this.priority,
      maxRetries: this.maxRetries,
      timeoutMs: this.timeoutMs,
      inputData: this.inputData,
    };
  }

  /**
   * Update specific properties (returns new instance)
   */
  update(updates: Partial<TaskConfigProps>): TaskConfig {
    return TaskConfig.create({
      taskId: updates.taskId ?? this.taskId,
      description: updates.description ?? this.description,
      assignedAgentTypes: updates.assignedAgentTypes ?? this.assignedAgentTypes,
      dependencies: updates.dependencies ?? this.dependencies,
      priority: updates.priority ?? this.priority,
      maxRetries: updates.maxRetries ?? this.maxRetries,
      timeoutMs: updates.timeoutMs ?? this.timeoutMs,
      inputData: updates.inputData ?? this.inputData,
    });
  }
}
