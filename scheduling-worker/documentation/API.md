# Scheduling Worker - API Reference

## Overview

The Scheduling Worker provides RESTful APIs for calendar management, goal tracking, habit management, and intelligent scheduling.

## Authentication

All API endpoints require authentication via JWT token or Google OAuth:

```
Authorization: Bearer <your_jwt_token>
```

## Calendar API

### Get Calendars
```http
GET /calendars
```

**Response:**
```json
{
  "calendars": [
    {
      "id": "primary",
      "name": "Primary Calendar",
      "primary": true,
      "accessRole": "owner",
      "backgroundColor": "#3788d8"
    }
  ]
}
```

### Get Events
```http
GET /events?calendarId=primary&start=2025-01-01T00:00:00Z&end=2025-12-31T23:59:59Z
```

**Parameters:**
- `calendarId`: Calendar identifier
- `start`: Start date (ISO 8601)
- `end`: End date (ISO 8601)
- `maxResults`: Maximum number of events (default: 250)

**Response:**
```json
{
  "events": [
    {
      "id": "event_id",
      "summary": "Team Meeting",
      "start": {
        "dateTime": "2025-10-28T10:00:00Z"
      },
      "end": {
        "dateTime": "2025-10-28T11:00:00Z"
      },
      "attendees": [
        {
          "email": "attendee@example.com",
          "responseStatus": "accepted"
        }
      ]
    }
  ]
}
```

### Create Event
```http
POST /events
```

**Request Body:**
```json
{
  "calendarId": "primary",
  "summary": "New Meeting",
  "start": {
    "dateTime": "2025-10-28T14:00:00Z"
  },
  "end": {
    "dateTime": "2025-10-28T15:00:00Z"
  },
  "attendees": [
    {"email": "person1@example.com"},
    {"email": "person2@example.com"}
  ],
  "description": "Weekly sync meeting"
}
```

## Goal Management API

### Create Goal
```http
POST /goals
```

**Request Body:**
```json
{
  "title": "Complete Project Alpha",
  "description": "Finish all deliverables for Project Alpha",
  "type": "project",
  "targetDate": "2025-12-31T23:59:59Z",
  "metrics": {
    "completion": 0,
    "target": 100,
    "unit": "percentage"
  },
  "milestones": [
    {
      "title": "Phase 1 Complete",
      "targetDate": "2025-11-15",
      "completion": 25
    }
  ]
}
```

### Update Goal Progress
```http
PUT /goals/{goalId}/progress
```

**Request Body:**
```json
{
  "completion": 75,
  "notes": "Completed database schema design",
  "timestamp": "2025-10-27T10:00:00Z"
}
```

### Get Goal Analytics
```http
GET /goals/{goalId}/analytics
```

**Response:**
```json
{
  "goalId": "goal_123",
  "progress": 75,
  "velocity": 2.5,  // progress per day
  "estimatedCompletion": "2025-11-20T00:00:00Z",
  "milestones": [
    {
      "id": "milestone_1",
      "title": "Phase 1 Complete",
      "completed": true,
      "completionDate": "2025-10-25T00:00:00Z"
    }
  ]
}
```

## Habit Tracking API

### Create Habit
```http
POST /habits
```

**Request Body:**
```json
{
  "name": "Morning Exercise",
  "description": "30 minutes of cardio exercise",
  "frequency": "daily",
  "targetTime": "07:00",
  "duration": 30,
  "reminders": {
    "enabled": true,
    "advanceNotice": 15  // minutes before
  },
  "category": "health"
}
```

### Mark Habit Complete
```http
POST /habits/{habitId}/complete
```

**Request Body:**
```json
{
  "date": "2025-10-27",
  "notes": "Great workout session",
  "duration": 35
}
```

### Get Habit Streak
```http
GET /habits/{habitId}/streak
```

**Response:**
```json
{
  "currentStreak": 12,
  "longestStreak": 28,
  "lastCompleted": "2025-10-27T07:30:00Z",
  "nextDue": "2025-10-28T07:00:00Z"
}
```

## ML Scheduling API

### Optimize Meeting Time
```http
POST /schedule/optimize
```

**Request Body:**
```json
{
  "title": "Product Review Meeting",
  "duration": 60,  // minutes
  "attendees": [
    "user1@example.com",
    "user2@example.com"
  ],
  "preferences": {
    "dayOfWeek": ["monday", "wednesday", "friday"],
    "timeRange": {
      "start": "09:00",
      "end": "17:00"
    },
    "avoidConflicts": true,
    "optimizeProductivity": true
  },
  "constraints": {
    "maxSuggestions": 5,
    "minConfidence": 0.7
  }
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "startTime": "2025-10-28T14:00:00Z",
      "endTime": "2025-10-28T15:00:00Z",
      "confidence": 0.85,
      "reasoning": "High availability for all attendees, optimal productivity time",
      "availability": {
        "user1@example.com": "available",
        "user2@example.com": "available"
      }
    }
  ]
}
```

### Get Scheduling Insights
```http
GET /schedule/insights?user=user1@example.com&period=30d
```

**Response:**
```json
{
  "user": "user1@example.com",
  "insights": {
    "peakProductivityHours": ["10:00-12:00", "14:00-16:00"],
    "preferredDays": ["monday", "tuesday", "wednesday"],
    "averageMeetingDuration": 45,
    "conflictRate": 0.15,
    "recommendations": [
      "Schedule important meetings between 10-12",
      "Avoid Friday afternoons for complex discussions"
    ]
  }
}
```

## Command Processing API

### Submit Command
```http
POST /commands
```

**Request Body:**
```json
{
  "taskId": "task_123",
  "taskType": "SCHEDULE_HABITS",
  "payload": {
    "userId": "user123",
    "date": "2025-10-27"
  }
}
```

**Response:**
```json
{
  "taskId": "task_123",
  "status": "accepted",
  "estimatedCompletion": "2025-10-27T00:05:00Z"
}
```

### Get Command Status
```http
GET /commands/{taskId}
```

**Response:**
```json
{
  "taskId": "task_123",
  "status": "completed",
  "result": {
    "habitsScheduled": 5,
    "remindersSent": 2
  },
  "completedAt": "2025-10-27T00:03:45Z"
}
```

## Error Responses

All APIs return standard HTTP status codes:

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `422`: Unprocessable Entity
- `500`: Internal Server Error

**Error Response Format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "start.dateTime",
      "issue": "Invalid ISO 8601 format"
    }
  }
}
```

## Rate Limiting

API endpoints are rate limited:

- **Authenticated requests**: 1000 requests per hour
- **Calendar operations**: 100 requests per hour
- **ML operations**: 50 requests per hour

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1635360000
```

## Webhooks

The service supports webhooks for real-time updates:

### Register Webhook
```http
POST /webhooks
```

**Request Body:**
```json
{
  "url": "https://your-app.com/webhook",
  "events": ["calendar.event.created", "goal.progress.updated"],
  "secret": "your_webhook_secret"
}
```

### Webhook Payload
```json
{
  "event": "calendar.event.created",
  "timestamp": "2025-10-27T10:00:00Z",
  "data": {
    "eventId": "event_123",
    "calendarId": "primary",
    "summary": "New Meeting"
  }
}
```