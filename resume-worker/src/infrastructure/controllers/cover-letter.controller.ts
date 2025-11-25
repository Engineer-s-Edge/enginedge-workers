import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  CoverLetterService,
  GenerateCoverLetterOptions,
} from '../../application/services/cover-letter.service';

@Controller('resume/cover-letters')
export class CoverLetterController {
  constructor(private readonly coverLetterService: CoverLetterService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createCoverLetter(
    @Body()
    body: {
      userId: string;
      resumeId: string;
      jobPostingId?: string;
      latexContent: string;
    },
  ) {
    return this.coverLetterService.create(
      body.userId,
      body.resumeId,
      body.jobPostingId,
      body.latexContent,
    );
  }

  @Get(':id')
  async getCoverLetter(@Param('id') id: string) {
    return this.coverLetterService.getById(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateCoverLetter(
    @Param('id') id: string,
    @Body()
    body: {
      latexContent?: string;
      version?: number;
    },
  ) {
    return this.coverLetterService.update(id, body);
  }

  @Get('resume/:resumeId')
  async getCoverLettersForResume(@Param('resumeId') resumeId: string) {
    return this.coverLetterService.getByResumeId(resumeId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteCoverLetter(@Param('id') id: string) {
    return this.coverLetterService.delete(id);
  }

  @Get(':id/export/tex')
  async exportTex(@Param('id') id: string, @Res() res: Response) {
    const result = await this.coverLetterService.exportTex(id);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cover-letter.tex"`,
    );
    res.send(result.content);
  }

  @Get(':id/export/pdf')
  async exportPdf(@Param('id') id: string, @Res() res: Response) {
    const result = await this.coverLetterService.exportPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cover-letter.pdf"`,
    );
    // In production, fetch PDF from URL and stream it
    res.send('PDF export - would fetch from URL');
  }

  @Post('generate')
  async generateCoverLetter(
    @Body()
    body: {
      userId: string;
      resumeId: string;
      options: GenerateCoverLetterOptions;
    },
  ) {
    return this.coverLetterService.generateCoverLetter(body.userId, {
      ...body.options,
      resumeId: body.resumeId,
    });
  }

  @Post(':id/regenerate')
  async regenerateCoverLetter(
    @Param('id') id: string,
    @Body() body: { options: Partial<GenerateCoverLetterOptions> },
  ) {
    return this.coverLetterService.regenerateCoverLetter(id, body.options);
  }

  @Post(':id/edit')
  async editCoverLetter(
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.coverLetterService.editCoverLetter(id, body.content);
  }
}
