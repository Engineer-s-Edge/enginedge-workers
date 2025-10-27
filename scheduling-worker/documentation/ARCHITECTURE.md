# Scheduling Worker - Architecture

## Overview

The Scheduling Worker implements hexagonal architecture to provide intelligent calendar and task management services. The architecture ensures clean separation of concerns, testability, and maintainability.

## Architecture Layers

### Domain Layer

The domain layer contains the core business logic and entities:

#### Entities
- **CalendarEvent**: Represents calendar events with Google Calendar integration
- **Goal**: SMART goals with progress tracking
- **Habit**: Recurring habits with streak tracking
- **Command**: Processing commands for scheduling operations

#### Services
- **CalendarService**: Calendar event management
- **GoalService**: Goal creation and progress tracking
- **HabitService**: Habit scheduling and completion tracking
- **SchedulingService**: ML-powered scheduling optimization

### Application Layer

The application layer orchestrates domain objects and implements use cases:

#### Use Cases
- **ProcessCommandUseCase**: Main command processing workflow
- **SyncCalendarUseCase**: Google Calendar synchronization
- **ScheduleHabitUseCase**: Habit scheduling logic
- **OptimizeScheduleUseCase**: ML-based time slot optimization

#### Ports
- **ICalendarProvider**: Google Calendar API abstraction
- **IGoalRepository**: Goal data persistence
- **IHabitRepository**: Habit data persistence
- **IMessagePublisher**: Async messaging (Kafka)

### Infrastructure Layer

The infrastructure layer handles external concerns:

#### Adapters
- **GoogleCalendarAdapter**: Google Calendar API integration
- **DatabaseAdapter**: PostgreSQL/MongoDB persistence
- **RedisAdapter**: Caching and session management
- **KafkaAdapter**: Message publishing

#### Controllers
- **CalendarController**: REST endpoints for calendar operations
- **GoalController**: REST endpoints for goal management
- **HabitController**: REST endpoints for habit tracking
- **SchedulingController**: REST endpoints for ML scheduling

## Data Flow

```
Client Request → Controller → Use Case → Domain Service → Repository/External API
                      ↓
               Message Publisher → Kafka → Other Workers
```

## Key Design Patterns

### Hexagonal Architecture Benefits
- **Testability**: Each layer can be tested in isolation
- **Flexibility**: Easy to swap implementations (adapters)
- **Maintainability**: Clear separation of concerns
- **Scalability**: Independent scaling of components

### Dependency Injection
- All dependencies are injected through constructors
- Enables easy mocking for testing
- Supports different implementations per environment

### Repository Pattern
- Abstracts data access logic
- Supports multiple storage backends
- Enables easy testing with in-memory implementations

### Command Pattern
- Encapsulates requests as objects
- Supports undo operations and auditing
- Enables async processing via message queues

## Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Scheduling Worker                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Application Layer                     │    │
│  │  ┌─────────────────────────────────────────────────┐ │    │
│  │  │            Use Cases                            │ │    │
│  │  │  • ProcessCommandUseCase                        │ │    │
│  │  │  • SyncCalendarUseCase                          │ │    │
│  │  │  • ScheduleHabitUseCase                         │ │    │
│  │  │  • OptimizeScheduleUseCase                      │ │    │
│  │  └─────────────────────────────────────────────────┘ │    │
│  │  ┌─────────────────────────────────────────────────┐ │    │
│  │  │            Ports & Interfaces                   │ │    │
│  │  │  • ICalendarProvider                            │ │    │
│  │  │  • IGoalRepository                              │ │    │
│  │  │  • IHabitRepository                             │ │    │
│  │  │  • IMessagePublisher                            │ │    │
│  │  └─────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Domain Layer                          │    │
│  │  ┌─────────────────────────────────────────────────┐ │    │
│  │  │            Entities                             │ │    │
│  │  │  • CalendarEvent                                 │ │    │
│  │  │  • Goal                                          │ │    │
│  │  │  │  • SMART Goals                               │ │    │
│  │  │  │  • Progress Tracking                         │ │    │
│  │  │  • Habit                                         │ │    │
│  │  │  │  • Recurring Schedules                       │ │    │
│  │  │  │  • Streak Tracking                           │ │    │
│  │  │  • Command                                       │ │    │
│  │  └─────────────────────────────────────────────────┘ │    │
│  │  ┌─────────────────────────────────────────────────┐ │    │
│  │  │            Services                              │ │    │
│  │  │  • CalendarService                               │ │    │
│  │  │  • GoalService                                   │ │    │
│  │  │  • HabitService                                  │ │    │
│  │  │  • SchedulingService                             │ │    │
│  │  └─────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Infrastructure Layer                   │    │
│  │  ┌─────────────────────────────────────────────────┐ │    │
│  │  │            Adapters                              │ │    │
│  │  │  • GoogleCalendarAdapter                         │ │    │
│  │  │  • DatabaseAdapter                               │ │    │
│  │  │  • RedisAdapter                                  │ │    │
│  │  │  • KafkaAdapter                                  │ │    │
│  │  └─────────────────────────────────────────────────┘ │    │
│  │  ┌─────────────────────────────────────────────────┐ │    │
│  │  │            Controllers                           │ │    │
│  │  │  • CalendarController                            │ │    │
│  │  │  • GoalController                                │ │    │
│  │  │  • HabitController                               │ │    │
│  │  │  • SchedulingController                          │ │    │
│  │  └─────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## External Integrations

### Google Calendar API
- Bidirectional synchronization
- Event creation, updates, and deletion
- Attendee management
- Calendar sharing and permissions

### Database Layer
- PostgreSQL for relational data (goals, habits)
- MongoDB for flexible event storage
- Redis for caching and session management

### Message Queue
- Apache Kafka for async processing
- Event-driven architecture
- Inter-service communication

## Security Considerations

- OAuth 2.0 for Google Calendar authentication
- JWT tokens for API authentication
- Input validation and sanitization
- Rate limiting and abuse prevention
- Data encryption at rest and in transit

## Performance Optimizations

- Connection pooling for database access
- Redis caching for frequently accessed data
- Async processing for long-running operations
- Batch operations for bulk updates
- Horizontal scaling support