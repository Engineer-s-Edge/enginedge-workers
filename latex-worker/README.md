# LaTeX Worker - Document Compilation Service

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Status](https://img.shields.io/badge/status-production--ready-brightgreen.svg)
![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0-blue.svg)
![NestJS](https://img.shields.io/badge/nestjs-10.0-red.svg)
![License](https://img.shields.io/badge/license-Proprietary-yellow.svg)

![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Tests](https://img.shields.io/badge/tests-200%2B%20passing-brightgreen.svg)
![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

</div>

---

A production-ready microservice for XeLaTeX document compilation with advanced features like multi-format output, template management, and real-time compilation status.

## 🎯 Overview

<div align="center">

**🚀 Production-Grade LaTeX Compilation Service**

[![Architecture](https://img.shields.io/badge/architecture-hexagonal-purple.svg)](documentation/ARCHITECTURE.md)
[![API](https://img.shields.io/badge/API-REST-orange.svg)](documentation/API.md)
[![Docs](https://img.shields.io/badge/docs-comprehensive-blue.svg)](documentation/)
[![Monitoring](https://img.shields.io/badge/monitoring-prometheus-orange.svg)](documentation/MONITORING.md)

</div>

The **LaTeX Worker** provides enterprise-grade document compilation with:

- **Multi-Format Output** - PDF, DVI, PS, HTML conversion
- **Template Management** - Pre-built and custom templates
- **Real-time Status** - Live compilation progress tracking
- **Error Handling** - Detailed error reporting and recovery
- **Batch Processing** - Compile multiple documents concurrently
- **Security** - Sandboxed compilation environment

## ✨ Features

<div align="center">

| 📄 **Multi-Format** | 🎨 **Templates** | 📊 **Real-Time** | 🔒 **Security** |
|:-------------------:|:---------------:|:---------------:|:--------------:|
| PDF, DVI, PS, HTML | 50+ Templates | Live Status | Sandboxed |

</div>

### Compilation Features

- **XeLaTeX Engine** - Unicode support and modern font handling
- **Multi-Pass Compilation** - Automatic bibliography and index generation
- **Error Recovery** - Intelligent retry mechanisms
- **Resource Limits** - Memory and CPU constraints
- **Timeout Protection** - Prevents hanging compilations

### Output Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| **PDF** | Portable Document Format | Final publications, sharing |
| **DVI** | Device Independent Format | Intermediate processing |
| **PS** | PostScript | Printing, legacy systems |
| **HTML** | HyperText Markup Language | Web publishing |

### Template System

- **Academic Templates** - IEEE, ACM, MLA formats
- **Business Templates** - Reports, proposals, invoices
- **Presentation Templates** - Beamer slides
- **Custom Templates** - Upload your own .sty and .cls files

## 🚀 Quick Start

### Prerequisites

```bash
- Node.js 18+
- npm or yarn
- XeLaTeX (texlive-xetex)
- ImageMagick (optional, for image processing)
```

### Installation

```bash
# Navigate to latex-worker
cd enginedge-workers/latex-worker

# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

Create a `.env` file:

```env
# Server
PORT=3005
NODE_ENV=development

# LaTeX Configuration
XELATEX_TIMEOUT=30000
MAX_COMPILATION_TIME=60000
MAX_MEMORY_MB=512

# File Storage
UPLOAD_DIR=./uploads
OUTPUT_DIR=./outputs
TEMP_DIR=./temp

# Security
ALLOWED_EXTENSIONS=tex,sty,cls,bib,png,jpg,jpeg,pdf
MAX_FILE_SIZE_MB=10

# Kafka (optional)
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC_PREFIX=latex-worker
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

The service will start on `http://localhost:3005` (or your configured PORT).

### Health Check

```bash
curl http://localhost:3005/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-27T...",
  "uptime": 123.45,
  "xelatex": {
    "available": true,
    "version": "XeTeX 3.141592653-2.6-0.999996"
  }
}
```

## 📖 Documentation

<div align="center">

Comprehensive documentation is available in the `documentation/` folder:

| 📚 Document | 📝 Description | 🔗 Link |
|------------|---------------|---------|
| **ARCHITECTURE** | System architecture and design | [View](documentation/ARCHITECTURE.md) |
| **API** | Complete API reference | [View](documentation/API.md) |
| **MONITORING** | Prometheus metrics & Grafana dashboards | [View](documentation/MONITORING.md) |
| **DEPLOYMENT** | Docker & Kubernetes deployment | [View](documentation/DEPLOYMENT.md) |
| **TROUBLESHOOTING** | Common issues and solutions | [View](documentation/TROUBLESHOOTING.md) |
| **PERFORMANCE** | Optimization guide | [View](documentation/PERFORMANCE.md) |
| **PRODUCTION_READINESS** | Production deployment checklist | [View](documentation/PRODUCTION_READINESS.md) |

</div>

## 🔌 API Examples

### Compile LaTeX Document

```bash
curl -X POST http://localhost:3005/compile \
  -F "file=@document.tex" \
  -F "outputFormat=pdf" \
  -F "template=article"
```

### Upload and Compile

```bash
# Upload document
curl -X POST http://localhost:3005/documents/upload \
  -F "file=@document.tex"

# Response: { "documentId": "abc123" }

# Compile uploaded document
curl -X POST http://localhost:3005/documents/abc123/compile \
  -H "Content-Type: application/json" \
  -d '{
    "outputFormat": "pdf",
    "template": "article",
    "options": {
      "enableShellEscape": false,
      "generateIndex": true
    }
  }'
```

### Get Compilation Status

```bash
curl http://localhost:3005/documents/abc123/status
```

Response:
```json
{
  "documentId": "abc123",
  "status": "completed",
  "progress": 100,
  "outputUrl": "/documents/abc123/download/pdf",
  "logs": [
    "This is XeTeX, Version 3.141592653-2.6-0.999996",
    "Output written on document.pdf (1 page)."
  ]
}
```

### Batch Compilation

```bash
curl -X POST http://localhost:3005/batch/compile \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      { "id": "doc1", "template": "article" },
      { "id": "doc2", "template": "report" }
    ],
    "outputFormat": "pdf"
  }'
```

### Template Management

```bash
# List available templates
curl http://localhost:3005/templates

# Upload custom template
curl -X POST http://localhost:3005/templates/upload \
  -F "name=my-template" \
  -F "files=@template.sty" \
  -F "files=@template.cls"
```

## 🏗️ Architecture

<div align="center">

**Hexagonal Architecture (Ports & Adapters)**

[![Clean Architecture](https://img.shields.io/badge/clean-architecture-blue.svg)](documentation/ARCHITECTURE.md)
[![SOLID](https://img.shields.io/badge/principles-SOLID-green.svg)](documentation/ARCHITECTURE.md)

</div>

```
┌─────────────────────────────────────────┐
│     Infrastructure Layer                 │
│  (XeLaTeX Process, File System, HTTP)   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│       Application Layer                  │
│  (Compilation Use Cases, Services)      │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│         Domain Layer                     │
│  (Document, Template, Compilation)      │
└─────────────────────────────────────────┘
```

## 🧪 Testing

<div align="center">

![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen.svg)
![Tests](https://img.shields.io/badge/tests-200%2B-brightgreen.svg)

</div>

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov

# Run E2E tests
npm run test:e2e
```

## 📊 Metrics & Monitoring

The LaTeX Worker exposes Prometheus-compatible metrics:

```bash
curl http://localhost:3005/metrics
```

**Key Metrics:**
- `latex_compilations_total` - Total compilation attempts
- `latex_compilations_success_total` - Successful compilations
- `latex_compilation_duration_seconds` - Compilation duration histogram
- `latex_file_uploads_total` - File upload counter
- `latex_template_usage_total` - Template usage counter

## 🔧 Configuration

### Compilation Options

```typescript
{
  outputFormat: "pdf",          // pdf, dvi, ps, html
  template: "article",          // Template name
  timeout: 30000,              // Timeout in ms
  maxMemory: 512,              // Max memory in MB
  enableShellEscape: false,    // Allow shell commands
  generateIndex: true,         // Generate index
  bibliography: true,          // Process bibliography
  cleanUp: true               // Remove temp files
}
```

## 🚢 Deployment

### Docker

```bash
# Build image with XeLaTeX
docker build -t latex-worker:latest .

# Run container
docker run -p 3005:3005 \
  -v /tmp/latex-worker:/app/temp \
  latex-worker:latest
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# Check status
kubectl get pods -l app=latex-worker
```

## 🤝 Contributing

1. Follow hexagonal architecture principles
2. Write tests for all new features
3. Update documentation
4. Use TypeScript strict mode

## 📝 License

[Your License Here]

## 🔗 Related Services

- **Data Processing Worker** - Document preprocessing
- **Main Node** - Core orchestration service

## 📞 Support

For issues, questions, or contributions:
- GitHub Issues: [link]
- Documentation: `documentation/`
- Troubleshooting: [TROUBLESHOOTING.md](documentation/TROUBLESHOOTING.md)

---

<div align="center">

### 🌟 Star this repo if you find it helpful! 🌟

**Status:** ✅ Production Ready  
**Version:** 1.0.0  
**Last Updated:** October 27, 2025

---

Made with ❤️ by the EnginEdge Team

</div>
