import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Types } from 'mongoose';
import {
  ResumeService,
  CreateResumeDto,
  UpdateResumeDto,
} from '../../application/services/resume.service';

@Controller('resumes')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateResumeDto) {
    return await this.resumeService.create(dto);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return await this.resumeService.findById(new Types.ObjectId(id));
  }

  @Get('user/:userId')
  async findByUser(
    @Param('userId') userId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.resumeService.findByUser(userId, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() dto: UpdateResumeDto) {
    return await this.resumeService.update(new Types.ObjectId(id), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.resumeService.delete(new Types.ObjectId(id));
  }

  @Get('job-posting/:jobPostingId')
  async findByJobPosting(@Param('jobPostingId') jobPostingId: string) {
    return await this.resumeService.findByJobPosting(
      new Types.ObjectId(jobPostingId),
    );
  }
}
