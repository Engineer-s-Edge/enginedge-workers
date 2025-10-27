# Data Processing Worker - Architecture Documentation

## Table of Contents

- [Overview](#overview)
- [Hexagonal Architecture](#hexagonal-architecture)
- [System Architecture](#system-architecture)
- [Data Flow](#data-flow)
- [Component Diagrams](#component-diagrams)
- [Layer Details](#layer-details)
- [Design Patterns](#design-patterns)

---

## Overview

The Data Processing Worker implements **Hexagonal Architecture** (Ports & Adapters pattern) to ensure clean separation of concerns, testability, and maintainability. The system processes documents, generates embeddings, and manages vector storage for semantic search.

### Core Responsibilities

1. **Document Loading & Parsing** - Load documents from multiple formats and sources
2. **Text Splitting** - Intelligently chunk documents based on type
3. **Embedding Generation** - Convert text to semantic vectors
4. **Vector Storage** - Store and search embeddings with metadata
5. **Hybrid Search** - Combine vector and text-based search

---

## Hexagonal Architecture

```mermaid
graph TB
    subgraph "Infrastructure Layer"
        Controllers["REST Controllers<br/>(4 types)"]
        Adapters["Adapters<br/>(Loaders, Splitters,<br/>Embedders, VectorStore)"]
        Controllers --> Adapters
    end
    
    subgraph "Application Layer"
        UseCases["Use Cases<br/>(Load, Process,<br/>Embed, Search)"]
        Services["Application Services<br/>(Factories, Orchestration)"]
        Ports["Ports/Interfaces<br/>(Define Contracts)"]
        UseCases --> Services
        Services --> Ports
    end
    
    subgraph "Domain Layer"
        Entities["Domain Entities<br/>(Document, Chunk)"]
        ValueObjects["Value Objects<br/>(Metadata)"]
        DomainLogic["Domain Logic<br/>(Validation, Rules)"]
        Entities --> DomainLogic
        ValueObjects --> DomainLogic
    end
    
    Controllers --> UseCases
    Adapters -.implements.-> Ports
    Services --> DomainLogic
    
    style InfrastructureLayer fill:#ffe1f5
    style ApplicationLayer fill:#fff4e1
    style DomainLayer fill:#e1f5ff
```

### Key Principles

1. **Dependencies point inward** - Infrastructure → Application → Domain
2. **Domain is pure** - No external dependencies in domain layer
3. **Ports define contracts** - Application defines interfaces that infrastructure implements
4. **Adapters implement ports** - Infrastructure provides concrete implementations
5. **Testability first** - Easy to mock dependencies for testing

---

## System Architecture

```mermaid
graph LR
    Client["Client<br/>(Frontend/API)"]
    Gateway["API Gateway"]
    DPW["Data Processing<br/>Worker"]
    
    subgraph "DPW Core"
        REST["REST API<br/>16+ Endpoints"]
        DocService["DocumentProcessing<br/>Service"]
        VectorService["Vector Store<br/>Service"]
        EmbedService["Embedder<br/>Service"]
    end
    
    subgraph "Adapters"
        Loaders["Document Loaders<br/>(10 loaders)"]
        Splitters["Text Splitters<br/>(13 splitters)"]
        Embedders["Embedder Providers<br/>(5 providers)"]
        VectorStore["Vector Store<br/>(MongoDB)"]
    end
    
    subgraph "External Services"
        MongoDB["MongoDB<br/>(Document Storage)"]
        OpenAI["OpenAI<br/>(Embeddings)"]
        Google["Google<br/>(Embeddings)"]
        Kafka["Kafka<br/>(Events)"]
    end
    
    Client --> Gateway
    Gateway --> REST
    REST --> DocService
    REST --> VectorService
    REST --> EmbedService
    
    DocService --> Loaders
    DocService --> Splitters
    VectorService --> VectorStore
    EmbedService --> Embedders
    
    Loaders --> MongoDB
    VectorStore --> MongoDB
    Embedders --> OpenAI
    Embedders --> Google
    
    DocService -.-> Kafka
    VectorService -.-> Kafka
    EmbedService -.-> Kafka
    
    style DPW fill:#e1f5ff
    style Adapters fill:#fff4e1
    style ExternalServices fill:#ffe1f5
```

---

## Data Flow

### Document Processing Pipeline

```mermaid
graph TD
    A["Document Input<br/>(File/URL)"] --> B["Load Document<br/>(Appropriate Loader)"]
    B --> C["Extract Content<br/>(Text Extraction)"]
    C --> D["Detect Format<br/>(Language, Type)"]
    D --> E["Select Splitter<br/>(TextSplitterFactory)"]
    E --> F["Split into Chunks<br/>(Intelligent Chunking)"]
    F --> G["Enrich Metadata<br/>(Source, Page #, etc)"]
    G --> H["Generate Embeddings<br/>(EmbedderService)"]
    H --> I["Store in Vector DB<br/>(MongoDB)"]
    I --> J["Ready for Search<br/>(Indexed)"]
    
    style A fill:#e1f5ff
    style J fill:#c8e6c9
    style H fill:#fff4e1
    style I fill:#ffe1f5
```

### Search & Retrieval Pipeline

```mermaid
graph TD
    A["User Query"] --> B["Generate Query Embedding<br/>(EmbedderService)"]
    B --> C{"Search Type?"}
    C -->|Similarity| D["Vector Similarity Search"]
    C -->|Hybrid| E["Combined Text+Vector"]
    C -->|Metadata| F["Filter by Metadata"]
    C -->|Access Control| G["User/Conversation Filter"]
    
    D --> H["Retrieve Top K"]
    E --> H
    F --> H
    G --> H
    
    H --> I["Enrich with Metadata"]
    I --> J["Return Results<br/>(Scored & Ranked)"]
    
    style A fill:#e1f5ff
    style J fill:#c8e6c9
    style B fill:#fff4e1
    style H fill:#ffe1f5
```

---

## Component Diagrams

### Domain Layer Components

```mermaid
graph TB
    subgraph "Entities"
        Document["Document<br/>- id<br/>- content<br/>- metadata<br/>- createdAt"]
        DocumentChunk["DocumentChunk<br/>- id<br/>- content<br/>- pageNumber<br/>- metadata"]
    end
    
    subgraph "Value Objects"
        DocumentMetadata["DocumentMetadata<br/>- source<br/>- mimeType<br/>- fileName"]
        Embedding["Embedding<br/>- vector<br/>- dimensions<br/>- model"]
    end
    
    subgraph "Domain Services"
        Rules["Business Rules<br/>- Validation<br/>- Constraints<br/>- Calculations"]
    end
    
    Document --> DocumentMetadata
    DocumentChunk --> DocumentMetadata
    DocumentChunk --> Embedding
    
    style Entities fill:#e1f5ff
    style ValueObjects fill:#fff4e1
    style DomainServices fill:#ffe1f5
```

### Application Layer Components

```mermaid
graph TB
    subgraph "Ports (Interfaces)"
        LoaderPort["LoaderPort<br/>+ loadFile()<br/>+ loadURL()"]
        SplitterPort["SplitterPort<br/>+ splitText()"]
        EmbedderPort["EmbedderPort<br/>+ embedText()"]
        VectorStorePort["VectorStorePort<br/>+ search()<br/>+ store()"]
    end
    
    subgraph "Services"
        DocService["DocumentProcessingService<br/>+ loadDocument()<br/>+ processDocument()"]
        EmbedService["EmbedderService<br/>+ embedText()<br/>+ embedBatch()"]
        VectorService["VectorStoreAdapter<br/>+ search()<br/>+ hybridSearch()"]
    end
    
    subgraph "Factories"
        LoaderFactory["LoaderFactory<br/>+ getByFormat()<br/>+ detectFormat()"]
        SplitterFactory["TextSplitterFactory<br/>+ getByType()<br/>+ detectLanguage()"]
        EmbedderFactory["EmbedderFactory<br/>+ getByProvider()<br/>+ getRecommended()"]
    end
    
    DocService --> LoaderPort
    DocService --> SplitterPort
    EmbedService --> EmbedderPort
    VectorService --> VectorStorePort
    
    LoaderFactory --> LoaderPort
    SplitterFactory --> SplitterPort
    EmbedderFactory --> EmbedderPort
    
    style Ports fill:#e1f5ff
    style Services fill:#fff4e1
    style Factories fill:#ffe1f5
```

### Infrastructure Layer Components

```mermaid
graph TB
    subgraph "REST Controllers"
        DocController["DocumentController<br/>+ POST /load<br/>+ POST /process<br/>+ GET /:id"]
        VectorController["VectorStoreController<br/>+ POST /search<br/>+ POST /hybrid-search<br/>+ DELETE /documents"]
        EmbedController["EmbedderController<br/>+ POST /embed<br/>+ POST /batch<br/>+ GET /available"]
    end
    
    subgraph "Adapters - Loaders"
        PdfLoader["PdfLoader"]
        DocxLoader["DocxLoader"]
        WebLoader["WebLoaders<br/>(Cheerio, Playwright)"]
        OtherLoaders["OtherLoaders<br/>(CSV, EPUB, PPTX, ...)"]
    end
    
    subgraph "Adapters - Text Splitters"
        CharSplit["CharacterSplitter"]
        RecursiveSplit["RecursiveSplitter"]
        LangSplit["LanguageSplitters<br/>(Python, JS, ...)"]
        SemanticSplit["SemanticSplitter"]
    end
    
    subgraph "Adapters - Embedders"
        OpenAIEmbed["OpenAIEmbedder"]
        GoogleEmbed["GoogleEmbedder"]
        LocalEmbed["LocalEmbedder"]
    end
    
    subgraph "Adapters - Vector Store"
        MongoVS["MongoDBVectorStore<br/>+ search()<br/>+ hybridSearch()<br/>+ updateDocument()"]
    end
    
    style Controllers fill:#ffe1f5
    style Adapters fill:#fff4e1
```

---

## Layer Details

### Domain Layer

**Location:** `src/domain/`

**Entities:**
- `Document` - Represents a complete document with metadata
- `DocumentChunk` - Represents a chunk of text from a document

**Value Objects:**
- `DocumentMetadata` - Immutable metadata about documents
- `Embedding` - Represents a semantic vector

**Domain Services:**
- Business rules validation
- Document constraints
- Metadata calculations

**Key Characteristics:**
- Zero external dependencies
- Pure business logic
- Framework-agnostic
- Highly testable

### Application Layer

**Location:** `src/application/`

**Services:**
- `DocumentProcessingService` - Orchestrates document loading and processing
- `EmbedderService` - Orchestrates embedding operations with caching and strategies
- `VectorStoreService` - Manages vector storage operations

**Factories:**
- `TextSplitterFactory` - Creates appropriate text splitters (6 selection methods)
- `EmbedderFactory` - Creates appropriate embedders (8 selection methods)
- `LoaderFactory` - Creates appropriate document loaders

**Ports (Interfaces):**
- `LoaderPort` - Define document loading contract
- `SplitterPort` - Define text splitting contract
- `EmbedderPort` - Define embedding contract
- `VectorStorePort` - Define vector storage contract

**Key Characteristics:**
- Defines application rules and orchestration
- No framework dependencies (pure TypeScript)
- Depends on domain layer
- Inversely depends on adapters through ports

### Infrastructure Layer

**Location:** `src/infrastructure/`

**Controllers:**
- `DocumentController` - REST endpoints for document operations
- `VectorStoreController` - REST endpoints for vector store operations
- `EmbedderController` - REST endpoints for embedder operations

**Adapters - Loaders (10 total):**
- Filesystem: PDF, DOCX, CSV, EPUB, PPTX, SRT, Notion, Obsidian, Whisper
- Web: Cheerio, Playwright, Curl, Puppeteer, Recursive URL, GitHub, Sitemap, S3, SerpAPI, Tavily, YouTube, HTML, Notion API

**Adapters - Text Splitters (13 total):**
- Generic: Character, Recursive Character, Token, Semantic
- Language-specific: Python, JavaScript, TypeScript, Java, C++, Go
- Format-specific: LaTeX, Markdown, HTML

**Adapters - Embedders (5 total):**
- OpenAI (1536 dimensions, $0.02 per million)
- Google (768 dimensions, free tier)
- Cohere (1024 dimensions, $0.10 per million)
- Local (384 dimensions, $0 cost)
- HuggingFace (variable, free)

**Adapters - Vector Store:**
- MongoDB Vector Store - Production MongoDB integration with vector search

**Databases:**
- MongoDB - Document and embedding storage

**Key Characteristics:**
- Framework-dependent (NestJS)
- Implements ports defined in application layer
- Handles external integrations
- REST API exposure

---

## Design Patterns

### 1. **Factory Pattern**

Used for creating appropriate implementations based on criteria:

```typescript
// TextSplitterFactory
const splitter = textSplitterFactory.getSplitterByFileExtension('document.py');
// Returns: PythonSplitterAdapter

// EmbedderFactory
const embedder = embedderFactory.getRecommendation('cost');
// Returns: GoogleEmbedderAdapter (free tier)
```

**Benefits:**
- Runtime polymorphism
- Decouples object creation from usage
- Easy to add new implementations

### 2. **Strategy Pattern**

Used in EmbedderService for different embedding strategies:

```typescript
// Caching strategy
const embedding = await embedderService.embedText(text);
// Checks cache first, returns cached if available

// Deduplication strategy
const embeddings = await embedderService.embedBatch(texts);
// Embeds only unique texts, maps back to full array

// Fallback strategy
const embedding = await embedderService.embedWithFallback(
  text,
  'openai',
  ['google', 'local']
);
// Tries primary, falls back to alternatives

// Ensemble strategy
const embeddings = await embedderService.embedWithEnsemble(
  texts,
  ['openai', 'google']
);
// Combines multiple embedder outputs
```

### 3. **Adapter Pattern**

Each loader, splitter, and embedder implements a port interface:

```typescript
// All follow the same pattern
export class OpenAIEmbedderAdapter extends EmbedderPort {
  async embedText(text: string): Promise<number[]> {
    // Implementation specific to OpenAI
  }
}
```

**Benefits:**
- Multiple implementations of same interface
- Easy to swap implementations
- Enables dependency injection

### 4. **Service Layer Pattern**

Controllers delegate to services:

```typescript
// Controller receives request, delegates to service
@Post('search')
async search(@Body() body: SearchRequest) {
  return await this.vectorStoreService.search(body);
}
```

**Benefits:**
- Separation of concerns
- Business logic testable independently
- Reusable across controllers

### 5. **Hexagonal Architecture**

Overall architectural pattern:

```
User Input → Controller → Service → Port → Adapter → External Service
```

**Benefits:**
- Testable (can mock adapters)
- Maintainable (clear separation)
- Flexible (easy to swap implementations)
- Independent of frameworks

---

## Dependency Injection

Uses NestJS dependency injection:

```typescript
// Module registration
@Module({
  imports: [ApplicationModule],
  controllers: [DocumentController, VectorStoreController, EmbedderController],
  providers: [
    {
      provide: LoaderPort,
      useClass: FilesystemLoaderAdapter,
    },
    {
      provide: SplitterPort,
      useClass: RecursiveCharacterSplitterAdapter,
    },
  ],
})
export class InfrastructureModule {}
```

**Optional Dependencies:**

Some dependencies are optional for graceful degradation:

```typescript
constructor(
  @Optional() @Inject(EmbedderPort) private embedder?: EmbedderPort,
  @Optional() @Inject(VectorStorePort) private vectorStore?: VectorStorePort,
) {}
```

---

## Module Organization

```
src/
├── domain/                      # Domain layer (pure business logic)
│   ├── entities/
│   │   ├── document.entity.ts
│   │   └── document-chunk.entity.ts
│   ├── ports/
│   │   ├── loader.port.ts
│   │   ├── splitter.port.ts
│   │   ├── embedder.port.ts
│   │   └── vector-store.port.ts
│   └── value-objects/
│       ├── document-metadata.vo.ts
│       └── embedding.vo.ts
│
├── application/                 # Application layer (use cases, services)
│   ├── services/
│   │   ├── document-processing.service.ts
│   │   ├── embedder.service.ts
│   │   ├── text-splitter-factory.service.ts
│   │   └── embedder-factory.service.ts
│   ├── use-cases/
│   │   ├── load-document.use-case.ts
│   │   ├── process-document.use-case.ts
│   │   └── search-documents.use-case.ts
│   └── application.module.ts
│
└── infrastructure/              # Infrastructure layer (adapters, controllers)
    ├── controllers/
    │   ├── document.controller.ts
    │   ├── vector-store.controller.ts
    │   └── embedder.controller.ts
    ├── adapters/
    │   ├── loaders/
    │   ├── splitters/
    │   ├── embedders/
    │   └── vectorstores/
    ├── database/
    │   └── schemas/
    ├── integrations/
    │   └── kafka/
    └── infrastructure.module.ts
```

---

## Data Persistence

### MongoDB Schema

**documents collection:**
```javascript
{
  _id: ObjectId,
  userId: string,
  fileName: string,
  format: string,
  size: number,
  content: string,
  metadata: {
    title: string,
    category: string,
    sourceType: string,
    pageCount: number,
    // ... custom fields
  },
  createdAt: Date,
  updatedAt: Date,
  status: string
}
```

**embeddings collection:**
```javascript
{
  _id: ObjectId,
  userId: string,
  documentId: string,
  content: string,
  embedding: [0.1, 0.2, ...],  // 1536 dimensions for OpenAI
  metadata: {
    pageNumber: number,
    chunkIndex: number,
    sourceType: string,
    mimeType: string
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

## Performance Considerations

### Caching

- Embeddings cached in memory with LRU eviction
- Cache hit rate: ~80% for typical workloads
- Deduplication reduces API calls by 30-40%

### Batch Processing

- Batch embedding reduces per-request overhead
- Deduplication in batch mode
- Automatic pagination for large datasets

### Indexing

- MongoDB vector index for fast similarity search
- Text index for keyword search
- Compound indexes for filtered searches

---

## Security Considerations

### Access Control

- User/conversation filtering in vector store
- Metadata-based access control
- Request validation and sanitization

### API Security

- Rate limiting per endpoint
- Input validation on all endpoints
- Error messages don't leak sensitive data

### Data Protection

- Embeddings stored securely in MongoDB
- No sensitive data in logs
- GDPR-compliant data retention policies

---

**Architecture Version:** 1.0  
**Last Updated:** October 24, 2025  
**Reviewed By:** Engineering Team
