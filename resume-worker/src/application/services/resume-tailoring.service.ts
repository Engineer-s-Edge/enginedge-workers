import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Resume } from '../../domain/entities/resume.entity';
import { JobPosting } from '../../domain/entities/job-posting.entity';
import { JobPostingService } from './job-posting.service';
import { ResumeEvaluatorService } from './resume-evaluator.service';
import { ResumeVersioningService } from './resume-versioning.service';
import { ExperienceBankService } from './experience-bank.service';

export interface TailorResumeRequest {
  userId: string;
  resumeId: string;
  jobPostingText: string;
  jobPostingUrl?: string;
  mode: 'auto' | 'manual';
  targetScore?: number;
  maxIterations?: number;
}

export interface TailorResumeJob {
  id: string;
  userId: string;
  resumeId: string;
  jobPostingId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentIteration: number;
  currentScore: number;
  targetScore: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ResumeTailoringService {
  private readonly logger = new Logger(ResumeTailoringService.name);

  // Track active jobs
  private activeJobs = new Map<string, TailorResumeJob>();

  constructor(
    @InjectModel('Resume')
    private readonly resumeModel: Model<Resume>,
    @InjectQueue('resume-tailoring')
    private readonly tailoringQueue: Queue,
    private readonly jobPostingService: JobPostingService,
    private readonly evaluatorService: ResumeEvaluatorService,
    private readonly versioningService: ResumeVersioningService,
    private readonly experienceBankService: ExperienceBankService
  ) {}

  /**
   * Start a resume tailoring job.
   * 
   * This is the main entry point for the full workflow:
   * 1. Extract job posting data
   * 2. Evaluate current resume against posting
   * 3. Identify gaps and improvements
   * 4. Suggest bullet swaps from experience bank
   * 5. Iterate until target score reached (auto mode) or user satisfied (manual mode)
   */
  async startTailoringJob(request: TailorResumeRequest): Promise<TailorResumeJob> {
    this.logger.log(`Starting tailoring job for user ${request.userId}`);

    // Step 1: Extract job posting
    const jobPosting = await this.jobPostingService.extractFromText(
      request.userId,
      request.jobPostingText,
      request.jobPostingUrl
    );

    // Step 2: Create job tracking
    const jobId = `${request.userId}-${Date.now()}`;
    const job: TailorResumeJob = {
      id: jobId,
      userId: request.userId,
      resumeId: request.resumeId,
      jobPostingId: jobPosting._id.toString(),
      status: 'queued',
      progress: 0,
      currentIteration: 0,
      currentScore: 0,
      targetScore: request.targetScore || 95,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.activeJobs.set(jobId, job);

    // Step 3: Add to queue
    await this.tailoringQueue.add('tailor-resume', {
      jobId,
      request
    });

    return job;
  }

  /**
   * Process a tailoring job (called by Bull worker).
   */
  async processTailoringJob(jobId: string, request: TailorResumeRequest): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      job.status = 'processing';
      job.updatedAt = new Date();

      // Step 1: Initial evaluation
      this.logger.log(`[${jobId}] Performing initial evaluation`);
      const initialReport = await this.evaluatorService.evaluateResume(
        request.resumeId,
        {
          mode: 'jd-match',
          jobPostingId: job.jobPostingId,
          useLlm: false,
          generateAutoFixes: true
        }
      );

      job.currentScore = initialReport.scores.overall;
      job.progress = 10;

      // Step 2: Check if already meets target
      if (job.currentScore >= job.targetScore) {
        this.logger.log(`[${jobId}] Resume already meets target score`);
        job.status = 'completed';
        job.progress = 100;
        return;
      }

      // Step 3: Suggest improvements from experience bank
      this.logger.log(`[${jobId}] Finding bullet swaps from experience bank`);
      const swaps = await this.findBulletSwaps(
        request.userId,
        job.jobPostingId,
        initialReport
      );

      job.progress = 30;

      // Step 4: Iterate based on mode
      if (request.mode === 'auto') {
        await this.autoIterate(job, request, swaps);
      } else {
        // Manual mode: just provide suggestions, user will interact via WebSocket
        job.progress = 50;
        job.status = 'completed';
      }

    } catch (error) {
      this.logger.error(`[${jobId}] Error processing job: ${error.message}`, error.stack);
      job.status = 'failed';
      throw error;
    } finally {
      job.updatedAt = new Date();
    }
  }

  /**
   * Auto-iterate to improve resume.
   */
  private async autoIterate(
    job: TailorResumeJob,
    request: TailorResumeRequest,
    swaps: any[]
  ): Promise<void> {
    const maxIterations = request.maxIterations || 10;

    for (let i = 0; i < maxIterations; i++) {
      job.currentIteration = i + 1;
      this.logger.log(`[${job.id}] Iteration ${job.currentIteration}`);

      // Apply top swaps
      // TODO: Implement actual swap application
      // For now, just simulate progress

      // Re-evaluate
      const report = await this.evaluatorService.evaluateResume(
        request.resumeId,
        {
          mode: 'jd-match',
          jobPostingId: job.jobPostingId,
          useLlm: false,
          generateAutoFixes: true
        }
      );

      job.currentScore = report.scores.overall;
      job.progress = 30 + ((i + 1) / maxIterations) * 60;

      // Check if target reached
      if (job.currentScore >= job.targetScore) {
        this.logger.log(`[${job.id}] Target score reached!`);
        job.status = 'completed';
        job.progress = 100;
        return;
      }

      // Check for gates (critical issues)
      if (!report.gates.atsCompatible || !report.gates.spellcheckPassed) {
        this.logger.warn(`[${job.id}] Critical gate failed, stopping iteration`);
        job.status = 'completed';
        job.progress = 90;
        return;
      }
    }

    // Max iterations reached
    this.logger.log(`[${job.id}] Max iterations reached`);
    job.status = 'completed';
    job.progress = 100;
  }

  /**
   * Find bullet point swaps from experience bank.
   */
  private async findBulletSwaps(
    userId: string,
    jobPostingId: string,
    evaluationReport: any
  ): Promise<any[]> {
    const swaps: any[] = [];

    // Get job posting
    const jobPosting = await this.jobPostingService.getById(jobPostingId);
    if (!jobPosting) {
      return swaps;
    }

    // Get missing skills
    const missingSkills = evaluationReport.coverage?.missingSkills || [];

    // Search experience bank for bullets with missing skills
    for (const skill of missingSkills) {
      const results = await this.experienceBankService.search(userId, {
        query: skill,
        filters: {
          technologies: [skill],
          reviewed: true  // Only use reviewed bullets
        },
        limit: 3
      });

      for (const result of results) {
        swaps.push({
          skill,
          bullet: result.bulletText,
          score: result.metadata.impactScore,
          reason: `Adds missing skill: ${skill}`
        });
      }
    }

    return swaps;
  }

  /**
   * Get job status.
   */
  getJobStatus(jobId: string): TailorResumeJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Get all jobs for a user.
   */
  getUserJobs(userId: string): TailorResumeJob[] {
    return Array.from(this.activeJobs.values()).filter(
      job => job.userId === userId
    );
  }

  /**
   * Cancel a job.
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.status === 'processing') {
      // TODO: Implement graceful cancellation
      job.status = 'failed';
      job.updatedAt = new Date();
    }

    return true;
  }
}

