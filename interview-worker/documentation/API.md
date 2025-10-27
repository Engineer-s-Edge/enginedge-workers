# Interview Worker - API Documentation

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Interview Management API](#interview-management-api)
- [Transcription API](#transcription-api)
- [Analysis API](#analysis-api)
- [Scheduling API](#scheduling-api)
- [Health & Metrics](#health--metrics)

---

## Overview

The Interview Worker exposes **45+ REST API endpoints** organized into the following categories:

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Interview Management** | 12 | Create, manage, and track interviews |
| **Transcription** | 8 | Audio/video processing and transcription |
| **Analysis** | 15 | AI-powered analysis and insights |
| **Scheduling** | 6 | Calendar integration and scheduling |
| **Health/Metrics** | 2 | System health and monitoring |

---

## Authentication

Currently, the API uses user-based identification:

```bash
# Include userId in request body or query parameter
{
  "userId": "user123",
  ...
}
```

For production, implement one of:
- **API Keys:** Header-based authentication
- **OAuth 2.0:** Token-based authentication
- **JWT:** JSON Web Token authentication

---

## Base URL

```
http://localhost:3001/api/v1
```

---

## Response Format

All API responses follow a consistent JSON structure:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req-12345"
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": { ... }
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "req-12345"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 502 | Bad Gateway |
| 503 | Service Unavailable |

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `NOT_FOUND` | Resource not found |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `RATE_LIMITED` | Too many requests |
| `PROCESSING_ERROR` | Interview processing failed |
| `TRANSCRIPTION_ERROR` | Audio/video transcription failed |
| `ANALYSIS_ERROR` | AI analysis failed |

---

## Interview Management API

### Create Interview

```http
POST /interviews
```

**Request Body:**
```json
{
  "userId": "user123",
  "candidateId": "candidate456",
  "jobId": "job789",
  "scheduledAt": "2024-01-15T10:00:00Z",
  "duration": 60,
  "interviewers": ["interviewer1", "interviewer2"],
  "type": "technical",
  "format": "video",
  "questions": [
    {
      "question": "Tell me about yourself",
      "category": "introduction",
      "difficulty": "easy"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "interviewId": "interview-123",
    "status": "scheduled",
    "meetingUrl": "https://meet.example.com/interview-123"
  }
}
```

### Get Interview

```http
GET /interviews/{interviewId}
```

### Update Interview

```http
PUT /interviews/{interviewId}
```

### Delete Interview

```http
DELETE /interviews/{interviewId}
```

### List Interviews

```http
GET /interviews?userId=user123&status=scheduled&page=1&limit=20
```

### Start Interview

```http
POST /interviews/{interviewId}/start
```

### End Interview

```http
POST /interviews/{interviewId}/end
```

---

## Transcription API

### Upload Audio/Video

```http
POST /transcription/upload
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: Audio/video file
- `interviewId`: Interview identifier
- `format`: "audio" | "video"

### Get Transcription

```http
GET /transcription/{interviewId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transcription": [
      {
        "timestamp": "00:00:15",
        "speaker": "interviewer",
        "text": "Tell me about your experience with React"
      },
      {
        "timestamp": "00:00:32",
        "speaker": "candidate",
        "text": "I've been working with React for 3 years..."
      }
    ],
    "confidence": 0.95,
    "duration": 3600
  }
}
```

### Real-time Transcription

```http
WebSocket: ws://localhost:3001/transcription/stream/{interviewId}
```

---

## Analysis API

### Analyze Interview

```http
POST /analysis/{interviewId}/analyze
```

**Request Body:**
```json
{
  "analysisTypes": ["sentiment", "keywords", "competency", "overall"],
  "customPrompts": {
    "competency": "Evaluate technical skills on a scale of 1-10"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sentiment": {
      "overall": 0.75,
      "timeline": [
        {"timestamp": "00:00:00", "score": 0.8},
        {"timestamp": "00:15:00", "score": 0.7}
      ]
    },
    "keywords": [
      {"word": "React", "frequency": 12, "relevance": 0.9},
      {"word": "JavaScript", "frequency": 8, "relevance": 0.8}
    ],
    "competency": {
      "technical": 8.5,
      "communication": 7.2,
      "problemSolving": 9.1
    },
    "overall": {
      "score": 8.2,
      "recommendation": "Strong candidate, recommend for next round",
      "strengths": ["Technical expertise", "Clear communication"],
      "areasForImprovement": ["Could provide more specific examples"]
    }
  }
}
```

### Get Analysis Results

```http
GET /analysis/{interviewId}/results
```

### Generate Feedback

```http
POST /analysis/{interviewId}/feedback
```

**Request Body:**
```json
{
  "template": "comprehensive",
  "recipients": ["candidate", "hiring_manager"],
  "includeScores": true,
  "customSections": ["career_advice"]
}
```

---

## Scheduling API

### Schedule Interview

```http
POST /scheduling/schedule
```

**Request Body:**
```json
{
  "candidateId": "candidate456",
  "interviewers": ["interviewer1", "interviewer2"],
  "duration": 60,
  "preferredTimes": [
    {
      "start": "2024-01-15T09:00:00Z",
      "end": "2024-01-15T17:00:00Z"
    }
  ],
  "timezone": "America/New_York"
}
```

### Get Availability

```http
GET /scheduling/availability?userId=user123&start=2024-01-01&end=2024-01-31
```

### Reschedule Interview

```http
PUT /scheduling/{interviewId}/reschedule
```

### Cancel Interview

```http
DELETE /scheduling/{interviewId}
```

---

## Health & Metrics

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "services": {
    "mongodb": "connected",
    "redis": "connected",
    "kafka": "connected"
  }
}
```

### Metrics

```http
GET /metrics
```

Returns Prometheus metrics in the standard format.