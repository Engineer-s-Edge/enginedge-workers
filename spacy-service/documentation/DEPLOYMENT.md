# spaCy Service - Deployment Guide

## Docker Deployment

### Build Image

```bash
docker build -t spacy-service:latest .
```

### Run Container

```bash
docker run -d \
  --name spacy-service \
  -p 8001:8001 \
  -e PORT=8001 \
  -e KAFKA_BROKERS=localhost:9094 \
  spacy-service:latest
```

## Environment Configuration

```env
PORT=8001
KAFKA_BROKERS=localhost:9094
KAFKA_TOPIC_PREFIX=resume-nlp
ALLOWED_ORIGINS=http://localhost:3000
```

## Running Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Download spaCy model
python -m spacy download en_core_web_sm

# Run service
uvicorn src.main:app --reload --host 0.0.0.0 --port 8001
```

## Health Check

```bash
curl http://localhost:8001/health
```
