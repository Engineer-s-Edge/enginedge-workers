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

@Controller('resume/job-postings')
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
  async getUserPostings(
    @Param('userId') userId: string,
    @Query('search') search?: string,
    @Query('tags') tags?: string,
    @Query('company') company?: string,
    @Query('role') role?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // If no query params, use simple getByUserId
    if (!search && !tags && !company && !role && !startDate && !endDate) {
      return this.jobPostingService.getByUserId(userId);
    }

    return this.jobPostingService.searchAndFilter(userId, {
      search,
      tags: tags ? tags.split(',') : undefined,
      company,
      role,
      startDate,
      endDate,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Delete(':id')
  async deletePosting(@Param('id') id: string) {
    const deleted = await this.jobPostingService.delete(id);
    return { success: deleted };
  }

  @Patch(':id')
  async updatePosting(
    @Param('id') id: string,
    @Body() body: {
      tags?: string[];
      notes?: string;
    },
  ) {
    return this.jobPostingService.update(id, body);
  }

  @Get('user/:userId/summary')
  async getUserPostingsSummary(
    @Param('userId') userId: string,
    @Query() query: any,
  ) {
    return this.jobPostingService.getSummary(userId, query);
  }
}
