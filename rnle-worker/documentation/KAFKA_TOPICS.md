# RNLE Worker Kafka Topics

## Overview

The RNLE Worker uses Apache Kafka for event-driven communication, asynchronous processing, and reliable message delivery. This document describes the Kafka topics, message schemas, and integration patterns used by the service.

## Architecture

### Message Flow

```
Command Request → REST API → Processing → Kafka Topics → Consumers
                      ↓
               Database Storage
                      ↓
               Result Publishing
```

### Topic Categories

1. **Command Topics**: Handle incoming command requests
2. **Result Topics**: Publish command processing outcomes
3. **Event Topics**: Broadcast system events and notifications
4. **Control Topics**: Manage worker coordination and health

## Topic Specifications

### 1. Command Topics

#### `rnle.commands`

**Purpose:** Accepts command processing requests from external services

**Partitioning Strategy:**
- Partitioned by `taskType` for load balancing
- 6 partitions for parallel processing
- Key: `taskId` (string)

**Message Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "taskId": {
      "type": "string",
      "description": "Unique identifier for the command task",
      "pattern": "^[a-zA-Z0-9_-]+$"
    },
    "taskType": {
      "type": "string",
      "enum": ["EXECUTE_ASSISTANT", "SCHEDULE_HABITS"],
      "description": "Type of command to execute"
    },
    "payload": {
      "type": "object",
      "description": "Command-specific payload data",
      "properties": {
        "assistantId": {
          "type": "string",
          "description": "Assistant identifier for EXECUTE_ASSISTANT tasks"
        },
        "userId": {
          "type": "string",
          "description": "User identifier"
        },
        "input": {
          "type": "string",
          "description": "Input data for processing"
        },
        "metadata": {
          "type": "object",
          "description": "Additional metadata"
        }
      }
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "Command creation timestamp"
    },
    "correlationId": {
      "type": "string",
      "description": "Correlation ID for request tracing"
    }
  },
  "required": ["taskId", "taskType", "timestamp"]
}
```

**Example Message:**

```json
{
  "taskId": "assist-001",
  "taskType": "EXECUTE_ASSISTANT",
  "payload": {
    "assistantId": "asst_123",
    "userId": "user_456",
    "input": "Analyze this resume for software engineering roles",
    "metadata": {
      "priority": "high",
      "timeout": 300
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "correlationId": "req-abc-123"
}
```

**Consumer Configuration:**

```typescript
const consumer = kafka.consumer({
  groupId: 'rnle-worker-commands',
  topics: ['rnle.commands'],
  fromBeginning: false,
  autoCommit: true,
  autoCommitInterval: 5000,
  sessionTimeout: 30000,
});

consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const command = JSON.parse(message.value.toString());
    await this.processCommand(command);
  },
});
```

### 2. Result Topics

#### `rnle.command-results`

**Purpose:** Publishes command processing outcomes and results

**Partitioning Strategy:**
- Partitioned by `taskId` hash for consistent routing
- 6 partitions matching command topics
- Key: `taskId` (string)

**Message Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "taskId": {
      "type": "string",
      "description": "Original command task identifier"
    },
    "status": {
      "type": "string",
      "enum": ["SUCCESS", "FAILURE", "PARTIAL_SUCCESS"],
      "description": "Processing outcome status"
    },
    "result": {
      "type": "object",
      "description": "Processing result data",
      "properties": {
        "output": {
          "type": "string",
          "description": "Processed output data"
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Confidence score for AI-generated results"
        },
        "metadata": {
          "type": "object",
          "description": "Result metadata"
        }
      }
    },
    "error": {
      "type": "object",
      "description": "Error details if status is FAILURE",
      "properties": {
        "code": {
          "type": "string",
          "description": "Error code"
        },
        "message": {
          "type": "string",
          "description": "Human-readable error message"
        },
        "details": {
          "type": "object",
          "description": "Additional error context"
        }
      }
    },
    "processingTime": {
      "type": "number",
      "description": "Processing time in milliseconds"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "Result publication timestamp"
    },
    "correlationId": {
      "type": "string",
      "description": "Correlation ID from original command"
    }
  },
  "required": ["taskId", "status", "timestamp"]
}
```

**Example Messages:**

**Success Result:**
```json
{
  "taskId": "assist-001",
  "status": "SUCCESS",
  "result": {
    "output": "Resume analysis completed successfully",
    "confidence": 0.92,
    "metadata": {
      "wordCount": 450,
      "processingSteps": ["parsing", "analysis", "scoring"]
    }
  },
  "processingTime": 1250,
  "timestamp": "2024-01-15T10:31:15.000Z",
  "correlationId": "req-abc-123"
}
```

**Failure Result:**
```json
{
  "taskId": "assist-001",
  "status": "FAILURE",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input format",
    "details": {
      "field": "input",
      "reason": "File format not supported"
    }
  },
  "processingTime": 150,
  "timestamp": "2024-01-15T10:30:15.000Z",
  "correlationId": "req-abc-123"
}
```

### 3. Event Topics

#### `rnle.worker-events`

**Purpose:** Broadcasts worker lifecycle events and system notifications

**Partitioning Strategy:**
- Single partition for ordered event processing
- Key: `eventType` (string)

**Message Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "eventId": {
      "type": "string",
      "description": "Unique event identifier"
    },
    "eventType": {
      "type": "string",
      "enum": [
        "WORKER_STARTED",
        "WORKER_STOPPED",
        "COMMAND_RECEIVED",
        "COMMAND_COMPLETED",
        "COMMAND_FAILED",
        "HEALTH_CHECK_FAILED",
        "RESOURCE_WARNING"
      ],
      "description": "Type of worker event"
    },
    "workerId": {
      "type": "string",
      "description": "Worker instance identifier"
    },
    "data": {
      "type": "object",
      "description": "Event-specific data"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "Event timestamp"
    },
    "correlationId": {
      "type": "string",
      "description": "Related correlation ID"
    }
  },
  "required": ["eventId", "eventType", "workerId", "timestamp"]
}
```

**Example Events:**

```json
{
  "eventId": "evt-001",
  "eventType": "WORKER_STARTED",
  "workerId": "worker-pod-abc-123",
  "data": {
    "version": "1.0.0",
    "startTime": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}

{
  "eventId": "evt-002",
  "eventType": "COMMAND_COMPLETED",
  "workerId": "worker-pod-abc-123",
  "data": {
    "taskId": "assist-001",
    "processingTime": 1250,
    "status": "SUCCESS"
  },
  "timestamp": "2024-01-15T10:31:15.000Z",
  "correlationId": "req-abc-123"
}
```

### 4. Control Topics

#### `rnle.worker-control`

**Purpose:** Handles worker coordination and administrative commands

**Partitioning Strategy:**
- Single partition for sequential processing
- Key: `controlType` (string)

**Message Schema:**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "controlId": {
      "type": "string",
      "description": "Unique control command identifier"
    },
    "controlType": {
      "type": "string",
      "enum": [
        "RESTART_WORKER",
        "UPDATE_CONFIG",
        "PAUSE_PROCESSING",
        "RESUME_PROCESSING",
        "HEALTH_CHECK"
      ],
      "description": "Type of control command"
    },
    "targetWorkers": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Target worker IDs (empty for all workers)"
    },
    "parameters": {
      "type": "object",
      "description": "Control command parameters"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "Command timestamp"
    },
    "issuedBy": {
      "type": "string",
      "description": "Issuer of the control command"
    }
  },
  "required": ["controlId", "controlType", "timestamp"]
}
```

## Consumer Groups

### Command Processing Group

```yaml
groupId: rnle-worker-commands
topics:
  - rnle.commands
replicas: 3
autoCommit: true
autoCommitInterval: 5000
sessionTimeout: 30000
maxPollRecords: 100
```

### Event Processing Group

```yaml
groupId: rnle-worker-events
topics:
  - rnle.worker-events
replicas: 1
autoCommit: true
autoCommitInterval: 10000
sessionTimeout: 60000
```

### Control Group

```yaml
groupId: rnle-worker-control
topics:
  - rnle.worker-control
replicas: 1
autoCommit: true
autoCommitInterval: 1000
sessionTimeout: 30000
```

## Producer Configuration

### High-Throughput Producer

```typescript
const producer = kafka.producer({
  allowAutoTopicCreation: false,
  batch: {
    size: 1048576,    // 1MB batch size
    lingerMs: 5,      // 5ms linger time
  },
  compression: CompressionTypes.GZIP,
  retries: 10,
  retry: {
    initialRetryTime: 100,
    maxRetryTime: 30000,
  },
});
```

### Reliable Producer

```typescript
const reliableProducer = kafka.producer({
  idempotent: true,   // Exactly-once delivery
  transactionalId: 'rnle-worker-producer',
  maxInFlightRequests: 1,
  retries: 0,         // Let transaction handle retries
});
```

## Monitoring & Observability

### Key Metrics

```prometheus
# Producer metrics
kafka_producer_requests_total{topic="rnle.command-results"}
kafka_producer_errors_total{topic="rnle.command-results"}

# Consumer metrics
kafka_consumer_group_lag{group="rnle-worker-commands", topic="rnle.commands"}
kafka_consumer_messages_consumed_total{group="rnle-worker-commands"}

# Topic metrics
kafka_topic_partitions{topic="rnle.commands"}
kafka_topic_partition_current_offset{topic="rnle.commands"}
```

### Alert Rules

```yaml
groups:
  - name: kafka-rnle-worker
    rules:
      - alert: KafkaConsumerLagHigh
        expr: kafka_consumer_group_lag{group="rnle-worker-commands"} > 1000
        for: 5m
        labels:
          severity: warning

      - alert: KafkaProducerErrors
        expr: rate(kafka_producer_errors_total{topic=~"rnle\\..*"}[5m]) > 0
        for: 5m
        labels:
          severity: critical

      - alert: KafkaTopicUnavailable
        expr: up{job="kafka"} == 0
        for: 5m
        labels:
          severity: critical
```

## Error Handling

### Retry Policies

```typescript
const retryConfig = {
  retries: 3,
  initialRetryTime: 100,
  maxRetryTime: 10000,
  retry: (error: Error) => {
    // Retry on transient errors only
    return error.message.includes('timeout') ||
           error.message.includes('connection');
  }
};
```

### Dead Letter Topics

#### `rnle.commands.dlq`

**Purpose:** Stores messages that failed processing after all retries

**Schema:** Same as `rnle.commands` with additional error metadata

```json
{
  "originalMessage": { /* original command */ },
  "error": {
    "message": "Processing failed after 3 retries",
    "code": "MAX_RETRIES_EXCEEDED",
    "timestamp": "2024-01-15T10:35:00.000Z"
  },
  "retryCount": 3
}
```

## Security

### Authentication

- SASL/SCRAM authentication for broker connections
- SSL/TLS encryption for data in transit
- ACLs for topic access control

### Authorization

```yaml
# Topic ACLs
- resourceType: TOPIC
  resourceName: rnle.commands
  resourcePatternType: LITERAL
  principal: User:rnle-worker
  host: *
  operation: READ
  permissionType: ALLOW

- resourceType: TOPIC
  resourceName: rnle.command-results
  resourcePatternType: LITERAL
  principal: User:rnle-worker
  host: *
  operation: WRITE
  permissionType: ALLOW
```

## Performance Tuning

### Topic Configuration

```yaml
# Topic settings for high throughput
configs:
  retention.ms: 604800000        # 7 days retention
  segment.bytes: 1073741824      # 1GB segment size
  max.message.bytes: 1048576     # 1MB max message size
  compression.type: gzip
  cleanup.policy: delete
```

### Consumer Tuning

```typescript
const tunedConsumer = kafka.consumer({
  groupId: 'rnle-worker-commands',
  fetchMinBytes: 1024,           // Wait for 1KB before fetching
  fetchMaxBytes: 5242880,        // Max 5MB per fetch
  fetchMaxWaitMs: 500,           // Wait up to 500ms
  maxPollRecords: 100,           // Process 100 records at once
  autoCommitInterval: 5000,      // Commit every 5 seconds
});
```

## Disaster Recovery

### Backup Strategy

- Topic data backed up via Kafka MirrorMaker
- Consumer offsets stored in external storage
- Schema registry backups for message schemas

### Failover Procedures

1. **Broker Failure:**
   - Automatic failover via Kafka cluster
   - Consumer rebalancing within 30 seconds
   - No data loss for acknowledged messages

2. **Worker Failure:**
   - Consumer group rebalancing
   - In-flight messages processed by other workers
   - Dead letter queue for failed messages

3. **Network Partition:**
   - Messages buffered until connection restored
   - Automatic retry with exponential backoff
   - Circuit breaker pattern for persistent failures

## Schema Evolution

### Versioning Strategy

- Schema versioning via Avro or JSON Schema
- Backward compatibility for consumer updates
- Schema registry for centralized schema management

### Migration Process

1. Deploy new schema to registry
2. Update producers with new schema
3. Deploy consumers that can handle both schemas
4. Remove old schema support after successful migration

## Testing

### Integration Tests

```typescript
describe('Kafka Integration', () => {
  it('should process command via Kafka', async () => {
    // Produce command to rnle.commands
    await producer.send({
      topic: 'rnle.commands',
      messages: [{ value: JSON.stringify(testCommand) }],
    });

    // Wait for result on rnle.command-results
    const result = await waitForMessage('rnle.command-results');
    expect(result.status).toBe('SUCCESS');
  });
});
```

### Load Testing

```bash
# Produce high volume of test messages
kafka-producer-perf-test \
  --topic rnle.commands \
  --num-records 100000 \
  --record-size 1024 \
  --throughput 1000 \
  --producer-props bootstrap.servers=kafka:9092
```

This comprehensive Kafka integration ensures reliable, scalable, and observable message processing for the RNLE Worker.