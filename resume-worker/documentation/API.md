# Resume Worker - API Documentation

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Experience Bank API](#experience-bank-api)
- [Resume API](#resume-api)
- [Job Posting API](#job-posting-api)
- [Evaluation API](#evaluation-api)
- [Resume Tailoring API](#resume-tailoring-api)
- [Resume Editing API](#resume-editing-api)
- [Cover Letter API](#cover-letter-api)
- [WebSocket Gateways](#websocket-gateways)
- [Health & Metrics](#health--metrics)

---

## Overview

The Resume Worker exposes **35+ REST API endpoints** organized into the following categories:

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Experience Bank** | 5 | Manage bullet point library |
| **Resume** | 4 | CRUD operations for resumes |
| **Job Posting** | 4 | Extract and manage job postings |
| **Evaluation** | 3 | Evaluate resumes and bullets |
| **Resume Tailoring** | 3 | Full tailoring workflow |
| **Resume Editing** | 7 | LaTeX editing operations |
| **Cover Letter** | 3 | Generate cover letters |
| **WebSocket Gateways** | 3 | Real-time agent interaction |
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
- **JWT Tokens:** Bearer token authentication
- **OAuth 2.0:** Third-party authentication

---

## Base URL

```
Development: http://localhost:3006
Production: https://resume.yourdomain.com
```

---

## Response Format

### Success Response

```json
{
  "id": "item_123",
  "status": "success",
  "data": {
    // Response data
  },
  "timestamp": "2025-11-03T12:00:00.000Z"
}
```

### Error Response

```json
{
  "statusCode": 400,
  "message": "Resource not found",
  "error": "Not Found",
  "timestamp": "2025-11-03T12:00:00.000Z",
  "path": "/experience-bank/invalid-id"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `200` | OK | Request successful |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid request parameters |
| `404` | Not Found | Resource not found |
| `409` | Conflict | Resource already exists |
| `500` | Internal Server Error | Server error |
| `503` | Service Unavailable | Service temporarily unavailable |

---

## Experience Bank API

### Add Bullet Point

Add a new bullet point to the experience bank.

**Endpoint:** `POST /experience-bank/add`

**Request Body:**
```json
{
  "userId": "user123",
  "bulletText": "Developed scalable microservices reducing deployment time by 60%",
  "metadata": {
    "technologies": ["Node.js", "Docker", "Kubernetes"],
    "role": "Software Engineer",
    "company": "Tech Corp",
    "dateRange": "2022-2024",
    "metrics": ["60% reduction"],
    "keywords": ["microservices", "deployment"],
    "reviewed": false,
    "linkedExperienceId": null,
    "category": "work",
    "impactScore": 0.9,
    "atsScore": 0.95
  }
}
```

**Response:**
```json
{
  "_id": "bullet123",
  "userId": "user123",
  "bulletText": "Developed scalable microservices reducing deployment time by 60%",
  "vector": [0.1, 0.2, ...],
  "vectorModel": "text-embedding-004",
  "metadata": { ... },
  "hash": "abc123def456",
  "createdAt": "2025-11-03T12:00:00.000Z",
  "updatedAt": "2025-11-03T12:00:00.000Z"
}
```

---

### Search Experience Bank

Search for bullet points using vector search and metadata filters.

**Endpoint:** `POST /experience-bank/search`

**Request Body:**
```json
{
  "userId": "user123",
  "query": "microservices deployment",
  "filters": {
    "technologies": ["Docker"],
    "reviewed": true,
    "minImpactScore": 0.7,
    "category": "work"
  },
  "limit": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "_id": "bullet123",
      "bulletText": "Developed scalable microservices...",
      "metadata": { ... },
      "score": 0.95
    }
  ],
  "total": 15
}
```

---

### List Bullets

List all bullets for a user with optional filters.

**Endpoint:** `GET /experience-bank/list/:userId`

**Query Parameters:**
- `reviewed` (optional): Filter by review status
- `category` (optional): Filter by category (work, project, education)
- `technologies` (optional): Filter by technologies (comma-separated)

**Response:**
```json
{
  "bullets": [
    {
      "_id": "bullet123",
      "bulletText": "...",
      "metadata": { ... }
    }
  ],
  "total": 25
}
```

---

### Mark as Reviewed

Mark a bullet point as reviewed.

**Endpoint:** `PATCH /experience-bank/:id/reviewed`

**Response:**
```json
{
  "_id": "bullet123",
  "metadata": {
    "reviewed": true
  },
  "updatedAt": "2025-11-03T12:00:00.000Z"
}
```

---

### Get Bullet by ID

Get a specific bullet point.

**Endpoint:** `GET /experience-bank/:id`

**Response:**
```json
{
  "_id": "bullet123",
  "bulletText": "...",
  "metadata": { ... }
}
```

---

## Resume API

### Create Resume

Create a new resume.

**Endpoint:** `POST /resume/create`

**Request Body:**
```json
{
  "userId": "user123",
  "name": "Software Engineer Resume",
  "latexContent": "\\documentclass{article}...",
  "metadata": {
    "targetRole": "Senior Software Engineer",
    "targetCompany": "Tech Corp",
    "jobPostingId": "posting123"
  }
}
```

**Response:**
```json
{
  "_id": "resume123",
  "userId": "user123",
  "name": "Software Engineer Resume",
  "currentVersion": 1,
  "versions": [
    {
      "version": 1,
      "latexContent": "...",
      "timestamp": "2025-11-03T12:00:00.000Z"
    }
  ],
  "createdAt": "2025-11-03T12:00:00.000Z"
}
```

---

### Get Resume

Get a resume by ID.

**Endpoint:** `GET /resume/:id`

**Response:**
```json
{
  "_id": "resume123",
  "name": "Software Engineer Resume",
  "latexContent": "...",
  "currentVersion": 3,
  "versions": [ ... ]
}
```

---

### Update Resume

Update resume content.

**Endpoint:** `PATCH /resume/:id`

**Request Body:**
```json
{
  "latexContent": "\\documentclass{article}...",
  "metadata": {
    "targetRole": "Lead Engineer"
  }
}
```

---

### Delete Resume

Delete a resume.

**Endpoint:** `DELETE /resume/:id`

**Response:**
```json
{
  "message": "Resume deleted successfully"
}
```

---

## Job Posting API

### Extract Job Posting

Extract structured information from a job posting.

**Endpoint:** `POST /job-posting/extract`

**Request Body:**
```json
{
  "userId": "user123",
  "url": "https://example.com/job",
  "rawText": "Senior Software Engineer\n5+ years experience...",
  "mode": "nlp-only"
}
```

**Response:**
```json
{
  "_id": "posting123",
  "userId": "user123",
  "url": "https://example.com/job",
  "parsed": {
    "role": {
      "titleRaw": "Senior Software Engineer",
      "roleFamily": "Software Engineering",
      "seniorityInferred": "Senior"
    },
    "skills": {
      "skillsExplicit": ["Python", "AWS", "Docker"],
      "skillsInferred": ["Cloud", "DevOps"]
    },
    "experience": {
      "monthsMin": 60,
      "monthsPreferred": 84
    },
    "compensation": {
      "baseSalary": {
        "min": 120000,
        "max": 160000,
        "currency": "USD"
      }
    }
  },
  "confidence": 0.85,
  "createdAt": "2025-11-03T12:00:00.000Z"
}
```

---

### Get Job Posting

Get a job posting by ID.

**Endpoint:** `GET /job-posting/:id`

---

### List Job Postings

List all job postings for a user.

**Endpoint:** `GET /job-posting/list/:userId`

---

### Delete Job Posting

Delete a job posting.

**Endpoint:** `DELETE /job-posting/:id`

---

## Evaluation API

### Evaluate Resume

Evaluate an entire resume.

**Endpoint:** `POST /evaluation/evaluate`

**Request Body:**
```json
{
  "resumeId": "resume123",
  "mode": "jd-match",
  "jobPostingId": "posting123",
  "options": {
    "autoFix": true,
    "includeSwaps": true
  }
}
```

**Response:**
```json
{
  "_id": "report123",
  "resumeId": "resume123",
  "mode": "jd-match",
  "scores": {
    "overall": 85,
    "structure": 90,
    "ats": 95,
    "content": 80,
    "alignment": 75
  },
  "gates": {
    "atsCompatible": true,
    "noSpellingErrors": true,
    "hasQuantifiableResults": true
  },
  "findings": [
    {
      "severity": "warning",
      "category": "content",
      "message": "Missing keyword: Kubernetes",
      "location": "Experience section"
    }
  ],
  "coverage": {
    "requiredSkillsMatched": 8,
    "requiredSkillsTotal": 10,
    "coveragePercent": 80
  },
  "suggestedSwaps": [
    {
      "currentBullet": "Worked on deployment",
      "suggestedBullet": "Automated deployment pipeline reducing release time by 70%",
      "reason": "Stronger metrics and action verb",
      "confidence": 0.9
    }
  ],
  "createdAt": "2025-11-03T12:00:00.000Z"
}
```

---

### Get Evaluation Report

Get an evaluation report by ID.

**Endpoint:** `GET /evaluation/report/:id`

---

### List Evaluation Reports

List all reports for a resume.

**Endpoint:** `GET /evaluation/reports/:resumeId`

---

## Resume Tailoring API

### Tailor Resume

Start a full resume tailoring workflow.

**Endpoint:** `POST /tailoring/tailor`

**Request Body:**
```json
{
  "userId": "user123",
  "resumeId": "resume123",
  "jobPostingText": "Senior Software Engineer...",
  "mode": "auto",
  "targetScore": 95,
  "options": {
    "maxIterations": 5,
    "autoApplyFixes": true
  }
}
```

**Response:**
```json
{
  "jobId": "job123",
  "status": "queued",
  "estimatedTime": 300
}
```

---

### Get Tailoring Job Status

Get the status of a tailoring job.

**Endpoint:** `GET /tailoring/job/:jobId`

**Response:**
```json
{
  "jobId": "job123",
  "status": "processing",
  "progress": 60,
  "currentScore": 87,
  "targetScore": 95,
  "iterations": 2,
  "message": "Evaluating resume..."
}
```

---

### Cancel Tailoring Job

Cancel a running tailoring job.

**Endpoint:** `POST /tailoring/job/:jobId/cancel`

---

## Resume Editing API

### Apply LaTeX Operation

Apply a LaTeX editing operation.

**Endpoint:** `POST /editing/:resumeId/latex`

**Request Body:**
```json
{
  "operation": "bold",
  "text": "Senior Software Engineer"
}
```

---

### Undo

Undo the last change.

**Endpoint:** `POST /editing/:resumeId/undo`

---

### Redo

Redo the last undone change.

**Endpoint:** `POST /editing/:resumeId/redo`

---

### Preview Resume

Generate a PDF preview.

**Endpoint:** `POST /editing/:resumeId/preview`

**Response:**
```json
{
  "pdfUrl": "https://...",
  "expiresAt": "2025-11-03T13:00:00.000Z"
}
```

---

### Suggest Bullet Swaps

Get bullet swap suggestions.

**Endpoint:** `POST /editing/:resumeId/suggest-swaps`

**Request Body:**
```json
{
  "jobPostingId": "posting123",
  "limit": 5
}
```

---

### Apply Bullet Swap

Apply a suggested bullet swap.

**Endpoint:** `POST /editing/:resumeId/apply-swap`

**Request Body:**
```json
{
  "oldBulletId": "bullet123",
  "newBulletId": "bullet456"
}
```

---

## Cover Letter API

### Generate Cover Letter

Generate a tailored cover letter.

**Endpoint:** `POST /cover-letter/generate`

**Request Body:**
```json
{
  "userId": "user123",
  "options": {
    "jobPostingId": "posting123",
    "tone": "professional",
    "length": "medium",
    "includeExperiences": ["bullet123", "bullet456"]
  }
}
```

**Response:**
```json
{
  "_id": "letter123",
  "userId": "user123",
  "jobPostingId": "posting123",
  "content": "Dear Hiring Manager,\n\nI am writing...",
  "metadata": {
    "company": "Tech Corp",
    "position": "Senior Software Engineer",
    "tone": "professional",
    "length": "medium",
    "experiencesUsed": ["bullet123", "bullet456"]
  },
  "createdAt": "2025-11-03T12:00:00.000Z"
}
```

---

### Regenerate Cover Letter

Regenerate with different options.

**Endpoint:** `POST /cover-letter/:id/regenerate`

---

### Edit Cover Letter

Edit cover letter content.

**Endpoint:** `PATCH /cover-letter/:id`

---

## WebSocket Gateways

### Resume Iterator Gateway

**Namespace:** `/resume-iterator`

**Events:**

**Client → Server:**
- `start-iteration` - Start iteration session
- `send-message` - Send message to agent
- `apply-fix` - Apply suggested fix
- `toggle-mode` - Toggle auto/manual mode
- `stop-iteration` - Stop iteration

**Server → Client:**
- `iteration-started` - Session started
- `agent-thinking` - Agent is processing
- `agent-message` - Agent message
- `evaluation-update` - New evaluation results
- `fix-suggested` - Auto-fix suggestion
- `iteration-complete` - Iteration finished

---

### Bullet Review Gateway

**Namespace:** `/bullet-review`

**Events:**

**Client → Server:**
- `start-review` - Start review session
- `respond` - Respond to agent question
- `approve` - Approve bullet
- `reject` - Reject bullet
- `skip` - Skip bullet

**Server → Client:**
- `review-started` - Session started
- `agent-question` - Agent question
- `bullet-approved` - Bullet approved
- `bullet-rejected` - Bullet rejected
- `review-complete` - All bullets reviewed

---

### Resume Builder Gateway

**Namespace:** `/resume-builder`

**Events:**

**Client → Server:**
- `start-session` - Start builder session
- `user-response` - User response
- `add-experience` - Add experience
- `add-bullet` - Add bullet
- `analyze-codebase` - Analyze GitHub repo
- `finalize-session` - Finalize and save

**Server → Client:**
- `session-started` - Session started
- `agent-question` - Agent question
- `experience-added` - Experience added
- `codebase-analyzed` - Analysis complete
- `session-finalized` - Session complete

---

## Health & Metrics

### Health Check

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-03T12:00:00.000Z",
  "uptime": 123.45
}
```

---

### Prometheus Metrics

**Endpoint:** `GET /metrics`

Returns Prometheus-formatted metrics.

---

## Rate Limiting

| Endpoint Category | Rate Limit |
|------------------|------------|
| Experience Bank | 100 req/min |
| Resume Operations | 50 req/min |
| Evaluation | 20 req/min |
| Tailoring | 10 req/min |
| Cover Letter | 10 req/min |

---

## Best Practices

1. **Use WebSockets for long-running operations** (iteration, review)
2. **Poll job status** for tailoring operations
3. **Cache evaluation reports** to avoid re-evaluation
4. **Batch bullet additions** to experience bank
5. **Use metadata filters** for efficient searches

---

**Last Updated:** November 3, 2025  
**Version:** 1.0.0  
**API Version:** v1
