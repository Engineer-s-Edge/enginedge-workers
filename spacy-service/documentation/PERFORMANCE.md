# spaCy Service - Performance Optimization Guide

## Target Performance Metrics

| Metric | Target |
|--------|--------|
| Bullet Evaluation | < 500ms |
| Job Posting Extraction | < 1s |
| PDF Parsing | < 2s |
| Speech Analysis | < 300ms |
| Topic Categorization | < 400ms |

## Optimization Strategies

1. **Model Caching** - Cache loaded spaCy models
2. **Async Processing** - Use async endpoints for I/O operations
3. **Worker Processes** - Run multiple workers for concurrent requests
4. **Batch Processing** - Process multiple items in batch when possible

## Running with Multiple Workers

```bash
uvicorn src.main:app --host 0.0.0.0 --port 8001 --workers 4
```
