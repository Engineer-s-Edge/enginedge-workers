import { Controller, Post, Get, Delete, Body, Param, Query } from '@nestjs/common';
import { ResumeTailoringService, TailorResumeRequest } from '../../application/services/resume-tailoring.service';

@Controller('tailor')
export class ResumeTailoringController {
  constructor(private readonly tailoringService: ResumeTailoringService) {}

  @Post()
  async startTailoring(@Body() request: TailorResumeRequest) {
    return this.tailoringService.startTailoringJob(request);
  }

  @Get('job/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.tailoringService.getJobStatus(jobId);
  }

  @Get('user/:userId/jobs')
  async getUserJobs(@Param('userId') userId: string) {
    return this.tailoringService.getUserJobs(userId);
  }

  @Delete('job/:jobId')
  async cancelJob(@Param('jobId') jobId: string) {
    const cancelled = await this.tailoringService.cancelJob(jobId);
    return { success: cancelled };
  }
}

