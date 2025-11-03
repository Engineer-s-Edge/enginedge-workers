# Resume Worker Architecture

## Overview

The Resume Worker implements Clean Architecture (Hexagonal Architecture) principles to ensure maintainability, testability, and scalability. This document describes the architectural patterns, design decisions, and component interactions for the AI-powered resume tailoring platform.

## Architecture Principles

### Clean Architecture (Hexagonal Architecture)

The application is structured around the following principles:

1. **Dependency Inversion**: Inner layers don't depend on outer layers
2. **Single Responsibility**: Each component has one reason to change
3. **Open/Closed**: Open for extension, closed for modification
4. **Interface Segregation**: Clients depend only on methods they use
5. **Dependency Injection**: Dependencies are injected rather than created

## Layer Structure

```
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│  (Controllers, Gateways, Database, Kafka, External APIs)   │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │Controllers │  │ Gateways   │  │  Adapters  │           │
│  │  (REST)    │  │(WebSocket) │  │  (Kafka)   │           │
│  └────────────┘  └────────────┘  └────────────┘           │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                  Application Layer                           │
│         (Use Cases, Services, Orchestration)                │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Experience   │  │   Resume     │  │  Evaluation  │     │
│  │Bank Service  │  │   Service    │  │   Service    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────┐
│                    Domain Layer                              │
│              (Entities, Business Logic)                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Experience   │  │    Resume    │  │ Job Posting  │     │
│  │ Bank Item    │  │    Entity    │  │    Entity    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## Domain Layer

**Location**: `src/domain/`

**Responsibilities**:
- Define core business entities
- Implement domain business rules
- Define interfaces (ports) for external dependencies
- Remain independent of external frameworks

### Entities

#### ExperienceBankItem
```typescript
interface ExperienceBankItem {
  _id: string;
  userId: string;
  bulletText: string;
  vector: number[];
  vectorModel: string;
  metadata: {
    technologies: string[];
    role: string;
    company: string;
    dateRange: string;
    metrics: string[];
    keywords: string[];
    reviewed: boolean;
    linkedExperienceId: string | null;
    category: 'work' | 'project' | 'education';
    impactScore: number;
    atsScore: number;
    lastUsedDate: Date | null;
    usageCount: number;
  };
  hash: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Resume
```typescript
interface Resume {
  _id: string;
  userId: string;
  name: string;
  latexContent: string;
  currentVersion: number;
  versions: ResumeVersion[];
  metadata: {
    targetRole: string;
    targetCompany: string;
    jobPostingId: string;
    lastEvaluationScore: number;
    lastEvaluationReport: string;
    bulletPointIds: string[];
    status: 'draft' | 'active' | 'archived';
  };
  createdAt: Date;
  updatedAt: Date;
}
```

#### JobPosting
```typescript
interface JobPosting {
  _id: string;
  userId: string;
  url: string;
  rawText: string;
  rawHtml: string;
  parsed: JobPostingParsed; // 20+ fields
  extractionMethod: 'nlp-only' | 'llm-assisted';
  confidence: number;
  createdAt: Date;
}
```

#### EvaluationReport
```typescript
interface EvaluationReport {
  _id: string;
  resumeId: string;
  userId: string;
  mode: 'standalone' | 'role-guided' | 'jd-match';
  scores: {
    overall: number;
    structure: number;
    ats: number;
    content: number;
    alignment: number;
  };
  gates: Record<string, boolean>;
  findings: Finding[];
  coverage: Coverage;
  repetition: Repetition;
  suggestedSwaps: BulletSwap[];
  createdAt: Date;
}
```

---

## Application Layer

**Location**: `src/application/`

**Responsibilities**:
- Implement use cases and business logic
- Orchestrate domain entities
- Define service interfaces
- Coordinate external integrations

### Services

#### 1. ExperienceBankService
**Purpose**: Manage bullet point library with vector search

**Key Methods**:
- `add(data)` - Add bullet with deduplication
- `search(userId, params)` - Vector + metadata search
- `list(userId, filters)` - List with filters
- `markAsReviewed(id)` - Mark as verified
- `updateUsage(id)` - Track usage

**Integrations**:
- Data Processing Worker (vector embeddings)
- MongoDB (persistence)

---

#### 2. BulletEvaluatorService
**Purpose**: Evaluate bullet point quality

**Key Methods**:
- `evaluateBullet(text, role, mode)` - Single bullet evaluation
- `evaluateBullets(texts, role)` - Batch evaluation

**Modes**:
- `nlp-only` - Rule-based via resume-nlp-service
- `llm-assisted` - Enhanced with LLM

**Integrations**:
- Resume NLP Service (Kafka)
- Assistant Worker (optional LLM)

---

#### 3. JobPostingService
**Purpose**: Extract structured data from job postings

**Key Methods**:
- `extractJobPosting(data, mode)` - Extract requirements
- `getById(id)` - Retrieve posting
- `list(userId)` - List postings

**Integrations**:
- Resume NLP Service (Kafka)
- Assistant Worker (optional LLM)

---

#### 4. ResumeEvaluatorService
**Purpose**: Comprehensive resume evaluation

**Key Methods**:
- `evaluateResume(resumeId, options)` - Full evaluation
- `getReportById(id)` - Retrieve report
- `listReports(resumeId)` - List reports

**Workflow**:
1. Compile LaTeX to PDF (latex-worker)
2. Parse PDF (resume-nlp-service)
3. Run ATS checks
4. Aggregate bullet scores
5. Check role/JD alignment
6. Detect repetition
7. Generate auto-fixes
8. Suggest bullet swaps

**Integrations**:
- LaTeX Worker (PDF generation)
- Resume NLP Service (parsing)
- Experience Bank (swap suggestions)

---

#### 5. ResumeVersioningService
**Purpose**: Git-like version control for resumes

**Key Methods**:
- `createVersion(resumeId, content)` - New version
- `rollback(resumeId, version)` - Rollback
- `getDiff(resumeId, v1, v2)` - Compare versions
- `listVersions(resumeId)` - Version history

**Features**:
- SHA-256 hash tracking
- Diff calculation
- Rollback support

---

#### 6. ResumeEditingService
**Purpose**: LaTeX editing operations

**Key Methods**:
- `applyLatexOperation(resumeId, operation)` - Apply edit
- `undo(resumeId)` - Undo last change
- `redo(resumeId)` - Redo change
- `preview(resumeId)` - Generate preview
- `suggestSwaps(resumeId, jobPostingId)` - Suggest bullets
- `applySwap(resumeId, oldId, newId)` - Apply swap

**Operations**:
- Bold, italic, underline
- Replace, insert, delete
- Undo/redo (50 levels)

---

#### 7. ResumeTailoringService
**Purpose**: Full workflow orchestration

**Key Methods**:
- `tailorResume(params)` - Start workflow
- `getJobStatus(jobId)` - Check status
- `cancelJob(jobId)` - Cancel job

**Workflow**:
1. Extract job posting
2. Evaluate current resume
3. Initiate iteration (auto/manual)
4. Track progress
5. Return tailored resume

**Integrations**:
- BullMQ (job queue)
- All other services

---

#### 8. ResumeBuilderService
**Purpose**: Build resumes from scratch

**Key Methods**:
- `startSession(userId, mode)` - Start builder
- `addExperience(sessionId, experience)` - Add experience
- `extractBulletsFromDescription(sessionId, index, text)` - Extract bullets
- `analyzeCodebase(sessionId, githubUrl)` - Analyze GitHub
- `finalizeSession(sessionId)` - Save to bank

**Modes**:
- Interview - Interactive Q&A
- Codebase - GitHub analysis
- Manual - Direct input

---

#### 9. CoverLetterService
**Purpose**: Generate tailored cover letters

**Key Methods**:
- `generateCoverLetter(userId, options)` - Generate letter
- `regenerateCoverLetter(id, options)` - Regenerate
- `editCoverLetter(id, content)` - Edit content

**Options**:
- Tone: professional, casual, enthusiastic
- Length: short, medium, long
- Specific experiences to include

---

## Infrastructure Layer

**Location**: `src/infrastructure/`

**Responsibilities**:
- Implement external interfaces
- Handle HTTP requests
- Manage WebSocket connections
- Integrate with external services

### Controllers (REST API)

#### 1. ExperienceBankController
**Endpoints**:
- `POST /experience-bank/add`
- `POST /experience-bank/search`
- `GET /experience-bank/list/:userId`
- `PATCH /experience-bank/:id/reviewed`
- `GET /experience-bank/:id`

---

#### 2. ResumeController
**Endpoints**:
- `POST /resume/create`
- `GET /resume/:id`
- `PATCH /resume/:id`
- `DELETE /resume/:id`

---

#### 3. JobPostingController
**Endpoints**:
- `POST /job-posting/extract`
- `GET /job-posting/:id`
- `GET /job-posting/list/:userId`
- `DELETE /job-posting/:id`

---

#### 4. EvaluationController
**Endpoints**:
- `POST /evaluation/evaluate`
- `GET /evaluation/report/:id`
- `GET /evaluation/reports/:resumeId`

---

#### 5. ResumeTailoringController
**Endpoints**:
- `POST /tailoring/tailor`
- `GET /tailoring/job/:jobId`
- `POST /tailoring/job/:jobId/cancel`

---

#### 6. ResumeEditingController
**Endpoints**:
- `POST /editing/:resumeId/latex`
- `POST /editing/:resumeId/undo`
- `POST /editing/:resumeId/redo`
- `POST /editing/:resumeId/preview`
- `POST /editing/:resumeId/suggest-swaps`
- `POST /editing/:resumeId/apply-swap`

---

#### 7. CoverLetterController
**Endpoints**:
- `POST /cover-letter/generate`
- `POST /cover-letter/:id/regenerate`
- `PATCH /cover-letter/:id`

---

### Gateways (WebSocket)

#### 1. ResumeIteratorGateway
**Namespace**: `/resume-iterator`

**Purpose**: Real-time resume iteration with AI agent

**Events**:
- Client → Server: `start-iteration`, `send-message`, `apply-fix`, `toggle-mode`, `stop-iteration`
- Server → Client: `iteration-started`, `agent-thinking`, `agent-message`, `evaluation-update`, `fix-suggested`, `iteration-complete`

---

#### 2. BulletReviewGateway
**Namespace**: `/bullet-review`

**Purpose**: Interactive bullet verification

**Events**:
- Client → Server: `start-review`, `respond`, `approve`, `reject`, `skip`
- Server → Client: `review-started`, `agent-question`, `bullet-approved`, `bullet-rejected`, `review-complete`

---

#### 3. ResumeBuilderGateway
**Namespace**: `/resume-builder`

**Purpose**: Interactive resume building

**Events**:
- Client → Server: `start-session`, `user-response`, `add-experience`, `add-bullet`, `analyze-codebase`, `finalize-session`
- Server → Client: `session-started`, `agent-question`, `experience-added`, `codebase-analyzed`, `session-finalized`

---

## External Integrations

### 1. Resume NLP Service (Python/FastAPI)
**Communication**: Kafka

**Topics**:
- `resume.bullet.evaluate.request/response`
- `resume.posting.extract.request/response`
- `resume.pdf.parse.request/response`

**Capabilities**:
- spaCy NER and POS tagging
- NLTK grammar checking
- PyMuPDF PDF parsing
- Rule-based evaluation

---

### 2. Assistant Worker
**Communication**: Kafka + REST

**Agents**:
- Resume Builder Agent (ReAct)
- Resume Iterator Agent (ReAct)
- Bullet Review Agent (ReAct)
- Cover Letter Generator Agent (ReAct)

---

### 3. Data Processing Worker
**Communication**: Kafka

**Capabilities**:
- Vector embedding generation (Google text-embedding-004)
- Vector search
- Batch processing

---

### 4. LaTeX Worker
**Communication**: Kafka

**Capabilities**:
- LaTeX compilation to PDF
- Preview generation
- Template management

---

### 5. Agent Tool Worker
**Communication**: Kafka

**Capabilities**:
- GitHub codebase analysis
- Company research (web scraping)
- Job posting scraping

---

## Data Flow

### Resume Tailoring Workflow

```
User → POST /tailoring/tailor
  ↓
ResumeTailoringService
  ↓
BullMQ Job Queue
  ↓
┌─────────────────────────────────────┐
│ 1. Extract Job Posting              │
│    → Resume NLP Service (Kafka)     │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 2. Evaluate Current Resume          │
│    → LaTeX Worker (PDF)             │
│    → Resume NLP Service (Parse)     │
│    → Bullet Evaluator               │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 3. Iterate (Auto/Manual)            │
│    → Assistant Worker (Agent)       │
│    → WebSocket (if manual)          │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 4. Apply Improvements               │
│    → Resume Editing Service         │
│    → Version Control                │
└─────────────────────────────────────┘
  ↓
Tailored Resume (PDF)
```

---

## Scalability Patterns

### 1. Horizontal Scaling
- Stateless services
- Multiple worker instances
- Load balancing

### 2. Asynchronous Processing
- Kafka for message passing
- BullMQ for job queues
- Non-blocking I/O

### 3. Caching
- Redis for session data
- MongoDB for persistence
- In-memory caches

### 4. Parallel Processing
- Multiple users simultaneously
- Multiple jobs per user
- Concurrent Kafka consumers

---

## Design Patterns

### 1. Hexagonal Architecture
- Clear separation of concerns
- Dependency inversion
- Testability

### 2. Repository Pattern
- Data access abstraction
- MongoDB schemas
- CRUD operations

### 3. Service Layer Pattern
- Business logic encapsulation
- Use case orchestration
- External integration

### 4. Gateway Pattern
- WebSocket abstraction
- Real-time communication
- Event-driven architecture

### 5. Queue Pattern
- BullMQ job processing
- Parallel execution
- Retry logic

---

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Framework** | NestJS 10 |
| **Language** | TypeScript 5 |
| **Database** | MongoDB 7 |
| **Messaging** | Kafka 3.7 |
| **Queue** | BullMQ + Redis |
| **WebSocket** | Socket.io |
| **NLP** | Python + spaCy + NLTK |
| **Monitoring** | Prometheus + Grafana |

---

## Best Practices

1. **Dependency Injection**: All dependencies injected via constructor
2. **Interface Segregation**: Small, focused interfaces
3. **Error Handling**: Comprehensive try-catch with logging
4. **Validation**: Input validation at controller level
5. **Testing**: Unit tests for services, E2E for controllers
6. **Documentation**: JSDoc comments for all public methods
7. **Logging**: Structured logging with context
8. **Monitoring**: Prometheus metrics for all operations

---

**Last Updated:** November 3, 2025  
**Version:** 1.0.0  
**Architecture:** Hexagonal (Clean Architecture)
