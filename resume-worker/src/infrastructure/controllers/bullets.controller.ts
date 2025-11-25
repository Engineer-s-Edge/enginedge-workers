import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { BulletsService } from '../../application/services/bullets.service';

@Controller('resume/bullets')
export class BulletsController {
  constructor(private readonly bulletsService: BulletsService) {}

  @Post('check-match')
  @HttpCode(HttpStatus.OK)
  async checkMatch(@Body() body: { bulletText: string; userId: string }) {
    return this.bulletsService.checkMatch(body.bulletText, body.userId);
  }

  @Post('create-reference')
  @HttpCode(HttpStatus.OK)
  async createReference(
    @Body()
    body: {
      bulletText: string;
      userId: string;
      metadata?: any;
      autoAddToBank?: boolean;
    },
  ) {
    return this.bulletsService.createReference(
      body.bulletText,
      body.userId,
      body.metadata,
      body.autoAddToBank,
    );
  }

  @Post('resolve-references')
  @HttpCode(HttpStatus.OK)
  async resolveReferences(
    @Body() body: { latexContent: string; userId: string },
  ) {
    return this.bulletsService.resolveReferences(
      body.latexContent,
      body.userId,
    );
  }
}
