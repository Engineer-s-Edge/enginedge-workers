# Resume Worker - Documentation

Welcome to the Resume Worker documentation! This directory contains comprehensive guides for understanding, deploying, and operating the Resume Worker service.

## 📚 Documentation Index

| Document | Description | Status |
|----------|-------------|--------|
| **[API.md](API.md)** | Complete API reference for 35+ endpoints | ✅ Complete |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System architecture and design patterns | ✅ Complete |
| **[KAFKA_TOPICS.md](KAFKA_TOPICS.md)** | Kafka topic specifications and message formats | ✅ Complete |
| **[MONITORING.md](MONITORING.md)** | Prometheus metrics and Grafana dashboards | ✅ Complete |
| **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** | Common issues and solutions | ✅ Complete |
| **[PERFORMANCE.md](PERFORMANCE.md)** | Performance tuning and optimization | ✅ Complete |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Docker and Kubernetes deployment guides | ✅ Complete |
| **[openapi.yaml](openapi.yaml)** | Machine-readable OpenAPI specification | ✅ Complete |

## 🚀 Quick Links

### For Developers
- **Getting Started**: See main [README.md](../README.md)
- **API Reference**: [API.md](API.md)
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)

### For DevOps
- **Deployment**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Monitoring**: [MONITORING.md](MONITORING.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

### For Performance Engineers
- **Performance**: [PERFORMANCE.md](PERFORMANCE.md)
- **Kafka Topics**: [KAFKA_TOPICS.md](KAFKA_TOPICS.md)

## 📖 Documentation Overview

### API Documentation
Complete REST API reference with request/response examples for all 35+ endpoints including:
- Experience Bank operations
- Resume evaluation
- Job posting extraction
- Resume tailoring workflow
- Cover letter generation
- WebSocket gateways

### Architecture Documentation
Detailed system architecture including:
- Hexagonal architecture layers
- Service interactions
- Data flow diagrams
- Integration patterns
- Technology stack

### Kafka Topics
Specifications for all Kafka topics:
- Message formats
- Topic naming conventions
- Producer/consumer patterns
- Error handling

### Monitoring
Prometheus metrics and Grafana dashboards:
- 50+ custom metrics
- Pre-built dashboards
- Alert configurations
- Performance monitoring

### Troubleshooting
Common issues and solutions:
- Service startup problems
- Kafka connectivity
- MongoDB issues
- Performance problems
- Error scenarios

### Performance
Optimization guides:
- Throughput tuning
- Latency optimization
- Resource management
- Scaling strategies

### Deployment
Production deployment guides:
- Docker configuration
- Kubernetes manifests
- Helm charts
- Environment setup
- High availability

## 🎯 Key Features Documented

- **Experience Bank**: Vector search, metadata filtering, deduplication
- **Bullet Evaluator**: 15+ KPI rules, auto-fix generation, gold dataset
- **Job Posting Extractor**: NER-based extraction, 20+ fields
- **Resume Evaluator**: PDF parsing, ATS checks, comprehensive analysis
- **AI Agents**: Builder, Iterator, Review agents with WebSocket support
- **Version Control**: Git-like versioning with diffs and rollback
- **Cover Letter Generator**: AI-powered tailored letter generation

## 🔗 External Resources

- **Main Repository**: [EnginEdge GitHub](https://github.com/yourusername/enginedge)
- **Related Services**:
  - [Assistant Worker](../../assistant-worker/documentation/)
  - [Data Processing Worker](../../data-processing-worker/documentation/)
  - [LaTeX Worker](../../latex-worker/documentation/)
  - [Resume NLP Service](../../spacy-service/)

## 📝 Contributing to Documentation

When updating documentation:

1. **Keep it current**: Update docs when making code changes
2. **Be comprehensive**: Include examples and edge cases
3. **Use diagrams**: Visual aids improve understanding
4. **Test examples**: Ensure all code examples work
5. **Cross-reference**: Link related documentation

## 🆘 Getting Help

If you can't find what you're looking for:

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review [API.md](API.md) for endpoint details
3. See main [README.md](../README.md) for quick start
4. Open a GitHub issue

---

**Last Updated**: November 3, 2025
**Version**: 1.0.0
**Status**: ✅ Production Ready
