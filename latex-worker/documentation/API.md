# LaTeX Worker API Documentation

## Overview

The LaTeX Worker API provides professional-grade LaTeX document compilation with advanced features for handling complex documents, bibliographies, custom fonts, and multi-file projects.

## Authentication

All endpoints require Bearer token authentication in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Endpoints

### Compilation

#### POST /latex/compile (Synchronous)

Compile a LaTeX document synchronously and return the PDF immediately.

**Request:**
```json
{
  "jobId": "compile-001",
  "userId": "user-123",
  "content": "\\documentclass{article}\\begin{document}Hello\\end{document}",
  "settings": {
    "engine": "xelatex",
    "maxPasses": 3,
    "timeout": 60000,
    "shell": false
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "pdfPath": "/tmp/compile-001.pdf",
  "pdfId": "507f1f77bcf86cd799439011",
  "compilationTime": 2500,
  "passes": 2,
  "errors": [],
  "warnings": [
    {
      "line": 5,
      "message": "Citation undefined",
      "file": "main.tex"
    }
  ],
  "logs": {
    "stdout": "This is XeTeX, Version 3.14159...",
    "stderr": "",
    "rawLog": "[truncated full LaTeX log]"
  }
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": {
    "code": "COMPILATION_ERROR",
    "message": "LaTeX compilation failed with 2 errors",
    "details": {
      "errors": [
        {
          "line": 10,
          "message": "Undefined control sequence: \\invalid",
          "severity": "error"
        }
      ]
    }
  }
}
```

#### POST /latex/compile-async (Asynchronous via Kafka)

Queue a compilation job for async processing. Returns immediately with job ID.

**Request:**
```json
{
  "jobId": "async-001",
  "userId": "user-456",
  "content": "[LaTeX content]"
}
```

**Response (202):**
```json
{
  "jobId": "async-001",
  "status": "queued",
  "estimatedTime": 15
}
```

#### POST /latex/validate

Validate LaTeX syntax without compilation.

**Request:**
```json
{
  "content": "\\documentclass{article}\\invalid\\end{document}"
}
```

**Response (200):**
```json
{
  "valid": false,
  "errors": [
    {
      "line": 1,
      "message": "Undefined control sequence: \\invalid",
      "severity": "error"
    }
  ],
  "warnings": []
}
```

### Job Management

#### GET /latex/jobs/{jobId}

Get compilation job status.

**Response (200):**
```json
{
  "jobId": "compile-001",
  "documentId": "doc-123",
  "userId": "user-123",
  "status": "completed",
  "result": {
    "success": true,
    "pdfPath": "/gridfs/507f1f77bcf86cd799439011"
  },
  "createdAt": "2025-10-27T15:00:00Z",
  "startedAt": "2025-10-27T15:00:01Z",
  "completedAt": "2025-10-27T15:00:03Z"
}
```

#### GET /latex/jobs/{jobId}/pdf

Download compiled PDF.

**Response (200):** Binary PDF content

#### GET /latex/jobs/{jobId}/logs

Get detailed compilation logs.

**Response (200):**
```json
{
  "stdout": "This is XeTeX...",
  "stderr": "",
  "rawLog": "[full LaTeX compilation log]"
}
```

### Projects

#### GET /latex/projects

List user projects.

**Parameters:**
- `userId` (required): User identifier

**Response (200):**
```json
[
  {
    "projectId": "proj-001",
    "userId": "user-123",
    "name": "My Research Paper",
    "mainFile": "main.tex",
    "files": [
      {
        "filename": "main.tex",
        "content": "[content]",
        "lastModified": "2025-10-27T15:00:00Z"
      }
    ],
    "dependencies": ["bibliography.bib", "images/fig1.png"],
    "createdAt": "2025-10-27T14:00:00Z",
    "updatedAt": "2025-10-27T15:00:00Z"
  }
]
```

#### POST /latex/projects

Create new project.

**Request:**
```json
{
  "userId": "user-123",
  "name": "My Paper",
  "mainFile": "main.tex",
  "files": [
    {
      "filename": "main.tex",
      "content": "\\documentclass{article}\\begin{document}Test\\end{document}"
    }
  ]
}
```

**Response (201):**
```json
{
  "projectId": "proj-001",
  "userId": "user-123",
  "name": "My Paper",
  "mainFile": "main.tex",
  "files": [
    {
      "filename": "main.tex",
      "content": "\\documentclass{article}\\begin{document}Test\\end{document}",
      "lastModified": "2025-10-27T15:00:00Z"
    }
  ],
  "dependencies": [],
  "createdAt": "2025-10-27T15:00:00Z",
  "updatedAt": "2025-10-27T15:00:00Z"
}
```

#### GET /latex/projects/{projectId}

Get project details.

#### PUT /latex/projects/{projectId}

Update project name or main file.

#### DELETE /latex/projects/{projectId}

Delete project.

#### PUT /latex/projects/{projectId}/files/{fileName}

Update file in project.

**Request:**
```json
{
  "content": "\\documentclass{article}\\begin{document}Updated\\end{document}"
}
```

#### DELETE /latex/projects/{projectId}/files/{fileName}

Delete file from project.

### Templates

#### GET /latex/templates

List templates with optional filtering.

**Parameters:**
- `category`: resume, academic, business, article, book, presentation
- `isPublic`: boolean

**Response (200):**
```json
[
  {
    "templateId": "tpl-001",
    "name": "Academic Article",
    "category": "academic",
    "content": "[LaTeX template]",
    "variables": [
      {
        "name": "author",
        "description": "Paper author",
        "placeholder": "Your Name"
      }
    ],
    "isPublic": true,
    "createdBy": "user-admin",
    "createdAt": "2025-10-01T00:00:00Z"
  }
]
```

#### POST /latex/templates

Create new template.

#### GET /latex/templates/{templateId}

Get template details.

#### DELETE /latex/templates/{templateId}

Delete template.

#### POST /latex/templates/{templateId}/clone

Clone template to project with variable substitution.

**Request:**
```json
{
  "userId": "user-123",
  "projectName": "My Article",
  "variables": {
    "author": "John Doe",
    "title": "My Research",
    "date": "2025-10-27"
  }
}
```

**Response (201):**
```json
{
  "projectId": "proj-new",
  "userId": "user-123",
  "name": "My Article",
  "mainFile": "main.tex",
  "files": [
    {
      "filename": "main.tex",
      "content": "[template content with variables substituted]"
    }
  ]
}
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request |
| `COMPILATION_ERROR` | 400 | LaTeX syntax error |
| `UNDEFINED_COMMAND` | 400 | Undefined LaTeX command |
| `MISSING_PACKAGE` | 400 | Required package not installed |
| `MISSING_FILE` | 400 | File not found in project |
| `TIMEOUT` | 504 | Compilation exceeded timeout |
| `MEMORY_LIMIT` | 503 | Memory limit exceeded |
| `NOT_FOUND` | 404 | Job, project, or template not found |
| `UNAUTHORIZED` | 401 | Invalid or missing credentials |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

- **Concurrent compilations**: 10 per user
- **Queue depth**: 100 total jobs
- **Timeout**: 60 seconds per compilation
- **Memory limit**: 2GB per job
