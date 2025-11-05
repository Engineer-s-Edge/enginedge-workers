/**
 * State Machine Service
 *
 * Centralized state transition validation and management.
 * Ensures all agents follow proper state machine rules.
 */

import { Agent } from '../entities/agent.entity';
import { AgentState, AgentStateType } from '../entities/agent-state.entity';
import { AgentType } from '../enums/agent-type.enum';

export interface StateTransitionRequest {
  agent: Agent;
  targetState: AgentStateType;
  metadata?: Record<string, unknown>;
}

export interface StateTransitionResult {
  allowed: boolean;
  reason?: string;
  agent?: Agent;
}

/**
 * Service for managing and validating state transitions
 */
export class StateMachineService {
  /**
   * Check if a state transition is valid
   */
  canTransition(request: StateTransitionRequest): boolean {
    const currentState = request.agent.getState().getCurrentState();
    return this.isTransitionValid(
      currentState,
      request.targetState,
      request.agent.agentType,
    );
  }

  /**
   * Attempt a state transition
   */
  transition(request: StateTransitionRequest): StateTransitionResult {
    const currentState = request.agent.getState().getCurrentState();

    // Validate transition
    if (
      !this.isTransitionValid(
        currentState,
        request.targetState,
        request.agent.agentType,
      )
    ) {
      return {
        allowed: false,
        reason: `Cannot transition from '${currentState}' to '${request.targetState}'`,
      };
    }

    // Use AgentState's transitionTo method
    let newState: AgentState;
    try {
      newState = request.agent
        .getState()
        .transitionTo(request.targetState, request.metadata);
    } catch (error) {
      return {
        allowed: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Update agent with new state
    const updatedAgent = request.agent.withState(newState);

    return {
      allowed: true,
      agent: updatedAgent,
    };
  }

  /**
   * Check if a raw state transition is valid
   */
  private isTransitionValid(
    from: AgentStateType,
    to: AgentStateType,
    agentType: string,
  ): boolean {
    // Base transitions for all agents
    const baseTransitions: Record<AgentStateType, AgentStateType[]> = {
      idle: ['processing'],
      processing: ['waiting', 'complete', 'error'],
      waiting: ['processing', 'complete', 'error'],
      complete: ['idle'],
      error: ['idle'],
      coordinating: ['complete', 'error', 'sub-agents-waiting'],
      'sub-agents-waiting': ['processing', 'complete', 'error', 'waiting'],
    };

    // Collective-specific additions
    const collectiveTransitions: Record<AgentStateType, AgentStateType[]> = {
      ...baseTransitions,
      processing: [...(baseTransitions.processing || []), 'coordinating'],
    };

    const transitions =
      agentType === AgentType.COLLECTIVE
        ? collectiveTransitions
        : baseTransitions;

    return (transitions[from] || []).includes(to);
  }

  /**
   * Get all valid next states for an agent
   */
  getValidNextStates(agent: Agent): AgentStateType[] {
    const currentState = agent.getState().getCurrentState();
    const baseTransitions: Record<AgentStateType, AgentStateType[]> = {
      idle: ['processing'],
      processing: ['waiting', 'complete', 'error'],
      waiting: ['processing', 'complete', 'error'],
      complete: ['idle'],
      error: ['idle'],
      coordinating: ['complete', 'error', 'sub-agents-waiting'],
      'sub-agents-waiting': ['processing', 'complete', 'error', 'waiting'],
    };

    let validStates = baseTransitions[currentState] || [];

    if (agent.agentType === AgentType.COLLECTIVE) {
      // Add collective-specific transitions
      if (currentState === 'processing') {
        validStates = [...validStates, 'coordinating'];
      }
    }

    return validStates;
  }

  /**
   * Create an error state with message
   */
  createErrorState(error: Error | string): AgentState {
    const message = typeof error === 'string' ? error : error.message;
    return AgentState.error(message, { errorType: 'transition_error' });
  }

  /**
   * Check if agent is in a terminal state
   */
  isTerminal(agent: Agent): boolean {
    const state = agent.getState().getCurrentState();
    return state === 'complete' || state === 'error';
  }

  /**
   * Check if agent can be paused (if capability allows)
   */
  canBePaused(agent: Agent): boolean {
    if (!agent.capability.canPauseResume) {
      return false;
    }
    const state = agent.getState().getCurrentState();
    return state === 'processing' || state === 'waiting';
  }

  /**
   * Check if agent can resume from pause
   */
  canResume(agent: Agent): boolean {
    if (!agent.capability.canPauseResume) {
      return false;
    }
    const state = agent.getState().getCurrentState();
    // Can resume from waiting state
    return state === 'waiting';
  }
}

// Export as StateMachine for backward compatibility
export const StateMachine = StateMachineService;
