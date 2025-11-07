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

import { Module, forwardRef } from '@nestjs/common';
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
import { ProcessCommandUseCase } from './use-cases/process-command.use-case';
import { CreateAgentUseCase } from './use-cases/create-agent.use-case';
import { CollectiveModule } from './services/collective/collective.module';
import { AgentExecutionService } from './services/agent-execution.service';
import { MessageQueueService } from './services/collective/message-queue.service';
import { CommunicationService } from './services/collective/communication.service';
import { SharedMemoryService } from './services/collective/shared-memory.service';
import { ArtifactLockingService } from './services/collective/artifact-locking.service';
import { TaskAssignmentService } from './services/collective/task-assignment.service';
import { DeadlockDetectionService } from './services/collective/deadlock-detection.service';
import { GraphComponentService } from './services/graph-component.service';
import { LLMProviderModule } from '@infrastructure/adapters/llm/llm-provider.module';
import { MetricsAdapter } from '@infrastructure/adapters/monitoring/metrics.adapter';
import { AssistantsCrudService } from './services/assistants-crud.service';
import { AssistantExecutorService } from './services/assistant-executor.service';
import { AssistantsModule } from '@infrastructure/assistants/assistants.module';
import { ConversationsService } from './services/conversations.service';

/**
 * Application module - use cases and application services
 *
 * Note: InfrastructureModule is @Global(), so its providers (ILogger, ILLMProvider, IAgentRepository)
 * are automatically available to all modules. No need to import it here.
 */
@Module({
  imports: [
    CollectiveModule, // Collective infrastructure services
    // Import LLMProviderModule to make ILLMProvider available in ApplicationModule
    LLMProviderModule.register({
      defaultProvider: (process.env.LLM_PROVIDER as any) || 'openai',
    }),
    // Import AssistantsModule to access IAssistantRepository
    // Use forwardRef to handle circular dependency (AssistantsModule also imports ApplicationModule)
    forwardRef(() => AssistantsModule),
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
        messageQueue: any,
        communication: any,
        sharedMemory: any,
        artifactLocking: any,
        taskAssignment: any,
        deadlockDetection: any,
        coordinationValidator: CoordinationValidatorService,
      ) =>
        new AgentFactory(
          logger,
          llm,
          memory,
          parser,
          prompts,
          messageQueue,
          communication,
          sharedMemory,
          artifactLocking,
          taskAssignment,
          deadlockDetection,
          coordinationValidator,
        ),
      inject: [
        'ILogger',
        'ILLMProvider',
        MemoryManager,
        ResponseParser,
        PromptBuilder,
        MessageQueueService,
        CommunicationService,
        SharedMemoryService,
        ArtifactLockingService,
        TaskAssignmentService,
        DeadlockDetectionService,
        CoordinationValidatorService,
      ],
    },
    {
      provide: ExpertPoolManager,
      useFactory: (llm: any, logger: any, kg: any, metrics?: MetricsAdapter) =>
        new ExpertPoolManager(llm, logger, kg, metrics),
      inject: ['ILLMProvider', 'ILogger', 'KnowledgeGraphPort', MetricsAdapter],
    },
    AgentService,
    AgentValidationService,
    AgentConfigurationService,
    AgentEventService,
    AgentSessionService,

    // Advanced Services (Phase 5)
    GraphComponentService,
    CheckpointService,
    HITLService,
    AgentExecutionService,

    // Use Cases
    ExecuteAgentUseCase,
    StreamAgentExecutionUseCase,
    ProcessCommandUseCase,
    CreateAgentUseCase,

    // Assistant services
    AssistantsCrudService,
    AssistantExecutorService,

    // Conversations service
    ConversationsService,
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
    ProcessCommandUseCase,
    CreateAgentUseCase,

    // Export assistant services
    AssistantsCrudService,
    AssistantExecutorService,

    // Export conversations service
    ConversationsService,

    // Export collective module
    CollectiveModule,
  ],
})
export class ApplicationModule {}
