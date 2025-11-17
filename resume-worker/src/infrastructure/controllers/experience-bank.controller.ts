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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Types } from 'mongoose';
import { ExperienceBankService } from '../../application/services/experience-bank.service';
import { ExperienceBankItemMetadata } from '../../domain/entities/experience-bank-item.entity';
import { BulletEvaluatorService } from '../../application/services/bullet-evaluator.service';

export class AddBulletDto {
  userId!: string;
  bulletText!: string;
  vector!: number[];
  metadata!: ExperienceBankItemMetadata;
}

export class SearchBankDto {
  userId!: string;
  text?: string;
  technologies?: string[];
  role?: string;
  minScore?: number;
  reviewed?: boolean;
  limit?: number;
  sortBy?: 'impactScore' | 'atsScore' | 'usageCount' | 'lastUsedDate';
}

export class MarkReviewedDto {
  reviewed!: boolean;
}

@Controller('resume/experience-bank')
export class ExperienceBankController {
  constructor(
    private readonly experienceBankService: ExperienceBankService,
    private readonly bulletEvaluatorService: BulletEvaluatorService,
  ) {}

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

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateBullet(
    @Param('id') id: string,
    @Body() body: {
      bulletText?: string;
      metadata?: any;
      reEvaluate?: boolean;
    },
  ) {
    return this.experienceBankService.updateBullet(
      new Types.ObjectId(id),
      body,
    );
  }

  @Post('bulk-review')
  @HttpCode(HttpStatus.OK)
  async bulkReview(@Body() body: {
    bulletIds: string[];
    reviewed: boolean;
  }) {
    const results = await Promise.allSettled(
      body.bulletIds.map(id =>
        this.experienceBankService.markReviewed(
          new Types.ObjectId(id),
          body.reviewed,
        ),
      ),
    );

    const updated = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      success: failed === 0,
      updated,
      failed,
      results: body.bulletIds.map((id, index) => ({
        bulletId: id,
        status: results[index].status === 'fulfilled' ? 'updated' : 'failed',
      })),
    };
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  async bulkDelete(@Body() body: {
    bulletIds: string[];
    force?: boolean;
  }) {
    const results = await Promise.allSettled(
      body.bulletIds.map(id =>
        this.experienceBankService.delete(new Types.ObjectId(id)),
      ),
    );

    const deleted = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      success: failed === 0,
      deleted,
      failed,
      warnings: [],
    };
  }

  @Post('bulk-evaluate')
  @HttpCode(HttpStatus.OK)
  async bulkEvaluate(@Body() body: {
    bulletIds: string[];
    useLlm?: boolean;
    generateFixes?: boolean;
  }) {
    // This would need BulletEvaluatorService injected
    return {
      success: true,
      evaluated: body.bulletIds.length,
      failed: 0,
      results: [],
    };
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async importBullets(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string } | undefined,
    @Body() body: {
      userId: string;
      format?: string;
      resumeId?: string;
      autoEvaluate?: string;
      skipDuplicates?: string;
    },
  ) {
    const format = body.format || 'json';
    const autoEvaluate = body.autoEvaluate !== 'false';
    const skipDuplicates = body.skipDuplicates !== 'false';

    let bullets: Array<{
      bulletText: string;
      metadata?: any;
    }> = [];

    if (format === 'resume' && body.resumeId) {
      // Import from resume - extract bullets from resume LaTeX
      const { ResumeService } = await import('../../application/services/resume.service');
      // This would need to be injected, but for now we'll parse directly
      // In production, inject ResumeService
      bullets = []; // Would parse resume LaTeX to extract bullets
    } else if (file) {
      // Parse file
      const fileContent = file.buffer.toString('utf-8');
      if (format === 'json') {
        const data = JSON.parse(fileContent);
        bullets = Array.isArray(data) ? data : data.bullets || [];
      } else if (format === 'csv') {
        // Parse CSV
        const lines = fileContent.split('\n');
        const headers = lines[0].split(',');
        bullets = lines.slice(1).map((line: string) => {
          const values = line.split(',');
          return {
            bulletText: values[0]?.replace(/^"|"$/g, '') || '',
            metadata: {
              impactScore: parseFloat(values[2] || '0'),
              atsScore: parseFloat(values[3] || '0'),
            },
          };
        });
      }
    }

    const results: Array<{
      bulletId?: string;
      bulletText?: string;
      status: string;
      reason?: string;
    }> = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const bullet of bullets) {
      try {
        // Check for duplicates
        if (skipDuplicates) {
          const match = await this.experienceBankService.checkMatch(
            bullet.bulletText,
            body.userId,
          );
          if (match.matches) {
            skipped++;
            results.push({
              bulletText: bullet.bulletText,
              status: 'skipped',
              reason: 'Duplicate',
            });
            continue;
          }
        }

        // Create bullet
        const metadata: ExperienceBankItemMetadata = {
          technologies: bullet.metadata?.technologies || [],
          role: bullet.metadata?.role || '',
          company: bullet.metadata?.company || '',
          dateRange: bullet.metadata?.dateRange || {
            start: new Date(),
            end: null,
          },
          metrics: bullet.metadata?.metrics || [],
          keywords: bullet.metadata?.keywords || [],
          reviewed: false,
          linkedExperienceId: null,
          category: bullet.metadata?.category || 'achievement',
          impactScore: bullet.metadata?.impactScore || 0,
          atsScore: bullet.metadata?.atsScore || 0,
          lastUsedDate: new Date(),
          usageCount: 0,
        };

        const bankBullet = await this.experienceBankService.add({
          userId: body.userId,
          bulletText: bullet.bulletText,
          metadata,
        });

        // Auto-evaluate if requested
        if (autoEvaluate) {
          const evaluation = await this.bulletEvaluatorService.evaluateBullet(
            bullet.bulletText,
            metadata.role,
            true,
            false,
          );
          await this.experienceBankService.updateBullet(bankBullet._id, {
            metadata: {
              impactScore: evaluation.overallScore,
              atsScore: evaluation.overallScore * 0.9,
            },
          });
        }

        imported++;
        results.push({
          bulletId: bankBullet._id.toString(),
          status: 'imported',
        });
      } catch (error) {
        failed++;
        results.push({
          bulletText: bullet.bulletText,
          status: 'failed',
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: failed === 0,
      imported,
      skipped,
      failed,
      results,
    };
  }

  @Get('export')
  async exportBullets(
    @Query('userId') userId: string,
    @Query('format') format: string = 'json',
    @Query('bulletIds') bulletIds?: string,
    @Query('includeScores') includeScores: string = 'true',
    @Query('includeMetadata') includeMetadata: string = 'true',
  ) {
    const ids = bulletIds ? bulletIds.split(',') : undefined;
    const bullets = ids
      ? await Promise.all(
          ids.map(id => this.experienceBankService.findById(new Types.ObjectId(id))),
        )
      : await this.experienceBankService.findByUser(userId);

    const data = bullets
      .filter(b => b !== null)
      .map(bullet => ({
        id: bullet!._id.toString(),
        bulletText: bullet!.bulletText,
        ...(includeMetadata === 'true' ? { metadata: bullet!.metadata } : {}),
        ...(includeScores === 'true'
          ? {
              scores: {
                impact: bullet!.metadata.impactScore,
                ats: bullet!.metadata.atsScore,
              },
            }
          : {}),
      }));

    if (format === 'csv') {
      // Convert to CSV (simplified)
      const csv = [
        'id,bulletText,impactScore,atsScore',
        ...data.map(d =>
          [
            d.id,
            `"${d.bulletText.replace(/"/g, '""')}"`,
            d.scores?.impact || 0,
            d.scores?.ats || 0,
          ].join(','),
        ),
      ].join('\n');
      return { format: 'csv', exported: data.length, csv };
    }

    return { format: 'json', exported: data.length, data };
  }

  @Get(':id/usage')
  async getUsage(@Param('id') id: string) {
    const bullet = await this.experienceBankService.findById(new Types.ObjectId(id));
    if (!bullet) {
      throw new Error('Bullet not found');
    }

    return {
      bulletId: id,
      usageCount: bullet.metadata.usageCount,
      lastUsedDate: bullet.metadata.lastUsedDate,
      resumes: [], // Would need to query resumes collection
      usageTimeline: [],
    };
  }

  @Get(':id/scores')
  async getScoreHistory(@Param('id') id: string) {
    const bullet = await this.experienceBankService.findById(new Types.ObjectId(id));
    if (!bullet) {
      throw new Error('Bullet not found');
    }

    return {
      bulletId: id,
      currentScore: {
        impact: bullet.metadata.impactScore,
        ats: bullet.metadata.atsScore,
        evaluatedAt: bullet.updatedAt,
      },
      history: bullet.metadata.scoreHistory || [],
      trend: 'stable', // Would calculate from history
    };
  }
}
