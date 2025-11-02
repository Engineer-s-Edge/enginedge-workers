# resume Worker Architecture

## Overview

The resume (Resume Natural Language Engine) Worker implements Clean Architecture (Hexagonal Architecture) principles to ensure maintainability, testability, and scalability. This document describes the architectural patterns, design decisions, and component interactions.

## Architecture Principles

### Clean Architecture (Hexagonal Architecture)

The application is structured around the following principles:

1. **Dependency Inversion**: Inner layers don't depend on outer layers
2. **Single Responsibility**: Each component has one reason to change
3. **Open/Closed**: Open for extension, closed for modification
4. **Interface Segregation**: Clients depend only on methods they use
5. **Dependency Injection**: Dependencies are injected rather than created

## Layer Structure

### 1. Domain Layer (Core Business Logic)

**Location**: `src/domain/`

**Responsibilities**:
- Define core business entities and value objects
- Implement domain business rules
- Define interfaces (ports) for external dependencies
- Remain independent of external frameworks and technologies

**Components**:

#### Entities
- `Command`: Represents a task to be processed
- `CommandResult`: Represents the outcome of command processing

```typescript
interface Command {
  taskId: string;
  taskType: 'EXECUTE_ASSISTANT' | 'SCHEDULE_HABITS';
  payload?: Record<string, unknown>;
}

interface CommandResult {
  taskId: string;
  status: 'SUCCESS' | 'FAILURE';
  result?: Record<string, unknown>;
  error?: string;
}
```

#### Domain Services
- Pure business logic without external dependencies
- Validation rules and business calculations
- Domain event handling

### 2. Application Layer (Use Cases & Orchestration)

**Location**: `src/application/`

**Responsibilities**:
- Implement application use cases
- Orchestrate domain objects
- Handle cross-cutting concerns (logging, transactions)
- Define application-specific interfaces

**Components**:

#### Use Cases
- `ProcessCommandUseCase`: Main use case for processing commands
- Handles command validation and execution flow
- Coordinates between domain services and external adapters

#### Application Services
- `CommandApplicationService`: Orchestrates command processing workflow
- Manages transaction boundaries
- Handles application-level error handling

#### Ports (Interfaces)
- `ICommandProcessor`: Interface for command processing logic
- `IMessagePublisher`: Interface for publishing results to message broker

### 3. Infrastructure Layer (Adapters & External Concerns)

**Location**: `src/infrastructure/`

**Responsibilities**:
- Implement external interfaces (databases, APIs, message brokers)
- Handle HTTP requests and responses
- Manage cross-cutting concerns (logging, monitoring, security)
- Adapt external systems to application needs

**Components**:

#### Adapters
- `CommandProcessorAdapter`: Implements command processing logic
- `KafkaMessageBrokerAdapter`: Handles Kafka message publishing
- `ConsoleMessagePublisherAdapter`: Simple console-based publisher for development

#### Controllers
- `CommandController`: REST API endpoints for command processing
- Request/response transformation
- HTTP-specific error handling

#### Cross-Cutting Concerns
- Logging and monitoring
- Exception filters and interceptors
- Middleware for request processing

## Data Flow

### Command Processing Flow

1. **HTTP Request** → `CommandController.processCommand()`
2. **Validation** → Input validation and transformation
3. **Use Case Execution** → `ProcessCommandUseCase.execute()`
4. **Domain Processing** → Business logic execution
5. **Result Publishing** → Asynchronous result publishing via Kafka
6. **HTTP Response** → Return processing result

### Asynchronous Processing

Commands are processed asynchronously to prevent blocking:

1. Command received via HTTP POST
2. Immediate response with task acceptance
3. Background processing via use case
4. Result published to Kafka topic
5. Consumer services handle result notifications

## External Dependencies

### Message Broker (Kafka)

**Purpose**: Asynchronous communication and event-driven processing

**Configuration**:
- Broker addresses via environment variables
- Consumer groups for load balancing
- Topics for command results and events

**Topics Used**:
- `command-results`: Processed command outcomes
- `command-events`: Processing status updates

### Database (MongoDB)

**Purpose**: Metadata storage and command state persistence

**Collections**:
- `commands`: Command execution history
- `command_results`: Processing outcomes
- `processing_metrics`: Performance metrics

### Monitoring (Prometheus)

**Purpose**: Observability and alerting

**Metrics Exposed**:
- Command processing rates and latency
- Error rates by command type
- Kafka message processing statistics
- System resource utilization

## Design Patterns

### Adapter Pattern

Used to adapt external interfaces to application ports:

```typescript
// Port (Interface)
interface IMessagePublisher {
  publishResult(result: CommandResult): Promise<void>;
}

// Adapter (Implementation)
@Injectable()
export class KafkaMessageBrokerAdapter implements IMessagePublisher {
  async publishResult(result: CommandResult): Promise<void> {
    // Kafka-specific implementation
  }
}
```

### Repository Pattern

Abstracts data access operations:

```typescript
interface ICommandRepository {
  save(command: Command): Promise<void>;
  findById(taskId: string): Promise<Command | null>;
}
```

### Factory Pattern

Creates domain objects with proper validation:

```typescript
export class CommandFactory {
  static create(taskId: string, taskType: string, payload?: any): Command {
    // Validation and creation logic
  }
}
```

### Observer Pattern

Handles domain events and notifications:

```typescript
// Domain events
export class CommandProcessedEvent {
  constructor(public readonly command: Command, public readonly result: CommandResult) {}
}

// Event handlers
@Injectable()
export class CommandEventHandler {
  handle(event: CommandProcessedEvent): void {
    // Event processing logic
  }
}
```

## Error Handling

### Error Types

1. **Validation Errors**: Invalid input data (400 Bad Request)
2. **Business Logic Errors**: Domain rule violations (422 Unprocessable Entity)
3. **Infrastructure Errors**: External service failures (502/503 Bad Gateway/Service Unavailable)
4. **System Errors**: Unexpected failures (500 Internal Server Error)

### Error Propagation

- Domain layer throws domain-specific exceptions
- Application layer catches and transforms to application errors
- Infrastructure layer converts to HTTP status codes
- All errors are logged with correlation IDs

## Testing Strategy

### Unit Tests
- Test domain logic in isolation
- Mock external dependencies
- Focus on business rules and edge cases

### Integration Tests
- Test adapter implementations
- Verify external service integrations
- End-to-end workflow testing

### Test Structure
```
src/
├── domain/
│   └── entities/
│       └── command.entities.spec.ts
├── application/
│   └── use-cases/
│       └── process-command.use-case.spec.ts
└── infrastructure/
    └── adapters/
        └── command-processor.adapter.spec.ts
```

## Performance Considerations

### Asynchronous Processing
- Commands processed in background threads
- Non-blocking I/O operations
- Connection pooling for external services

### Caching Strategy
- Command metadata caching
- Result caching for frequently accessed data
- Redis integration for distributed caching

### Scalability
- Stateless design for horizontal scaling
- Message-based communication
- Database connection pooling

## Security Measures

### Input Validation
- Request payload validation using DTOs
- Sanitization of user inputs
- Type checking and schema validation

### Authentication & Authorization
- API key authentication for service-to-service communication
- Role-based access control (future enhancement)
- Request rate limiting

### Data Protection
- Encryption of sensitive data at rest
- Secure communication via TLS
- Audit logging for security events

## Deployment Architecture

### Containerization
- Docker-based deployment
- Multi-stage builds for optimization
- Non-root user execution

### Orchestration
- Kubernetes deployment manifests
- Horizontal Pod Autoscaling
- ConfigMaps and Secrets management

### Service Mesh
- Istio integration for traffic management
- Circuit breakers and retry logic
- Distributed tracing

## Monitoring & Observability

### Metrics Collection
- Prometheus metrics exposition
- Custom business metrics
- Performance histograms

### Logging
- Structured logging with correlation IDs
- Log aggregation via ELK stack
- Error tracking and alerting

### Tracing
- Distributed tracing with Jaeger
- Request flow visualization
- Performance bottleneck identification

## Future Enhancements

### Microservices Evolution
- Command type-specific workers
- Event sourcing implementation
- CQRS pattern adoption

### Advanced Features
- Command scheduling and queuing
- Workflow orchestration
- Machine learning integration

### Infrastructure Improvements
- Multi-region deployment
- Service mesh adoption
- Advanced monitoring dashboards