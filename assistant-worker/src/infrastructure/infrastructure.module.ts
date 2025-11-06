/**
 * Infrastructure Module
 *
 * Configures adapters, controllers, and external integrations.
 */

import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApplicationModule } from '@application/application.module';
import { ThreadingModule } from './threading/threading.module';
import { ConsoleLoggerAdapter } from './adapters';
import {
  BufferMemoryAdapter,
  WindowMemoryAdapter,
  SummaryMemoryAdapter,
  VectorMemoryAdapter,
  EntityMemoryAdapter,
  MongoDBPersistenceAdapter,
} from './adapters/memory';
import { Neo4jAdapter } from './adapters/knowledge-graph';
import { SSEStreamAdapter, WebSocketAdapter } from './adapters/streaming';
import { MetricsAdapter } from './adapters/monitoring';
import { RedisCacheAdapter } from './adapters/cache/redis-cache.adapter';
import { KafkaLoggerAdapter } from '../common/logging/kafka-logger.adapter';
import { InMemoryAgentRepository } from './adapters/storage/in-memory-agent.repository';
import { MemoryService } from '@application/services/memory.service';
import { KnowledgeGraphService } from '@application/services/knowledge-graph.service';
import { LLMProviderModule } from './adapters/llm/llm-provider.module';
import {
  AgentController,
  HealthController,
  ReActAgentController,
  GraphAgentController,
  ExpertAgentController,
  GeniusAgentController,
  CollectiveAgentController,
  ManagerAgentController,
  MemoryController,
  KnowledgeGraphController,
  MetricsController,
  ModelsController,
} from './controllers';
import { AssistantsModule } from './assistants/assistants.module';
import {
  Conversation,
  ConversationSchema,
} from './adapters/storage/conversations/conversation.schema';
import {
  ConversationEvent,
  ConversationEventSchema,
} from './adapters/storage/conversations/conversation-event.schema';
import {
  MessageVersion,
  MessageVersionSchema,
} from './adapters/storage/conversations/message-version.schema';
import { MongoDBConversationsRepository } from './adapters/storage/mongodb-conversations.repository';
import { ConversationsController } from './controllers/conversations.controller';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { RAGServiceAdapter } from './adapters/implementations/rag-service.adapter';

/**
 * Infrastructure module - adapters, controllers, and wiring
 *
 * Phase 1: Core agent infrastructure ✅
 * Phase 2: Specialized agent controllers ✅
 * Phase 3: Memory systems ✅
 * Phase 4: Knowledge graph ✅
 * Phase 5: Advanced features ⏳
 *
 * Made global to ensure DI providers are available across all modules
 */
@Global()
@Module({
  imports: [
    ApplicationModule,
    ThreadingModule, // Provides WorkerThreadPool, RequestQueue, etc.
    AssistantsModule, // Assistants CRUD and execution
    // Real LLM providers (default driven by env LLM_PROVIDER, defaults to openai)
    LLMProviderModule.register({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaultProvider: (process.env.LLM_PROVIDER as any) || 'openai',
    }),
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: ConversationEvent.name, schema: ConversationEventSchema },
      { name: MessageVersion.name, schema: MessageVersionSchema },
    ]),
  ],
  controllers: [
    // Core controllers
    AgentController,
    HealthController,

    // Agent type controllers (Phase 2)
    ReActAgentController,
    GraphAgentController,
    ExpertAgentController,
    GeniusAgentController,
    CollectiveAgentController,
    ManagerAgentController,

    // Memory controller (Phase 3)
    MemoryController,

    // Knowledge Graph controller (Phase 4)
    KnowledgeGraphController,

    // Metrics controller (Phase 6)
    MetricsController,

    // Models controller
    ModelsController,
    ConversationsController,
  ],
  providers: [
    // Core adapters
    {
      provide: 'ILogger',
      useClass: KafkaLoggerAdapter,
    },

    // Repository adapters
    {
      provide: 'IAgentRepository',
      useClass: InMemoryAgentRepository,
    },

    // Memory adapters (Phase 3)
    BufferMemoryAdapter,
    WindowMemoryAdapter,
    SummaryMemoryAdapter,
    VectorMemoryAdapter,
    EntityMemoryAdapter,
    // Memory adapter tokens
    { provide: 'MemoryAdapter.buffer', useExisting: BufferMemoryAdapter },
    { provide: 'MemoryAdapter.window', useExisting: WindowMemoryAdapter },
    { provide: 'MemoryAdapter.summary', useExisting: SummaryMemoryAdapter },
    { provide: 'MemoryAdapter.vector', useExisting: VectorMemoryAdapter },
    { provide: 'MemoryAdapter.entity', useExisting: EntityMemoryAdapter },

    // Memory Service (moved from ApplicationModule to avoid circular dependency)
    MemoryService,

    // Knowledge Graph Service (moved from ApplicationModule to avoid circular dependency)
    KnowledgeGraphService,

    // Knowledge Graph adapter (Phase 4)
    Neo4jAdapter,

    // Streaming adapters (Phase 5)
    SSEStreamAdapter,
    WebSocketAdapter,

    // Monitoring adapters (Phase 6)
    MetricsAdapter,

    // Cache adapter
    RedisCacheAdapter,

    // Conversations repository
    {
      provide: 'IConversationsRepository',
      useClass: MongoDBConversationsRepository,
    },

    // RAG Service adapter
    RAGServiceAdapter,
    {
      provide: 'IRAGServicePort',
      useExisting: RAGServiceAdapter,
    } as any,

    // Domain port binding for knowledge graph
    {
      provide: 'KnowledgeGraphPort',
      useExisting: KnowledgeGraphService,
    } as any,

    // Global filter/interceptor providers for DI resolution in main.ts
    GlobalExceptionFilter,
    LoggingInterceptor,
  ],
  exports: [
    // Export ports for application and domain layers
    // Note: 'ILLMProvider' is exported by LLMProviderModule (imported above) and available globally
    'ILogger',
    'IAgentRepository',
    // Conversations repository (provided above)
    'IConversationsRepository',
    // Domain port binding for knowledge graph (provided above)
    'KnowledgeGraphPort',
    // Domain port binding for RAG service
    'IRAGServicePort',
    // Memory adapter tokens
    'MemoryAdapter.buffer',
    'MemoryAdapter.window',
    'MemoryAdapter.summary',
    'MemoryAdapter.vector',
    'MemoryAdapter.entity',
    // Export services moved from ApplicationModule
    MemoryService,
    KnowledgeGraphService,
    // Export MetricsAdapter for application layer
    MetricsAdapter,
  ],
})
export class InfrastructureModule {}
