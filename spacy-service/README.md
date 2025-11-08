# Resume NLP Service - Python NLP Processing for Resume Worker

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Status](https://img.shields.io/badge/status-production--ready-brightgreen.svg)
![Python](https://img.shields.io/badge/python-3.9%2B-blue.svg)
![FastAPI](https://img.shields.io/badge/fastapi-0.104-green.svg)
![License](https://img.shields.io/badge/license-Proprietary-yellow.svg)

![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)

</div>

---

A production-ready Python microservice providing NLP processing capabilities for the Resume Worker. Built with FastAPI, spaCy, and NLTK, this service handles bullet point evaluation, job posting extraction, and PDF parsing.

## 🎯 Overview

<div align="center">

**🚀 High-Performance NLP Processing**

[![Architecture](https://img.shields.io/badge/architecture-microservice-purple.svg)]()
[![API](https://img.shields.io/badge/API-REST-orange.svg)]()
[![NLP](https://img.shields.io/badge/NLP-spaCy%20%2B%20NLTK-blue.svg)]()

</div>

The **Resume NLP Service** is a specialized Python microservice that provides:

- **Bullet Point Evaluation** - 15+ KPI rules for quality assessment
- **Job Posting Extraction** - NER-based requirement extraction
- **PDF Parsing** - Resume text extraction and layout analysis
- **Text Analysis** - Grammar checking, passive voice detection
- **Kafka Integration** - Asynchronous message processing
- **REST API** - Direct HTTP endpoints for synchronous calls

## ✨ Features

<div align="center">

| 🎯 **Bullet Evaluation** | 📄 **Job Extraction** | 📋 **PDF Parsing** | 🔍 **Text Analysis** |
|:------------------------:|:--------------------:|:------------------:|:-------------------:|
| 15+ KPI Rules | NER-based | PyMuPDF | Grammar & Style |

</div>

### Core Capabilities

| Feature | Description | Status |
|---------|-------------|--------|
| **Bullet Evaluator** | Action verbs, metrics, ATS safety, grammar | ✅ Complete |
| **Posting Extractor** | Skills, experience, compensation extraction | ✅ Complete |
| **Resume Parser** | PDF text extraction, section detection | ✅ Complete |
| **Text Analyzer** | Grammar checks, passive voice detection | ✅ Complete |
| **Kafka Consumer** | Async message processing | ✅ Complete |
| **REST API** | Synchronous HTTP endpoints | ✅ Complete |

### NLP Features

- **spaCy Integration** - NER, POS tagging, dependency parsing
- **NLTK Integration** - Grammar checking, tokenization
- **PyMuPDF** - PDF parsing and layout analysis
- **Regex Patterns** - Skill extraction, compensation parsing
- **Rule-Based Logic** - Deterministic evaluation

## 🚀 Quick Start

### Prerequisites

```bash
- Python 3.9+
- pip
- Kafka (via platform docker-compose)
```

### Installation

```bash
# Navigate to spacy-service
cd enginedge-workers/spacy-service

# Install dependencies
pip install -r requirements.txt

# Download spaCy model
python -m spacy download en_core_web_sm
```

### Configuration

Environment variables:

```env
# Server
PORT=8001

# Kafka
KAFKA_BROKERS=localhost:9094
KAFKA_TOPIC_PREFIX=resume-nlp
```

### Running the Service

```bash
# Development mode
uvicorn src.main:app --reload --host 0.0.0.0 --port 8001

# Production mode with multiple workers
uvicorn src.main:app --host 0.0.0.0 --port 8001 --workers 4
```

The service will start on `http://localhost:8001`.

### Health Check

```bash
curl http://localhost:8001/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "spacy-service",
  "version": "1.0.0"
}
```

## 🔌 API Examples

### Evaluate Bullet Point

```bash
curl -X POST http://localhost:8001/bullet/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "bulletText": "Developed scalable microservices reducing deployment time by 60%",
    "role": "Software Engineer"
  }'
```

Response:
```json
{
  "overallScore": 0.95,
  "passed": true,
  "checks": {
    "actionVerb": {"passed": true, "score": 1.0},
    "quantifiable": {"passed": true, "score": 1.0},
    "activeVoice": {"passed": true, "score": 1.0}
  },
  "suggestedFixes": []
}
```

### Extract Job Posting

```bash
curl -X POST http://localhost:8001/posting/extract \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Senior Software Engineer with 5+ years experience in Python..."
  }'
```

Response:
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

### Parse Resume PDF

```bash
curl -X POST http://localhost:8001/resume/parse \
  -F "file=@resume.pdf"
```

Response:
```json
{
  "text": "John Doe\nSoftware Engineer...",
  "sections": {
    "contact": {...},
    "experience": [...],
    "education": [...]
  },
  "layoutIssues": []
}
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         FastAPI Application              │
│  (REST Endpoints + Kafka Consumer)      │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│           Services Layer                 │
│  (Bullet, Posting, Resume, Text)        │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│         NLP Libraries                    │
│  (spaCy, NLTK, PyMuPDF)                 │
└─────────────────────────────────────────┘
```

## 🧪 Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/test_bullet_evaluator.py -v
```

**Test Coverage:** 90%+ with gold dataset validation

### Gold Dataset

The service includes a gold dataset (`data/gold_bullets.json`) with 10 example bullet points for validation:

```bash
# Run gold dataset tests
pytest tests/test_bullet_evaluator.py::test_gold_dataset_accuracy -v
```

## 📊 Kafka Topics

The service consumes and produces messages on the following topics:

### Consumed Topics

- `resume.bullet.evaluate.request` - Bullet evaluation requests
- `resume.posting.extract.request` - Job posting extraction requests
- `resume.pdf.parse.request` - PDF parsing requests

### Produced Topics

- `resume.bullet.evaluate.response` - Bullet evaluation results
- `resume.posting.extract.response` - Job posting extraction results
- `resume.pdf.parse.response` - PDF parsing results

## 🚢 Deployment

### Via Platform Docker Compose

```bash
# From platform directory
cd enginedge-core/platform
docker-compose up spacy-service
```

### Standalone Docker

```bash
# Build image
docker build -t spacy-service:latest .

# Run container
docker run -p 8001:8001 \
  -e PORT=8001 \
  -e KAFKA_BROKERS=host.docker.internal:9094 \
  spacy-service:latest
```

### Production with Multiple Workers

```bash
# Run with 4 workers for better performance
uvicorn src.main:app --host 0.0.0.0 --port 8001 --workers 4
```

## 🔧 Configuration

### Bullet Evaluator Configuration

The evaluator checks for:
- Action verbs (150+ verbs)
- Active voice
- Quantifiable results (numbers, percentages, metrics)
- Conciseness (20-150 characters)
- Tense consistency
- ATS safety (no special characters/emojis)
- Keywords and technical terms
- Fluff words (avoid buzzwords)
- Grammar correctness
- Structural formulas (XYZ, APR, CAR, STAR)

### Job Posting Extractor Configuration

Extracts:
- Role and seniority level
- Required/preferred skills
- Years of experience
- Education requirements
- Compensation range
- Location and remote policy
- Benefits
- Responsibilities

## 📝 Dependencies

```
fastapi==0.104.1
uvicorn==0.24.0
spacy==3.7.2
nltk==3.8.1
pymupdf==1.23.8
kafka-python==2.0.2
pydantic==2.5.0
```

## 🤝 Contributing

1. Follow PEP 8 style guide
2. Write tests for all new features
3. Use type hints
4. Update documentation

## 📝 License

UNLICENSED - Proprietary

## 🔗 Related Services

- **Resume Worker** - Main NestJS service orchestrating resume operations
- **Data Processing Worker** - Vector embeddings and storage
- **Assistant Worker** - AI agent orchestration

## 📞 Support

For issues, questions, or contributions:
- GitHub Issues: [link]
- Documentation: See resume-worker `documentation/`

---

<div align="center">

**Status:** ✅ Production Ready (100% complete)
**Version:** 1.0.0
**Last Updated:** November 3, 2025

---

Made with ❤️ by the EnginEdge Team

[![GitHub](https://img.shields.io/badge/github-EnginEdge-black.svg?logo=github)](https://github.com/yourusername/enginedge)
[![Support](https://img.shields.io/badge/support-active-green.svg)]()

</div>
