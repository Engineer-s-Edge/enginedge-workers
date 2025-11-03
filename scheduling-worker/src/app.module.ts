import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { DomainModule } from './domain/domain.module';
import { ApplicationModule } from './application/application.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';

/**
 * App Module - Root module for Scheduling Worker
 *
 * Hexagonal Architecture Layers:
 *
 * 1. Domain Layer (Core Business Logic)
 *    - Entities: CalendarEvent, Habit, Goal
 *    - Value Objects: TimeSlot
 *    - Domain Services: Pure business logic
 *    - No external dependencies
 *
 * 2. Application Layer (Use Cases & Orchestration)
 *    - Services: HabitService, GoalService
 *    - Ports: Interfaces for external services (Google Calendar, MongoDB, Kafka)
 *    - DTOs: Data transfer objects
 *
 * 3. Infrastructure Layer (Adapters & Implementations)
 *    - Adapters:
 *      - Auth: Google OAuth 2.0
 *      - Calendar: Google Calendar API
 *      - Persistence: MongoDB repositories
 *      - Messaging: Kafka message broker
 *      - Logging: Structured logger
 *    - Controllers: REST API endpoints
 *    - Interceptors: Cross-cutting concerns
 *
 * Responsibility: Google Calendar sync, habit tracking, goal management,
 *                 task scheduling, ML-based optimization
 *
 * Port: 3007
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HealthModule,
    DomainModule,
    ApplicationModule,
    InfrastructureModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
