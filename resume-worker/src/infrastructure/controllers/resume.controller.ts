import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Types } from 'mongoose';
import {
  ResumeService,
  CreateResumeDto,
  UpdateResumeDto,
} from '../../application/services/resume.service';
import { ResumeEditingService } from '../../application/services/resume-editing.service';

@Controller('resume/resumes')
export class ResumeController {
  constructor(
    private readonly resumeService: ResumeService,
    private readonly resumeEditingService: ResumeEditingService,
  ) {}

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

  @Post(':resumeId/apply-template')
  @HttpCode(HttpStatus.OK)
  async applyTemplate(
    @Param('resumeId') resumeId: string,
    @Body()
    body: {
      templateId: string;
      preserveBullets: boolean;
      userData: any;
      options: any;
    },
  ) {
    return this.resumeEditingService.applyTemplate(
      resumeId,
      body.templateId,
      body.preserveBullets,
      body.userData,
      body.options,
    );
  }

  @Patch(':resumeId/sections/reorder')
  @HttpCode(HttpStatus.OK)
  async reorderSections(
    @Param('resumeId') resumeId: string,
    @Body() body: { sectionOrder: string[] },
  ) {
    return this.resumeEditingService.reorderSections(
      resumeId,
      body.sectionOrder,
    );
  }

  @Patch(':resumeId/formatting')
  @HttpCode(HttpStatus.OK)
  async updateFormatting(
    @Param('resumeId') resumeId: string,
    @Body() body: { formatting: any },
  ) {
    return this.resumeEditingService.updateFormatting(
      resumeId,
      body.formatting,
    );
  }

  @Patch(':id/layout')
  @HttpCode(HttpStatus.OK)
  async saveLayout(@Param('id') id: string, @Body() body: { layout: any }) {
    return this.resumeService.saveLayout(new Types.ObjectId(id), body.layout);
  }

  @Get(':id/layout')
  async getLayout(@Param('id') id: string) {
    return this.resumeService.getLayout(new Types.ObjectId(id));
  }

  @Get(':id/export/tex')
  async exportTex(@Param('id') id: string, @Res() res: Response) {
    const result = await this.resumeService.exportTex(new Types.ObjectId(id));
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.content);
  }

  @Get(':id/export/pdf')
  async exportPdf(@Param('id') id: string, @Res() res: Response) {
    const result = await this.resumeService.exportPdf(new Types.ObjectId(id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    // In production, fetch PDF from URL and stream it
    res.redirect(result.pdfUrl);
  }

  @Get(':id/sync-status')
  async getSyncStatus(@Param('id') id: string) {
    return this.resumeService.getSyncStatus(new Types.ObjectId(id));
  }

  @Get(':id/locations')
  async getLocations(
    @Param('id') id: string,
    @Query('finding') finding: string,
    @Query('format') format: string = 'latex-lines',
  ) {
    return this.resumeService.getLocations(
      new Types.ObjectId(id),
      finding,
      format,
    );
  }

  @Get(':resumeId/current-job-posting')
  async getCurrentJobPosting(@Param('resumeId') resumeId: string) {
    return this.resumeService.getCurrentJobPosting(
      new Types.ObjectId(resumeId),
    );
  }

  @Patch(':resumeId/current-job-posting')
  @HttpCode(HttpStatus.OK)
  async setCurrentJobPosting(
    @Param('resumeId') resumeId: string,
    @Body() body: { jobPostingId: string },
  ) {
    return this.resumeService.setCurrentJobPosting(
      new Types.ObjectId(resumeId),
      body.jobPostingId,
    );
  }
}
