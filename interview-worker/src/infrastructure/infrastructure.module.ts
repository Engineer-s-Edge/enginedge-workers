/**
 * Infrastructure Module
 *
 * Configures adapters, controllers, and external integrations.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaLoggerAdapter } from '../common/logging/kafka-logger.adapter';
import { ApplicationModule } from '@application/application.module';
import { HealthModule } from '../health/health.module';
import { ThreadingModule } from './threading/threading.module';
import { MetricsAdapter } from './adapters/monitoring';
import { QuestionController } from './controllers/question.controller';
import { QuestionSeedController } from './controllers/question-seed.controller';
import { SessionController } from './controllers/session.controller';
import { InterviewController } from './controllers/interview.controller';
import { ProfileController } from './controllers/profile.controller';
import { ReportController } from './controllers/report.controller';
import { InterviewWebSocketGateway } from './gateways/interview-websocket.gateway';
import { GoogleSpeechAdapter } from './adapters/voice/google-speech.adapter';
import { AzureSpeechAdapter } from './adapters/voice/azure-speech.adapter';
import { FillerWordDetectorAdapter } from './adapters/voice/filler-word-detector.adapter';
import { StructuredLogger } from './adapters/logging/structured-logger';
import { RedisCacheAdapter } from './adapters/cache/redis-cache.adapter';
import {
  MongoDbModule,
  MongoInterviewRepository,
  MongoInterviewSessionRepository,
  MongoInterviewQuestionRepository,
  MongoInterviewResponseRepository,
  MongoCandidateProfileRepository,
  MongoTranscriptRepository,
  MongoInterviewReportRepository,
  MongoWebhookRepository,
} from './adapters/database';
import {
  IInterviewRepository,
  IInterviewSessionRepository,
  IInterviewQuestionRepository,
  IInterviewResponseRepository,
  ICandidateProfileRepository,
  ITranscriptRepository,
  IInterviewReportRepository,
  IWebhookRepository,
} from '@application/ports/repositories.port';

/**
 * Infrastructure module - adapters, controllers, and wiring
 *
 * Phase 1: Core agent infrastructure ✅
 * Phase 2: Specialized agent controllers ✅
 * Phase 3: Memory systems ✅
 * Phase 4: Knowledge graph ✅
 * Phase 5: Advanced features ⏳
 *
 * Made global to ensure DI providers are available across all modules
 */
@Global()
@Module({
  imports: [
    ApplicationModule,
    HealthModule, // Provides HealthController and HealthService
    ThreadingModule, // Provides WorkerThreadPool, RequestQueue, etc.
    MongoDbModule, // MongoDB connection and database instance
  ],
  controllers: [
    QuestionController,
    QuestionSeedController,
    SessionController,
    InterviewController,
    ProfileController,
    ReportController,
  ],
  providers: [
    // Logger
    {
      provide: 'ILogger',
      useClass: KafkaLoggerAdapter,
    },
    // WebSocket Gateway
    InterviewWebSocketGateway,
    // Speech Adapters
    GoogleSpeechAdapter,
    AzureSpeechAdapter,
    FillerWordDetectorAdapter,
    // Repository implementations
    {
      provide: 'IInterviewRepository',
      useClass: MongoInterviewRepository,
    },
    {
      provide: 'IInterviewSessionRepository',
      useClass: MongoInterviewSessionRepository,
    },
    {
      provide: 'IInterviewQuestionRepository',
      useClass: MongoInterviewQuestionRepository,
    },
    {
      provide: 'IInterviewResponseRepository',
      useClass: MongoInterviewResponseRepository,
    },
    {
      provide: 'ICandidateProfileRepository',
      useClass: MongoCandidateProfileRepository,
    },
    {
      provide: 'ITranscriptRepository',
      useClass: MongoTranscriptRepository,
    },
    {
      provide: 'IInterviewReportRepository',
      useClass: MongoInterviewReportRepository,
    },
    {
      provide: 'IWebhookRepository',
      useClass: MongoWebhookRepository,
    },
    MetricsAdapter,

    // Cache adapter
    RedisCacheAdapter,
  ],
  exports: [
    // Export logger for use in other modules
    'ILogger',
    // Export repository interfaces for application layer
    'IInterviewRepository',
    'IInterviewSessionRepository',
    'IInterviewQuestionRepository',
    'IInterviewResponseRepository',
    'ICandidateProfileRepository',
    'ITranscriptRepository',
    'IInterviewReportRepository',
    'IWebhookRepository',
  ],
})
export class InfrastructureModule {}
