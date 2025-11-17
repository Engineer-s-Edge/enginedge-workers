# spaCy Service - Troubleshooting Guide

## Common Issues

### Service Won't Start

**Missing spaCy Model:**
```bash
python -m spacy download en_core_web_sm
```

**Port Already in Use:**
```bash
# Change port
PORT=8002
```

### NLP Processing Errors

**Model Not Found:**
- Ensure spaCy model is downloaded
- Check model path in code

**Memory Issues:**
- Reduce batch size
- Use smaller spaCy models for development

### Kafka Connection Issues

```bash
# Verify Kafka is running
# Check KAFKA_BROKERS environment variable
KAFKA_BROKERS=localhost:9094
```

## Debugging

Enable debug logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```
