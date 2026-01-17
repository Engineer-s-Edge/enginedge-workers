# ML Model Integration Documentation

This document describes the ML service integration for the Scheduling Worker, including architecture, API reference, and deployment.

## Overview

The Scheduling Worker integrates with an external ML service (`scheduling-model`) to provide AI-powered scheduling recommendations. The ML service uses Model-Agnostic Meta-Learning (MAML) to learn user preferences and predict optimal time slots.

## ML Service Architecture

### Service Location

- **Service Name:** `scheduling-model`
- **Default URL:** `http://scheduling-model:8000` (Kubernetes)
- **Local Development:** `http://localhost:8000`
- **Protocol:** HTTP/REST
- **Framework:** FastAPI (Python)

### Components

1. **MAML Scheduler** - Core PyTorch model for learning user preferences
2. **Deliverable Mapper** - Transformer-based NLP for task understanding
3. **Training Pipeline** - Model retraining and updates
4. **Prediction API** - REST endpoints for real-time predictions

## API Reference

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "models_initialized": true
}
```

### Map Deliverable

Converts natural language task descriptions into structured features.

```http
POST /map-deliverable
```

**Request:**
```json
{
  "deliverable_text": "Complete project proposal",
  "context": {
    "priority": "high",
    "deadline": "2025-01-15T00:00:00Z"
  }
}
```

**Response:**
```json
{
  "embedding": [0.1, 0.2, ...],
  "category": "work",
  "category_confidence": 0.95,
  "urgency": "high",
  "priority": "high",
  "estimated_duration_hours": 4.5,
  "semantic_features": {
    "complexity": 0.7,
    "requires_focus": true
  }
}
```

### Predict Optimal Slots

Predicts the best time slots for scheduling a task.

```http
POST /predict-slots
```

**Request:**
```json
{
  "user_id": "user_123",
  "deliverable": {
    "title": "Complete project proposal",
    "description": "Write and review project proposal",
    "duration": 240,
    "priority": "high",
    "deadline": "2025-01-15T00:00:00Z"
  },
  "context": {}
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "time_slot": 1,
      "hour": 9,
      "probability": 0.85,
      "confidence": 0.92,
      "recommended": true
    },
    {
      "time_slot": 2,
      "hour": 10,
      "probability": 0.78,
      "confidence": 0.88,
      "recommended": false
    }
  ]
}
```

### Analyze User Patterns

Analyzes a user's scheduling patterns and preferences.

```http
GET /analyze/:userId
```

**Response:**
```json
{
  "preferredHours": [9, 10, 14, 15],
  "mostProductiveHours": [9, 10],
  "averageTaskDuration": 60,
  "completionRate": 0.85
}
```

### Submit Feedback

Submits user feedback for model improvement.

```http
POST /feedback
```

**Request:**
```json
{
  "task_id": "task_123",
  "scheduled_slot": {
    "start_time": "2025-01-10T09:00:00Z",
    "end_time": "2025-01-10T11:00:00Z"
  },
  "ml_score": 0.85,
  "user_accepted": true,
  "user_rating": 5,
  "completed_on_time": true,
  "actual_duration": 120,
  "feedback": "Great timing, very productive"
}
```

## Feature Engineering

The ML model uses the following features for predictions:

### Temporal Features
- Hour of day (0-23)
- Day of week (0-6, Sunday=0)
- Day of month (1-31)
- Week of year (1-52)
- Month (1-12)
- Is weekend (boolean)

### Task Features
- Task duration (minutes)
- Task priority (high/medium/low → numeric)
- Task category (work/personal/health/etc.)
- Task complexity (0-1)
- Deadline proximity (days until deadline)

### User Context Features
- User's historical completion rate (0-1)
- User's preferred hours (array of hours)
- User's peak productivity hours (array of hours)
- Average task duration for user (minutes)
- Current schedule density (events per day)

### Historical Features
- Time since last similar task (hours)
- Historical productivity score for similar tasks (0-1)
- Historical completion rate for time slot (0-1)
- Number of reschedules for similar tasks

## Model Training

### Training Process

1. **Data Collection**
   - User activity events
   - Task completions
   - User feedback
   - Schedule outcomes

2. **Preprocessing**
   - Feature extraction
   - Normalization
   - Handling missing values

3. **Model Training**
   - MAML meta-learning
   - User-specific fine-tuning
   - Validation and testing

4. **Model Deployment**
   - Model versioning
   - A/B testing
   - Gradual rollout

### Triggering Retraining

The model can be retrained:
- Automatically after N new events (configurable)
- On-demand via API
- Scheduled (daily/weekly)

## Deployment

### Environment Variables

```env
# ML Service Configuration
ML_SERVICE_URL=http://scheduling-model:8000
ML_SERVICE_TIMEOUT=10000  # milliseconds

# Activity Model Service
ACTIVITY_MODEL_ENABLED=true
ACTIVITY_PATTERN_UPDATE_INTERVAL=3600  # seconds
```

### Kubernetes Deployment

The ML service runs as a separate microservice:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: scheduling-model
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: model-api
        image: enginedge/scheduling-model:latest
        ports:
        - containerPort: 8000
        env:
        - name: REDIS_URL
          value: "redis://redis-service:6379"
```

### Health Checks

The Scheduling Worker checks ML service health before making predictions:

```typescript
const mlAvailable = await mlClient.healthCheck();
if (!mlAvailable) {
  // Fallback to rule-based scheduling
}
```

## Monitoring

### Metrics

The following metrics are tracked:

- `scheduling_ml_predictions_total` - Total ML predictions
- `scheduling_ml_prediction_duration_seconds` - Prediction latency
- `scheduling_ml_prediction_errors_total` - Prediction errors
- `scheduling_ml_model_accuracy` - Model accuracy (0-1)

### Monitoring Model Performance

1. **Prediction Accuracy**
   - Track predicted vs actual outcomes
   - Monitor user acceptance rates
   - Compare ML recommendations vs user choices

2. **Latency**
   - Monitor prediction response times
   - Set up alerts for high latency
   - Optimize for p95/p99 latencies

3. **Error Rates**
   - Track prediction failures
   - Monitor service availability
   - Alert on high error rates

## Model Updates

### Updating Models

1. **Version Control**
   - Models are versioned
   - Old versions are kept for rollback
   - A/B testing between versions

2. **Rollout Strategy**
   - Gradual rollout (10% → 50% → 100%)
   - Monitor metrics at each stage
   - Rollback if performance degrades

3. **Feature Flags**
   - Use feature flags to enable/disable ML features
   - Allow per-user or per-tenant configuration

## Troubleshooting

### Issue: ML Service Unavailable

**Symptoms:**
- Predictions fail
- Fallback to rule-based scheduling

**Solutions:**
- Check ML service health: `GET /health`
- Verify network connectivity
- Check service logs
- Verify `ML_SERVICE_URL` is correct

### Issue: High Prediction Latency

**Symptoms:**
- Slow response times
- Timeout errors

**Solutions:**
- Check ML service load
- Scale up ML service instances
- Optimize model inference
- Use caching for common predictions

### Issue: Low Prediction Accuracy

**Symptoms:**
- Poor scheduling recommendations
- Low user acceptance rates

**Solutions:**
- Retrain model with more data
- Review feature engineering
- Check for data quality issues
- A/B test different model versions

### Issue: Model Training Failures

**Symptoms:**
- Training jobs fail
- Models not updating

**Solutions:**
- Check training data quality
- Verify sufficient data volume
- Check compute resources
- Review training logs

## Best Practices

1. **Always have a fallback**
   - Rule-based scheduling should work when ML is unavailable
   - Graceful degradation is essential

2. **Monitor continuously**
   - Track prediction accuracy
   - Monitor latency and errors
   - Set up alerts

3. **Version models carefully**
   - Test thoroughly before deployment
   - Use gradual rollouts
   - Keep rollback capability

4. **Collect feedback**
   - Track user acceptance of recommendations
   - Use feedback for model improvement
   - Continuously refine features

5. **Optimize for latency**
   - Cache common predictions
   - Use batch predictions when possible
   - Optimize model inference

## Additional Resources

- [ML Service Repository](../../../enginedge-scheduling-model)
- [MAML Paper](https://arxiv.org/abs/1703.03400)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PyTorch Documentation](https://pytorch.org/docs/)
