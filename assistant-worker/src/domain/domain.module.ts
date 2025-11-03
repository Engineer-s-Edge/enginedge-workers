import { Module } from '@nestjs/common';
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
@Module({
  providers: [
    // Existing services
    PromptBuilder,
    ResponseParser,
    MemoryManager,
    // New agent management services
    AgentFactory,
    StateMachineService,
    CoordinationValidatorService,
    // Expert pool management
    ExpertPoolManager,
  ],
  exports: [
    // Existing exports
    PromptBuilder,
    ResponseParser,
    MemoryManager,
    // New exports
    AgentFactory,
    StateMachineService,
    CoordinationValidatorService,
    // Export for use in infrastructure adapters
    ExpertPoolManager,
  ],
})
export class DomainModule {}
