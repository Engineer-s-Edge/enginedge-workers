# Interview Worker - Architecture

## Overview

The Interview Worker is built using **Hexagonal Architecture** (Ports & Adapters) with clear separation of concerns. The system processes interviews through multiple stages: scheduling, real-time processing, AI analysis, and feedback generation.

## Architecture Principles

### Hexagonal Architecture
- **Core Business Logic**: Independent of external concerns
- **Ports**: Interfaces defining what the application needs
- **Adapters**: Implementations of ports for external systems
- **Dependency Inversion**: Core depends on abstractions, not concretions

### Key Design Patterns
- **CQRS**: Command Query Responsibility Segregation
- **Event Sourcing**: State changes as immutable events
- **Saga Pattern**: Distributed transaction management
- **Observer Pattern**: Real-time processing notifications

## System Components

### Core Domain
```
src/
├── domain/
│   ├── entities/          # Business entities
│   │   ├── interview.entity.ts
│   │   ├── candidate.entity.ts
│   │   ├── question.entity.ts
│   │   └── analysis.entity.ts
│   ├── value-objects/     # Value objects
│   │   ├── interview-id.vo.ts
│   │   ├── sentiment-score.vo.ts
│   │   └── competency-score.vo.ts
│   ├── services/          # Domain services
│   │   ├── interview.service.ts
│   │   ├── analysis.service.ts
│   │   └── scheduling.service.ts
│   └── events/            # Domain events
│       ├── interview-scheduled.event.ts
│       ├── interview-started.event.ts
│       └── analysis-completed.event.ts
```

### Application Layer
```
├── application/
│   ├── commands/          # Write operations
│   │   ├── create-interview.command.ts
│   │   ├── start-interview.command.ts
│   │   └── analyze-interview.command.ts
│   ├── queries/           # Read operations
│   │   ├── get-interview.query.ts
│   │   ├── list-interviews.query.ts
│   │   └── get-analysis.query.ts
│   ├── handlers/          # Command/Query handlers
│   │   ├── create-interview.handler.ts
│   │   ├── start-interview.handler.ts
│   │   └── analyze-interview.handler.ts
│   ├── dtos/              # Data Transfer Objects
│   │   ├── create-interview.dto.ts
│   │   ├── interview-response.dto.ts
│   │   └── analysis-result.dto.ts
│   └── events/            # Application events
```

### Infrastructure Layer
```
├── infrastructure/
│   ├── controllers/       # HTTP API controllers
│   │   ├── interview.controller.ts
│   │   ├── transcription.controller.ts
│   │   └── analysis.controller.ts
│   ├── repositories/      # Data persistence
│   │   ├── interview.repository.ts
│   │   ├── candidate.repository.ts
│   │   └── analysis.repository.ts
│   ├── services/          # External integrations
│   │   ├── transcription/
│   │   │   ├── google-speech.service.ts
│   │   │   └── azure-speech.service.ts
│   │   ├── calendar/
│   │   │   ├── google-calendar.service.ts
│   │   │   └── outlook-calendar.service.ts
│   │   └── ai/
│   │       ├── openai.service.ts
│   │       ├── anthropic.service.ts
│   │       └── huggingface.service.ts
│   ├── messaging/         # Kafka integration
│   │   ├── kafka-producer.service.ts
│   │   ├── kafka-consumer.service.ts
│   │   └── event-handlers/
│   ├── config/            # Configuration
│   │   ├── database.config.ts
│   │   ├── kafka.config.ts
│   │   └── ai.config.ts
│   └── metrics/           # Monitoring
│       ├── prometheus.service.ts
│       └── health.service.ts
```

## Data Flow

### Interview Creation Flow
```
1. HTTP Request → Controller
2. Controller → Command → Command Handler
3. Handler → Domain Service → Repository
4. Repository → MongoDB
5. Domain Event → Event Publisher
6. Event → Kafka → Other Services
```

### Real-time Processing Flow
```
1. WebSocket/Audio Stream → Transcription Service
2. Transcription Service → Speech-to-Text API
3. Transcribed Text → Analysis Service
4. Analysis Service → AI Models (Sentiment, Keywords)
5. Results → WebSocket → Client
6. Results → Repository → MongoDB
```

### Analysis Flow
```
1. Analysis Command → Handler
2. Handler → Analysis Service
3. Service → Multiple AI Providers (parallel)
4. Results Aggregation → Scoring Algorithm
5. Final Analysis → Repository
6. Notification Event → Kafka
```

## Database Schema

### Interview Collection
```javascript
{
  _id: ObjectId,
  interviewId: String,
  candidateId: String,
  jobId: String,
  status: Enum['scheduled', 'in_progress', 'completed', 'cancelled'],
  scheduledAt: Date,
  startedAt: Date,
  completedAt: Date,
  duration: Number, // minutes
  interviewers: [String],
  type: String,
  format: String,
  questions: [{
    questionId: String,
    question: String,
    category: String,
    difficulty: String,
    askedAt: Date,
    answeredAt: Date
  }],
  transcription: {
    status: String,
    segments: [{
      timestamp: String,
      speaker: String,
      text: String,
      confidence: Number
    }]
  },
  analysis: {
    status: String,
    sentiment: {
      overall: Number,
      timeline: [{
        timestamp: String,
        score: Number
      }]
    },
    keywords: [{
      word: String,
      frequency: Number,
      relevance: Number
    }],
    competency: {
      technical: Number,
      communication: Number,
      problemSolving: Number
    },
    overall: {
      score: Number,
      recommendation: String,
      strengths: [String],
      areasForImprovement: [String]
    }
  },
  metadata: {
    createdAt: Date,
    updatedAt: Date,
    createdBy: String,
    version: Number
  }
}
```

### Candidate Collection
```javascript
{
  _id: ObjectId,
  candidateId: String,
  name: String,
  email: String,
  phone: String,
  resume: {
    url: String,
    parsed: Boolean,
    skills: [String],
    experience: Number
  },
  interviews: [String], // interview IDs
  metadata: {
    createdAt: Date,
    updatedAt: Date
  }
}
```

## External Integrations

### AI Services
- **OpenAI GPT-4**: Advanced analysis and feedback generation
- **Anthropic Claude**: Ethical AI analysis and recommendations
- **Hugging Face**: Specialized NLP models for sentiment and competency analysis

### Speech Services
- **Google Speech-to-Text**: High accuracy transcription
- **Azure Speech Services**: Real-time processing capabilities
- **AWS Transcribe**: Cost-effective batch processing

### Calendar Services
- **Google Calendar API**: Primary calendar integration
- **Microsoft Graph API**: Outlook calendar support
- **Zoom API**: Meeting creation and management

### Communication
- **SendGrid**: Email notifications
- **Twilio**: SMS notifications
- **WebRTC**: Real-time video/audio streaming

## Performance Considerations

### Scalability
- **Horizontal Scaling**: Stateless application layer
- **Database Sharding**: Interview data partitioned by date
- **Caching Strategy**: Redis for frequently accessed data
- **CDN Integration**: Static assets and recordings

### Reliability
- **Circuit Breaker**: External service failure protection
- **Retry Logic**: Transient failure handling
- **Dead Letter Queue**: Failed message processing
- **Backup Strategy**: Point-in-time recovery

### Monitoring
- **Application Metrics**: Response times, error rates, throughput
- **Business Metrics**: Interview completion rates, analysis accuracy
- **Infrastructure Metrics**: CPU, memory, disk usage
- **External Service Metrics**: API response times and success rates

## Security Considerations

### Data Protection
- **Encryption at Rest**: MongoDB field-level encryption
- **Encryption in Transit**: TLS 1.3 for all communications
- **PII Handling**: Tokenization of sensitive candidate data

### Access Control
- **Role-Based Access**: Interviewer, HR, Admin roles
- **API Authentication**: JWT with refresh token rotation
- **Audit Logging**: All data access and modifications logged

### Compliance
- **GDPR**: Right to erasure, data portability
- **CCPA**: Privacy rights and data deletion
- **Industry Standards**: SOC 2, ISO 27001 compliance