/**
 * Infrastructure Module
 *
 * Configures adapters, controllers, and external integrations.
 */

import { Module, Global } from '@nestjs/common';
import { ApplicationModule } from '@application/application.module';
import { ThreadingModule } from './threading/threading.module';
import { MockLLMAdapter, ConsoleLoggerAdapter } from './adapters';
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
import { InMemoryAgentRepository } from './adapters/storage/in-memory-agent.repository';
import { MemoryService } from '@application/services/memory.service';
import { KnowledgeGraphService } from '@application/services/knowledge-graph.service';
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
} from './controllers';

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
  ],
  providers: [
    // Core adapters
    {
      provide: 'ILLMProvider',
      useClass: MockLLMAdapter,
    },
    {
      provide: 'ILogger',
      useClass: ConsoleLoggerAdapter,
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
    MongoDBPersistenceAdapter,
    
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
  ],
  exports: [
    // Export ports for application and domain layers
    'ILLMProvider',
    'ILogger',
    'IAgentRepository',
    // Export services moved from ApplicationModule
    MemoryService,
    KnowledgeGraphService,
  ],
})
export class InfrastructureModule {}
