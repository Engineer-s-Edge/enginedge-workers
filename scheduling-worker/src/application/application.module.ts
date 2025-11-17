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
import { ActivityModelService } from './services/activity-model.service';
import { PatternAnalyzerService } from './services/pattern-analyzer.service';
import { PredictionService } from './services/prediction.service';
import { TaskService } from './services/task.service';
import { DayLockService } from './services/day-lock.service';
import { MLRecommendationService } from './services/ml-recommendation.service';
import { LLMTaskAssistService } from './services/llm-task-assist.service';

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
    ActivityModelService,
    PatternAnalyzerService,
    PredictionService,
    TaskService,
    DayLockService,
    MLRecommendationService,
    LLMTaskAssistService,
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
    ActivityModelService,
    PatternAnalyzerService,
    PredictionService,
    TaskService,
    DayLockService,
    MLRecommendationService,
    LLMTaskAssistService,
  ],
})
export class ApplicationModule {}
