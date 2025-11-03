# Resume Worker - AI-Powered Resume Tailoring Platform

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Status](https://img.shields.io/badge/status-production--ready-brightgreen.svg)
![Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0-blue.svg)
![NestJS](https://img.shields.io/badge/nestjs-10.0-red.svg)
![License](https://img.shields.io/badge/license-Proprietary-yellow.svg)

![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)
![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

</div>

---

A production-ready microservice for rapid resume generation, evaluation, and tailoring. Built with hexagonal architecture, this service transforms the time-consuming process of customizing resumes into a matter of minutes.

## 🎯 Overview

<div align="center">

**🚀 Go from Job Posting to Tailored Resume in Minutes**

[![Architecture](https://img.shields.io/badge/architecture-hexagonal-purple.svg)](documentation/ARCHITECTURE.md)
[![API](https://img.shields.io/badge/API-REST-orange.svg)](documentation/API.md)
[![Docs](https://img.shields.io/badge/docs-comprehensive-blue.svg)](documentation/)
[![Monitoring](https://img.shields.io/badge/monitoring-prometheus-orange.svg)](documentation/MONITORING.md)

</div>

The **Resume Worker** is a highly scalable, production-grade microservice that provides:

- **Experience Bank** - Reusable bullet point library with vector search
- **Bullet Evaluator** - 15+ KPI rules for quality assessment
- **Job Posting Extractor** - NLP-based requirement extraction
- **Resume Evaluator** - Comprehensive ATS and quality checks
- **AI Agents** - Builder, Iterator, and Review agents
- **Version Control** - Git-like resume versioning
- **Cover Letter Generator** - Automated tailored cover letters
- **35+ REST API Endpoints** - Comprehensive API coverage

## ✨ Features

<div align="center">

| 📚 **Experience Bank** | 🎯 **Smart Evaluation** | 🤖 **AI Agents** | ⚡ **Real-Time** |
|:---------------------:|:----------------------:|:----------------:|:---------------:|
| Vector Search | 15+ KPI Rules | Builder, Iterator | WebSocket Support |

</div>

### Core Capabilities

| Feature | Description | Status |
|---------|-------------|--------|
| **Experience Bank** | Vector-searchable bullet point library with metadata | ✅ Complete |
| **Bullet Evaluator** | Rule-based quality assessment with auto-fixes | ✅ Complete |
| **Job Posting Extractor** | Extract 20+ fields from job postings | ✅ Complete |
| **Resume Evaluator** | PDF parsing, ATS checks, comprehensive analysis | ✅ Complete |
| **Resume Builder Agent** | Interview mode, codebase analysis | ✅ Complete |
| **Resume Iterator Agent** | Auto/manual improvement modes | ✅ Complete |
| **Bullet Review Agent** | Verification workflow | ✅ Complete |
| **Version Control** | Git-like versioning with diffs | ✅ Complete |
| **Editing Toolkit** | LaTeX operations, undo/redo | ✅ Complete |
| **Cover Letter Generator** | AI-powered tailored letters | ✅ Complete |

### Evaluation Features

- **15+ KPI Checks**:
  - Action verb detection
  - Active voice checking
  - Quantifiable results
  - Conciseness
  - Tense consistency
  - ATS safety
  - Keyword density
  - Grammar validation
  - Structural formulas
  - Fluff detection

- **Auto-Fix Generation** - Rule-based suggestions with confidence scores
- **Gold Dataset** - 10 test examples for validation
- **Role-Specific** - Tailored evaluation for different positions

### AI Agents

- **Resume Builder Agent** - Interview users and analyze codebases to extract experience
- **Resume Iterator Agent** - Automatically improve resumes based on evaluation feedback
- **Bullet Review Agent** - Verify bullet point authenticity through interactive questioning

## 🚀 Quick Start

### Prerequisites

```bash
- Node.js 18+
- npm or yarn
- MongoDB (via platform docker-compose)
- Kafka (via platform docker-compose)
- Python 3.9+ (for NLP service)
```

### Installation

```bash
# Navigate to resume-worker
cd enginedge-workers/resume-worker

# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

Create a `.env` file:

```env
# Server
PORT=3006
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/resume-worker

# Kafka
KAFKA_BROKERS=localhost:9094
KAFKA_TOPIC_PREFIX=resume-worker

# LLM Provider (optional, for LLM-assisted modes)
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# Redis (for BullMQ)
REDIS_URL=redis://localhost:6379/0

# Integration URLs
LATEX_WORKER_URL=http://localhost:3005
ASSISTANT_WORKER_URL=http://localhost:3001
DATA_PROCESSING_WORKER_URL=http://localhost:3003
```

### Running the Service

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run start:prod

# Watch mode
npm run start
```

The service will start on `http://localhost:3006` (or your configured PORT).

### Health Check

```bash
curl http://localhost:3006/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-03T...",
  "uptime": 123.45
}
```

## 📖 Documentation

<div align="center">

Comprehensive documentation is available in the `documentation/` folder:

| 📚 Document | 📝 Description | 🔗 Link |
|------------|---------------|---------|
| **ARCHITECTURE** | System architecture and design patterns | [View](documentation/ARCHITECTURE.md) |
| **API** | Complete API reference for 35+ endpoints | [View](documentation/API.md) |
| **KAFKA_TOPICS** | Kafka topic specifications | [View](documentation/KAFKA_TOPICS.md) |
| **MONITORING** | Prometheus monitoring & Grafana dashboards | [View](documentation/MONITORING.md) |
| **TROUBLESHOOTING** | Common issues and solutions | [View](documentation/TROUBLESHOOTING.md) |
| **PERFORMANCE** | Optimization & tuning guide | [View](documentation/PERFORMANCE.md) |
| **DEPLOYMENT** | Docker & Kubernetes deployment | [View](documentation/DEPLOYMENT.md) |
| **OpenAPI** | Machine-readable API specification | [View](documentation/openapi.yaml) |

</div>

## 🔌 API Examples

### Add Bullet to Experience Bank

```bash
curl -X POST http://localhost:3006/experience-bank/add \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "bulletText": "Developed scalable microservices reducing deployment time by 60%",
    "metadata": {
      "technologies": ["Node.js", "Docker", "Kubernetes"],
      "role": "Software Engineer",
      "company": "Tech Corp"
    }
  }'
```

### Evaluate Resume

```bash
curl -X POST http://localhost:3006/evaluation/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "resumeId": "resume123",
    "mode": "standalone"
  }'
```

### Extract Job Posting

```bash
curl -X POST http://localhost:3006/job-posting/extract \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "url": "https://example.com/job",
    "rawText": "Senior Software Engineer...",
    "mode": "nlp-only"
  }'
```

### Tailor Resume for Job

```bash
curl -X POST http://localhost:3006/tailoring/tailor \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "resumeId": "resume123",
    "jobPostingText": "Senior Software Engineer...",
    "mode": "auto",
    "targetScore": 95
  }'
```

### Generate Cover Letter

```bash
curl -X POST http://localhost:3006/cover-letter/generate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "options": {
      "jobPostingId": "posting123",
      "tone": "professional",
      "length": "medium"
    }
  }'
```

## 🏗️ Architecture

<div align="center">

**Hexagonal Architecture (Ports & Adapters)**

[![Clean Architecture](https://img.shields.io/badge/clean-architecture-blue.svg)](documentation/ARCHITECTURE.md)
[![SOLID](https://img.shields.io/badge/principles-SOLID-green.svg)](documentation/ARCHITECTURE.md)
[![DDD](https://img.shields.io/badge/design-DDD-purple.svg)](documentation/ARCHITECTURE.md)

</div>

```
┌─────────────────────────────────────────┐
│     Infrastructure Layer                 │
│  (Controllers, Gateways, External I/O)  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│       Application Layer                  │
│  (Services, Use Cases, Orchestration)   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│         Domain Layer                     │
│  (Entities, Value Objects, Logic)       │
└─────────────────────────────────────────┘
```

<div align="center">

📊 **[View Detailed Architecture Diagrams →](documentation/ARCHITECTURE.md)**

</div>

## 🧪 Testing

<div align="center">

![Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen.svg)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)
![Unit](https://img.shields.io/badge/unit-passing-brightgreen.svg)

</div>

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e
```

**Test Coverage:** 90%+ with gold dataset validation

## 📊 Metrics & Monitoring

<div align="center">

![Prometheus](https://img.shields.io/badge/prometheus-ready-orange.svg)
![Grafana](https://img.shields.io/badge/grafana-dashboards-orange.svg)
![Metrics](https://img.shields.io/badge/metrics-50%2B-blue.svg)
![Alerts](https://img.shields.io/badge/alerts-configured-red.svg)

</div>

The Resume Worker exposes Prometheus-compatible metrics:

```bash
curl http://localhost:3006/metrics
```

**Key Metrics:**
- `resume_evaluations_total` - Total resume evaluations
- `resume_evaluation_duration_seconds` - Evaluation duration histogram
- `bullet_evaluations_total` - Bullet evaluation counter
- `experience_bank_operations_total` - Experience bank operations
- `http_requests_total` - HTTP request counter
- `http_request_duration_seconds` - HTTP request duration

<div align="center">

**[📊 Complete Metrics Guide →](documentation/MONITORING.md)**

</div>

## 🔧 Configuration

### Resume Evaluation Configuration

```typescript
{
  mode: "standalone",          // standalone, role-guided, jd-match
  targetScore: 95,             // Target quality score (0-100)
  autoFix: true,               // Enable auto-fix suggestions
  includeSwaps: true          // Include bullet swap suggestions
}
```

### Experience Bank Configuration

```typescript
{
  vectorModel: "text-embedding-004",  // Google embedding model
  searchLimit: 10,                     // Max search results
  minImpactScore: 0.7,                // Minimum impact score filter
  reviewedOnly: false                 // Only search reviewed bullets
}
```

## 🚢 Deployment

### Via Platform Docker Compose

```bash
# From platform directory
cd enginedge-core/platform
docker-compose up resume-worker resume-nlp-service
```

### Standalone Docker

```bash
# Build image
docker build -t resume-worker:latest .

# Run container
docker run -p 3006:3006 \
  -e PORT=3006 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/resume-worker \
  -e KAFKA_BROKERS=host.docker.internal:9094 \
  resume-worker:latest
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# Check status
kubectl get pods -l app=resume-worker
```

See [DEPLOYMENT.md](documentation/DEPLOYMENT.md) for detailed deployment instructions.

## 🤝 Contributing

1. Follow hexagonal architecture principles
2. Write tests for all new features (target 90%+ coverage)
3. Use TypeScript strict mode
4. Follow NestJS conventions
5. Update documentation

## 📝 License

UNLICENSED - Proprietary

## 🔗 Related Services

- **Assistant Worker** - AI agent orchestration
- **Data Processing Worker** - Vector embeddings and storage
- **LaTeX Worker** - PDF compilation
- **Agent Tool Worker** - GitHub and web scraping tools
- **Resume NLP Service** - Python NLP processing (spaCy, NLTK)

## 📞 Support

For issues, questions, or contributions:
- GitHub Issues: [link]
- Documentation: `documentation/`
- Troubleshooting: [TROUBLESHOOTING.md](documentation/TROUBLESHOOTING.md)

---

<div align="center">

### 🌟 Star this repo if you find it helpful! 🌟

**Status:** ✅ Production Ready (100% complete)  
**Version:** 1.0.0  
**Last Updated:** November 3, 2025

---

Made with ❤️ by the EnginEdge Team

[![GitHub](https://img.shields.io/badge/github-EnginEdge-black.svg?logo=github)](https://github.com/yourusername/enginedge)
[![Documentation](https://img.shields.io/badge/docs-complete-blue.svg)](documentation/)
[![Support](https://img.shields.io/badge/support-active-green.svg)](documentation/TROUBLESHOOTING.md)

</div>
