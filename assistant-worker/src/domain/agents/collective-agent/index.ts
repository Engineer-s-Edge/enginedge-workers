/**
 * Collective Agent Barrel Export
 *
 * Exports the CollectiveAgent class and all related types for multi-agent orchestration.
 */

export { CollectiveAgent } from './collective-agent';
export type {
  SubAgentType,
  TaskDistributionStrategy,
  AggregationMethod,
  CoordinationPattern,
  CollectiveAgentState,
  CollectiveExecutionResult,
  CollectiveStateUpdate,
  SubAgentRef,
  Task,
  TaskAssignment,
  SubAgentResult,
  AggregatedResult,
  DistributionPlan,
  CoordinationInstruction,
  ConflictResolution,
  SubAgentStats,
  LoadMetrics,
  CapabilityMatch,
} from './collective-agent.types';
