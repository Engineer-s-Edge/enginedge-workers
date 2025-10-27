# EnginEdge Workers - Hexagonal Architecture Implementation

> Comprehensive documentation of the hexagonal architecture pattern implemented across all EnginEdge worker nodes.

## Table of Contents

- [Overview](#overview)
- [Worker Types](#worker-types)
- [Shared Architecture](#shared-architecture)
- [Domain Layer](#domain-layer)
- [Application Layer](#application-layer)
- [Infrastructure Layer](#infrastructure-layer)
- [Worker-Specific Implementations](#worker-specific-implementations)
- [Testing Strategy](#testing-strategy)
- [Deployment & Scaling](#deployment--scaling)

## Overview

The **EnginEdge Workers** repository contains six specialized worker nodes that implement a consistent hexagonal architecture pattern. Each worker handles a specific domain of AI/ML processing while maintaining architectural consistency and code reusability.

### Architecture Goals

- **Consistency**: Uniform architecture across all workers
- **Reusability**: Shared components and patterns
- **Specialization**: Domain-specific logic in each worker
- **Scalability**: Independent scaling of worker types
- **Maintainability**: Clear separation of concerns

## Worker Types

### 1. LLM Worker (`assistant-worker/`)
**Purpose**: Large Language Model interactions and text generation
**Port**: 3001
**Domain**: Text generation, prompt engineering, multi-provider LLM orchestration

### 2. Agent Tool Worker (`agent-tool-worker/`)
**Purpose**: AI agent execution and tool orchestration
**Port**: 3002
**Domain**: Agent lifecycle management, tool integration, workflow execution

### 3. Data Processing Worker (`data-processing-worker/`)
**Purpose**: Document processing and vector operations
**Port**: 3003
**Domain**: Document ingestion, text chunking, vector embeddings, retrieval

### 4. Interview Worker (`interview-worker/`)
**Purpose**: Interview processing and candidate assessment
**Port**: 3004
**Domain**: Interview scheduling, question generation, response analysis

### 5. LaTeX Worker (`latex-worker/`)
**Purpose**: Mathematical document processing
**Port**: 3005
**Domain**: LaTeX compilation, mathematical rendering, formula processing

### 6. RNLE Worker (`rnle-worker/`)
**Purpose**: Symbolic mathematics and computation
**Port**: 3006
**Domain**: Symbolic equation solving, computational kernels, mathematical reasoning

## Shared Architecture

All workers follow the same hexagonal architecture pattern with shared base classes and interfaces.

### Directory Structure (Per Worker)

```
src/
├── _common/                    # Shared components across workers
│   ├── domain/                # Shared domain concepts
│   ├── application/           # Shared application patterns
│   └── infrastructure/        # Shared infrastructure adapters
├── domain/                    # Worker-specific domain
│   ├── entities/             # Domain entities
│   ├── services/             # Domain services
│   └── types/                # Domain types
├── application/              # Application layer
│   ├── ports/                # Port interfaces
│   ├── use-cases/            # Use cases
│   └── dtos/                 # Data transfer objects
├── infrastructure/           # Infrastructure layer
│   ├── controllers/          # HTTP controllers
│   ├── adapters/             # Port implementations
│   ├── config/               # Configuration
│   └── modules/              # NestJS modules
└── test/                     # Test files
```

### Shared Components

#### Common Domain Concepts

```typescript
// _common/domain/types/command.types.ts
export interface Command {
  id: CommandId;
  type: CommandType;
  payload: CommandPayload;
  metadata: CommandMetadata;
  timestamp: Date;
}

export interface CommandResult {
  id: CommandResultId;
  commandId: CommandId;
  status: CommandStatus;
  result?: any;
  error?: string;
  processingTime: number;
  timestamp: Date;
}
```

#### Shared Application Ports

```typescript
// _common/application/ports/inbound/command-handler.port.ts
export interface ICommandHandler {
  processCommand(command: ProcessCommandRequest): Promise<Result<CommandResultId, ApplicationError>>;
  getCommandStatus(commandId: CommandId): Promise<Result<CommandStatusResponse, ApplicationError>>;
}

// _common/application/ports/outbound/command-processor.port.ts
export interface ICommandProcessor {
  process(command: Command): Promise<Result<CommandResult, DomainError>>;
}
```

## Domain Layer

### Shared Domain Entities

#### Command Entity

```typescript
export class Command {
  private constructor(
    private readonly id: CommandId,
    private readonly type: CommandType,
    private payload: CommandPayload,
    private metadata: CommandMetadata,
    private status: CommandStatus,
    private readonly createdAt: Date,
    private processedAt?: Date,
  ) {}

  static create(params: CreateCommandParams): Result<Command, DomainError> {
    // Validation logic
    if (!this.isValidCommandType(params.type)) {
      return Result.failure(new InvalidCommandTypeError(params.type));
    }

    const command = new Command(
      CommandId.generate(),
      params.type,
      params.payload,
      params.metadata || {},
      CommandStatus.PENDING,
      new Date(),
    );

    return Result.success(command);
  }

  markAsProcessing(): Result<void, DomainError> {
    if (this.status !== CommandStatus.PENDING) {
      return Result.failure(new InvalidStatusTransitionError(this.status, CommandStatus.PROCESSING));
    }
    this.status = CommandStatus.PROCESSING;
    return Result.success(undefined);
  }

  complete(result: CommandResultData): Result<void, DomainError> {
    this.status = CommandStatus.COMPLETED;
    this.processedAt = new Date();
    // Store result...
    return Result.success(undefined);
  }

  fail(error: string): Result<void, DomainError> {
    this.status = CommandStatus.FAILED;
    this.processedAt = new Date();
    // Store error...
    return Result.success(undefined);
  }
}
```

#### CommandResult Entity

```typescript
export class CommandResult {
  private constructor(
    private readonly id: CommandResultId,
    private readonly commandId: CommandId,
    private status: CommandStatus,
    private result?: any,
    private error?: string,
    private readonly processingTime: number,
    private readonly timestamp: Date,
  ) {}

  static success(commandId: CommandId, result: any, processingTime: number): CommandResult {
    return new CommandResult(
      CommandResultId.generate(),
      commandId,
      CommandStatus.COMPLETED,
      result,
      undefined,
      processingTime,
      new Date(),
    );
  }

  static failure(commandId: CommandId, error: string, processingTime: number): CommandResult {
    return new CommandResult(
      CommandResultId.generate(),
      commandId,
      CommandStatus.FAILED,
      undefined,
      error,
      processingTime,
      new Date(),
    );
  }
}
```

### Worker-Specific Domain Services

Each worker implements domain services specific to its processing domain:

```typescript
// LLM Worker - domain/services/llm.service.ts
@Injectable()
export class LlmService {
  generateText(prompt: string, options: LlmOptions): Result<GeneratedText, DomainError> {
    // LLM-specific business logic
    if (!this.isValidPrompt(prompt)) {
      return Result.failure(new InvalidPromptError());
    }

    // Domain rules for text generation
    const generatedText = this.applyGenerationRules(prompt, options);
    return Result.success(generatedText);
  }
}

// Data Processing Worker - domain/services/document.service.ts
@Injectable()
export class DocumentService {
  processDocument(document: Document, options: ProcessingOptions): Result<ProcessedDocument, DomainError> {
    // Document processing business rules
    const chunks = this.chunkDocument(document, options.chunkSize);
    const embeddings = this.generateEmbeddings(chunks);
    return Result.success(new ProcessedDocument(chunks, embeddings));
  }
}
```

## Application Layer

### Shared Use Cases

#### ProcessCommandUseCase

```typescript
@Injectable()
export class ProcessCommandUseCase {
  constructor(
    private readonly commandProcessor: ICommandProcessor, // Port
    private readonly commandRepository: ICommandRepository, // Port
    private readonly messagePublisher: IMessagePublisher, // Port
  ) {}

  async execute(request: ProcessCommandRequest): Promise<Result<CommandResultId, ApplicationError>> {
    // 1. Create domain command
    const commandResult = Command.create({
      type: request.type,
      payload: request.payload,
      metadata: request.metadata,
    });

    if (commandResult.isFailure()) {
      return Result.failure(new ApplicationError(commandResult.error.message));
    }

    const command = commandResult.value;

    // 2. Persist command
    await this.commandRepository.save(command);

    // 3. Process command (worker-specific)
    const processingResult = await this.commandProcessor.process(command);

    // 4. Create result entity
    const commandResultEntity = processingResult.isSuccess()
      ? CommandResult.success(command.getId(), processingResult.value, Date.now() - command.getCreatedAt().getTime())
      : CommandResult.failure(command.getId(), processingResult.error.message, Date.now() - command.getCreatedAt().getTime());

    // 5. Update command status
    if (processingResult.isSuccess()) {
      command.complete(processingResult.value);
    } else {
      command.fail(processingResult.error.message);
    }

    await this.commandRepository.save(command);

    // 6. Publish result
    await this.messagePublisher.publishResult(commandResultEntity);

    return Result.success(commandResultEntity.getId());
  }
}
```

### Worker-Specific Use Cases

Each worker extends the base use case with domain-specific logic:

```typescript
// LLM Worker - application/use-cases/generate-text.use-case.ts
@Injectable()
export class GenerateTextUseCase extends ProcessCommandUseCase {
  constructor(
    private readonly llmProcessor: ILlmProcessor, // Worker-specific port
    commandRepository: ICommandRepository,
    messagePublisher: IMessagePublisher,
  ) {
    super(
      llmProcessor, // Inject worker-specific processor
      commandRepository,
      messagePublisher,
    );
  }

  // Additional LLM-specific validation
  protected validateCommand(command: Command): Result<void, ApplicationError> {
    if (command.getType() === CommandType.GENERATE_TEXT) {
      const payload = command.getPayload();
      if (!payload.prompt || typeof payload.prompt !== 'string') {
        return Result.failure(new ApplicationError('Invalid prompt'));
      }
    }
    return Result.success(undefined);
  }
}
```

## Infrastructure Layer

### Shared Infrastructure Adapters

#### Kafka Message Publisher

```typescript
@Injectable()
export class KafkaMessagePublisherAdapter implements IMessagePublisher {
  constructor(
    private readonly kafkaProducer: KafkaProducer,
    private readonly config: KafkaConfig,
  ) {}

  async publishResult(result: CommandResult): Promise<Result<void, InfrastructureError>> {
    try {
      const message = {
        key: result.getCommandId().toString(),
        value: JSON.stringify({
          resultId: result.getId().toString(),
          commandId: result.getCommandId().toString(),
          status: result.getStatus(),
          result: result.getResult(),
          error: result.getError(),
          processingTime: result.getProcessingTime(),
        }),
        headers: {
          'correlation-id': result.getCommandId().toString(),
          'worker-type': this.config.workerType,
          'result-type': result.getStatus(),
        },
      };

      await this.kafkaProducer.send({
        topic: 'command.results',
        messages: [message],
      });

      return Result.success(undefined);
    } catch (error) {
      return Result.failure(new KafkaPublishError(error.message));
    }
  }
}
```

#### HTTP Controller

```typescript
@Controller('api/commands')
export class CommandController {
  constructor(
    private readonly processCommandUseCase: ProcessCommandUseCase,
    private readonly getStatusUseCase: GetCommandStatusUseCase,
  ) {}

  @Post()
  async processCommand(
    @Body() body: ProcessCommandRequestDto,
  ): Promise<ProcessCommandResponseDto> {
    const request = ProcessCommandRequest.create({
      type: body.type,
      payload: body.payload,
      metadata: body.metadata,
    });

    const result = await this.processCommandUseCase.execute(request);

    if (result.isFailure()) {
      throw new BadRequestException(result.error.message);
    }

    return {
      commandId: result.value.toString(),
      status: 'accepted',
      workerType: this.getWorkerType(),
    };
  }

  @Get(':id/status')
  async getCommandStatus(@Param('id') id: string): Promise<CommandStatusResponseDto> {
    const commandId = CommandId.fromString(id);
    const result = await this.getStatusUseCase.execute(commandId);

    if (result.isFailure()) {
      throw new NotFoundException(result.error.message);
    }

    return CommandStatusResponseDto.fromDomain(result.value);
  }
}
```

### Worker-Specific Adapters

Each worker implements domain-specific adapters:

```typescript
// LLM Worker - infrastructure/adapters/openai-processor.adapter.ts
@Injectable()
export class OpenAiProcessorAdapter implements ILlmProcessor {
  constructor(
    private readonly openaiClient: OpenAI,
    private readonly config: LlmConfig,
  ) {}

  async process(command: Command): Promise<Result<CommandResult, DomainError>> {
    try {
      const payload = command.getPayload() as LlmCommandPayload;

      const completion = await this.openaiClient.chat.completions.create({
        model: payload.model || 'gpt-4',
        messages: [{ role: 'user', content: payload.prompt }],
        max_tokens: payload.maxTokens,
        temperature: payload.temperature,
      });

      const result = {
        text: completion.choices[0].message.content,
        usage: completion.usage,
        model: completion.model,
      };

      return Result.success(CommandResult.success(
        command.getId(),
        result,
        Date.now() - command.getCreatedAt().getTime(),
      ));
    } catch (error) {
      return Result.failure(new LlmProcessingError(error.message));
    }
  }
}
```

## Worker-Specific Implementations

### LLM Worker Architecture

```
Domain Layer:
├── entities/
│   ├── Prompt.entity.ts
│   ├── Completion.entity.ts
│   └── Model.entity.ts
├── services/
│   ├── PromptEngineering.service.ts
│   ├── ModelSelection.service.ts
│   └── TokenManagement.service.ts

Application Layer:
├── ports/
│   ├── ILlmProcessor.port.ts
│   ├── IModelRegistry.port.ts
│   └── IPromptOptimizer.port.ts
├── use-cases/
│   ├── GenerateText.use-case.ts
│   ├── StreamText.use-case.ts
│   └── OptimizePrompt.use-case.ts

Infrastructure Layer:
├── adapters/
│   ├── OpenAiProcessor.adapter.ts
│   ├── AnthropicProcessor.adapter.ts
│   ├── ModelRegistry.adapter.ts
│   └── PromptCache.adapter.ts
```

### Data Processing Worker Architecture

```
Domain Layer:
├── entities/
│   ├── Document.entity.ts
│   ├── Chunk.entity.ts
│   ├── Embedding.entity.ts
│   └── VectorStore.entity.ts
├── services/
│   ├── DocumentChunking.service.ts
│   ├── EmbeddingGeneration.service.ts
│   └── VectorSearch.service.ts

Application Layer:
├── ports/
│   ├── IDocumentProcessor.port.ts
│   ├── IEmbeddingGenerator.port.ts
│   └── IVectorStore.port.ts
├── use-cases/
│   ├── ProcessDocument.use-case.ts
│   ├── GenerateEmbeddings.use-case.ts
│   └── SearchVectors.use-case.ts

Infrastructure Layer:
├── adapters/
│   ├── PdfProcessor.adapter.ts
│   ├── OpenAiEmbeddings.adapter.ts
│   ├── PineconeStore.adapter.ts
│   └── FileSystemStore.adapter.ts
```

### Interview Worker Architecture

```
Domain Layer:
├── entities/
│   ├── Interview.entity.ts
│   ├── Candidate.entity.ts
│   ├── Question.entity.ts
│   └── Assessment.entity.ts
├── services/
│   ├── QuestionGeneration.service.ts
│   ├── ResponseAnalysis.service.ts
│   └── Scoring.service.ts

Application Layer:
├── ports/
│   ├── IInterviewProcessor.port.ts
│   ├── ICalendarIntegration.port.ts
│   └── IAssessmentEngine.port.ts
├── use-cases/
│   ├── ConductInterview.use-case.ts
│   ├── GenerateQuestions.use-case.ts
│   └── AnalyzeResponses.use-case.ts

Infrastructure Layer:
├── adapters/
│   ├── GoogleCalendar.adapter.ts
│   ├── ZoomIntegration.adapter.ts
│   ├── AssessmentEngine.adapter.ts
│   └── DatabaseStore.adapter.ts
```

## Testing Strategy

### Unit Testing (Domain + Application)

```typescript
describe('Command Entity', () => {
  it('should create valid command', () => {
    const params = {
      type: CommandType.PROCESS_DOCUMENT,
      payload: { documentUrl: 'http://example.com/doc.pdf' },
    };

    const result = Command.create(params);

    expect(result.isSuccess()).toBe(true);
    expect(result.value.getType()).toBe(CommandType.PROCESS_DOCUMENT);
  });

  it('should reject invalid command type', () => {
    const params = {
      type: 'INVALID_TYPE' as CommandType,
      payload: {},
    };

    const result = Command.create(params);

    expect(result.isFailure()).toBe(true);
    expect(result.error).toBeInstanceOf(InvalidCommandTypeError);
  });
});

describe('ProcessCommandUseCase', () => {
  let useCase: ProcessCommandUseCase;
  let mockProcessor: jest.Mocked<ICommandProcessor>;
  let mockRepository: jest.Mocked<ICommandRepository>;
  let mockPublisher: jest.Mocked<IMessagePublisher>;

  beforeEach(() => {
    mockProcessor = createMock<ICommandProcessor>();
    mockRepository = createMock<ICommandRepository>();
    mockPublisher = createMock<IMessagePublisher>();

    useCase = new ProcessCommandUseCase(
      mockProcessor,
      mockRepository,
      mockPublisher,
    );
  });

  it('should process command successfully', async () => {
    const request = createTestRequest();
    const mockResult = createMockCommandResult();

    mockRepository.save.mockResolvedValue(undefined);
    mockProcessor.process.mockResolvedValue(Result.success(mockResult));
    mockPublisher.publishResult.mockResolvedValue(Result.success(undefined));

    const result = await useCase.execute(request);

    expect(result.isSuccess()).toBe(true);
    expect(mockProcessor.process).toHaveBeenCalledWith(expect.any(Command));
  });
});
```

### Integration Testing

```typescript
describe('LLM Worker Integration', () => {
  let app: INestApplication;
  let kafkaClient: ClientKafka;

  beforeAll(async () => {
    app = await createTestApp();
    kafkaClient = app.get<ClientKafka>('KAFKA_CLIENT');
  });

  it('should process LLM command end-to-end', async () => {
    // Send command via HTTP
    const response = await request(app.getHttpServer())
      .post('/api/commands')
      .send({
        type: 'GENERATE_TEXT',
        payload: { prompt: 'Hello, world!' },
      })
      .expect(202);

    const commandId = response.body.commandId;

    // Wait for Kafka message
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify result was published
    const resultMessage = await kafkaClient.subscribeToResponseOf(commandId);
    expect(resultMessage.status).toBe('COMPLETED');
    expect(resultMessage.result.text).toBeDefined();
  });
});
```

### Worker-Specific Testing

Each worker has domain-specific tests:

```typescript
// LLM Worker specific tests
describe('OpenAiProcessorAdapter', () => {
  it('should handle OpenAI API errors gracefully', async () => {
    const mockOpenAI = createMock<OpenAI>();
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

    const adapter = new OpenAiProcessorAdapter(mockOpenAI, llmConfig);
    const command = createTestCommand();

    const result = await adapter.process(command);

    expect(result.isFailure()).toBe(true);
    expect(result.error).toBeInstanceOf(LlmProcessingError);
  });
});
```

## Deployment & Scaling

### Container Configuration

Each worker runs in its own container with specific resource requirements:

```dockerfile
# LLM Worker Dockerfile
FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY dist/ ./dist/

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

EXPOSE 3001
CMD ["node", "dist/main.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: assistant-worker
spec:
  replicas: 3
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
        image: enginedge/assistant-worker:latest
        ports:
        - containerPort: 3001
        env:
        - name: KAFKA_BROKERS
          value: "kafka-cluster:9092"
        - name: REDIS_URL
          value: "redis://redis-cluster:6379"
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: openai-secrets
              key: api-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Horizontal Scaling

Workers scale based on queue depth and resource utilization:

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
  - type: External
    external:
      metric:
        name: kafka_consumergroup_lag
        selector:
          matchLabels:
            topic: worker.llm.requests
      target:
        type: AverageValue
        averageValue: "100"
```

### Service Mesh Integration

Workers integrate with service mesh for traffic management:

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: assistant-worker
spec:
  http:
  - match:
    - uri:
        prefix: "/api"
    route:
    - destination:
        host: assistant-worker
    timeout: 300s  # Long timeout for LLM requests
    retries:
      attempts: 2
      perTryTimeout: 150s
```

This architecture ensures consistency, scalability, and maintainability across all worker types while allowing for domain-specific specialization.