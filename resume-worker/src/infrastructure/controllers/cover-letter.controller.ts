import { Controller, Post, Body, Param } from '@nestjs/common';
import {
  CoverLetterService,
  GenerateCoverLetterOptions,
} from '../../application/services/cover-letter.service';

@Controller('cover-letter')
export class CoverLetterController {
  constructor(private readonly coverLetterService: CoverLetterService) {}

  @Post('generate')
  async generateCoverLetter(
    @Body() body: { userId: string; options: GenerateCoverLetterOptions },
  ) {
    return this.coverLetterService.generateCoverLetter(
      body.userId,
      body.options,
    );
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
