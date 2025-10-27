/**
 * Application Module - Scheduling Worker
 *
 * Configures and provides all application-layer services and use cases.
 * Bridges domain logic with infrastructure adapters.
 * 
 * Phase 1: Google Calendar Integration ✅
 * Phase 2: Habits & Goals ✅
 * Phase 3: Scheduling Engine ✅
 * Phase 4: ML Integration 🚧 (in progress)
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DomainModule } from '@domain/domain.module';

// Application Services
import { HabitService } from './services/habit.service';
import { GoalService } from './services/goal.service';
import { TimeSlotService } from './services/time-slot.service';
import { TaskSchedulerService } from './services/task-scheduler.service';
import { SchedulingService } from './services/scheduling.service';
import { TaskCompletionService } from './services/task-completion.service';
import { MLModelClient } from './services/ml-model-client.service';
import { RecommendationService } from './services/recommendation.service';

/**
 * Application module - use cases and application services
 * 
 * Note: InfrastructureModule is @Global(), so its providers (ILogger, repositories)
 * are automatically available to all modules. No need to import it here.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // For ML_SERVICE_URL env var
    DomainModule, // Domain services
  ],
  providers: [
    HabitService,
    GoalService,
    TimeSlotService,
    TaskSchedulerService,
    SchedulingService,
    TaskCompletionService,
    MLModelClient,
    RecommendationService,
  ],
  exports: [
    // Export domain module so infrastructure can access it
    DomainModule,
    
    // Export services for other modules
    HabitService,
    GoalService,
    TimeSlotService,
    TaskSchedulerService,
    SchedulingService,
    TaskCompletionService,
    MLModelClient,
    RecommendationService,
  ],
})
export class ApplicationModule {}
