import { Module } from '@nestjs/common';
import { ApplicationModule } from '../application/application.module';
import { KafkaLoggerAdapter } from '../common/logging/kafka-logger.adapter';
import { RedisCacheAdapter } from './adapters/cache/redis-cache.adapter';
import { ExperienceBankController } from './controllers/experience-bank.controller';
import { ResumeController } from './controllers/resume.controller';
import { JobPostingController } from './controllers/job-posting.controller';
import { EvaluationController } from './controllers/evaluation.controller';
import { ResumeTailoringController } from './controllers/resume-tailoring.controller';
import { ResumeEditingController } from './controllers/resume-editing.controller';
import { ResumeIteratorGateway } from './gateways/resume-iterator.gateway';
import { BulletReviewGateway } from './gateways/bullet-review.gateway';
import { ResumeBuilderGateway } from './gateways/resume-builder.gateway';
import { CoverLetterController } from './controllers/cover-letter.controller';

/**
 * Infrastructure Module
 *
 * Contains all adapters, controllers, gateways, and external integrations.
 */
@Module({
  imports: [ApplicationModule],
  controllers: [
    ExperienceBankController,
    ResumeController,
    JobPostingController,
    EvaluationController,
    ResumeTailoringController,
    ResumeEditingController,
    CoverLetterController,
  ],
  providers: [
    // Logger
    {
      provide: 'ILogger',
      useClass: KafkaLoggerAdapter,
    },
    ResumeIteratorGateway,
    BulletReviewGateway,
    ResumeBuilderGateway,

    // Cache adapter
    RedisCacheAdapter,
  ],
  exports: [RedisCacheAdapter],
})
export class InfrastructureModule {}
