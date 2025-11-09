/**
 * Application Module - Phase 5 In Progress
 *
 * Configures and provides all application-layer services and use cases.
 * Bridges domain logic with infrastructure adapters.
 *
 * Phase 1: Core agent infrastructure ✅
 * Phase 2: Specialized agent controllers ✅
 * Phase 3: Memory systems ✅
 * Phase 4: Knowledge graph ✅
 * Phase 5: Advanced features ⏳
 */

import { Module } from '@nestjs/common';
import { DomainModule } from '@domain/domain.module';
import { QuestionService } from './services/question.service';
import { SessionService } from './services/session.service';
import { InterviewService } from './services/interview.service';
import { CandidateProfileService } from './services/candidate-profile.service';
import { EvaluatorService } from './services/evaluator.service';
import { CreateQuestionUseCase } from './use-cases/create-question.use-case';
import { SelectQuestionsUseCase } from './use-cases/select-questions.use-case';
import { StartInterviewUseCase } from './use-cases/start-interview.use-case';
import { PauseInterviewUseCase } from './use-cases/pause-interview.use-case';
import { ResumeInterviewUseCase } from './use-cases/resume-interview.use-case';
import { SkipQuestionUseCase } from './use-cases/skip-question.use-case';
import { SubmitResponseUseCase } from './use-cases/submit-response.use-case';
import { WebhookService } from './services/webhook.service';
import { NotificationService } from './services/notification.service';
import { CodeExecutionService } from './services/code-execution.service';

/**
 * Application module - use cases and application services
 *
 * Note: InfrastructureModule is @Global(), so its providers (ILogger, ILLMProvider, IAgentRepository)
 * are automatically available to all modules. No need to import it here.
 */
@Module({
  imports: [
    DomainModule, // Domain services (AgentFactory, MemoryManager, etc.)
  ],
  providers: [
    // Use cases
    CreateQuestionUseCase,
    SelectQuestionsUseCase,
    StartInterviewUseCase,
    PauseInterviewUseCase,
    ResumeInterviewUseCase,
    SkipQuestionUseCase,
    SubmitResponseUseCase,
    // Services
    QuestionService,
    SessionService,
    InterviewService,
    CandidateProfileService,
    EvaluatorService,
    WebhookService,
    NotificationService,
    CodeExecutionService,
  ],
  exports: [
    // Export domain module so infrastructure can access it
    DomainModule,
    // Export services for controllers
    QuestionService,
    SessionService,
    InterviewService,
    CandidateProfileService,
    EvaluatorService,
    WebhookService,
    NotificationService,
    CodeExecutionService,
  ],
})
export class ApplicationModule {}
