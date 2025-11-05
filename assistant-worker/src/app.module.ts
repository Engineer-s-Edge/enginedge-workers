import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthModule } from './health/health.module';
import { ApplicationModule } from './application/application.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';

/**
 * App Module - Root module with clean hexagonal architecture
 *
 * Architecture Layers (Hexagonal/Clean Architecture):
 *
 * 1. Domain Layer (Core Business Logic)
 *    - Entities: Core business objects (Agent, AgentMemory, ExecutionContext)
 *    - Value Objects: Immutable domain concepts (AgentCapability, AgentConfig, Message)
 *    - Domain Services: Pure business logic (AgentFactory, MemoryManager, StateMachine)
 *    - Domain Ports: Interfaces for repositories (no implementations)
 *    - Agents: Specialized agent implementations (Collective, Expert, Genius, Graph, ReAct)
 *
 * 2. Application Layer (Use Cases & Orchestration)
 *    - Use Cases: Business operations (ExecuteAgent, CreateAgent, ProcessCommand)
 *    - Application Services: Coordination (GeniusAgentOrchestrator, ExpertResearchPipeline)
 *    - DTOs: Data transfer objects for input/output
 *    - Application Ports: Interfaces for external services (MessageBroker, LLMProvider)
 *    - Validators: Input validation logic
 *
 * 3. Infrastructure Layer (Adapters & Implementations)
 *    - Adapters: External service implementations
 *      - Messaging: Kafka adapter for message broker
 *      - LLM: OpenAI adapter for LLM provider
 *      - Storage: In-memory repository for agents
 *      - Logging: Structured logger
 *    - Controllers: HTTP API endpoints
 *    - Filters: Exception handling
 *    - Interceptors: Cross-cutting concerns
 *    - Middleware: Request processing
 *
 * Dependency Flow:
 * Infrastructure → Application → Domain
 * (Infrastructure depends on Application, Application depends on Domain, Domain is independent)
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/assistant-worker',
      {
        // MongoDB connection options
      },
    ),
    HealthModule,
    ApplicationModule,
    InfrastructureModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
