import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ResumeEditingService } from '../../application/services/resume-editing.service';
import { ResumeVersioningService } from '../../application/services/resume-versioning.service';

@Controller('resume/:resumeId/edit')
export class ResumeEditingController {
  constructor(
    private readonly editingService: ResumeEditingService,
    private readonly versioningService: ResumeVersioningService,
  ) {}

  @Post('apply')
  async applyEdit(
    @Param('resumeId') resumeId: string,
    @Body()
    body: {
      operation: any;
      createVersion?: boolean;
    },
  ) {
    return this.editingService.applyEdit(
      resumeId,
      body.operation,
      body.createVersion,
    );
  }

  @Post('undo')
  async undo(@Param('resumeId') resumeId: string) {
    return this.editingService.undo(resumeId);
  }

  @Post('redo')
  async redo(@Param('resumeId') resumeId: string) {
    return this.editingService.redo(resumeId);
  }

  @Get('stacks')
  async getStackSizes(@Param('resumeId') resumeId: string) {
    return this.editingService.getStackSizes(resumeId);
  }

  @Get('versions')
  async getVersionHistory(@Param('resumeId') resumeId: string) {
    return this.versioningService.getVersionHistory(resumeId);
  }

  @Get('versions/:versionNumber')
  async getVersion(
    @Param('resumeId') resumeId: string,
    @Param('versionNumber') versionNumber: number,
  ) {
    return this.versioningService.getVersion(resumeId, versionNumber);
  }

  @Post('versions/:versionNumber/rollback')
  async rollback(
    @Param('resumeId') resumeId: string,
    @Param('versionNumber') versionNumber: number,
  ) {
    return this.versioningService.rollbackToVersion(resumeId, versionNumber);
  }

  @Get('versions/compare/:version1/:version2')
  async compareVersions(
    @Param('resumeId') resumeId: string,
    @Param('version1') version1: number,
    @Param('version2') version2: number,
  ) {
    return this.versioningService.compareVersions(resumeId, version1, version2);
  }
}
