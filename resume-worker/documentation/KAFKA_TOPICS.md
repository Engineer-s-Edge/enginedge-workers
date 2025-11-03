# Resume Worker Kafka Topics

## Overview

The Resume Worker uses Apache Kafka for event-driven communication with the Resume NLP Service, Assistant Worker, Data Processing Worker, and LaTeX Worker. This document describes all Kafka topics, message schemas, and integration patterns.

## Architecture

### Message Flow

```
Resume Worker → Kafka → Resume NLP Service
              ↓
         MongoDB Storage
              ↓
         Response via Kafka
```

### Topic Categories

1. **Bullet Evaluation Topics**: Evaluate bullet point quality
2. **Job Posting Topics**: Extract structured data from postings
3. **PDF Parsing Topics**: Parse resume PDFs
4. **Tailoring Topics**: Resume tailoring workflow events
5. **Agent Topics**: AI agent communication
6. **Vector Topics**: Embedding generation and search

---

## Topic Specifications

### 1. Bullet Evaluation Topics

#### `resume.bullet.evaluate.request`

**Purpose:** Request bullet point evaluation from NLP service

**Partitioning Strategy:**
- Partitioned by `userId` for load balancing
- 6 partitions for parallel processing
- Key: `requestId` (string)

**Message Schema:**

```json
{
  "requestId": "req_123",
  "bulletText": "Developed scalable microservices reducing deployment time by 60%",
  "role": "Software Engineer",
  "mode": "nlp-only",
  "options": {
    "checkGrammar": true,
    "checkATS": true,
    "generateFixes": true
  },
  "timestamp": "2025-11-03T12:00:00.000Z",
  "correlationId": "corr_456"
}
```

**Fields:**
- `requestId` (required): Unique request identifier
- `bulletText` (required): Bullet point text to evaluate
- `role` (optional): Target role for context
- `mode` (required): Evaluation mode (nlp-only, llm-assisted)
- `options` (optional): Evaluation options
- `timestamp` (required): Request timestamp
- `correlationId` (optional): Correlation ID for tracing

---

#### `resume.bullet.evaluate.response`

**Purpose:** Return bullet evaluation results

**Message Schema:**

```json
{
  "requestId": "req_123",
  "overallScore": 0.95,
  "passed": true,
  "checks": {
    "actionVerb": {
      "passed": true,
      "score": 1.0,
      "message": "Strong action verb: Developed"
    },
    "activeVoice": {
      "passed": true,
      "score": 1.0
    },
    "quantifiable": {
      "passed": true,
      "score": 1.0,
      "metrics": ["60%"]
    },
    "concise": {
      "passed": true,
      "score": 0.9
    },
    "tenseConsistent": {
      "passed": true,
      "score": 1.0
    },
    "atsSafe": {
      "passed": true,
      "score": 1.0
    },
    "hasKeywords": {
      "passed": true,
      "score": 0.9,
      "keywords": ["microservices", "deployment"]
    },
    "noFluff": {
      "passed": true,
      "score": 1.0
    },
    "grammarCorrect": {
      "passed": true,
      "score": 1.0
    }
  },
  "suggestedFixes": [
    {
      "description": "Consider adding specific technology",
      "fixedText": "Developed scalable microservices using Docker reducing deployment time by 60%",
      "confidence": 0.8,
      "category": "enhancement"
    }
  ],
  "timestamp": "2025-11-03T12:00:01.000Z",
  "processingTime": 245
}
```

---

### 2. Job Posting Extraction Topics

#### `resume.posting.extract.request`

**Purpose:** Request job posting extraction

**Message Schema:**

```json
{
  "requestId": "req_789",
  "userId": "user123",
  "rawText": "Senior Software Engineer\n5+ years experience...",
  "rawHtml": "<html>...</html>",
  "url": "https://example.com/job",
  "mode": "nlp-only",
  "timestamp": "2025-11-03T12:00:00.000Z"
}
```

---

#### `resume.posting.extract.response`

**Purpose:** Return extracted job posting data

**Message Schema:**

```json
{
  "requestId": "req_789",
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
    "education": {
      "educationRequirements": [
        {
          "level": "Bachelor",
          "field": "Computer Science",
          "required": true
        }
      ]
    },
    "compensation": {
      "baseSalary": {
        "min": 120000,
        "max": 160000,
        "currency": "USD"
      }
    },
    "location": {
      "jobLocation": "San Francisco, CA",
      "onsiteDaysPerWeek": 3
    }
  },
  "confidence": 0.85,
  "timestamp": "2025-11-03T12:00:02.000Z",
  "processingTime": 1200
}
```

---

### 3. PDF Parsing Topics

#### `resume.pdf.parse.request`

**Purpose:** Request PDF parsing

**Message Schema:**

```json
{
  "requestId": "req_pdf_123",
  "resumeId": "resume123",
  "pdfUrl": "s3://bucket/resume.pdf",
  "options": {
    "extractSections": true,
    "detectLayout": true,
    "ocrFallback": true
  },
  "timestamp": "2025-11-03T12:00:00.000Z"
}
```

---

#### `resume.pdf.parse.response`

**Purpose:** Return parsed PDF data

**Message Schema:**

```json
{
  "requestId": "req_pdf_123",
  "text": "John Doe\nSoftware Engineer...",
  "sections": {
    "contact": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    },
    "experience": [
      {
        "company": "Tech Corp",
        "role": "Senior Engineer",
        "dateRange": "2020-2024",
        "bullets": [
          "Developed microservices...",
          "Led team of 5..."
        ]
      }
    ],
    "education": [
      {
        "school": "University",
        "degree": "BS Computer Science",
        "graduationDate": "2020"
      }
    ],
    "skills": ["Python", "AWS", "Docker"]
  },
  "layoutIssues": [
    {
      "type": "table_detected",
      "severity": "warning",
      "location": "page 1"
    }
  ],
  "timestamp": "2025-11-03T12:00:03.000Z",
  "processingTime": 3400
}
```

---

### 4. Resume Tailoring Topics

#### `resume.tailoring.job.started`

**Purpose:** Notify that a tailoring job has started

**Message Schema:**

```json
{
  "jobId": "job_123",
  "userId": "user123",
  "resumeId": "resume123",
  "jobPostingId": "posting123",
  "mode": "auto",
  "targetScore": 95,
  "timestamp": "2025-11-03T12:00:00.000Z"
}
```

---

#### `resume.tailoring.job.progress`

**Purpose:** Update on tailoring job progress

**Message Schema:**

```json
{
  "jobId": "job_123",
  "status": "processing",
  "progress": 60,
  "currentScore": 87,
  "targetScore": 95,
  "iterations": 2,
  "message": "Evaluating resume...",
  "timestamp": "2025-11-03T12:01:00.000Z"
}
```

---

#### `resume.tailoring.job.completed`

**Purpose:** Notify that tailoring job completed

**Message Schema:**

```json
{
  "jobId": "job_123",
  "status": "completed",
  "finalScore": 96,
  "targetScore": 95,
  "iterations": 3,
  "resumeId": "resume123",
  "newVersion": 5,
  "timestamp": "2025-11-03T12:05:00.000Z",
  "totalTime": 300000
}
```

---

#### `resume.tailoring.job.failed`

**Purpose:** Notify that tailoring job failed

**Message Schema:**

```json
{
  "jobId": "job_123",
  "status": "failed",
  "error": "PDF compilation failed",
  "errorCode": "LATEX_COMPILE_ERROR",
  "timestamp": "2025-11-03T12:02:00.000Z"
}
```

---

### 5. Vector Embedding Topics

#### `resume.vector.embed.request`

**Purpose:** Request vector embedding generation

**Message Schema:**

```json
{
  "requestId": "req_vec_123",
  "texts": [
    "Developed scalable microservices...",
    "Led team of 5 engineers..."
  ],
  "model": "text-embedding-004",
  "userId": "user123",
  "timestamp": "2025-11-03T12:00:00.000Z"
}
```

---

#### `resume.vector.embed.response`

**Purpose:** Return generated embeddings

**Message Schema:**

```json
{
  "requestId": "req_vec_123",
  "embeddings": [
    [0.1, 0.2, 0.3, ...],
    [0.4, 0.5, 0.6, ...]
  ],
  "model": "text-embedding-004",
  "dimensions": 768,
  "timestamp": "2025-11-03T12:00:01.000Z"
}
```

---

#### `resume.vector.search.request`

**Purpose:** Request vector search

**Message Schema:**

```json
{
  "requestId": "req_search_123",
  "userId": "user123",
  "queryVector": [0.1, 0.2, 0.3, ...],
  "filters": {
    "technologies": ["Docker"],
    "reviewed": true
  },
  "limit": 10,
  "timestamp": "2025-11-03T12:00:00.000Z"
}
```

---

#### `resume.vector.search.response`

**Purpose:** Return search results

**Message Schema:**

```json
{
  "requestId": "req_search_123",
  "results": [
    {
      "id": "bullet123",
      "score": 0.95,
      "bulletText": "Developed scalable microservices...",
      "metadata": {
        "technologies": ["Docker", "Node.js"],
        "role": "Software Engineer"
      }
    }
  ],
  "total": 15,
  "timestamp": "2025-11-03T12:00:01.000Z"
}
```

---

### 6. LaTeX Compilation Topics

#### `resume.latex.compile.request`

**Purpose:** Request LaTeX compilation to PDF

**Message Schema:**

```json
{
  "requestId": "req_latex_123",
  "resumeId": "resume123",
  "latexContent": "\\documentclass{article}...",
  "options": {
    "engine": "pdflatex",
    "passes": 2
  },
  "timestamp": "2025-11-03T12:00:00.000Z"
}
```

---

#### `resume.latex.compile.response`

**Purpose:** Return compiled PDF

**Message Schema:**

```json
{
  "requestId": "req_latex_123",
  "success": true,
  "pdfUrl": "s3://bucket/resume_123.pdf",
  "logs": "...",
  "timestamp": "2025-11-03T12:00:05.000Z",
  "compilationTime": 5000
}
```

---

## Topic Configuration

### Retention Policy

| Topic Pattern | Retention | Reason |
|--------------|-----------|--------|
| `*.request` | 7 days | Short-term request tracking |
| `*.response` | 7 days | Short-term response tracking |
| `*.job.*` | 30 days | Job history tracking |
| `*.vector.*` | 3 days | Temporary vector operations |

### Partitioning Strategy

| Topic | Partitions | Key |
|-------|-----------|-----|
| `resume.bullet.evaluate.*` | 6 | `userId` |
| `resume.posting.extract.*` | 4 | `userId` |
| `resume.pdf.parse.*` | 4 | `resumeId` |
| `resume.tailoring.job.*` | 8 | `jobId` |
| `resume.vector.*` | 6 | `userId` |
| `resume.latex.*` | 4 | `resumeId` |

### Replication Factor

- **Production**: 3 replicas
- **Development**: 1 replica

---

## Consumer Groups

### Resume Worker Consumers

| Consumer Group | Topics | Purpose |
|---------------|--------|---------|
| `resume-worker-bullet-eval` | `resume.bullet.evaluate.response` | Process bullet evaluations |
| `resume-worker-posting` | `resume.posting.extract.response` | Process job postings |
| `resume-worker-pdf` | `resume.pdf.parse.response` | Process PDF parsing |
| `resume-worker-vector` | `resume.vector.*.response` | Process vector operations |
| `resume-worker-latex` | `resume.latex.compile.response` | Process LaTeX compilation |

### Resume NLP Service Consumers

| Consumer Group | Topics | Purpose |
|---------------|--------|---------|
| `resume-nlp-bullet` | `resume.bullet.evaluate.request` | Evaluate bullets |
| `resume-nlp-posting` | `resume.posting.extract.request` | Extract postings |
| `resume-nlp-pdf` | `resume.pdf.parse.request` | Parse PDFs |

---

## Error Handling

### Dead Letter Topics

Failed messages are sent to dead letter topics:

- `resume.bullet.evaluate.dlq`
- `resume.posting.extract.dlq`
- `resume.pdf.parse.dlq`
- `resume.tailoring.job.dlq`

### Retry Policy

- **Max Retries**: 3
- **Backoff**: Exponential (1s, 2s, 4s)
- **Timeout**: 30 seconds per attempt

---

## Monitoring

### Key Metrics

- `kafka_consumer_lag` - Consumer lag per topic
- `kafka_message_rate` - Messages per second
- `kafka_processing_time` - Message processing duration
- `kafka_error_rate` - Failed message rate

### Alerts

- Consumer lag > 1000 messages
- Error rate > 5%
- Processing time > 10 seconds (p95)

---

## Best Practices

1. **Always include `correlationId`** for request tracing
2. **Set appropriate timeouts** (30s for NLP, 60s for PDF)
3. **Use idempotent consumers** to handle duplicates
4. **Monitor consumer lag** to detect processing issues
5. **Use dead letter topics** for failed messages
6. **Partition by userId** for even load distribution

---

**Last Updated:** November 3, 2025  
**Version:** 1.0.0  
**Kafka Version:** 3.7
