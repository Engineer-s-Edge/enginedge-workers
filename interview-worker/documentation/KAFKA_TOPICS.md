# Interview Worker - Kafka Topics

## Overview

The Interview Worker uses Apache Kafka for event-driven communication with other services in the EnginEdge platform. This document defines all Kafka topics used by the Interview Worker.

## Topic Naming Convention

```
enginedge.interview.{entity}.{action}
```

Where:
- `entity`: interview, candidate, analysis, transcription, scheduling
- `action`: created, updated, completed, failed, etc.

## Topics

### Interview Events

#### `enginedge.interview.interview.created`
**Purpose:** Notify when a new interview is scheduled
**Producer:** Interview Worker
**Consumers:** Calendar Service, Notification Service, Analytics

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "interview.created",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "interviewId": "string",
    "candidateId": "string",
    "jobId": "string",
    "scheduledAt": "2024-01-01T00:00:00Z",
    "duration": 60,
    "interviewers": ["string"],
    "type": "technical|behavioral|system",
    "format": "video|audio|text",
    "meetingUrl": "string"
  }
}
```

#### `enginedge.interview.interview.updated`
**Purpose:** Notify when interview details are modified
**Producer:** Interview Worker
**Consumers:** Calendar Service, Notification Service

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "interview.updated",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "interviewId": "string",
    "changes": {
      "scheduledAt": {
        "old": "2024-01-01T00:00:00Z",
        "new": "2024-01-02T00:00:00Z"
      }
    }
  }
}
```

#### `enginedge.interview.interview.started`
**Purpose:** Notify when interview begins
**Producer:** Interview Worker
**Consumers:** Analytics, Monitoring, Real-time Services

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "interview.started",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "interviewId": "string",
    "candidateId": "string",
    "actualStartTime": "2024-01-01T00:00:00Z",
    "participants": ["string"]
  }
}
```

#### `enginedge.interview.interview.completed`
**Purpose:** Notify when interview ends
**Producer:** Interview Worker
**Consumers:** Analysis Service, Notification Service, Analytics

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "interview.completed",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "interviewId": "string",
    "duration": 3600,
    "completionReason": "normal|cancelled|timeout",
    "recordingUrl": "string"
  }
}
```

#### `enginedge.interview.interview.cancelled`
**Purpose:** Notify when interview is cancelled
**Producer:** Interview Worker
**Consumers:** Calendar Service, Notification Service

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "interview.cancelled",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "interviewId": "string",
    "cancelledBy": "string",
    "reason": "candidate_no_show|interviewer_unavailable|technical_issues",
    "cancellationTime": "2024-01-01T00:00:00Z"
  }
}
```

### Transcription Events

#### `enginedge.interview.transcription.started`
**Purpose:** Notify when transcription begins
**Producer:** Interview Worker
**Consumers:** Monitoring, Analytics

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "transcription.started",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "interviewId": "string",
    "transcriptionId": "string",
    "audioFormat": "wav|mp3|webm",
    "audioDuration": 3600,
    "provider": "google|azure|aws"
  }
}
```

#### `enginedge.interview.transcription.progress`
**Purpose:** Real-time transcription progress updates
**Producer:** Interview Worker
**Consumers:** Real-time UI, Monitoring

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "transcription.progress",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "interviewId": "string",
    "transcriptionId": "string",
    "progress": 0.75,
    "currentTime": 2700,
    "segmentsProcessed": 45
  }
}
```

#### `enginedge.interview.transcription.completed`
**Purpose:** Notify when transcription finishes
**Producer:** Interview Worker
**Consumers:** Analysis Service, Storage Service

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "transcription.completed",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "interviewId": "string",
    "transcriptionId": "string",
    "status": "success|partial_failure|complete_failure",
    "confidence": 0.92,
    "duration": 3600,
    "wordCount": 8500,
    "language": "en-US",
    "transcriptUrl": "string"
  }
}
```

#### `enginedge.interview.transcription.failed`
**Purpose:** Notify when transcription fails
**Producer:** Interview Worker
**Consumers:** Error Handling, Notification Service

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "transcription.failed",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "interviewId": "string",
    "transcriptionId": "string",
    "error": {
      "code": "PROVIDER_UNAVAILABLE|QUOTA_EXCEEDED|INVALID_AUDIO",
      "message": "string",
      "details": {}
    },
    "retryCount": 3
  }
}
```

### Analysis Events

#### `enginedge.interview.analysis.started`
**Purpose:** Notify when analysis begins
**Producer:** Interview Worker
**Consumers:** Monitoring, Analytics

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "analysis.started",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "interviewId": "string",
    "analysisId": "string",
    "analysisTypes": ["sentiment", "keywords", "competency", "overall"],
    "provider": "openai|anthropic|huggingface"
  }
}
```

#### `enginedge.interview.analysis.progress`
**Purpose:** Analysis progress updates
**Producer:** Interview Worker
**Consumers:** Real-time UI, Monitoring

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "analysis.progress",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "interviewId": "string",
    "analysisId": "string",
    "stage": "sentiment_analysis|keyword_extraction|competency_scoring",
    "progress": 0.6,
    "estimatedTimeRemaining": 45
  }
}
```

#### `enginedge.interview.analysis.completed`
**Purpose:** Notify when analysis finishes
**Producer:** Interview Worker
**Consumers:** Notification Service, HR System, Analytics

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "analysis.completed",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "interviewId": "string",
    "analysisId": "string",
    "status": "success|partial_success|failed",
    "results": {
      "sentiment": {
        "overall": 0.75,
        "timeline": [...]
      },
      "keywords": [...],
      "competency": {
        "technical": 8.5,
        "communication": 7.2
      },
      "overall": {
        "score": 8.2,
        "recommendation": "Strong candidate",
        "strengths": [...],
        "areasForImprovement": [...]
      }
    },
    "processingTime": 25,
    "confidence": 0.88
  }
}
```

#### `enginedge.interview.analysis.failed`
**Purpose:** Notify when analysis fails
**Producer:** Interview Worker
**Consumers:** Error Handling, Notification Service

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "analysis.failed",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "interviewId": "string",
    "analysisId": "string",
    "error": {
      "code": "AI_SERVICE_UNAVAILABLE|INVALID_INPUT|PROCESSING_TIMEOUT",
      "message": "string",
      "details": {}
    },
    "retryCount": 2,
    "partialResults": {}
  }
}
```

### Scheduling Events

#### `enginedge.interview.scheduling.requested`
**Purpose:** Request calendar availability check
**Producer:** Interview Worker
**Consumers:** Calendar Service

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "scheduling.requested",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "requestId": "string",
    "candidateId": "string",
    "interviewers": ["string"],
    "duration": 60,
    "preferredTimes": [
      {
        "start": "2024-01-15T09:00:00Z",
        "end": "2024-01-15T17:00:00Z"
      }
    ],
    "timezone": "America/New_York"
  }
}
```

#### `enginedge.interview.scheduling.availability`
**Purpose:** Return calendar availability
**Producer:** Calendar Service
**Consumers:** Interview Worker

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "scheduling.availability",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "requestId": "string",
    "availability": [
      {
        "start": "2024-01-15T10:00:00Z",
        "end": "2024-01-15T11:00:00Z",
        "available": true
      }
    ],
    "conflicts": [
      {
        "start": "2024-01-15T14:00:00Z",
        "end": "2024-01-15T15:00:00Z",
        "reason": "Existing meeting"
      }
    ]
  }
}
```

#### `enginedge.interview.scheduling.confirmed`
**Purpose:** Confirm interview scheduling
**Producer:** Interview Worker
**Consumers:** Calendar Service, Notification Service

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "scheduling.confirmed",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "interviewId": "string",
    "scheduledAt": "2024-01-15T10:00:00Z",
    "meetingDetails": {
      "title": "Technical Interview - John Doe",
      "location": "Zoom",
      "attendees": ["john@example.com", "interviewer@company.com"],
      "description": "Technical interview for Senior Developer position"
    }
  }
}
```

### Error Events

#### `enginedge.interview.error.occurred`
**Purpose:** Generic error notifications
**Producer:** Interview Worker
**Consumers:** Monitoring, Error Handling

**Message Schema:**
```json
{
  "eventId": "string",
  "eventType": "error.occurred",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "errorId": "string",
    "component": "transcription|analysis|scheduling|database",
    "severity": "low|medium|high|critical",
    "error": {
      "code": "string",
      "message": "string",
      "stack": "string",
      "context": {}
    },
    "affectedEntities": {
      "interviewId": "string",
      "candidateId": "string"
    }
  }
}
```

## Topic Configuration

### Partitioning Strategy

#### Interview Topics
- **Partitions:** 12 (based on interviewId hash)
- **Replication Factor:** 3
- **Retention:** 90 days

#### Transcription Topics
- **Partitions:** 8 (based on interviewId hash)
- **Replication Factor:** 3
- **Retention:** 365 days

#### Analysis Topics
- **Partitions:** 6 (based on interviewId hash)
- **Replication Factor:** 3
- **Retention:** 365 days

#### Scheduling Topics
- **Partitions:** 4 (based on candidateId hash)
- **Replication Factor:** 3
- **Retention:** 30 days

### Consumer Groups

#### `interview-worker-main`
- Consumes: scheduling.availability, analysis.completed
- Purpose: Main application logic

#### `interview-analytics`
- Consumes: All interview events
- Purpose: Analytics and reporting

#### `interview-monitoring`
- Consumes: All events
- Purpose: Monitoring and alerting

#### `interview-notification`
- Consumes: interview.created, interview.completed, analysis.completed
- Purpose: User notifications

## Message Processing

### Idempotency
All messages include unique `eventId` for idempotent processing.

### Ordering Guarantees
- Interview events maintain order within interviewId partition
- Transcription events maintain order within transcriptionId partition
- Analysis events maintain order within analysisId partition

### Dead Letter Queue
Failed messages are sent to:
- `enginedge.interview.dlq` for manual inspection and reprocessing

## Monitoring

### Key Metrics
```
kafka_consumer_lag{topic="enginedge.interview.*"} < 1000
kafka_producer_requests_total{topic="enginedge.interview.*", status="success"} / kafka_producer_requests_total{topic="enginedge.interview.*"} > 0.99
kafka_topic_partitions_current_offset{topic="enginedge.interview.*"} - kafka_consumer_current_offset{topic="enginedge.interview.*", group="interview-worker-main"} < 10000
```

### Alerting Rules
- Consumer lag > 5000 messages
- Producer error rate > 1%
- Topic partition imbalance
- Message processing failures

## Schema Evolution

### Versioning
Message schemas follow semantic versioning:
- **Major:** Breaking changes
- **Minor:** New optional fields
- **Patch:** Bug fixes, documentation

### Compatibility
- Backward compatible: New fields are optional
- Forward compatible: Consumers ignore unknown fields
- Schema registry enforces compatibility rules

## Security

### Authentication
- SASL/SCRAM authentication for all producers/consumers
- TLS encryption for data in transit

### Authorization
- ACLs restrict topic access by service
- Service accounts with minimal required permissions

### Encryption
- Data encrypted at rest in Kafka
- Sensitive fields encrypted in messages