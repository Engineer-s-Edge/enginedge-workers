# Kafka Topics Documentation - Data Processing Worker

## Overview

This document describes all Kafka topics used by the Data Processing Worker for asynchronous communication with other workers (Agent Tool Worker, Assistant Worker).

## Topic Architecture

### Message Flow
```
Producer (Agent/Assistant) → Topic → Consumer (Data Processing) → Processing → Result Topic → Producer (Data Processing) → Consumer (Agent/Assistant)
```

### Versioning Strategy
All message schemas include a `version` field for backward compatibility.

---

## Topics

### 1. `document.process`

**Purpose:** Request document processing (load, split, embed, store)

**Consumer:** Data Processing Worker  
**Producers:** Agent Tool Worker, Assistant Worker, Main Node

**Message Schema:**
```json
{
  "version": "1.0",
  "taskId": "string (required)",
  "url": "string (optional)",
  "content": "string (optional)",
  "metadata": {
    "userId": "string",
    "conversationId": "string",
    "source": "string",
    "...": "custom fields"
  },
  "options": {
    "split": "boolean (default: true)",
    "embed": "boolean (default: true)",
    "store": "boolean (default: true)",
    "chunkSize": "number (default: 1000)",
    "chunkOverlap": "number (default: 200)"
  }
}
```

**Result Topic:** `document.processed`

**Example:**
```json
{
  "version": "1.0",
  "taskId": "doc-123-abc",
  "url": "https://example.com/document.pdf",
  "metadata": {
    "userId": "user-456",
    "conversationId": "conv-789",
    "source": "agent-tool-worker"
  },
  "options": {
    "split": true,
    "embed": true,
    "store": true
  }
}
```

---

### 2. `document.processed`

**Purpose:** Document processing result

**Consumer:** Agent Tool Worker, Assistant Worker, Main Node  
**Producer:** Data Processing Worker

**Message Schema:**
```json
{
  "version": "1.0",
  "taskId": "string (required)",
  "status": "SUCCESS | FAILURE",
  "result": {
    "documentCount": "number",
    "chunkCount": "number",
    "embeddingCount": "number",
    "processingTime": "number (ms)",
    "documents": [
      {
        "id": "string",
        "content": "string",
        "metadata": "object",
        "embedding": "number[] (optional)"
      }
    ]
  },
  "error": "string (only if status=FAILURE)"
}
```

---

### 3. `document.search`

**Purpose:** Search for similar documents

**Consumer:** Data Processing Worker  
**Producers:** Agent Tool Worker, Assistant Worker

**Message Schema:**
```json
{
  "version": "1.0",
  "taskId": "string (required)",
  "query": "string (required)",
  "limit": "number (default: 5)",
  "filter": {
    "userId": "string",
    "conversationId": "string",
    "sourceType": "string",
    "...": "custom filters"
  }
}
```

**Result Topic:** `document.search.results`

---

### 4. `document.search.results`

**Purpose:** Search results

**Consumer:** Agent Tool Worker, Assistant Worker  
**Producer:** Data Processing Worker

**Message Schema:**
```json
{
  "version": "1.0",
  "taskId": "string (required)",
  "status": "SUCCESS | FAILURE",
  "results": [
    {
      "documentId": "string",
      "content": "string",
      "metadata": "object",
      "score": "number (similarity score)"
    }
  ],
  "error": "string (only if status=FAILURE)"
}
```

---

### 5. `document.delete`

**Purpose:** Delete documents

**Consumer:** Data Processing Worker  
**Producers:** Agent Tool Worker, Assistant Worker, Main Node

**Message Schema:**
```json
{
  "version": "1.0",
  "taskId": "string (required)",
  "documentIds": ["string"],
  "filter": {
    "userId": "string",
    "conversationId": "string",
    "...": "custom filters"
  }
}
```

**Result Topic:** `document.deleted`

---

### 6. `document.deleted`

**Purpose:** Deletion confirmation

**Consumer:** Agent Tool Worker, Assistant Worker, Main Node  
**Producer:** Data Processing Worker

**Message Schema:**
```json
{
  "version": "1.0",
  "taskId": "string (required)",
  "status": "SUCCESS | FAILURE",
  "deletedCount": "number",
  "error": "string (only if status=FAILURE)"
}
```

---

### 7. `document.upload`

**Purpose:** Upload and process new document

**Consumer:** Data Processing Worker  
**Producers:** Agent Tool Worker, Assistant Worker

**Message Schema:**
```json
{
  "version": "1.0",
  "taskId": "string (required)",
  "url": "string (optional)",
  "content": "string (optional - base64 for binary)",
  "fileName": "string",
  "mimeType": "string",
  "metadata": {
    "userId": "string",
    "conversationId": "string",
    "scope": "conversation | user | global"
  }
}
```

**Result Topic:** `document.uploaded`

---

### 8. `document.uploaded`

**Purpose:** Upload result

**Consumer:** Agent Tool Worker, Assistant Worker  
**Producer:** Data Processing Worker

**Message Schema:**
```json
{
  "version": "1.0",
  "taskId": "string (required)",
  "status": "SUCCESS | FAILURE",
  "result": {
    "documentId": "string",
    "chunkCount": "number",
    "processingTime": "number"
  },
  "error": "string (only if status=FAILURE)"
}
```

---

### 9. `embedding.generate`

**Purpose:** Generate embeddings for text

**Consumer:** Data Processing Worker  
**Producers:** Agent Tool Worker, Assistant Worker

**Message Schema:**
```json
{
  "version": "1.0",
  "taskId": "string (required)",
  "text": "string (optional - single text)",
  "texts": ["string"] (optional - batch)",
  "provider": "openai | google | cohere | huggingface",
  "model": "string (optional)"
}
```

**Result Topic:** `embedding.generated`

---

### 10. `embedding.generated`

**Purpose:** Embedding generation result

**Consumer:** Agent Tool Worker, Assistant Worker  
**Producer:** Data Processing Worker

**Message Schema:**
```json
{
  "version": "1.0",
  "taskId": "string (required)",
  "status": "SUCCESS | FAILURE",
  "embeddings": [
    {
      "text": "string",
      "embedding": "number[]",
      "dimensions": "number"
    }
  ],
  "error": "string (only if status=FAILURE)"
}
```

---

### 11. `vector.search`

**Purpose:** Vector similarity search

**Consumer:** Data Processing Worker  
**Producers:** Agent Tool Worker, Assistant Worker

**Message Schema:**
```json
{
  "version": "1.0",
  "taskId": "string (required)",
  "queryEmbedding": "number[] (required)",
  "limit": "number (default: 5)",
  "filter": {
    "userId": "string",
    "conversationId": "string",
    "...": "custom filters"
  },
  "similarity": "cosine | euclidean | dotProduct"
}
```

**Result Topic:** `vector.search.result`

---

### 12. `vector.search.result`

**Purpose:** Vector search results

**Consumer:** Agent Tool Worker, Assistant Worker  
**Producer:** Data Processing Worker

**Message Schema:**
```json
{
  "version": "1.0",
  "taskId": "string (required)",
  "status": "SUCCESS | FAILURE",
  "results": [
    {
      "documentId": "string",
      "content": "string",
      "metadata": "object",
      "score": "number",
      "embedding": "number[] (optional)"
    }
  ],
  "error": "string (only if status=FAILURE)"
}
```

---

### 13. `ocr.process`

**Purpose:** OCR text extraction from images

**Consumer:** Data Processing Worker  
**Producer:** Agent Tool Worker

**Message Schema:**
```json
{
  "version": "1.0",
  "taskId": "string (required)",
  "imagePath": "string (optional - file path)",
  "imageData": "string (optional - base64)",
  "imageUrl": "string (optional - URL)",
  "language": "string (default: 'eng')",
  "operation": "extract | search | extract_with_boxes",
  "confidence": "number (default: 0.8)",
  "preprocess": "boolean (default: false)"
}
```

**Result Topic:** `ocr.complete`

---

### 14. `ocr.complete`

**Purpose:** OCR processing result

**Consumer:** Agent Tool Worker  
**Producer:** Data Processing Worker

**Message Schema:**
```json
{
  "version": "1.0",
  "taskId": "string (required)",
  "status": "SUCCESS | FAILURE",
  "result": {
    "text": "string (extracted text)",
    "confidence": "number",
    "language": "string",
    "boundingBoxes": [
      {
        "text": "string",
        "x": "number",
        "y": "number",
        "width": "number",
        "height": "number"
      }
    ] (optional)
  },
  "error": "string (only if status=FAILURE)"
}
```

---

## Error Handling

### Dead Letter Queue (DLQ)

All topics have corresponding DLQ topics:
- `document.process.dlq`
- `document.search.dlq`
- `embedding.generate.dlq`
- etc.

### Retry Policy

- **Max Retries:** 3
- **Backoff:** Exponential (1s, 2s, 4s)
- **DLQ:** After max retries

### Error Message Format
```json
{
  "version": "1.0",
  "taskId": "string",
  "originalTopic": "string",
  "originalMessage": "object",
  "error": {
    "message": "string",
    "stack": "string",
    "timestamp": "ISO 8601 string"
  },
  "retryCount": "number"
}
```

---

## Consumer Groups

- **data-processing-worker-group:** Main consumer group for Data Processing Worker
- **agent-tool-worker-group:** Agent Tool Worker consumers
- **assistant-worker-group:** Assistant Worker consumers

---

## Performance Guidelines

### Message Size Limits
- **Max Message Size:** 1 MB
- **Recommendation:** For large documents, use URL references instead of inline content
- **Large Files:** Upload to S3/MinIO first, send URL in message

### Throughput
- **Target:** 1000 messages/sec per topic
- **Batch Size:** 100 messages per batch
- **Compression:** Snappy compression enabled

### Monitoring Metrics
- Consumer lag
- Processing time per message
- Error rate
- DLQ message count

---

## Kafka Configuration

### Broker Configuration
```yaml
KAFKA_BROKERS: "kafka-0.kafka-headless:9092,kafka-1.kafka-headless:9092"
KAFKA_COMPRESSION_TYPE: "snappy"
KAFKA_BATCH_SIZE: 16384
KAFKA_LINGER_MS: 10
KAFKA_MAX_REQUEST_SIZE: 1048576
```

### Consumer Configuration
```yaml
KAFKA_CONSUMER_GROUP_ID: "data-processing-worker-group"
KAFKA_AUTO_OFFSET_RESET: "latest"
KAFKA_ENABLE_AUTO_COMMIT: true
KAFKA_AUTO_COMMIT_INTERVAL_MS: 5000
KAFKA_SESSION_TIMEOUT_MS: 30000
```

### Producer Configuration
```yaml
KAFKA_ACKS: "all"
KAFKA_RETRIES: 3
KAFKA_IDEMPOTENCE: true
KAFKA_MAX_IN_FLIGHT_REQUESTS: 5
```

---

## Testing

### Integration Tests

See `src/__tests__/integration/kafka-integration.spec.ts` for:
- Topic creation
- Message publishing
- Message consumption
- Error handling
- DLQ behavior

### Manual Testing

Use `kafkacat` or Kafka CLI tools:

```bash
# Produce test message
echo '{"version":"1.0","taskId":"test-123","url":"https://example.com/doc.pdf"}' | \
  kafkacat -P -b localhost:9092 -t document.process

# Consume results
kafkacat -C -b localhost:9092 -t document.processed -o end
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-26 | Initial schema definitions for all 14 topics |

---

## Future Enhancements

1. **Schema Registry:** Implement Avro/Protobuf schemas with Confluent Schema Registry
2. **Streaming:** Add Kafka Streams for real-time analytics
3. **CDC:** Change Data Capture from MongoDB to Kafka
4. **GraphQL Subscriptions:** Kafka-backed GraphQL subscriptions
5. **Event Sourcing:** Full event sourcing architecture
