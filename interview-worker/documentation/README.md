# Interview Worker

AI-powered interview processing and analysis service for the EnginEdge platform.

## Overview

The Interview Worker provides comprehensive interview management capabilities including:

- **Interview Scheduling**: Automated scheduling with calendar integration
- **Real-time Processing**: Live interview transcription and analysis
- **AI-Powered Insights**: Automated candidate evaluation and feedback generation
- **Multi-format Support**: Video, audio, and text interview processing
- **Compliance Tracking**: GDPR and privacy-compliant interview management

## Features

### Core Capabilities
- **Automated Transcription**: Real-time speech-to-text conversion
- **Sentiment Analysis**: Candidate emotion and engagement tracking
- **Question Generation**: AI-powered interview question creation
- **Performance Scoring**: Automated candidate evaluation metrics
- **Feedback Synthesis**: Structured feedback generation

### Integration Points
- **Calendar Systems**: Google Calendar, Outlook integration
- **Video Platforms**: Zoom, Microsoft Teams, WebRTC support
- **HR Systems**: ATS integration for candidate data
- **Analytics**: Performance metrics and reporting

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6.0+
- Redis 7+
- Kafka 3.0+

### Installation

```bash
npm install
```

### Configuration

Create a `.env` file:

```env
PORT=3004
MONGODB_URI=mongodb://localhost:27017/interview-worker
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
```

### Running

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Documentation

See [API.md](API.md) for comprehensive API documentation.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for system architecture details.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment instructions.

## Monitoring

- **Grafana Dashboard**: [grafana-dashboard.json](grafana-dashboard.json)
- **Prometheus Alerts**: [prometheus-alerts.yml](prometheus-alerts.yml)
- **Metrics Documentation**: [MONITORING.md](MONITORING.md)

## Development

### Testing
```bash
npm test                    # Run all tests
npm run test:unit          # Run unit tests only
npm run test:e2e           # Run end-to-end tests
```

### Code Quality
```bash
npm run lint               # Run ESLint
npm run format             # Format with Prettier
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is proprietary software. See LICENSE file for details.

## Support

For support and questions:
- **Documentation**: Check the [docs/](docs/) directory
- **Issues**: Create an issue in the repository
- **Troubleshooting**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)