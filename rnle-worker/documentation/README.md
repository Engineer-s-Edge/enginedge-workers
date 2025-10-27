# RNLE Worker

## Overview

The RNLE (Resume Natural Language Engine) Worker is a specialized microservice in the EnginEdge ecosystem designed for processing and executing background tasks related to assistant operations and habit scheduling. Built with NestJS and following hexagonal architecture principles, this worker handles asynchronous command processing with high reliability and scalability.

## Features

- **Command Processing**: Executes background tasks for assistant operations and habit scheduling
- **Asynchronous Processing**: Handles long-running tasks without blocking the main application
- **Kafka Integration**: Event-driven architecture for reliable message processing
- **Health Monitoring**: Comprehensive health checks and metrics collection
- **Error Handling**: Robust error handling with detailed logging and recovery mechanisms
- **Scalable Architecture**: Horizontal scaling support with stateless design

## Architecture

The RNLE Worker follows Clean Architecture (Hexagonal Architecture) principles:

- **Domain Layer**: Core business logic and entities
- **Application Layer**: Use cases and business rules orchestration
- **Infrastructure Layer**: External concerns (Kafka, HTTP, monitoring)

## Supported Task Types

- `EXECUTE_ASSISTANT`: Processes assistant execution requests
- `SCHEDULE_HABITS`: Handles habit scheduling operations

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (for containerized deployment)
- Kafka cluster
- MongoDB (for metadata storage)

### Local Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run start:dev

# Run tests
npm test

# Build for production
npm run build
```

### Docker Deployment

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run
```

## API Endpoints

### Health Check
```
GET /health
```

### Command Processing
```
POST /command/process
Content-Type: application/json

{
  "taskId": "unique-task-id",
  "taskType": "EXECUTE_ASSISTANT",
  "payload": {
    "assistantId": "assistant-123",
    "input": "user input data"
  }
}
```

## Configuration

Environment variables:

- `PORT`: Service port (default: 3001)
- `KAFKA_BROKERS`: Kafka broker addresses
- `KAFKA_CLIENT_ID`: Kafka client identifier
- `KAFKA_GROUP_ID`: Consumer group ID
- `MONGODB_URI`: MongoDB connection string

## Monitoring

The service exposes comprehensive metrics:

- Command processing rates and latency
- Kafka consumer/producer metrics
- Error rates and types
- System resource usage

Access metrics at `/metrics` endpoint.

## Development

### Project Structure

```
src/
├── domain/           # Business logic entities
├── application/      # Use cases and services
├── infrastructure/   # External adapters and controllers
└── main.ts          # Application bootstrap
```

### Testing

```bash
# Unit tests
npm run test:unit

# E2E tests
npm run test:e2e

# Coverage report
npm run test:cov
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions including Kubernetes manifests and Helm charts.

## Contributing

1. Follow the established code style and architecture patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure all tests pass before submitting PR

## License

UNLICENSED - Proprietary software