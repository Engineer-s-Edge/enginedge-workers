import { PromptBuilder } from './services/prompt-builder.service';
import { ResponseParser } from './services/response-parser.service';
import { MemoryManager } from './services/memory-manager.service';
import { AgentFactory } from './services/agent-factory.service';
import { StateMachineService } from './services/state-machine.service';
import { CoordinationValidatorService } from './services/coordination-validator.service';
import { ExpertPoolManager } from './services/expert-pool-manager.service';

/**
 * Domain Module - Pure business logic with NO external dependencies
 *
 * All services in this module are pure domain services that:
 * - Have no infrastructure dependencies
 * - Are easily testable in isolation
 * - Contain core business logic
 *
 * Exports:
 * - Factory services for creating domain objects
 * - Validation services for business rules
 * - Transformation services for domain logic
 */
// NOTE: DomainModule removed Nest dependency. Keep as plain re-export barrel if needed.
export const DomainProviders = {
  PromptBuilder,
  ResponseParser,
  MemoryManager,
  AgentFactory,
  StateMachineService,
  CoordinationValidatorService,
  ExpertPoolManager,
};
