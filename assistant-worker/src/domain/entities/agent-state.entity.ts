/**
 * Agent State Entity - Represents the current state of an agent
 * 
 * State machine implementation:
 * IDLE → PROCESSING → WAITING → COMPLETE
 *        ↓              ↓ (for Collective)
 *      ERROR      COORDINATING → SUB_AGENTS_WAITING
 */

export type AgentStateType =
  | 'idle'
  | 'processing'
  | 'waiting'
  | 'complete'
  | 'error'
  | 'coordinating'
  | 'sub-agents-waiting';

export class AgentState {
  private constructor(
    private readonly currentState: AgentStateType,
    private readonly errorMessage?: string,
    private readonly metadata?: Record<string, unknown>,
  ) {}

  // Factory methods for each state
  static idle(): AgentState {
    return new AgentState('idle');
  }

  static processing(metadata?: Record<string, unknown>): AgentState {
    return new AgentState('processing', undefined, metadata);
  }

  static waiting(metadata?: Record<string, unknown>): AgentState {
    return new AgentState('waiting', undefined, metadata);
  }

  static complete(metadata?: Record<string, unknown>): AgentState {
    return new AgentState('complete', undefined, metadata);
  }

  static error(errorMessage: string, metadata?: Record<string, unknown>): AgentState {
    return new AgentState('error', errorMessage, metadata);
  }

  static fromString(state: AgentStateType): AgentState {
    switch (state) {
      case 'idle':
        return AgentState.idle();
      case 'processing':
        return AgentState.processing();
      case 'waiting':
        return AgentState.waiting();
      case 'complete':
        return AgentState.complete();
      case 'error':
        return AgentState.error('Unknown error');
      case 'coordinating':
        return AgentState.processing({ __variant: 'coordinating' });
      case 'sub-agents-waiting':
        return AgentState.waiting({ __variant: 'sub-agents-waiting' });
      default:
        throw new Error(`Invalid agent state: ${state}`);
    }
  }

  getCurrentState(): AgentStateType {
    return this.currentState;
  }

  getErrorMessage(): string | undefined {
    return this.errorMessage;
  }

  getMetadata(): Record<string, unknown> | undefined {
    return this.metadata;
  }

  /**
   * State transition validation
   */
  canTransitionTo(targetState: AgentStateType): boolean {
    const transitions: Record<AgentStateType, AgentStateType[]> = {
      idle: ['processing'],
      processing: ['waiting', 'complete', 'error', 'coordinating'],
      waiting: ['processing', 'complete', 'error'],
      complete: ['idle'],
      error: ['idle'],
      coordinating: ['complete', 'error', 'sub-agents-waiting'],
      'sub-agents-waiting': ['processing', 'complete', 'error', 'waiting'],
    };

    return transitions[this.currentState]?.includes(targetState) || false;
  }

  /**
   * Attempt state transition
   */
  transitionTo(targetState: AgentStateType, metadata?: Record<string, unknown>): AgentState {
    if (!this.canTransitionTo(targetState)) {
      throw new Error(
        `Invalid state transition: ${this.currentState} → ${targetState}`,
      );
    }

    switch (targetState) {
      case 'idle':
        return AgentState.idle();
      case 'processing':
        return AgentState.processing(metadata);
      case 'waiting':
        return AgentState.waiting(metadata);
      case 'complete':
        return AgentState.complete(metadata);
      case 'error':
        return AgentState.error(
          (metadata?.errorMessage as string) || 'Unknown error',
          metadata,
        );
      case 'coordinating':
        return AgentState.processing({ ...metadata, __variant: 'coordinating' });
      case 'sub-agents-waiting':
        return AgentState.waiting({ ...metadata, __variant: 'sub-agents-waiting' });
      default:
        throw new Error(`Unknown target state: ${targetState}`);
    }
  }

  /**
   * Check if state is terminal
   */
  isTerminal(): boolean {
    return this.currentState === 'complete' || this.currentState === 'error';
  }

  /**
   * Convert to plain object
   */
  toPlainObject(): Record<string, unknown> {
    return {
      currentState: this.currentState,
      errorMessage: this.errorMessage,
      metadata: this.metadata,
    };
  }
}
