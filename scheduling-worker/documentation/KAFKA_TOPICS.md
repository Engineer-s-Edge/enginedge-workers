# Scheduling Worker - Kafka Topics

## Overview

The Scheduling Worker uses Apache Kafka for asynchronous processing of scheduling operations, event synchronization, and inter-service communication.

## Topic Architecture

### Command Topics

#### `scheduling.commands`
**Purpose**: Incoming command processing for scheduling operations
**Producer**: Main API, Frontend
**Consumer**: Scheduling Worker
**Message Format**:
```json
{
  "taskId": "string",
  "taskType": "SCHEDULE_HABITS | SYNC_CALENDAR | OPTIMIZE_SCHEDULE",
  "payload": {
    "userId": "string",
    "data": "object"
  },
  "timestamp": "2025-10-27T10:00:00Z",
  "priority": "HIGH | NORMAL | LOW"
}
```

#### `scheduling.commands.dead-letter`
**Purpose**: Failed command processing (dead letter queue)
**Producer**: Scheduling Worker
**Consumer**: Monitoring/Alerting
**Retention**: 7 days

### Event Topics

#### `scheduling.events.calendar`
**Purpose**: Calendar event changes and synchronization
**Producer**: Scheduling Worker, Google Calendar Webhooks
**Consumer**: Main API, Other Workers
**Message Format**:
```json
{
  "eventId": "string",
  "eventType": "CREATED | UPDATED | DELETED",
  "calendarId": "string",
  "userId": "string",
  "eventData": {
    "summary": "string",
    "start": {
      "dateTime": "2025-10-27T10:00:00Z"
    },
    "end": {
      "dateTime": "2025-10-27T11:00:00Z"
    },
    "attendees": ["string"],
    "location": "string"
  },
  "source": "GOOGLE_CALENDAR | API | WORKER",
  "timestamp": "2025-10-27T10:00:00Z"
}
```

#### `scheduling.events.goals`
**Purpose**: Goal creation, updates, and progress tracking
**Producer**: Scheduling Worker
**Consumer**: Main API, Analytics
**Message Format**:
```json
{
  "goalId": "string",
  "eventType": "CREATED | UPDATED | COMPLETED | DELETED",
  "userId": "string",
  "goalData": {
    "title": "string",
    "type": "PROJECT | PERSONAL | HEALTH",
    "targetDate": "2025-12-31T23:59:59Z",
    "progress": {
      "current": 75,
      "target": 100,
      "unit": "percentage"
    }
  },
  "timestamp": "2025-10-27T10:00:00Z"
}
```

#### `scheduling.events.habits`
**Purpose**: Habit tracking and completion events
**Producer**: Scheduling Worker
**Consumer**: Main API, Notification Service
**Message Format**:
```json
{
  "habitId": "string",
  "eventType": "CREATED | COMPLETED | STREAK_UPDATED | REMINDER_SENT",
  "userId": "string",
  "habitData": {
    "name": "string",
    "frequency": "DAILY | WEEKLY",
    "streak": {
      "current": 12,
      "longest": 28
    }
  },
  "timestamp": "2025-10-27T10:00:00Z"
}
```

### Notification Topics

#### `scheduling.notifications.reminders`
**Purpose**: Reminder and notification messages
**Producer**: Scheduling Worker
**Consumer**: Notification Worker
**Message Format**:
```json
{
  "notificationId": "string",
  "userId": "string",
  "type": "HABIT_REMINDER | GOAL_DEADLINE | MEETING_REMINDER",
  "channel": "EMAIL | PUSH | SMS",
  "priority": "HIGH | NORMAL | LOW",
  "content": {
    "title": "string",
    "message": "string",
    "actionUrl": "string"
  },
  "scheduledFor": "2025-10-27T09:00:00Z",
  "timestamp": "2025-10-27T08:30:00Z"
}
```

#### `scheduling.notifications.calendar-updates`
**Purpose**: Calendar synchronization notifications
**Producer**: Scheduling Worker
**Consumer**: User Notification Service
**Message Format**:
```json
{
  "userId": "string",
  "updateType": "SYNC_COMPLETED | SYNC_FAILED | CONFLICT_RESOLVED",
  "details": {
    "eventsProcessed": 25,
    "conflictsResolved": 2,
    "errors": ["string"]
  },
  "timestamp": "2025-10-27T10:00:00Z"
}
```

### Analytics Topics

#### `scheduling.analytics.usage`
**Purpose**: Usage analytics and metrics
**Producer**: Scheduling Worker
**Consumer**: Analytics Service
**Message Format**:
```json
{
  "userId": "string",
  "eventType": "CALENDAR_VIEWED | GOAL_CREATED | HABIT_COMPLETED",
  "metadata": {
    "sessionId": "string",
    "userAgent": "string",
    "ipAddress": "string"
  },
  "timestamp": "2025-10-27T10:00:00Z"
}
```

#### `scheduling.analytics.performance`
**Purpose**: Performance metrics and system health
**Producer**: Scheduling Worker
**Consumer**: Monitoring Service
**Message Format**:
```json
{
  "metricType": "API_LATENCY | DB_QUERY_TIME | EXTERNAL_API_CALL",
  "value": 150.5,
  "unit": "milliseconds",
  "labels": {
    "endpoint": "/api/calendars",
    "method": "GET",
    "statusCode": 200
  },
  "timestamp": "2025-10-27T10:00:00Z"
}
```

## Topic Configuration

### Partitioning Strategy

| Topic | Partitions | Key Strategy |
|-------|------------|--------------|
| `scheduling.commands` | 6 | `userId` (consistent user routing) |
| `scheduling.events.calendar` | 12 | `userId` (user-scoped events) |
| `scheduling.events.goals` | 6 | `userId` (user-scoped goals) |
| `scheduling.events.habits` | 6 | `userId` (user-scoped habits) |
| `scheduling.notifications.reminders` | 8 | `userId` (user notifications) |
| `scheduling.analytics.usage` | 4 | `userId` (analytics aggregation) |

### Retention Policies

| Topic | Retention | Reason |
|-------|-----------|--------|
| Command topics | 7 days | Processing history |
| Event topics | 30 days | Audit trail |
| Notification topics | 14 days | Notification history |
| Analytics topics | 90 days | Trend analysis |

### Consumer Groups

#### `scheduling-worker-primary`
- Consumes: `scheduling.commands`
- Purpose: Main command processing
- Instances: 3 (scaled based on load)

#### `scheduling-event-listeners`
- Consumes: All `scheduling.events.*` topics
- Purpose: Event-driven updates
- Instances: 2 (for redundancy)

#### `scheduling-notifications`
- Consumes: `scheduling.notifications.*`
- Purpose: Notification delivery
- Instances: 2 (for high availability)

#### `scheduling-analytics`
- Consumes: `scheduling.analytics.*`
- Purpose: Metrics collection
- Instances: 1 (centralized processing)

## Message Processing Patterns

### Command Processing Flow

```
1. Command received on scheduling.commands
2. Worker validates and processes command
3. Success: Publish result to appropriate event topic
4. Failure: Publish to dead-letter queue
5. Send acknowledgment to producer
```

### Event Sourcing

```
1. State change occurs in worker
2. Event published to appropriate topic
3. Event consumed by interested services
4. Services update their local state
5. Audit trail maintained in topic
```

### Saga Pattern for Complex Operations

```
Calendar Sync Saga:
1. Start sync → scheduling.commands
2. Fetch Google Calendar → External API
3. Process events → Internal processing
4. Update local state → Database
5. Publish sync result → scheduling.events.calendar
6. Send notifications → scheduling.notifications.calendar-updates
```

## Error Handling

### Dead Letter Queues

- `scheduling.commands.dead-letter`: Failed command processing
- `scheduling.events.dead-letter`: Failed event processing
- `scheduling.notifications.dead-letter`: Failed notification delivery

### Retry Policies

```typescript
{
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelay: 1000, // ms
  maxDelay: 30000     // ms
}
```

### Circuit Breaker

```typescript
{
  failureThreshold: 5,
  recoveryTimeout: 60000, // ms
  monitoringPeriod: 10000 // ms
}
```

## Monitoring

### Key Metrics

- **Throughput**: Messages processed per second
- **Latency**: End-to-end message processing time
- **Error Rate**: Failed message processing percentage
- **Consumer Lag**: How far behind consumers are
- **Partition Balance**: Message distribution across partitions

### Alerts

- Consumer lag > 10000 messages
- Error rate > 5%
- Message processing latency > 30 seconds
- Dead letter queue growing rapidly

## Configuration

### Producer Configuration

```typescript
{
  'bootstrap.servers': 'localhost:9092',
  'acks': 'all',
  'retries': 3,
  'batch.size': 16384,
  'linger.ms': 5,
  'compression.type': 'snappy'
}
```

### Consumer Configuration

```typescript
{
  'bootstrap.servers': 'localhost:9092',
  'group.id': 'scheduling-worker-primary',
  'auto.offset.reset': 'earliest',
  'enable.auto.commit': false,
  'max.poll.records': 100,
  'session.timeout.ms': 30000
}
```

## Best Practices

### Message Design

1. **Immutable Messages**: Never modify message content
2. **Versioning**: Include version field for schema evolution
3. **Idempotency**: Design for safe message replay
4. **Size Limits**: Keep messages under 1MB
5. **Clear Naming**: Use descriptive topic and field names

### Operational Excellence

1. **Monitoring**: Track all message flows
2. **Alerting**: Set up alerts for failures
3. **Testing**: Test message processing thoroughly
4. **Documentation**: Keep message schemas documented
5. **Security**: Encrypt sensitive message data

### Performance Optimization

1. **Batch Processing**: Process messages in batches
2. **Async Processing**: Don't block on slow operations
3. **Connection Pooling**: Reuse Kafka connections
4. **Message Compression**: Use compression for large messages
5. **Partitioning**: Distribute load across partitions