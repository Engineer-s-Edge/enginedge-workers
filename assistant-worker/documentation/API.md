# Assistant Worker - API Documentation

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Base URL](#base-url)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Core Agent API](#core-agent-api)
- [Agent-Specific APIs](#agent-specific-apis)
- [Memory API](#memory-api)
- [Knowledge Graph API](#knowledge-graph-api)
- [Health & Metrics](#health--metrics)

---

## Overview

The Assistant Worker exposes **80+ REST API endpoints** organized into the following categories:

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Core Agent** | 7 | Create, execute, manage agents |
| **ReAct Agent** | 5 | Chain-of-thought reasoning |
| **Graph Agent** | 8 | DAG workflow execution |
| **Expert Agent** | 6 | Research operations |
| **Genius Agent** | 7 | Meta-learning |
| **Collective Agent** | 6 | Multi-agent coordination |
| **Manager Agent** | 6 | Task decomposition |
| **Memory** | 11 | Conversation memory |
| **Knowledge Graph** | 15 | Graph operations |
| **Health/Metrics** | 2 | System health |

---

## Authentication

Currently, the API uses user-based identification:

```bash
# Include userId in request body or query parameter
{
  "userId": "user123",
  ...
}
```

For production, implement one of:
- **API Keys:** Header-based authentication
- **JWT Tokens:** Bearer token authentication
- **OAuth 2.0:** Third-party authentication

---

## Base URL

```
Development: http://localhost:3001
Production: https://assistant.yourdomain.com
```

---

## Response Format

### Success Response

```json
{
  "id": "agent_123",
  "name": "my-agent",
  "status": "success",
  "result": {
    // Response data
  },
  "timestamp": "2025-10-24T12:00:00.000Z"
}
```

### Error Response

```json
{
  "statusCode": 400,
  "message": "Agent not found",
  "error": "Not Found",
  "timestamp": "2025-10-24T12:00:00.000Z",
  "path": "/agents/invalid-id"
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| `200` | OK | Request successful |
| `201` | Created | Resource created |
| `204` | No Content | Successful, no response body |
| `400` | Bad Request | Invalid input |
| `401` | Unauthorized | Authentication required |
| `403` | Forbidden | Access denied |
| `404` | Not Found | Resource not found |
| `409` | Conflict | Resource conflict |
| `422` | Unprocessable Entity | Validation error |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server error |
| `503` | Service Unavailable | Service temporarily unavailable |

### Common Error Messages

```json
// Agent not found
{
  "statusCode": 404,
  "message": "Agent 'agent_123' not found"
}

// Validation error
{
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    {
      "field": "agentType",
      "message": "must be one of: react, graph, expert, genius, collective, manager"
    }
  ]
}

// Timeout error
{
  "statusCode": 408,
  "message": "Agent execution timeout (30s)"
}
```

---

## Core Agent API

### Create Agent

**Endpoint:** `POST /agents/create`

**Description:** Create a new agent instance

**Request:**
```json
{
  "name": "my-assistant",
  "type": "react",
  "userId": "user123",
  "config": {
    "model": "gpt-4",
    "provider": "openai",
    "temperature": 0.7,
    "maxTokens": 2048,
    "systemPrompt": "You are a helpful assistant.",
    "enableTools": true,
    "toolNames": ["search", "calculator"],
    "streamingEnabled": true,
    "timeout": 30000
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "agent_1729776000_abc123",
  "name": "my-assistant",
  "type": "react",
  "state": "idle",
  "createdAt": "2025-10-24T12:00:00.000Z"
}
```

---

### List Agents

**Endpoint:** `GET /agents?userId={userId}&type={type}`

**Query Parameters:**
- `userId` (required): User identifier
- `type` (optional): Filter by agent type
- `active` (optional): Filter by active status

**Response:** `200 OK`
```json
{
  "total": 5,
  "agents": [
    {
      "id": "agent_123",
      "name": "my-assistant",
      "type": "react",
      "state": "idle"
    }
  ]
}
```

---

### Get Agent

**Endpoint:** `GET /agents/:id?userId={userId}`

**Response:** `200 OK`
```json
{
  "id": "agent_123",
  "name": "my-assistant",
  "state": "idle",
  "config": {
    "model": "gpt-4",
    "temperature": 0.7
  }
}
```

---

### Execute Agent

**Endpoint:** `POST /agents/:id/execute`

**Request:**
```json
{
  "input": "What is the capital of France?",
  "userId": "user123",
  "sessionId": "session_456",
  "conversationId": "conv_789"
}
```

**Response:** `200 OK`
```json
{
  "output": "The capital of France is Paris.",
  "status": "complete",
  "executionTime": 1.52,
  "tokenCount": {
    "input": 8,
    "output": 7
  },
  "metadata": {
    "model": "gpt-4",
    "temperature": 0.7
  }
}
```

---

### Stream Agent Execution

**Endpoint:** `POST /agents/:id/stream`

**Request:** Same as execute

**Response:** `200 OK` (Server-Sent Events)
```
data: {"type":"start","timestamp":"2025-10-24T12:00:00.000Z"}

data: {"type":"token","content":"The"}

data: {"type":"token","content":" capital"}

data: {"type":"token","content":" of"}

data: {"type":"token","content":" France"}

data: {"type":"token","content":" is"}

data: {"type":"token","content":" Paris"}

data: {"type":"token","content":"."}

data: {"type":"complete","executionTime":1.52}
```

---

### Delete Agent

**Endpoint:** `DELETE /agents/:id?userId={userId}`

**Response:** `204 No Content`

---

### Abort Agent Execution

**Endpoint:** `POST /agents/:id/abort?userId={userId}`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Agent execution aborted"
}
```

---

## Agent-Specific APIs

### ReAct Agent

**Base Path:** `/react-agents`

#### Create Tool Plan
`POST /react-agents/:id/plan`

**Request:**
```json
{
  "goal": "Find information about quantum computing",
  "availableTools": ["search", "wikipedia", "calculator"]
}
```

**Response:**
```json
{
  "plan": [
    {
      "step": 1,
      "action": "search",
      "reasoning": "Search for recent information"
    },
    {
      "step": 2,
      "action": "wikipedia",
      "reasoning": "Get detailed explanation"
    }
  ]
}
```

#### Execute with Tools
`POST /react-agents/:id/execute-with-tools`

Full ReAct loop execution with tool use.

---

### Graph Agent

**Base Path:** `/graph-agents`

#### Create Workflow
`POST /graph-agents/:id/workflows`

**Request:**
```json
{
  "name": "Data Processing Workflow",
  "nodes": [
    {
      "id": "start",
      "type": "task",
      "config": {
        "action": "load_data"
      }
    },
    {
      "id": "process",
      "type": "task",
      "config": {
        "action": "transform_data"
      }
    },
    {
      "id": "approve",
      "type": "approval",
      "config": {
        "prompt": "Approve transformation?"
      }
    }
  ],
  "edges": [
    {
      "from": "start",
      "to": "process"
    },
    {
      "from": "process",
      "to": "approve",
      "condition": "success"
    }
  ]
}
```

#### Execute Workflow
`POST /graph-agents/:id/workflows/:workflowId/execute`

#### Get Workflow State
`GET /graph-agents/:id/workflows/:workflowId/state`

#### Provide User Input
`POST /graph-agents/:id/workflows/:workflowId/input`

**Request:**
```json
{
  "nodeId": "user_input_1",
  "value": "User's input here"
}
```

---

### Expert Agent

**Base Path:** `/expert-agents`

#### Start Research
`POST /expert-agents/:id/research`

**Request:**
```json
{
  "question": "Explain quantum entanglement",
  "depth": "deep",
  "sources": ["academic", "web", "knowledge_graph"]
}
```

#### Get Research Status
`GET /expert-agents/:id/research/:researchId/status`

#### Get Research Results
`GET /expert-agents/:id/research/:researchId/results`

**Response:**
```json
{
  "question": "Explain quantum entanglement",
  "answer": "Quantum entanglement is...",
  "sources": [
    {
      "title": "Quantum Mechanics",
      "url": "https://...",
      "relevance": 0.95
    }
  ],
  "knowledgeGraph": {
    "nodeId": "kg_node_123"
  },
  "citations": [
    "[1] Smith, J. (2024). Quantum Mechanics..."
  ]
}
```

---

### Genius Agent

**Base Path:** `/genius-agents`

#### Start Learning
`POST /genius-agents/:id/learn`

**Request:**
```json
{
  "topic": "Machine Learning",
  "mode": "autonomous",
  "duration": 3600,
  "qualityThreshold": 0.8
}
```

#### Get Learning Status
`GET /genius-agents/:id/learning/:learningId/status`

#### Get Expert Pool
`GET /genius-agents/:id/experts`

**Response:**
```json
{
  "poolSize": 5,
  "experts": [
    {
      "id": "expert_1",
      "specialty": "Deep Learning",
      "proficiency": 0.92
    }
  ]
}
```

---

### Collective Agent

**Base Path:** `/collective-agents`

#### Start Coordination
`POST /collective-agents/:id/coordinate`

**Request:**
```json
{
  "task": "Build a web application",
  "subAgents": ["frontend", "backend", "database", "deployment"],
  "priority": "high"
}
```

#### Get Task Status
`GET /collective-agents/:id/tasks/:taskId/status`

#### Get Sub-Agent Status
`GET /collective-agents/:id/sub-agents`

---

### Manager Agent

**Base Path:** `/manager-agents`

#### Decompose Task
`POST /manager-agents/:id/decompose`

**Request:**
```json
{
  "task": "Create user authentication system",
  "complexity": "medium"
}
```

**Response:**
```json
{
  "taskId": "task_123",
  "subtasks": [
    {
      "id": "subtask_1",
      "description": "Design database schema",
      "assignee": "sub_agent_1",
      "status": "pending"
    },
    {
      "id": "subtask_2",
      "description": "Implement authentication logic",
      "assignee": "sub_agent_2",
      "status": "pending"
    }
  ]
}
```

---

## Memory API

**Base Path:** `/memory`

### Add Message

`POST /memory/:conversationId/messages`

**Request:**
```json
{
  "role": "user",
  "content": "Hello!",
  "memoryType": "buffer",
  "metadata": {
    "source": "web"
  }
}
```

### Get Messages

`GET /memory/:conversationId?memoryType={type}&limit={limit}`

**Response:**
```json
{
  "conversationId": "conv_123",
  "memoryType": "buffer",
  "messages": [
    {
      "role": "user",
      "content": "Hello!",
      "timestamp": "2025-10-24T12:00:00.000Z"
    }
  ],
  "total": 1
}
```

### Get Context

`GET /memory/:conversationId/context?memoryType={type}&query={query}`

Returns formatted conversation context for LLM input.

### Clear Memory

`DELETE /memory/:conversationId?memoryType={type}`

### Get Summary

`GET /memory/:conversationId/summary`

### Search Similar

`POST /memory/:conversationId/search`

**Request:**
```json
{
  "query": "quantum computing",
  "topK": 5
}
```

### Get Entities

`GET /memory/:conversationId/entities`

### Search Entities

`POST /memory/:conversationId/entities/search`

### List Conversations

`GET /memory/conversations/list?userId={userId}&limit={limit}`

### Search Conversations

`POST /memory/conversations/search`

**Request:**
```json
{
  "userId": "user123",
  "query": "search term"
}
```

### Get Stats

`GET /memory/stats/:userId`

---

## Knowledge Graph API

**Base Path:** `/knowledge-graph`

### Create Node

`POST /knowledge-graph/nodes`

**Request:**
```json
{
  "label": "Quantum Computing",
  "type": "concept",
  "layer": "L1_OBSERVATIONS",
  "properties": {
    "description": "...",
    "confidence": 0.95
  }
}
```

### Get Node

`GET /knowledge-graph/nodes/:id`

### Delete Node

`DELETE /knowledge-graph/nodes/:id`

### Create Edge

`POST /knowledge-graph/edges`

**Request:**
```json
{
  "from": "node_1",
  "to": "node_2",
  "type": "RELATES_TO",
  "properties": {
    "strength": 0.8
  }
}
```

### Delete Edge

`DELETE /knowledge-graph/edges/:id`

### Execute Query

`GET /knowledge-graph/query?cypher={query}&params={params}`

**Example:**
```
GET /knowledge-graph/query?cypher=MATCH (n:Node) RETURN n LIMIT 10
```

### Get Nodes by Layer

`GET /knowledge-graph/nodes/layer/:layer`

**Layers:** L1_OBSERVATIONS, L2_PATTERNS, L3_MODELS, L4_THEORIES, L5_PRINCIPLES, L6_SYNTHESIS

### Get Nodes by Type

`GET /knowledge-graph/nodes/type/:type`

### Get Neighbors

`GET /knowledge-graph/nodes/:id/neighbors?direction={direction}`

**Directions:** in, out, both

### Get Subgraph

`GET /knowledge-graph/nodes/:id/subgraph?depth={depth}`

### Search Nodes

`POST /knowledge-graph/search`

**Request:**
```json
{
  "searchTerm": "quantum"
}
```

### Get Stats

`GET /knowledge-graph/stats`

**Response:**
```json
{
  "nodeCount": 1250,
  "edgeCount": 3400,
  "layers": {
    "L1_OBSERVATIONS": 450,
    "L2_PATTERNS": 320,
    "L3_MODELS": 240,
    "L4_THEORIES": 150,
    "L5_PRINCIPLES": 60,
    "L6_SYNTHESIS": 30
  }
}
```

### Build ICS Hierarchy

`POST /knowledge-graph/ics/build`

**Request:**
```json
{
  "concept": "Machine Learning",
  "observations": ["Data point 1", "Data point 2"],
  "patterns": ["Pattern 1"],
  "models": ["Model 1"],
  "theories": ["Theory 1"],
  "principles": ["Principle 1"],
  "synthesis": "Integrated understanding"
}
```

### Traverse Up

`GET /knowledge-graph/ics/traverse-up/:nodeId`

Traverse from observations to synthesis.

### Traverse Down

`GET /knowledge-graph/ics/traverse-down/:nodeId`

Traverse from synthesis to observations.

---

## Health & Metrics

### Health Check

`GET /health`

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2025-10-24T12:00:00.000Z",
  "uptime": 123.45,
  "memory": {
    "used": 500000000,
    "total": 1000000000
  },
  "dependencies": {
    "mongodb": "connected",
    "neo4j": "connected"
  }
}
```

### Metrics

`GET /metrics`

**Response:** Prometheus format
```
# HELP agent_executions_total Total number of agent executions
# TYPE agent_executions_total counter
agent_executions_total{agent_type="react",status="success"} 145

# HELP agent_execution_duration_seconds Agent execution duration
# TYPE agent_execution_duration_seconds histogram
agent_execution_duration_seconds_bucket{agent_type="react",le="1"} 45
agent_execution_duration_seconds_bucket{agent_type="react",le="5"} 120
```

---

## Rate Limiting

Default limits (configurable):
- **Per IP:** 100 requests per minute
- **Per User:** 1000 requests per hour
- **Streaming:** 10 concurrent streams per user

**Response when rate limited:** `429 Too Many Requests`
```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded. Try again in 42 seconds."
}
```

---

## Pagination

For list endpoints that return many results:

```
GET /agents?userId=user123&page=1&limit=20
```

**Response:**
```json
{
  "total": 150,
  "page": 1,
  "limit": 20,
  "pages": 8,
  "data": [...]
}
```

---

## Webhooks (Coming Soon)

Subscribe to events:
- Agent execution complete
- Memory update
- Knowledge graph change

```json
{
  "url": "https://your-app.com/webhook",
  "events": ["agent.complete", "memory.update"]
}
```

---

## SDK Support (Coming Soon)

Official SDKs planned for:
- JavaScript/TypeScript
- Python
- Go
- Java

---

For complete OpenAPI 3.0 specification, see [openapi.yaml](openapi.yaml).

---

**Last Updated:** October 24, 2025

