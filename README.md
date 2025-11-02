# EnginEdge Workers

> Specialized worker nodes implementing hexagonal architecture for domain-specific processing in the EnginEdge platform.

[![Hexagonal Architecture](https://img.shields.io/badge/Architecture-Hexagonal-blue)](https://en.wikipedia.org/wiki/Hexagonal_architecture)
[![NestJS](https://img.shields.io/badge/NestJS-10.0+-red)](https://nestjs.com/)
[![Apache Kafka](https://img.shields.io/badge/Apache%20Kafka-3.0+-orange)](https://kafka.apache.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#license)

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Worker Nodes](#worker-nodes)
- [Shared Architecture](#shared-architecture)
- [Development](#development)
- [Deployment](#deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

The **EnginEdge Workers** repository contains specialized worker nodes that handle domain-specific processing tasks. Each worker follows hexagonal architecture principles and communicates asynchronously with the main orchestrator via Apache Kafka.

### Key Characteristics

- **Domain-Driven**: Each worker specializes in a specific business domain
- **Hexagonal Architecture**: Clean separation of concerns with ports & adapters
- **Event-Driven**: Asynchronous processing via Kafka messaging
- **Scalable**: Independent horizontal scaling per worker type
- **Fault-Tolerant**: Isolated failure domains with circuit breakers
- **Observable**: Comprehensive logging, metrics, and health checks

### Communication Flow

```
Client Request → Main Orchestrator → Kafka Topic → Worker Node → Kafka Response → Orchestrator → Client
```

## Architecture

All worker nodes follow the **same hexagonal architecture pattern** but specialize in different domains:

```
src/
├── domain/                    # Business Logic Layer
│   ├── entities/             # Domain entities (Command, Result)
│   └── services/             # Domain services (if needed)
├── application/              # Application Layer
│   ├── ports/                # Port interfaces
│   │   └── interfaces.ts     # ICommandProcessor, IMessagePublisher
│   ├── use-cases/           # Business use cases
│   │   └── process-command.use-case.ts
│   └── services/            # Application services
│       └── command-application.service.ts
└── infrastructure/           # Infrastructure Layer
    ├── controllers/         # HTTP controllers
    │   └── command.controller.ts
    ├── adapters/            # Port implementations
    │   ├── command-processor.adapter.ts
    │   └── console-message-publisher.adapter.ts
    └── modules/             # NestJS modules
        └── command-infrastructure.module.ts
```

### Hexagonal Benefits

- **Consistency**: Same architecture pattern across all workers
- **Testability**: Each layer testable in isolation
- **Maintainability**: Clear separation of business logic from infrastructure
- **Flexibility**: Easy to swap implementations (adapters)
- **Reusability**: Common patterns and utilities

## Worker Nodes

### LLM Worker (Port 3001)
**Domain**: Natural Language Processing & AI Model Inference

**Responsibilities:**
- Handle LLM API calls (OpenAI, Anthropic, etc.)
- Process natural language inputs/outputs
- Manage model selection and parameters
- Implement prompt engineering and templating
- Handle token limits and cost optimization

**Key Features:**
- Multi-provider support (OpenAI GPT, Claude, etc.)
- Prompt versioning and A/B testing
- Token usage tracking and cost optimization
- Response caching and deduplication
- Rate limiting and quota management

### Agent Tool Worker (Port 3002)
**Domain**: External Tool Integration & Execution

**Responsibilities:**
- Execute agent-defined tools and scripts
- Integrate with external APIs and services
- Handle tool authentication and rate limiting
- Process tool results and format responses
- Manage tool configurations and dependencies

**Key Features:**
- REST API and GraphQL client support
- OAuth2 and API key authentication
- Response transformation and mapping
- Error handling and retry logic
- Tool execution sandboxing

### Data Processing Worker (Port 3003)
**Domain**: Heavy Data Processing & Extraction

**Responsibilities:**
- Perform OCR on images and documents
- Process large files and datasets
- Extract structured data from unstructured sources
- Handle batch processing and parallel tasks
- Manage resource-intensive operations

**Key Features:**
- Multiple OCR engines (Tesseract, Google Vision)
- File format support (PDF, DOC, images)
- Parallel processing with worker pools
- Progress tracking and resumable uploads
- Data validation and quality assurance

### Interview Worker (Port 3004)
**Domain**: Interview Management & Media Processing

**Responsibilities:**
- Manage interview sessions and workflows
- Process speech-to-text conversion
- Handle video/audio stream processing
- Generate interview questions and feedback
- Analyze interview responses and performance

**Key Features:**
- Real-time audio/video processing
- Multiple STT providers (Google, AWS, Azure)
- Interview question generation
- Sentiment analysis and feedback
- Session recording and playback

### LaTeX Worker (Port 3005)
**Domain**: Document Generation & Typesetting

**Responsibilities:**
- Compile LaTeX documents to PDF
- Generate mathematical expressions and formulas
- Handle document templates and styling
- Process complex mathematical content
- Manage bibliography and citations

**Key Features:**
- Full LaTeX distribution support
- Mathematical symbol rendering
- Template management system
- Bibliography processing (BibTeX)
- Error reporting and debugging

### resume Worker (Port 3006)
**Domain**: Resume NLP Engine

**Responsibilities:**
- Parse and extract information from resumes
- Perform NLP analysis on job descriptions
- Match candidates to job requirements
- Extract skills, experience, and qualifications
- Generate candidate profiles and recommendations

**Key Features:**
- Multiple resume formats (PDF, DOC, TXT)
- Named entity recognition for skills/experience
- Job description parsing and analysis
- Matching algorithms with confidence scores
- Profile generation and enrichment

## Shared Architecture

### Domain Layer

All workers share the same domain model:

```typescript
// Command entity (input)
interface Command {
  taskId: string;
  taskType: string;
  payload: Record<string, unknown>;
}

// CommandResult entity (output)
interface CommandResult {
  taskId: string;
  status: 'SUCCESS' | 'FAILURE';
  result?: Record<string, unknown>;
  error?: string;
}
```

### Application Layer

**Port Interfaces:**
```typescript
interface ICommandProcessor {
  processCommand(command: Command): Promise<CommandResult>;
}

interface IMessagePublisher {
  publishResult(result: CommandResult): Promise<void>;
}
```

**Use Case:**
```typescript
@Injectable()
export class ProcessCommandUseCase {
  constructor(
    @Inject('ICommandProcessor') private processor: ICommandProcessor,
    @Inject('IMessagePublisher') private publisher: IMessagePublisher,
  ) {}

  async execute(command: Command): Promise<CommandResult> {
    const result = await this.processor.processCommand(command);
    await this.publisher.publishResult(result);
    return result;
  }
}
```

### Infrastructure Layer

**Controller:**
```typescript
@Controller('command')
export class CommandController {
  constructor(private service: CommandApplicationService) {}

  @Post('process')
  async processCommand(@Body() command: Command): Promise<CommandResult> {
    return this.service.processCommand(command);
  }
}
```

**Adapters:**
- `CommandProcessorAdapter`: Implements domain-specific processing logic
- `ConsoleMessagePublisher`: Publishes results (can be replaced with Kafka adapter)

## Development

### Prerequisites

- Node.js 18+
- npm 9+
- Docker & Docker Compose

### Worker Template

Each worker follows the same setup pattern:

1. **Create worker directory:**
   ```bash
   mkdir assistant-worker
   cd assistant-worker
   ```

2. **Initialize project:**
   ```bash
   npm init -y
   npm install @nestjs/core @nestjs/common @nestjs/platform-express reflect-metadata
   npm install -D @types/node typescript ts-node
   ```

3. **Configure TypeScript:**
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "baseUrl": "./src",
       "paths": {
         "@domain/*": ["domain/*"],
         "@application/*": ["application/*"],
         "@infrastructure/*": ["infrastructure/*"]
       }
     }
   }
   ```

4. **Implement hexagonal layers:**
   - Domain entities
   - Application ports and use cases
   - Infrastructure adapters and controllers

### Testing Strategy

```bash
# Unit tests (domain layer)
npm run test:unit

# Integration tests (application layer)
npm run test:integration

# End-to-end tests (infrastructure layer)
npm run test:e2e

# Contract tests (adapter verification)
npm run test:contract
```

### Adding a New Worker

1. **Define domain boundaries** in the main README
2. **Create worker directory** with hexagonal structure
3. **Implement domain-specific logic** in adapters
4. **Configure unique port** (3001-3006 range)
5. **Add health checks** and monitoring
6. **Update deployment manifests**

## Deployment

### Individual Worker Deployment

```bash
# Build worker
cd assistant-worker
npm run build
docker build -t enginedge-assistant-worker:latest .

# Deploy to Kubernetes
kubectl apply -f k8s/assistant-worker.yaml
```

### Worker Scaling

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: assistant-worker
spec:
  replicas: 3  # Scale based on load
  selector:
    matchLabels:
      app: assistant-worker
  template:
    metadata:
      labels:
        app: assistant-worker
    spec:
      containers:
      - name: assistant-worker
        image: enginedge-assistant-worker:latest
        ports:
        - containerPort: 3001
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
```

### Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: assistant-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: assistant-worker
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Monitoring

### Health Checks

Each worker exposes standard health endpoints:

```bash
# Liveness probe
GET /health

# Readiness probe
GET /health/ready

# Detailed health
GET /health/detailed
```

### Metrics

Prometheus-compatible metrics exposed on `/metrics`:

```
# Request metrics
worker_requests_total{worker="llm", status="success"} 1547
worker_requests_total{worker="llm", status="error"} 23
worker_request_duration_seconds{worker="llm", quantile="0.95"} 2.5

# Resource metrics
nodejs_heap_size_used_bytes{worker="llm"} 45600000
process_cpu_user_seconds_total{worker="llm"} 123.45

# Domain-specific metrics
llm_tokens_used_total{model="gpt-4"} 456789
llm_api_calls_total{provider="openai", status="success"} 1234
```

### Logging

Structured JSON logging with correlation IDs:

```json
{
  "timestamp": "2025-10-21T10:30:15.123Z",
  "level": "info",
  "worker": "assistant-worker",
  "message": "Command processed successfully",
  "taskId": "task_123456",
  "duration": 1250,
  "correlationId": "corr_789012"
}
```

### Alerting Rules

- High error rate (>5% in 5 minutes)
- High latency (>5 seconds p95)
- Memory usage >90%
- CPU usage >80%
- Unhealthy status for >1 minute

## Troubleshooting

### Common Issues

#### Worker Not Starting
```bash
# Check logs
kubectl logs -f deployment/assistant-worker

# Check events
kubectl describe pod assistant-worker-xxxxx

# Verify configuration
kubectl exec -it assistant-worker-xxxxx -- env
```

#### High Memory Usage
```bash
# Check heap usage
kubectl exec -it assistant-worker-xxxxx -- curl http://localhost:3001/metrics | grep heap

# Check for memory leaks
kubectl logs -f deployment/assistant-worker | grep "heap used"

# Restart pod if needed
kubectl delete pod assistant-worker-xxxxx
```

#### Kafka Connection Issues
```bash
# Check Kafka connectivity
kubectl exec -it assistant-worker-xxxxx -- telnet kafka-service 9092

# Check consumer group
kubectl exec -it kafka-pod -- kafka-consumer-groups --describe --group worker-group

# Verify topic exists
kubectl exec -it kafka-pod -- kafka-topics --list
```

#### Slow Performance
```bash
# Check metrics
curl http://assistant-worker:3001/metrics | grep request_duration

# Profile application
kubectl exec -it assistant-worker-xxxxx -- npm run profile

# Check resource limits
kubectl describe deployment assistant-worker
```

### Debug Mode

Enable debug logging:

```bash
# Environment variable
DEBUG=enginedge:*

# Or via ConfigMap
kubectl edit configmap worker-config
```

### Performance Tuning

```yaml
# Resource optimization
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"

# JVM tuning (if applicable)
env:
- name: NODE_OPTIONS
  value: "--max-old-space-size=4096"
```

## Contributing

### Worker Development Guidelines

1. **Follow Hexagonal Architecture**: Maintain separation of concerns
2. **Domain-First Design**: Start with business entities and rules
3. **Test-Driven Development**: Write tests before implementation
4. **Consistent APIs**: Follow established patterns across workers
5. **Documentation**: Update README and API docs for changes

### Code Review Checklist

- [ ] Hexagonal architecture followed (domain → application → infrastructure)
- [ ] Ports defined as interfaces, adapters implement them
- [ ] Error handling comprehensive and consistent
- [ ] Logging includes correlation IDs and structured data
- [ ] Tests cover all layers and edge cases
- [ ] Configuration externalized and documented
- [ ] Health checks and metrics implemented
- [ ] Resource limits and requests specified

### Adding Domain-Specific Features

1. **Extend Domain Entities** if needed
2. **Add Port Methods** for new capabilities
3. **Implement Adapters** for external integrations
4. **Update Use Cases** to orchestrate new functionality
5. **Add Tests** for all new code
6. **Update Documentation** and API specs

---

**Part of the EnginEdge Platform** | [System Overview](../../README.md) | [Main Orchestrator](../enginedge-main-hexagon/)