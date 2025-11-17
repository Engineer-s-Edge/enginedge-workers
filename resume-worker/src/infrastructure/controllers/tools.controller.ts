import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ToolsService } from '../../application/services/tools.service';

@Controller('resume/tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Post('create-bullet')
  @HttpCode(HttpStatus.CREATED)
  async createDraftBullet(@Body() body: {
    userId: string;
    text: string;
    role?: string;
    company?: string;
    metadata?: any;
  }) {
    return this.toolsService.createDraftBullet(
      body.userId,
      body.text,
      body.role,
      body.company,
      body.metadata,
    );
  }

  @Post('evaluate-bullet')
  @HttpCode(HttpStatus.OK)
  async evaluateBullet(@Body() body: {
    bulletText: string;
    role?: string;
  }) {
    return this.toolsService.evaluateBullet(body.bulletText, body.role);
  }

  @Post('add-bullet-to-bank')
  @HttpCode(HttpStatus.CREATED)
  async addBulletToBank(@Body() body: {
    bulletId?: string;
    bulletText: string;
    metadata: any;
    scores?: any;
  }) {
    return this.toolsService.addBulletToBank(
      body.bulletId,
      body.bulletText,
      body.metadata,
      body.scores,
    );
  }

  @Post('flag-bullet')
  @HttpCode(HttpStatus.OK)
  async flagBullet(@Body() body: {
    bulletId: string;
    comment: string;
    reason?: string;
  }) {
    return this.toolsService.flagBullet(
      body.bulletId,
      body.comment,
      body.reason,
    );
  }

  @Delete('remove-bullet-from-bank/:bulletId')
  @HttpCode(HttpStatus.OK)
  async removeBulletFromBank(@Param('bulletId') bulletId: string) {
    return this.toolsService.removeBulletFromBank(bulletId);
  }

  @Get('get-unreviewed-bullets')
  async getUnreviewedBullets(
    @Query('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.toolsService.getUnreviewedBullets(
      userId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('get-flagged-bullets')
  async getFlaggedBullets(@Query('userId') userId: string) {
    return this.toolsService.getFlaggedBullets(userId);
  }

  @Post('edit-cover-letter-latex')
  @HttpCode(HttpStatus.OK)
  async editCoverLetterLatex(@Body() body: {
    coverLetterId: string;
    latex: string;
    editType: string;
  }) {
    return this.toolsService.editCoverLetterLatex(
      body.coverLetterId,
      body.latex,
      body.editType,
    );
  }

  @Post('build-cover-letter-latex')
  @HttpCode(HttpStatus.OK)
  async buildCoverLetterLatex(@Body() body: {
    coverLetterId: string;
    latex?: string;
  }) {
    return this.toolsService.buildCoverLetterLatex(
      body.coverLetterId,
      body.latex,
    );
  }
}
