# LaTeX Worker Architecture

## System Design

### Layered Architecture

```
┌─────────────────────────────────────┐
│     Presentation Layer              │
│  (REST Controllers, HTTP Handlers)  │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│     Application Layer               │
│  (Use Cases, Services, Business     │
│   Logic, Orchestration)             │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│     Domain Layer                    │
│  (Entities, Value Objects, Ports)   │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│     Infrastructure Layer            │
│  (Adapters, Database, Messaging,    │
│   Compilation, File System)         │
└─────────────────────────────────────┘
```

## Components

### Domain Entities

- **LaTeXDocument**: Represents a LaTeX document with content and metadata
- **CompilationJob**: Tracks compilation jobs with status and results
- **LaTeXProject**: Multi-file project with main file and dependencies
- **LaTeXTemplate**: Reusable templates with variable placeholders
- **LaTeXPackage**: Package cache metadata

### Application Services

#### LaTeXCompilerService
- XeLaTeX/LuaLaTeX execution
- Multi-pass compilation (up to 3 passes)
- Error parsing from compilation logs
- Warning extraction
- PDF generation verification

#### PackageManagerService
- Detects required packages from .tex content
- Checks MongoDB package cache
- Installs packages via tlmgr
- Caches packages for reuse

#### MultiFileService
- Analyzes \include, \input, \bibliography dependencies
- Topological sorting for compilation order
- Circular dependency detection
- Missing file validation
- Dependency graph generation

#### BibliographyService
- BibTeX/Biber compilation
- 9 citation styles (plain, alpha, ieee, apa, chicago, mla, etc.)
- .bib file validation
- Citation key extraction and verification
- Duplicate key detection
- File merging

#### MathRenderingService
- KaTeX integration for fast math rendering
- Supports inline ($...$) and display ($$...$$) math
- Batch rendering with caching
- Renders to HTML, SVG, or PNG
- LaTeX environment support (\begin{equation}...\end{equation})

#### FontService
- Detects fonts: \setmainfont, \setsansfont, \setmonofont, \newfontfamily
- Validates font availability (15+ system fonts + 9+ TeX fonts)
- Font installation to project directory
- Fontspec configuration generation
- Font recommendations by document type

#### ErrorRecoveryService
- 11 error categories (syntax, packages, math mode, fonts, etc.)
- 14+ error pattern recognition
- Auto-fix detection for common issues
- Human-readable error summaries

### Infrastructure Adapters

#### XeLaTeXCompilerAdapter
- Shell execution of xelatex command
- Multi-pass execution
- BibTeX/Biber support
- Log file parsing
- Error extraction

#### NodeFileSystemAdapter
- Read/write operations
- Directory creation and deletion
- Cross-platform path handling

#### MongoDBRepositories
- Document storage
- Project management
- Template storage
- Package cache
- GridFS for PDF storage

#### KafkaMessageBrokerAdapter
- Subscribe to latex.compile.request topic
- Publish to latex.compile.response topic
- Error queue handling (DLQ)
- Message schema validation

#### WorkerThreadPool
- Isolated compilation in worker threads
- Thread lifecycle management
- Resource limits per thread
- Task queuing

## Data Flow

### Synchronous Compilation

```
HTTP Request (POST /latex/compile)
    ↓
REST Controller validates request
    ↓
CompileCommandUseCase.execute()
    ↓
Create LaTeXDocument entity
    ↓
FontService.validateFonts()
    ↓
PackageManagerService.detectAndInstall()
    ↓
WorkerThreadPool queues task
    ↓
XeLaTeXCompilerAdapter.compile()
    ↓
Multi-pass compilation (max 3 passes)
    ↓
BibliographyService.compile() if .bib exists
    ↓
Error/Warning parsing
    ↓
PDF generation to GridFS
    ↓
Return CompilationResult
    ↓
HTTP Response (200 with PDF metadata)
```

### Asynchronous Compilation (Kafka)

```
HTTP Request (POST /latex/compile-async)
    ↓
CompileCommand published to Kafka
    ↓
Topic: latex.compile.request
    ↓
KafkaMessageBrokerAdapter subscribes
    ↓
[Same compilation flow as above]
    ↓
Result published to Kafka
    ↓
Topic: latex.compile.response
    ↓
Client polls GET /latex/jobs/:id
    ↓
Return result when available
```

## Dependency Resolution

### File Dependencies
- `\include{file}`: Full recompilation
- `\input{file}`: Inline inclusion
- `\bibliography{file}`: Citation references
- `\includegraphics{path}`: Image files

### Automatic Extension Detection
- `.tex` files assumed if no extension
- `.bib` for bibliography
- Image formats: `.pdf`, `.png`, `.jpg`, `.eps`

### Topological Sort Algorithm
```
1. Collect all dependencies recursively
2. Detect circular references
3. Sort by dependency order
4. Compile root file with all includes resolved
```

## Performance Characteristics

### Compilation Performance
- Simple document: < 1 second
- Resume: < 2 seconds
- Multi-file book: < 5 seconds
- Large project: < 10 seconds

### Caching Strategy
- Package cache: MongoDB (persistent)
- Font cache: In-memory LRU (100 entries)
- Math rendering cache: LRU (1000 entries)
- File system cache: tmpfs

### Resource Limits (per job)
- CPU: 1 core (worker thread)
- Memory: 2GB
- Timeout: 60 seconds
- Queue depth: 100 concurrent jobs

## Database Schema

### Collections

#### documents
```javascript
{
  _id: ObjectId,
  userId: String,
  documentId: String,
  content: String,
  metadata: {
    documentClass: String,
    packages: [String],
    author: String,
    title: String,
    customCommands: [String]
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### projects
```javascript
{
  _id: ObjectId,
  userId: String,
  projectId: String,
  name: String,
  mainFile: String,
  files: [{
    filename: String,
    content: String,
    lastModified: Date
  }],
  dependencies: [String],
  createdAt: Date,
  updatedAt: Date
}
```

#### templates
```javascript
{
  _id: ObjectId,
  templateId: String,
  name: String,
  category: String,
  content: String,
  variables: [{
    name: String,
    description: String,
    placeholder: String
  }],
  isPublic: Boolean,
  createdBy: String,
  createdAt: Date
}
```

#### package_cache
```javascript
{
  _id: ObjectId,
  packageName: String,
  version: String,
  installedAt: Date,
  lastUsedAt: Date,
  usageCount: Number,
  size: Number
}
```

## Kafka Topics

### latex.compile.request
- **Partition**: 3
- **Replication Factor**: 2
- **Retention**: 1 day

```json
{
  "jobId": String,
  "userId": String,
  "content": String,
  "settings": Object,
  "timestamp": Date
}
```

### latex.compile.response
- **Partition**: 3
- **Replication Factor**: 2
- **Retention**: 7 days

```json
{
  "jobId": String,
  "success": Boolean,
  "result": CompilationResult,
  "timestamp": Date
}
```

### latex.compile.error (Dead Letter Queue)
- Errors after 3 retries
- Logged for debugging
- Alerted to monitoring

## Security

### Input Validation
- LaTeX content length limit: 10MB
- File count limit: 100 files per project
- Shell escape disabled by default
- Command injection prevention

### Access Control
- User ID validation on all requests
- Project ownership verification
- Template access control (public/private)
- Rate limiting per user

### Compilation Safety
- Timeout to prevent DoS
- Memory limits per job
- Worker thread isolation
- Resource quotas

## Monitoring & Observability

### Metrics
- Compilation success rate
- Average compilation time by document type
- Package cache hit rate
- Queue depth and processing time
- Resource utilization per job

### Logging
- Structured JSON logs
- Log levels: DEBUG, INFO, WARN, ERROR
- Correlation IDs for request tracing
- Compilation logs preserved in GridFS

### Health Checks
- XeLaTeX availability
- MongoDB connectivity
- Kafka broker status
- Package manager (tlmgr) status
