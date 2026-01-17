# spaCy Service - API Documentation

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Bullet Evaluation API](#bullet-evaluation-api)
- [Job Posting Extraction API](#job-posting-extraction-api)
- [PDF Parsing API](#pdf-parsing-api)
- [Speech Analysis API](#speech-analysis-api)
- [Topic Categorization API](#topic-categorization-api)
- [Health Check](#health-check)

---

## Overview

The spaCy Service exposes **REST API endpoints** for NLP processing:

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Bullet Evaluation** | 1 | Evaluate resume bullet points |
| **Job Posting Extraction** | 1 | Extract structured data from job postings |
| **PDF Parsing** | 1 | Parse resume PDFs |
| **Speech Analysis** | 1 | Analyze speech transcriptions |
| **Topic Categorization** | 4 | Categorize and analyze topics |
| **Health** | 1 | Health check |

---

## Base URL

```
Development: http://localhost:8001
Production: https://spacy.yourdomain.com
```

---

## Bullet Evaluation API

### Evaluate Bullet Point

**Endpoint:** `POST /evaluate-bullet`

**Description:** Evaluate a resume bullet point for quality (100+ KPIs)

**Request:**
```json
{
  "bullet": "Developed scalable microservices reducing deployment time by 60%",
  "targetRole": "Software Engineer",
  "targetKeywords": ["microservices", "scalability"],
  "isCurrentRole": false
}
```

**Response:** `200 OK`
```json
{
  "score": 0.95,
  "kpis": {
    "actionVerb": {"passed": true, "score": 1.0},
    "quantifiable": {"passed": true, "score": 1.0},
    "activeVoice": {"passed": true, "score": 1.0}
  },
  "autoFixes": [],
  "feedback": "Excellent bullet point with strong metrics"
}
```

---

## Job Posting Extraction API

### Extract Job Posting

**Endpoint:** `POST /extract-posting`

**Description:** Extract structured data from a job posting

**Request:**
```json
{
  "text": "Senior Software Engineer with 5+ years experience in Python...",
  "html": "<html>...</html>"
}
```

**Response:** `200 OK`
```json
{
  "parsed": {
    "role": {
      "titleRaw": "Senior Software Engineer",
      "seniorityInferred": "Senior"
    },
    "skills": {
      "skillsExplicit": ["Python", "AWS", "Docker"]
    },
    "experience": {
      "monthsMin": 60
    }
  },
  "confidence": 0.85
}
```

---

## PDF Parsing API

### Parse Resume PDF

**Endpoint:** `POST /parse-pdf`

**Description:** Parse a resume PDF and extract structured data

**Request:** `multipart/form-data`
- `pdfBytes` (file) - PDF file bytes

**Response:** `200 OK`
```json
{
  "metadata": {
    "pages": 2,
    "title": "Resume"
  },
  "sections": {
    "contact": {...},
    "experience": [...],
    "education": [...]
  },
  "rawText": "John Doe\nSoftware Engineer..."
}
```

---

## Speech Analysis API

### Analyze Speech

**Endpoint:** `POST /analyze-speech`

**Description:** Analyze speech transcription for filler words and patterns

**Request:**
```json
{
  "text": "So, um, I think that, you know, we should...",
  "durationSeconds": 60.0
}
```

**Response:** `200 OK`
```json
{
  "fillers": ["um", "uh", "you know"],
  "frequency": 2.5,
  "confidence": 0.92,
  "patterns": ["so", "um"],
  "totalWords": 120,
  "fillerCount": 5
}
```

---

## Topic Categorization API

### Categorize Topic

**Endpoint:** `POST /categorize-topic`

**Description:** Categorize a topic using spaCy semantic analysis

**Request:**
```json
{
  "topicName": "Machine Learning",
  "description": "Deep learning and neural networks",
  "existingCategories": ["Technology", "Science"]
}
```

**Response:** `200 OK`
```json
{
  "suggestedCategory": "Technology",
  "confidence": 0.88,
  "keywords": ["machine learning", "deep learning", "neural networks"],
  "entities": [...],
  "similarityScores": {
    "Technology": 0.88,
    "Science": 0.75
  },
  "reasoning": "High similarity to Technology category based on keywords"
}
```

---

## Health Check

**Endpoint:** `GET /health`

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "service": "spacy-service",
  "version": "2.0.0"
}
```

---

For complete OpenAPI 3.0 specification, see [openapi.yaml](openapi.yaml).
