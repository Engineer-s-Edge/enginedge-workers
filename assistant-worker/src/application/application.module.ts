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
import { ModelValidationService } from './services/model-validation.service';
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
import { TopicCatalogService } from './services/topic-catalog.service';
import { CategoryService } from './services/category.service';
import { ValidationService } from './services/validation.service';
import { LearningModeService } from './services/learning-mode.service';
import { ScheduledLearningManagerService } from './services/scheduled-learning-manager.service';
import { ResearchService } from './services/research.service';
import { SharedMemoryGroupService } from './services/shared-memory-group.service';
import { GetTopicsForResearchUseCase } from './use-cases/get-topics-for-research.use-case';
import { AddTopicUseCase } from './use-cases/add-topic.use-case';
import { ManagerRuntimeService } from './services/manager/manager-runtime.service';
import { GeniusExpertRuntimeService } from './services/genius/genius-expert-runtime.service';
import { ILogger, ILLMProvider } from '@application/ports';
import { KnowledgeGraphPort } from '@domain/ports/knowledge-graph.port';

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
      defaultProvider:
        (process.env.LLM_PROVIDER as
          | 'openai'
          | 'anthropic'
          | 'google'
          | 'groq'
          | 'nvidia'
          | 'xai'
          | undefined) || 'openai',
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
        logger: ILogger,
        llm: ILLMProvider,
        memory: MemoryManager,
        parser: ResponseParser,
        prompts: PromptBuilder,
        messageQueue: MessageQueueService,
        communication: CommunicationService,
        sharedMemory: SharedMemoryService,
        artifactLocking: ArtifactLockingService,
        taskAssignment: TaskAssignmentService,
        deadlockDetection: DeadlockDetectionService,
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
      useFactory: (
        llm: ILLMProvider,
        logger: ILogger,
        kg: KnowledgeGraphPort,
        metrics?: MetricsAdapter,
      ) => new ExpertPoolManager(llm, logger, kg, metrics),
      inject: ['ILLMProvider', 'ILogger', 'KnowledgeGraphPort', MetricsAdapter],
    },
    AgentService,
    AgentValidationService,
    AgentConfigurationService,
    ModelValidationService,
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

    // Shared Memory Group service
    SharedMemoryGroupService,

    // Topic Catalog and Category services
    TopicCatalogService,
    CategoryService,

    // Models service
    ModelsService,

    // Validation service
    ValidationService,

    // Learning Mode service
    LearningModeService,

    // Scheduled Learning Manager service
    ScheduledLearningManagerService,

    // Research service
    ResearchService,

  ManagerRuntimeService,
  GeniusExpertRuntimeService,

    // Topic use cases
    GetTopicsForResearchUseCase,
    AddTopicUseCase,
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

    // Export topic catalog and category services
    TopicCatalogService,
    CategoryService,

    // Export validation service
    ValidationService,

    // Export learning mode service
    LearningModeService,

    // Export scheduled learning manager service
    ScheduledLearningManagerService,

    // Export research service
    ResearchService,

  ManagerRuntimeService,
  GeniusExpertRuntimeService,

    // Export topic use cases
    GetTopicsForResearchUseCase,
    AddTopicUseCase,

    // Export collective module
    CollectiveModule,
  ],
})
export class ApplicationModule {}
