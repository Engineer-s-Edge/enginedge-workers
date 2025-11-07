import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { ExperienceBankService } from './services/experience-bank.service';
import { ResumeService } from './services/resume.service';
import { BulletEvaluatorService } from './services/bullet-evaluator.service';
import { JobPostingService } from './services/job-posting.service';
import { ResumeEvaluatorService } from './services/resume-evaluator.service';
import { ResumeVersioningService } from './services/resume-versioning.service';
import { ResumeEditingService } from './services/resume-editing.service';
import { ResumeTailoringService } from './services/resume-tailoring.service';
import { ResumeBuilderService } from './services/resume-builder.service';
import { CoverLetterService } from './services/cover-letter.service';
import {
  ExperienceBankItemSchema,
  ExperienceBankItemSchemaFactory,
} from '../infrastructure/database/schemas/experience-bank-item.schema';
import {
  ResumeSchema,
  ResumeSchemaFactory,
} from '../infrastructure/database/schemas/resume.schema';
import {
  JobPostingSchema,
  JobPostingSchemaFactory,
} from '../infrastructure/database/schemas/job-posting.schema';
import {
  EvaluationReportSchema,
  EvaluationReportSchemaFactory,
} from '../infrastructure/database/schemas/evaluation-report.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'ExperienceBankItem',
        schema: ExperienceBankItemSchemaFactory,
      },
      { name: 'Resume', schema: ResumeSchemaFactory },
      { name: 'JobPosting', schema: JobPostingSchemaFactory },
      {
        name: 'EvaluationReport',
        schema: EvaluationReportSchemaFactory,
      },
    ]),
    BullModule.registerQueue({
      name: 'resume-tailoring',
    }),
    forwardRef(() => InfrastructureModule),
  ],
  providers: [
    ExperienceBankService,
    ResumeService,
    BulletEvaluatorService,
    JobPostingService,
    ResumeEvaluatorService,
    ResumeVersioningService,
    ResumeEditingService,
    ResumeTailoringService,
    ResumeBuilderService,
    CoverLetterService,
  ],
  exports: [
    ExperienceBankService,
    ResumeService,
    BulletEvaluatorService,
    JobPostingService,
    ResumeEvaluatorService,
    ResumeVersioningService,
    ResumeEditingService,
    ResumeTailoringService,
    ResumeBuilderService,
    CoverLetterService,
  ],
})
export class ApplicationModule {}
