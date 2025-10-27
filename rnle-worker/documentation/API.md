# RNLE Worker API Documentation

## Overview

The RNLE Worker provides RESTful APIs for processing background commands and monitoring service health. All endpoints return JSON responses and follow REST conventions.

## Base URL

```
http://localhost:3001
```

## Authentication

Currently, no authentication is required for internal service communication.

## Endpoints

### Health Check

#### GET /health

Returns the health status of the service and its dependencies.

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "checks": {
    "kafka": {
      "status": "up",
      "responseTime": 45
    },
    "database": {
      "status": "up",
      "responseTime": 23
    }
  }
}
```

**Error Response (503 Service Unavailable):**
```json
{
  "status": "error",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "kafka": {
      "status": "down",
      "error": "Connection timeout"
    }
  }
}
```

### Command Processing

#### POST /command/process

Processes a background command asynchronously.

**Request Body:**
```json
{
  "taskId": "string (required)",
  "taskType": "EXECUTE_ASSISTANT | SCHEDULE_HABITS (required)",
  "payload": {
    "additional": "data"
  }
}
```

**Parameters:**

- `taskId` (string, required): Unique identifier for the task
- `taskType` (string, required): Type of task to execute
  - `EXECUTE_ASSISTANT`: Execute an assistant operation
  - `SCHEDULE_HABITS`: Schedule habit-related tasks
- `payload` (object, optional): Task-specific data

**Success Response (200 OK):**
```json
{
  "taskId": "task-123",
  "status": "SUCCESS",
  "result": {
    "message": "Executed assistant task task-123 with payload: {...}",
    "processedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "taskId": "task-123",
  "status": "FAILURE",
  "error": "Invalid command format: missing taskType"
}
```

**Error Response (500 Internal Server Error):**
```json
{
  "taskId": "task-123",
  "status": "FAILURE",
  "error": "Internal processing error"
}
```

### Metrics

#### GET /metrics

Returns Prometheus-compatible metrics for monitoring.

**Response (200 OK):**
```
# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/health",status="200"} 150

# HELP command_processing_duration_seconds Time spent processing commands
# TYPE command_processing_duration_seconds histogram
command_processing_duration_seconds_bucket{le="0.1"} 5
command_processing_duration_seconds_bucket{le="0.5"} 12
...
```

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input data |
| 500 | Internal Server Error - Processing failed |
| 503 | Service Unavailable - Health check failed |

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing based on production requirements.

## Timeouts

- Health check: 30 seconds
- Command processing: 300 seconds (5 minutes)

## Data Formats

All requests and responses use JSON format with UTF-8 encoding.

## Versioning

API versioning is not currently implemented. All endpoints are at version 1.0.

## Examples

### Execute Assistant Task

```bash
curl -X POST http://localhost:3001/command/process \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "assist-001",
    "taskType": "EXECUTE_ASSISTANT",
    "payload": {
      "assistantId": "asst_123",
      "userInput": "Analyze this resume",
      "context": {
        "userId": "user_456",
        "sessionId": "sess_789"
      }
    }
  }'
```

### Schedule Habits

```bash
curl -X POST http://localhost:3001/command/process \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "habit-001",
    "taskType": "SCHEDULE_HABITS",
    "payload": {
      "userId": "user_456",
      "habits": [
        {
          "name": "Morning Exercise",
          "frequency": "daily",
          "time": "07:00"
        }
      ]
    }
  }'
```

### Health Check

```bash
curl http://localhost:3001/health
```

## WebSocket Support

The service supports WebSocket connections for real-time updates on command processing status. Connect to `/ws` endpoint for live updates.

## Monitoring Integration

All endpoints are instrumented with Prometheus metrics:

- Request count and duration
- Error rates by endpoint
- Command processing metrics
- Kafka message processing stats

## Security Considerations

- Input validation is performed on all endpoints
- SQL injection protection through parameterized queries
- XSS protection through input sanitization
- CORS headers configured for cross-origin requests

## Future Enhancements

- API versioning with URL prefixes
- Authentication and authorization
- Request/response compression
- GraphQL API support
- Webhook notifications for task completion