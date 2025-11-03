import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ExperienceBankService } from '../../application/services/experience-bank.service';
import { ExperienceBankItemMetadata } from '../../domain/entities/experience-bank-item.entity';

export class AddBulletDto {
  userId: string;
  bulletText: string;
  vector: number[];
  metadata: ExperienceBankItemMetadata;
}

export class SearchBankDto {
  userId: string;
  text?: string;
  technologies?: string[];
  role?: string;
  minScore?: number;
  reviewed?: boolean;
  limit?: number;
  sortBy?: 'impactScore' | 'atsScore' | 'usageCount' | 'lastUsedDate';
}

export class MarkReviewedDto {
  reviewed: boolean;
}

@Controller('experience-bank')
export class ExperienceBankController {
  constructor(private readonly experienceBankService: ExperienceBankService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addBullet(@Body() dto: AddBulletDto) {
    return await this.experienceBankService.addBullet(
      dto.userId,
      dto.bulletText,
      dto.vector,
      dto.metadata,
    );
  }

  @Get('search')
  async search(@Query() query: SearchBankDto) {
    return await this.experienceBankService.search(query);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return await this.experienceBankService.findById(new Types.ObjectId(id));
  }

  @Get('user/:userId')
  async findByUser(
    @Param('userId') userId: string,
    @Query('reviewed') reviewed?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.experienceBankService.findByUser(userId, {
      reviewed: reviewed !== undefined ? reviewed === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Patch(':id/review')
  @HttpCode(HttpStatus.OK)
  async markReviewed(@Param('id') id: string, @Body() dto: MarkReviewedDto) {
    await this.experienceBankService.markReviewed(
      new Types.ObjectId(id),
      dto.reviewed,
    );
    return { success: true };
  }

  @Patch(':id/usage')
  @HttpCode(HttpStatus.OK)
  async updateUsage(@Param('id') id: string) {
    await this.experienceBankService.updateUsage(new Types.ObjectId(id));
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.experienceBankService.delete(new Types.ObjectId(id));
  }
}
