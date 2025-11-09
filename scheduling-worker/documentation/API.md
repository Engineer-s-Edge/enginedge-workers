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

## Activity Model Service API

### Get User Activity Patterns

```http
GET /activity/patterns/:userId
```

**Response:**
```json
{
  "id": "act_pattern_123",
  "userId": "user_123",
  "patternType": "daily",
  "preferredHours": [9, 10, 14, 15],
  "preferredDays": [1, 2, 3, 4, 5],
  "productivityScore": 0.85,
  "completionRate": 0.78,
  "averageFocusDuration": 60,
  "peakProductivityHours": [9, 10],
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-10T12:00:00Z"
}
```

### Track Event Completion

```http
POST /activity/events/:eventId/complete
```

**Request Body:**
```json
{
  "userId": "user_123",
  "scheduledTime": "2025-01-10T09:00:00Z",
  "actualStartTime": "2025-01-10T09:05:00Z",
  "actualEndTime": "2025-01-10T11:00:00Z",
  "userRating": 5,
  "productivityScore": 0.85,
  "interruptions": 2
}
```

**Response:**
```json
{
  "id": "act_event_123",
  "userId": "user_123",
  "eventId": "event_456",
  "scheduledTime": "2025-01-10T09:00:00Z",
  "actualStartTime": "2025-01-10T09:05:00Z",
  "actualEndTime": "2025-01-10T11:00:00Z",
  "completed": true,
  "completedOnTime": false,
  "userRating": 5,
  "productivityScore": 0.85,
  "interruptions": 2,
  "rescheduled": false
}
```

### Get Schedule Efficiency Metrics

```http
GET /activity/efficiency/:userId?startDate=2025-01-01T00:00:00Z&endDate=2025-01-31T23:59:59Z
```

**Response:**
```json
{
  "scheduleEfficiency": 0.82,
  "timeUtilization": 0.75,
  "completionRate": 0.78,
  "punctualityRate": 0.85,
  "productivityScore": 0.80,
  "averageDelay": 5.2,
  "rescheduleFrequency": 2.5,
  "overallEfficiency": 0.80
}
```

### Get Productivity Insights

```http
GET /activity/insights/:userId
```

**Response:**
```json
{
  "overallProductivityScore": 0.85,
  "bestProductivityHours": [9, 10],
  "bestProductivityDays": [1, 2, 3, 4, 5],
  "completionTrend": "improving",
  "recommendations": [
    "Consider scheduling tasks during your peak productivity hours for better completion rates.",
    "Try scheduling important tasks during your most productive hours."
  ]
}
```

### Predict Event Success Probability

```http
GET /activity/predict/:eventId
```

**Response:**
```json
{
  "eventId": "event_123",
  "probability": 0.85
}
```

### Analyze Time Usage

```http
POST /activity/analyze
```

**Request Body:**
```json
{
  "userId": "user_123",
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-01-31T23:59:59Z"
}
```

**Response:**
```json
{
  "totalTimeScheduled": 12000,
  "totalTimeSpent": 9000,
  "totalTimeWasted": 3000,
  "averageSessionDuration": 60,
  "mostActiveHours": [9, 10, 14],
  "leastActiveHours": [12, 13, 17]
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
