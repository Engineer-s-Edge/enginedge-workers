import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { JobPostingService } from '../../application/services/job-posting.service';

@Controller('job-postings')
export class JobPostingController {
  constructor(private readonly jobPostingService: JobPostingService) {}

  @Post('extract')
  async extractPosting(
    @Body() body: { userId: string; text: string; url?: string; html?: string },
  ) {
    return this.jobPostingService.extractFromText(
      body.userId,
      body.text,
      body.url,
      body.html,
    );
  }

  @Get(':id')
  async getPosting(@Param('id') id: string) {
    return this.jobPostingService.getById(id);
  }

  @Get('user/:userId')
  async getUserPostings(@Param('userId') userId: string) {
    return this.jobPostingService.getByUserId(userId);
  }

  @Delete(':id')
  async deletePosting(@Param('id') id: string) {
    const deleted = await this.jobPostingService.delete(id);
    return { success: deleted };
  }
}
