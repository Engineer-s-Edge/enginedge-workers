# LaTeX Worker Kafka Topics Documentation

## Topics Overview

The LaTeX Worker uses Apache Kafka for asynchronous compilation processing and inter-service communication.

## Topic Configurations

### latex.compile.request

**Purpose**: Queue compilation jobs for asynchronous processing

**Configuration**:
- Partitions: 3
- Replication Factor: 2
- Retention Period: 24 hours
- Cleanup Policy: delete
- Compression: snappy

**Message Schema**:
```json
{
  "jobId": "string (UUID)",
  "userId": "string",
  "content": "string (LaTeX document)",
  "projectId": "string (optional)",
  "settings": {
    "engine": "xelatex|lualatex",
    "maxPasses": "integer (1-5)",
    "timeout": "integer (milliseconds)",
    "shell": "boolean"
  },
  "timestamp": "ISO8601 date",
  "priority": "normal|high|low"
}
```

**Example**:
```json
{
  "jobId": "job-550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-123",
  "content": "\\documentclass{article}\\begin{document}Hello\\end{document}",
  "projectId": null,
  "settings": {
    "engine": "xelatex",
    "maxPasses": 3,
    "timeout": 60000,
    "shell": false
  },
  "timestamp": "2025-10-27T15:30:00Z",
  "priority": "normal"
}
```

**Key Ordering**: By `jobId` to ensure single consumer per job

---

### latex.compile.response

**Purpose**: Publish compilation results

**Configuration**:
- Partitions: 3
- Replication Factor: 2
- Retention Period: 7 days
- Cleanup Policy: delete
- Compression: snappy

**Message Schema**:
```json
{
  "jobId": "string",
  "userId": "string",
  "success": "boolean",
  "result": {
    "pdfPath": "string (GridFS ObjectId)",
    "compilationTime": "integer (ms)",
    "passes": "integer",
    "errors": [
      {
        "line": "integer",
        "message": "string",
        "severity": "error|warning|info"
      }
    ],
    "warnings": [
      {
        "line": "integer",
        "message": "string"
      }
    ]
  },
  "timestamp": "ISO8601 date"
}
```

**Example**:
```json
{
  "jobId": "job-550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-123",
  "success": true,
  "result": {
    "pdfPath": "507f1f77bcf86cd799439011",
    "compilationTime": 2500,
    "passes": 2,
    "errors": [],
    "warnings": [
      {
        "line": 5,
        "message": "Citation undefined"
      }
    ]
  },
  "timestamp": "2025-10-27T15:30:02.500Z"
}
```

**Key Ordering**: By `jobId` for correlation with request

---

### latex.compile.error (Dead Letter Queue)

**Purpose**: Failed compilation jobs after retry exhaustion

**Configuration**:
- Partitions: 1
- Replication Factor: 2
- Retention Period: 30 days
- Cleanup Policy: delete

**Message Schema**:
```json
{
  "jobId": "string",
  "userId": "string",
  "originalRequest": "object",
  "error": "string",
  "retryCount": "integer",
  "timestamp": "ISO8601 date",
  "lastAttempt": "ISO8601 date"
}
```

---

## Consumer Groups

### latex-worker-consumer

- **Purpose**: Main compilation consumer
- **Partitions**: 3 (one consumer per partition)
- **Offset Strategy**: AUTO_OFFSET_RESET = latest (after first run)

### latex-result-processor

- **Purpose**: Process compilation results
- **Partitions**: 3
- **Offset Strategy**: AUTO_OFFSET_RESET = earliest (replay from beginning)

---

## Message Flow

### Normal Flow

```
User Request
    ↓
POST /latex/compile-async
    ↓
Producer: Send to latex.compile.request
    ↓
Consumer (latex-worker-consumer):
  1. Read message
  2. Compile document
  3. Store PDF in GridFS
    ↓
Producer: Send to latex.compile.response
    ↓
Client: GET /latex/jobs/{jobId}
  → Queries MongoDB for result
    ↓
Return compiled PDF
```

### Error Flow

```
Compilation Error
    ↓
Attempt Retry (up to 3 times)
    ↓
If Still Failing:
  Producer: Send to latex.compile.error (DLQ)
    ↓
Alert Operations Team
    ↓
Manual Investigation
```

---

## Kafka Configuration (docker-compose)

```yaml
kafka:
  image: confluentinc/cp-kafka:7.0.0
  environment:
    KAFKA_BROKER_ID: 1
    KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
    KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
    KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
    KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
    KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'false'
    KAFKA_LOG_CLEANUP_POLICY: delete
    KAFKA_LOG_RETENTION_MS: 86400000
    KAFKA_COMPRESSION_TYPE: snappy
```

---

## Creating Topics

```bash
# Create all topics
kafka-topics --bootstrap-server localhost:9092 --create \
  --topic latex.compile.request \
  --partitions 3 --replication-factor 2

kafka-topics --bootstrap-server localhost:9092 --create \
  --topic latex.compile.response \
  --partitions 3 --replication-factor 2

kafka-topics --bootstrap-server localhost:9092 --create \
  --topic latex.compile.error \
  --partitions 1 --replication-factor 2

# List topics
kafka-topics --bootstrap-server localhost:9092 --list

# Describe topic
kafka-topics --bootstrap-server localhost:9092 \
  --describe --topic latex.compile.request
```

---

## Monitoring

### Topic Lag

```bash
kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group latex-worker-consumer --describe
```

**Acceptable Lag**:
- < 100 messages: Healthy
- 100-1000 messages: Monitor
- > 1000 messages: Alert

### Partition Leadership

```bash
kafka-topics --bootstrap-server localhost:9092 \
  --describe --topic latex.compile.request
```

### Consumer Lag Monitoring

Add to Prometheus:
```
kafka_consumer_lag_sum{group="latex-worker-consumer"}
```

---

## Best Practices

1. **Message Ordering**: Always use `jobId` as key for partition ordering
2. **Schema Versioning**: Version messages to support evolution
3. **Idempotency**: Ensure compilation is idempotent (safe to retry)
4. **Timeout Handling**: Set compilation timeout < consumer timeout
5. **DLQ Monitoring**: Alert on messages in error topic
6. **Partition Balance**: Ensure even load across partitions
7. **Offset Management**: Disable auto-commit, use manual commits
8. **Compression**: Use snappy for optimal throughput/latency

---

## Troubleshooting

### High Consumer Lag

**Symptoms**: Compilation queue building up

**Causes**:
- Consumer slow or crashed
- Compilation taking too long
- Kafka broker issues

**Solutions**:
```bash
# Check consumer status
kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group latex-worker-consumer --describe

# Reset offset if needed
kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group latex-worker-consumer --reset-offsets \
  --to-earliest --topic latex.compile.request --execute
```

### Message Loss

**Prevent with**:
- Replication Factor ≥ 2
- Min ISR = 2
- Producer: acks=all

### Duplicates

**Prevent with**:
- Producer: idempotence=true
- Consumer: process messages idempotently

---

## Topic Retention Policy

| Topic | Retention | Use Case |
|-------|-----------|----------|
| `latex.compile.request` | 24 hours | Working queue |
| `latex.compile.response` | 7 days | Result history |
| `latex.compile.error` | 30 days | Debugging failures |

Archive old messages to S3 using Confluent Tiered Storage for long-term analytics.
