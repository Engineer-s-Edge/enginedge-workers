/**
 * Application Module - Phase 5 In Progress
 *
 * Configures and provides all application-layer services and use cases.
 * Bridges domain logic with infrastructure adapters.
 *
 * Phase 1: Core agent infrastructure ✅
 * Phase 2: Specialized agent controllers ✅
 * Phase 3: Memory systems ✅
 * Phase 4: Knowledge graph ✅
 * Phase 5: Advanced features ⏳
 */

import { Module } from '@nestjs/common';
import { PromptBuilder } from '@domain/services/prompt-builder.service';
import { ResponseParser } from '@domain/services/response-parser.service';
import { MemoryManager } from '@domain/services/memory-manager.service';
import { AgentFactory } from '@domain/services/agent-factory.service';
import { StateMachineService } from '@domain/services/state-machine.service';
import { CoordinationValidatorService } from '@domain/services/coordination-validator.service';
import { ExpertPoolManager } from '@domain/services/expert-pool-manager.service';
import { AgentService } from './services/agent.service';
import { AgentValidationService } from './services/agent-validation.service';
import { AgentConfigurationService } from './services/agent-configuration.service';
import { AgentEventService } from './services/agent-event.service';
import { AgentSessionService } from './services/agent-session.service';
import { CheckpointService } from './services/checkpoint.service';
import { HITLService } from './services/hitl.service';
import { ExecuteAgentUseCase } from './use-cases/execute-agent.use-case';
import { StreamAgentExecutionUseCase } from './use-cases/stream-agent-execution.use-case';
import { CollectiveModule } from './services/collective/collective.module';
import { AgentExecutionService } from './services/agent-execution.service';

/**
 * Application module - use cases and application services
 *
 * Note: InfrastructureModule is @Global(), so its providers (ILogger, ILLMProvider, IAgentRepository)
 * are automatically available to all modules. No need to import it here.
 */
@Module({
  imports: [
    CollectiveModule, // Collective infrastructure services
  ],
  providers: [
    // Core Services
    // Domain services (framework-agnostic)
    PromptBuilder,
    ResponseParser,
    MemoryManager,
    StateMachineService,
    CoordinationValidatorService,
    {
      provide: AgentFactory,
      useFactory: (
        logger: any,
        llm: any,
        memory: MemoryManager,
        parser: ResponseParser,
        prompts: PromptBuilder,
      ) => new AgentFactory(logger, llm, memory, parser, prompts),
      deps: [
        'ILogger',
        'ILLMProvider',
        MemoryManager,
        ResponseParser,
        PromptBuilder,
      ],
    },
    {
      provide: ExpertPoolManager,
      useFactory: (llm: any, logger: any, kg: any, metrics?: any) =>
        new ExpertPoolManager(llm, logger, kg, metrics),
      deps: ['ILLMProvider', 'ILogger', 'KnowledgeGraphPort', 'MetricsAdapter'],
    },
    AgentService,
    AgentValidationService,
    AgentConfigurationService,
    AgentEventService,
    AgentSessionService,

    // Advanced Services (Phase 5)
    CheckpointService,
    HITLService,
    AgentExecutionService,

    // Use Cases
    ExecuteAgentUseCase,
    StreamAgentExecutionUseCase,
  ],
  exports: [
    // Export services for other modules
    // Domain services
    PromptBuilder,
    ResponseParser,
    MemoryManager,
    StateMachineService,
    CoordinationValidatorService,
    AgentFactory,
    ExpertPoolManager,
    AgentService,
    AgentValidationService,
    AgentConfigurationService,
    AgentEventService,
    AgentSessionService,
    CheckpointService,
    HITLService,
    AgentExecutionService,

    // Export use cases for controllers
    ExecuteAgentUseCase,
    StreamAgentExecutionUseCase,

    // Export collective module
    CollectiveModule,
  ],
})
export class ApplicationModule {}
