import { Controller, Post, Body } from '@nestjs/common';
import { CoverLetterService, GenerateCoverLetterOptions } from '../../application/services/cover-letter.service';

@Controller('cover-letter')
export class CoverLetterController {
  constructor(private readonly coverLetterService: CoverLetterService) {}

  @Post('generate')
  async generateCoverLetter(
    @Body() body: {
      userId: string;
      options: GenerateCoverLetterOptions;
    }
  ) {
    return this.coverLetterService.generateCoverLetter(body.userId, body.options);
  }

  @Post(':id/regenerate')
  async regenerateCoverLetter(
    @Body() body: {
      options: Partial<GenerateCoverLetterOptions>;
    }
  ) {
    // TODO: Implement
    return { message: 'Not implemented' };
  }

  @Post(':id/edit')
  async editCoverLetter(
    @Body() body: {
      content: string;
    }
  ) {
    // TODO: Implement
    return { message: 'Not implemented' };
  }
}

