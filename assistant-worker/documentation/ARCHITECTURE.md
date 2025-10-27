# Assistant Worker - Architecture Documentation

## Table of Contents

- [Overview](#overview)
- [Hexagonal Architecture](#hexagonal-architecture)
- [System Architecture](#system-architecture)
- [Agent Execution Flow](#agent-execution-flow)
- [Data Flow](#data-flow)
- [Component Diagrams](#component-diagrams)
- [Layer Details](#layer-details)

---

## Overview

The Assistant Worker implements **Hexagonal Architecture** (Ports & Adapters pattern) to ensure clean separation of concerns, testability, and maintainability. The system is organized into three main layers:

1. **Domain Layer** - Pure business logic
2. **Application Layer** - Use cases and orchestration
3. **Infrastructure Layer** - External integrations

---

## Hexagonal Architecture

```mermaid
graph TB
    subgraph "Infrastructure Layer"
        Controllers[REST Controllers]
        Adapters[Adapters]
        Controllers --> Adapters
    end
    
    subgraph "Application Layer"
        UseCases[Use Cases]
        Services[Application Services]
        Ports[Ports/Interfaces]
        UseCases --> Services
        Services --> Ports
    end
    
    subgraph "Domain Layer"
        Agents[Agent Types]
        Entities[Entities]
        ValueObjects[Value Objects]
        DomainServices[Domain Services]
        Agents --> Entities
        Agents --> ValueObjects
        Agents --> DomainServices
    end
    
    Controllers --> UseCases
    Adapters -.implements.-> Ports
    Services --> DomainServices
    
    style Domain Layer fill:#e1f5ff
    style Application Layer fill:#fff4e1
    style Infrastructure Layer fill:#ffe1f5
```

### Key Principles

1. **Dependencies point inward** - Infrastructure depends on Application, Application depends on Domain
2. **Domain is pure** - No external dependencies in domain layer
3. **Ports define contracts** - Application layer defines interfaces
4. **Adapters implement ports** - Infrastructure provides concrete implementations

---

## System Architecture

```mermaid
graph LR
    Client[Client/Frontend] --> Gateway[API Gateway]
    Gateway --> AW[Assistant Worker]
    
    subgraph "Assistant Worker"
        REST[REST API<br/>80+ Endpoints]
        AgentEngine[Agent Engine<br/>6 Types]
        Memory[Memory System<br/>5 Types]
        KG[Knowledge Graph<br/>Neo4j]
    end
    
    subgraph "External Services"
        LLM[LLM Providers<br/>OpenAI/Anthropic]
        MongoDB[(MongoDB)]
        Neo4j[(Neo4j)]
        Kafka[Kafka]
    end
    
    REST --> AgentEngine
    REST --> Memory
    REST --> KG
    
    AgentEngine --> LLM
    Memory --> MongoDB
    KG --> Neo4j
    AgentEngine --> Kafka
    
    style AW fill:#e1f5ff
    style LLM fill:#ffe1e1
    style MongoDB fill:#e1ffe1
    style Neo4j fill:#ffe1e1
    style Kafka fill:#e1ffe1
```

---

## Agent Execution Flow

### Standard Execution Flow

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant UseCase
    participant AgentService
    participant Agent
    participant LLM
    participant Memory
    
    Client->>Controller: POST /agents/:id/execute
    Controller->>UseCase: execute(request)
    UseCase->>AgentService: getAgentInstance(id)
    AgentService->>Agent: create instance
    AgentService-->>UseCase: agent instance
    
    UseCase->>Agent: execute(input, context)
    Agent->>Agent: initialize context
    Agent->>Agent: emit 'agent:started'
    
    loop Agent Loop
        Agent->>LLM: generate response
        LLM-->>Agent: response
        Agent->>Memory: store message
        Agent->>Agent: process response
    end
    
    Agent->>Agent: emit 'agent:completed'
    Agent-->>UseCase: ExecutionResult
    UseCase-->>Controller: result
    Controller-->>Client: JSON response
```

### Streaming Execution Flow

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant UseCase
    participant Agent
    participant LLM
    participant SSE
    
    Client->>Controller: POST /agents/:id/stream
    Controller->>UseCase: stream(request)
    UseCase->>Agent: stream(input, context)
    Agent->>Agent: emit 'agent:stream_started'
    
    loop Streaming Loop
        Agent->>LLM: stream tokens
        LLM-->>Agent: token chunk
        Agent->>SSE: emit chunk
        SSE-->>Client: SSE event
    end
    
    Agent->>Agent: emit 'agent:stream_completed'
    SSE-->>Client: close connection
```

---

## Data Flow

### Agent Creation & Execution

```mermaid
flowchart TD
    Start([Client Request]) --> CreateAgent{Agent Exists?}
    CreateAgent -->|No| Factory[AgentFactory]
    Factory --> Instance[Agent Instance]
    CreateAgent -->|Yes| GetAgent[Get from Registry]
    GetAgent --> Instance
    
    Instance --> Execute[Execute Agent]
    Execute --> InitContext[Initialize Context]
    InitContext --> LoadMemory[Load Memory]
    LoadMemory --> AgentLoop{Agent Loop}
    
    AgentLoop --> LLM[Call LLM]
    LLM --> ProcessResponse[Process Response]
    ProcessResponse --> CheckTool{Tool Call?}
    CheckTool -->|Yes| ExecuteTool[Execute Tool]
    ExecuteTool --> AgentLoop
    CheckTool -->|No| CheckDone{Done?}
    CheckDone -->|No| AgentLoop
    CheckDone -->|Yes| SaveMemory[Save to Memory]
    SaveMemory --> Return([Return Result])
    
    style Start fill:#e1f5ff
    style Return fill:#e1ffe1
    style LLM fill:#ffe1e1
```

### Memory Operations

```mermaid
flowchart LR
    Input[User Message] --> AddMessage[Add to Memory]
    AddMessage --> BufferMem[Buffer Memory]
    AddMessage --> WindowMem[Window Memory]
    AddMessage --> SummaryMem[Summary Memory]
    AddMessage --> VectorMem[Vector Memory]
    AddMessage --> EntityMem[Entity Memory]
    
    BufferMem --> Persist[MongoDB Persistence]
    WindowMem --> Persist
    SummaryMem --> Persist
    VectorMem --> Persist
    EntityMem --> Persist
    
    Retrieve[Retrieve Context] --> MemoryType{Memory Type}
    MemoryType --> BufferMem
    MemoryType --> WindowMem
    MemoryType --> SummaryMem
    MemoryType --> VectorMem
    MemoryType --> EntityMem
    
    style Input fill:#e1f5ff
    style Persist fill:#e1ffe1
```

---

## Component Diagrams

### Domain Layer Components

```mermaid
classDiagram
    class BaseAgent {
        <<abstract>>
        +execute(input, context)
        +stream(input, context)
        +abort()
        +getState()
        #run(input, context)*
        #runStream(input, context)*
    }
    
    class ReActAgent {
        +run(input, context)
        +runStream(input, context)
        -reasoningLoop()
    }
    
    class GraphAgent {
        +run(input, context)
        +runStream(input, context)
        -executeDAG()
    }
    
    class ExpertAgent {
        +run(input, context)
        -aim()
        -shoot()
        -skin()
    }
    
    class GeniusAgent {
        +run(input, context)
        -orchestrateExperts()
    }
    
    class CollectiveAgent {
        +run(input, context)
        -coordinateAgents()
    }
    
    class ManagerAgent {
        +run(input, context)
        -decomposeTask()
    }
    
    BaseAgent <|-- ReActAgent
    BaseAgent <|-- GraphAgent
    BaseAgent <|-- ExpertAgent
    BaseAgent <|-- GeniusAgent
    BaseAgent <|-- CollectiveAgent
    BaseAgent <|-- ManagerAgent
```

### Application Layer Components

```mermaid
classDiagram
    class ExecuteAgentUseCase {
        +execute(request)
    }
    
    class AgentService {
        +createAgent(dto, userId)
        +getAgent(agentId, userId)
        +listAgents(userId, filter)
        +executeAgent(agentId, userId, input)
        +streamAgent(agentId, userId, input)
        -agentRegistry Map
        -agentInstances Map
    }
    
    class MemoryService {
        +addMessage(conversationId, message)
        +getMessages(conversationId, type)
        +getContext(conversationId)
        +clearMemory(conversationId)
        -memoryAdapters Map
    }
    
    class KnowledgeGraphService {
        +addNode(label, type, layer)
        +createRelationship(from, to, type)
        +query(cypher, params)
        +traverseUp(nodeId)
        +traverseDown(nodeId)
    }
    
    ExecuteAgentUseCase --> AgentService
    ExecuteAgentUseCase --> MemoryService
    AgentService --> KnowledgeGraphService
```

### Infrastructure Layer Components

```mermaid
classDiagram
    class AgentController {
        +create(body)
        +listAgents(userId)
        +getAgent(agentId, userId)
        +execute(agentId, body)
        +executeStream(agentId, body)
        +deleteAgent(agentId, userId)
        +abortAgent(agentId, userId)
    }
    
    class MemoryController {
        +addMessage(conversationId, body)
        +getMessages(conversationId, query)
        +getContext(conversationId, query)
        +clearMemory(conversationId, query)
        +getSummary(conversationId)
    }
    
    class KnowledgeGraphController {
        +createNode(body)
        +getNode(nodeId)
        +createEdge(body)
        +executeQuery(query)
        +getNodesByLayer(layer)
    }
    
    class ILLMProvider {
        <<interface>>
        +generate(request)
        +stream(request)
    }
    
    class MockLLMAdapter {
        +generate(request)
        +stream(request)
    }
    
    class OpenAILLMAdapter {
        +generate(request)
        +stream(request)
    }
    
    ILLMProvider <|.. MockLLMAdapter
    ILLMProvider <|.. OpenAILLMAdapter
```

---

## Layer Details

### Domain Layer

**Location:** `src/domain/`

**Responsibilities:**
- Pure business logic
- Agent implementations
- Domain entities and value objects
- Domain services (PromptBuilder, ResponseParser, etc.)

**Key Files:**
```
domain/
├── agents/
│   ├── agent.base.ts          # Abstract base agent
│   ├── react-agent/           # ReAct agent
│   ├── graph-agent/           # Graph agent
│   ├── expert-agent/          # Expert agent
│   ├── genius-agent/          # Genius agent
│   ├── collective-agent/      # Collective agent
│   └── manager-agent/         # Manager agent
├── entities/
│   ├── agent.entity.ts        # Agent entity
│   ├── agent-state.entity.ts  # State management
│   └── execution-context.ts   # Execution context
├── value-objects/
│   ├── message.vo.ts          # Message value object
│   └── agent-config.vo.ts     # Configuration
└── services/
    ├── agent-factory.service.ts    # Creates agents
    ├── prompt-builder.service.ts   # Builds prompts
    └── response-parser.service.ts  # Parses responses
```

**No External Dependencies:** Domain layer only depends on TypeScript standard library.

---

### Application Layer

**Location:** `src/application/`

**Responsibilities:**
- Use case orchestration
- Application services
- Port definitions (interfaces)
- DTOs and validation

**Key Files:**
```
application/
├── use-cases/
│   ├── execute-agent.use-case.ts
│   └── stream-agent-execution.use-case.ts
├── services/
│   ├── agent.service.ts           # Agent CRUD
│   ├── memory.service.ts          # Memory operations
│   ├── knowledge-graph.service.ts # KG operations
│   ├── checkpoint.service.ts      # Checkpointing
│   └── hitl.service.ts           # Human-in-the-loop
├── ports/
│   ├── llm-provider.port.ts      # LLM interface
│   ├── logger.port.ts            # Logger interface
│   └── agent.repository.ts       # Repository interface
└── dto/
    ├── agent.dto.ts              # Agent DTOs
    └── execute-agent.request.ts  # Request DTOs
```

**Dependencies:** Domain layer only.

---

### Infrastructure Layer

**Location:** `src/infrastructure/`

**Responsibilities:**
- External integrations
- REST controllers
- Adapter implementations
- Middleware and filters

**Key Files:**
```
infrastructure/
├── controllers/
│   ├── agent.controller.ts           # 7 endpoints
│   ├── react-agent.controller.ts     # 5 endpoints
│   ├── graph-agent.controller.ts     # 8 endpoints
│   ├── expert-agent.controller.ts    # 6 endpoints
│   ├── genius-agent.controller.ts    # 7 endpoints
│   ├── collective-agent.controller.ts # 6 endpoints
│   ├── manager-agent.controller.ts   # 6 endpoints
│   ├── memory.controller.ts          # 11 endpoints
│   └── knowledge-graph.controller.ts # 15 endpoints
├── adapters/
│   ├── llm/
│   │   ├── mock-llm.adapter.ts
│   │   └── openai-llm.adapter.ts
│   ├── memory/
│   │   ├── buffer-memory.adapter.ts
│   │   ├── window-memory.adapter.ts
│   │   ├── summary-memory.adapter.ts
│   │   ├── vector-memory.adapter.ts
│   │   └── entity-memory.adapter.ts
│   ├── knowledge-graph/
│   │   └── neo4j.adapter.ts
│   └── streaming/
│       ├── sse-stream.adapter.ts
│       └── websocket.adapter.ts
└── middleware/
    ├── correlation-id.middleware.ts
    └── logging.interceptor.ts
```

**Dependencies:** Application and Domain layers.

---

## Agent Type Details

### ReAct Agent Architecture

```mermaid
flowchart TD
    Start([Input]) --> Thought[Thought: Reasoning]
    Thought --> Action{Action Type}
    Action -->|Tool| ExecuteTool[Execute Tool]
    Action -->|Answer| FinalAnswer[Final Answer]
    ExecuteTool --> Observation[Observation: Result]
    Observation --> Thought
    FinalAnswer --> End([Return])
    
    style Start fill:#e1f5ff
    style End fill:#e1ffe1
```

### Graph Agent Architecture

```mermaid
flowchart TD
    Start([Define Workflow]) --> ParseGraph[Parse DAG]
    ParseGraph --> FindStart[Find Start Nodes]
    FindStart --> ExecuteNode{Execute Node}
    
    ExecuteNode -->|Task| RunTask[Run Task]
    ExecuteNode -->|Input| WaitUser[Wait for User Input]
    ExecuteNode -->|Approval| WaitApproval[Wait for Approval]
    ExecuteNode -->|Condition| EvalCondition[Evaluate Condition]
    
    RunTask --> CheckEdges{Check Edges}
    WaitUser --> CheckEdges
    WaitApproval --> CheckEdges
    EvalCondition --> CheckEdges
    
    CheckEdges -->|More Nodes| ExecuteNode
    CheckEdges -->|Complete| End([Return Results])
    
    style Start fill:#e1f5ff
    style End fill:#e1ffe1
```

### Expert Agent Architecture (ICS)

```mermaid
flowchart TD
    Start([Research Question]) --> AIM[AIM Phase:<br/>Analyze Question]
    AIM --> Identify[Identify Key Concepts]
    Identify --> SHOOT[SHOOT Phase:<br/>Multi-Source Research]
    
    SHOOT --> Source1[Source 1]
    SHOOT --> Source2[Source 2]
    SHOOT --> Source3[Source 3]
    
    Source1 --> Aggregate[Aggregate Results]
    Source2 --> Aggregate
    Source3 --> Aggregate
    
    Aggregate --> SKIN[SKIN Phase:<br/>Synthesize]
    SKIN --> BuildKG[Build Knowledge Graph]
    BuildKG --> Format[Format with Citations]
    Format --> End([Return Research])
    
    style Start fill:#e1f5ff
    style End fill:#e1ffe1
    style AIM fill:#ffe1e1
    style SHOOT fill:#fff4e1
    style SKIN fill:#e1ffe1
```

---

## Scaling Considerations

### Horizontal Scaling

The Assistant Worker is **stateless** and can be horizontally scaled:

```mermaid
graph TB
    LB[Load Balancer] --> W1[Worker 1]
    LB --> W2[Worker 2]
    LB --> W3[Worker 3]
    
    W1 --> Redis[(Redis<br/>Shared State)]
    W2 --> Redis
    W3 --> Redis
    
    W1 --> MongoDB[(MongoDB)]
    W2 --> MongoDB
    W3 --> MongoDB
    
    W1 --> Neo4j[(Neo4j)]
    W2 --> Neo4j
    W3 --> Neo4j
```

### Vertical Scaling

- Worker thread pool (2-8 threads)
- Memory limits configurable
- CPU allocation per pod/container

---

## Summary

The Assistant Worker architecture provides:

✅ **Clean Separation** - Hexagonal architecture ensures testability  
✅ **Extensibility** - Easy to add new agent types or adapters  
✅ **Scalability** - Stateless design enables horizontal scaling  
✅ **Maintainability** - Clear boundaries and dependencies  
✅ **Testability** - 98% test coverage with mock adapters  

For implementation details, see the source code in `src/`.

