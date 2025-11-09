/**
 * Infrastructure Module
 *
 * Configures adapters, controllers, and external integrations.
 *
 * Scheduling Worker - Phase 1: Google Calendar Integration ⏳
 */

import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationModule } from '@application/application.module';
import { MetricsAdapter } from './adapters/monitoring';

// Auth
import { GoogleAuthService } from './adapters/auth/google-auth.service';

// Calendar
import { GoogleCalendarApiService } from './adapters/calendar/google-calendar-api.service';
import { CalendarSyncService } from './adapters/sync/calendar-sync.service';

// Persistence
import { MongoCalendarEventRepository } from './adapters/persistence/mongo-calendar-event.repository';
import { MongoHabitRepository } from './adapters/persistence/mongo-habit.repository';
import { MongoGoalRepository } from './adapters/persistence/mongo-goal.repository';
import { MongoActivityPatternRepository } from './adapters/persistence/mongo-activity-pattern.repository';
import { MongoActivityEventRepository } from './adapters/persistence/mongo-activity-event.repository';

// Logging
import { ConsoleLoggerAdapter } from './adapters/logging/console-logger.adapter';
import { StructuredLogger } from './adapters/logging/structured-logger';
import { KafkaLoggerAdapter } from '../common/logging/kafka-logger.adapter';

// Messaging
import { KafkaMessageBrokerAdapter } from './adapters/messaging/kafka-message-broker.adapter';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

// ML Adapters
import { ActivityMLAdapter } from './adapters/ml/activity-ml-adapter';

// Monitoring
import { ErrorMonitoringAdapter } from './adapters/monitoring/error-monitoring.adapter';

// Controllers
import { CalendarController } from './controllers/calendar.controller';
import { HabitController } from './controllers/habit.controller';
import { GoalController } from './controllers/goal.controller';
import { SchedulingController } from './controllers/scheduling.controller';
import { MLController } from './controllers/ml.controller';
import { ActivityController } from './controllers/activity.controller';
import { MetricsController } from './controllers/metrics.controller';

// Gateways
import { CalendarSyncGateway } from './gateways/calendar-sync.gateway';

/**
 * Infrastructure module - adapters, controllers, and wiring
 *
 * Made global to ensure DI providers are available across all modules
 */
@Global()
@Module({
  imports: [
    ApplicationModule,
    // ThreadingModule moved to AppModule to avoid circular dependency
  ],
  controllers: [
    CalendarController,
    HabitController,
    GoalController,
    SchedulingController,
    MLController,
    ActivityController,
    MetricsController,
  ],
  providers: [
    MetricsAdapter,
    ErrorMonitoringAdapter,

    // Auth
    GoogleAuthService,
    {
      provide: 'IGoogleAuthService',
      useClass: GoogleAuthService,
    },

    // Calendar API
    GoogleCalendarApiService,
    {
      provide: 'IGoogleCalendarApiService',
      useClass: GoogleCalendarApiService,
    },

    // Calendar Sync
    CalendarSyncGateway,
    CalendarSyncService,
    {
      provide: 'ICalendarSyncService',
      useClass: CalendarSyncService,
    },

    // Repositories
    MongoCalendarEventRepository,
    {
      provide: 'ICalendarEventRepository',
      useClass: MongoCalendarEventRepository,
    },
    MongoHabitRepository,
    {
      provide: 'IHabitRepository',
      useClass: MongoHabitRepository,
    },
    MongoGoalRepository,
    {
      provide: 'IGoalRepository',
      useClass: MongoGoalRepository,
    },
    MongoActivityPatternRepository,
    {
      provide: 'IActivityPatternRepository',
      useClass: MongoActivityPatternRepository,
    },
    MongoActivityEventRepository,
    {
      provide: 'IActivityEventRepository',
      useClass: MongoActivityEventRepository,
    },

    // ML Adapters
    ActivityMLAdapter,

    // Logging
    ConsoleLoggerAdapter,
    {
      provide: StructuredLogger,
      useFactory: (configService: ConfigService) => {
        const serviceName =
          configService.get<string>('SERVICE_NAME') || 'scheduling-worker';
        return new StructuredLogger(serviceName);
      },
      inject: [ConfigService],
    },
    KafkaLoggerAdapter,
    {
      provide: 'ILogger',
      useClass: KafkaLoggerAdapter,
    },

    // Messaging
    KafkaMessageBrokerAdapter,
    {
      provide: 'IMessageBroker',
      useClass: KafkaMessageBrokerAdapter,
    },

    // Global filter/interceptor providers for DI resolution
    GlobalExceptionFilter,
    LoggingInterceptor,
  ],
  exports: [
    'ILogger', // Export ILogger so ThreadingModule can use it
    'ICalendarEventRepository', // Export repository tokens for ApplicationModule
    'IHabitRepository',
    'IGoalRepository',
    'IActivityPatternRepository',
    'IActivityEventRepository',
    'IGoogleAuthService', // Export service tokens for ApplicationModule
    'IGoogleCalendarApiService',
    'ICalendarSyncService',
    GoogleAuthService,
    GoogleCalendarApiService,
    CalendarSyncService,
    MongoCalendarEventRepository,
    MongoHabitRepository,
    MongoGoalRepository,
    MongoActivityPatternRepository,
    MongoActivityEventRepository,
    ActivityMLAdapter,
    MetricsAdapter,
    ErrorMonitoringAdapter,
    ConsoleLoggerAdapter,
    StructuredLogger,
    KafkaMessageBrokerAdapter,
  ],
})
export class InfrastructureModule {}
