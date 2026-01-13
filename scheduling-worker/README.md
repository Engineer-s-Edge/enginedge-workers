# Scheduling Worker - Intelligent Calendar & Task Management

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Status](https://img.shields.io/badge/status-production--ready-brightgreen.svg)
![Coverage](https://img.shields.io/badge/coverage-92%25-brightgreen.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0-blue.svg)
![NestJS](https://img.shields.io/badge/nestjs-10.0-red.svg)
![License](https://img.shields.io/badge/license-Proprietary-yellow.svg)

![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Tests](https://img.shields.io/badge/tests-150%2B%20passing-brightgreen.svg)
![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

</div>

---

An intelligent scheduling microservice that integrates Google Calendar with habit tracking, goal management, and ML-powered task optimization.

## 🎯 Overview

<div align="center">

**🚀 Intelligent Calendar & Task Management Platform**

[![Architecture](https://img.shields.io/badge/architecture-hexagonal-purple.svg)](documentation/ARCHITECTURE.md)
[![API](https://img.shields.io/badge/API-REST-orange.svg)](documentation/API.md)
[![Docs](https://img.shields.io/badge/docs-comprehensive-blue.svg)](documentation/)
[![Google Calendar](https://img.shields.io/badge/google-calendar-blue.svg)](documentation/CALENDAR_INTEGRATION.md)

</div>

The **Scheduling Worker** provides comprehensive calendar and task management with:

- **Google Calendar Sync** - Bidirectional calendar integration
- **Habit Tracking** - Automated habit scheduling and reminders
- **Goal Management** - SMART goal setting and progress tracking
- **ML Task Scheduling** - AI-powered optimal time slot recommendations
- **Event Management** - Create, update, and manage calendar events
- **Smart Notifications** - Intelligent reminder system

## ✨ Features

<div align="center">

| 📅 **Calendar Sync** | 🎯 **Goal Tracking** | 🤖 **ML Scheduling** | 📱 **Smart Alerts** |
|:--------------------:|:--------------------:|:-------------------:|:------------------:|
| Google Calendar | SMART Goals | Time Optimization | Intelligent Reminders |

</div>

### Calendar Integration

- **Bidirectional Sync** - Changes sync both ways with Google Calendar
- **Multiple Calendars** - Support for personal and shared calendars
- **Event Types** - Meetings, tasks, reminders, all-day events
- **Conflict Resolution** - Automatic conflict detection and resolution
- **Timezone Handling** - Proper timezone conversion and display

### Habit & Goal Management

- **Habit Tracking** - Daily, weekly, monthly habit scheduling
- **Goal Setting** - SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- **Progress Monitoring** - Visual progress tracking and analytics
- **Streak Tracking** - Maintain motivation with streak counters
- **Reminder System** - Customizable notifications and alerts
- **Activity Model Service** - Track user activity patterns, predict event success, calculate efficiency metrics

### ML-Powered Scheduling

- **Optimal Time Slots** - AI recommendations for best meeting times
- **Productivity Analysis** - Learn user preferences and patterns
- **Conflict Prediction** - Prevent scheduling conflicts
- **Priority Optimization** - Schedule high-priority tasks first
- **Energy-Based Scheduling** - Schedule tasks based on energy levels
- **Activity Tracking** - Track completion patterns and productivity metrics
- **Efficiency Metrics** - Calculate schedule efficiency, time utilization, and completion rates

## 🚀 Quick Start

### Prerequisites

```bash
- Node.js 18+
- npm or yarn
- Google Cloud Project (for Calendar API)
- Redis (optional, for caching)
- PostgreSQL (optional, for persistence)
```

### Installation

```bash
# Navigate to scheduling-worker
cd enginedge-workers/scheduling-worker

# Install dependencies
npm install

# Build the project
npm run build
```

### Google Calendar Setup

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable Calendar API**
   - Enable Google Calendar API
   - Create OAuth 2.0 credentials

3. **Configure Environment**
   ```env
   # Google Calendar API
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3007/auth/google/callback

   # Server
   PORT=3007
   NODE_ENV=development
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

The service will start on `http://localhost:3007` (or your configured PORT).

### Health Check

```bash
curl http://localhost:3007/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-27T...",
  "uptime": 123.45,
  "googleCalendar": {
    "connected": true,
    "lastSync": "2025-10-27T..."
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
| **CALENDAR_SETUP** | Google Calendar setup guide | [View](documentation/CALENDAR_SETUP.md) |
| **ML_INTEGRATION** | ML service integration documentation | [View](documentation/ML_INTEGRATION.md) |
| **CALENDAR_INTEGRATION** | Google Calendar integration details | [View](documentation/CALENDAR_INTEGRATION.md) |
| **GOAL_MANAGEMENT** | Goal and habit tracking guide | [View](documentation/GOAL_MANAGEMENT.md) |
| **ML_SCHEDULING** | AI-powered scheduling features | [View](documentation/ML_SCHEDULING.md) |
| **DEPLOYMENT** | Docker & Kubernetes deployment | [View](documentation/DEPLOYMENT.md) |
| **TROUBLESHOOTING** | Common issues and solutions | [View](documentation/TROUBLESHOOTING.md) |

</div>

## 🔌 API Examples

### Google Calendar Integration

```bash
# Authenticate with Google
curl http://localhost:3007/auth/google

# Get calendar list
curl http://localhost:3007/calendars \
  -H "Authorization: Bearer your_token"

# Create calendar event
curl -X POST http://localhost:3007/events \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Team Meeting",
    "start": {
      "dateTime": "2025-10-28T10:00:00Z"
    },
    "end": {
      "dateTime": "2025-10-28T11:00:00Z"
    },
    "attendees": [
      {"email": "attendee@example.com"}
    ]
  }'
```

### Goal Management

```bash
# Create a goal
curl -X POST http://localhost:3007/goals \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Complete Project Alpha",
    "description": "Finish all deliverables for Project Alpha",
    "type": "project",
    "targetDate": "2025-12-31",
    "metrics": {
      "completion": 0,
      "target": 100
    }
  }'

# Get goal progress
curl http://localhost:3007/goals/project-alpha/progress \
  -H "Authorization: Bearer your_token"
```

### Habit Tracking

```bash
# Create a habit
curl -X POST http://localhost:3007/habits \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Morning Exercise",
    "description": "30 minutes of exercise every morning",
    "frequency": "daily",
    "targetTime": "07:00",
    "reminders": true
  }'

# Mark habit as completed
curl -X POST http://localhost:3007/habits/morning-exercise/complete \
  -H "Authorization: Bearer your_token" \
  -d '{"date": "2025-10-27"}'
```

### ML-Powered Scheduling

```bash
# Get optimal meeting time
curl -X POST http://localhost:3007/schedule/optimize \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Product Review",
    "duration": 60,
    "attendees": ["user1@example.com", "user2@example.com"],
    "preferences": {
      "dayOfWeek": "monday",
      "timeRange": "09:00-17:00"
    }
  }'

# Response includes optimal time slot with confidence score
{
  "recommendedTime": "2025-10-28T14:00:00Z",
  "confidence": 0.85,
  "reasoning": "High availability, optimal productivity time"
}
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
│  (Google Calendar API, Database, Redis) │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│       Application Layer                  │
│  (Scheduling Use Cases, ML Services)    │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│         Domain Layer                     │
│  (Calendar, Goal, Habit, Event Entities)│
└─────────────────────────────────────────┘
```

## 🧪 Testing

<div align="center">

![Coverage](https://img.shields.io/badge/coverage-92%25-brightgreen.svg)
![Tests](https://img.shields.io/badge/tests-150%2B-brightgreen.svg)

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

The Scheduling Worker exposes Prometheus-compatible metrics:

```bash
curl http://localhost:3007/metrics
```

**Key Metrics:**
- `scheduling_events_total` - Total calendar events processed
- `scheduling_sync_duration_seconds` - Calendar sync duration histogram
- `scheduling_goals_completed_total` - Completed goals counter
- `scheduling_ml_recommendations_total` - ML scheduling recommendations
- `scheduling_api_requests_total` - API request counter

## 🔧 Configuration

### Calendar Configuration

```typescript
{
  syncInterval: 300000,        // 5 minutes
  maxRetries: 3,              // Retry failed syncs
  batchSize: 50,              // Events per batch
  timezone: 'America/New_York',
  defaultCalendarId: 'primary'
}
```

### ML Scheduling Configuration

```typescript
{
  modelVersion: 'v1.0',
  confidenceThreshold: 0.7,
  features: ['availability', 'productivity', 'preferences'],
  learningRate: 0.01,
  maxIterations: 1000
}
```

## 🚢 Deployment

### Docker

```bash
# Build image
docker build -t scheduling-worker:latest .

# Run container
docker run -p 3007:3007 \
  -e GOOGLE_CLIENT_ID=your_id \
  -e GOOGLE_CLIENT_SECRET=your_secret \
  scheduling-worker:latest
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# Check status
kubectl get pods -l app=scheduling-worker
```

## 🤝 Contributing

1. Follow hexagonal architecture principles
2. Write tests for all new features
3. Update documentation
4. Use TypeScript strict mode

## 📝 License

[Your License Here]

## 🔗 Related Services

- **Assistant Worker** - AI-powered task suggestions
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
