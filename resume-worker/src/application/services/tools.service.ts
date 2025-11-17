import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExperienceBankItemSchema } from '../../infrastructure/database/schemas/experience-bank-item.schema';
import { ExperienceBankService, ExperienceBankItemMetadata } from './experience-bank.service';
import { BulletEvaluatorService } from './bullet-evaluator.service';
import { CoverLetterService } from './cover-letter.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);
  private draftBullets = new Map<string, any>(); // Temporary storage for draft bullets

  constructor(
    @InjectModel('ExperienceBankItem')
    private readonly experienceBankModel: Model<ExperienceBankItemSchema>,
    private readonly experienceBankService: ExperienceBankService,
    private readonly bulletEvaluatorService: BulletEvaluatorService,
    private readonly coverLetterService: CoverLetterService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create draft bullet (not yet in Experience Bank)
   */
  async createDraftBullet(
    userId: string,
    text: string,
    role?: string,
    company?: string,
    metadata?: any,
  ): Promise<{
    success: boolean;
    bulletId: string;
    text: string;
    score: number | null;
  }> {
    const bulletId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const draftBullet = {
      id: bulletId,
      userId,
      text,
      role,
      company,
      metadata: metadata || {},
      score: null,
      createdAt: new Date(),
    };

    this.draftBullets.set(bulletId, draftBullet);

    return {
      success: true,
      bulletId,
      text,
      score: null,
    };
  }

  /**
   * Evaluate bullet (wrapper around bullet evaluator)
   */
  async evaluateBullet(
    bulletText: string,
    role?: string,
  ): Promise<{
    success: boolean;
    score: number;
    feedback: string;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  }> {
    const evaluation = await this.bulletEvaluatorService.evaluateBullet(
      bulletText,
      role,
      true,
      true,
    );

    return {
      success: true,
      score: Math.round(evaluation.overallScore * 100),
      feedback: evaluation.feedback?.join('; ') || 'No feedback available',
      strengths: evaluation.checks
        ? Object.entries(evaluation.checks)
            .filter(([, check]: [string, any]) => check.passed)
            .map(([key]) => key)
        : [],
      weaknesses: evaluation.checks
        ? Object.entries(evaluation.checks)
            .filter(([, check]: [string, any]) => !check.passed)
            .map(([key]) => key)
        : [],
      suggestions: evaluation.suggestedFixes?.map(fix => fix.description) || [],
    };
  }

  /**
   * Add bullet to Experience Bank
   */
  async addBulletToBank(
    bulletId: string | undefined,
    bulletText: string,
    metadata: any,
    scores?: any,
  ): Promise<{
    success: boolean;
    bulletId: string;
  }> {
    // If draft bullet, get from draft storage
    let draftBullet = null;
    if (bulletId && bulletId.startsWith('draft_')) {
      draftBullet = this.draftBullets.get(bulletId);
    }

    const userId = draftBullet?.userId || metadata.userId || 'unknown';

    const bankMetadata: ExperienceBankItemMetadata = {
      technologies: metadata.technologies || [],
      role: metadata.role || draftBullet?.role || '',
      company: metadata.company || draftBullet?.company || '',
      dateRange: metadata.dateRange || {
        start: new Date(),
        end: null,
      },
      metrics: metadata.metrics || [],
      keywords: metadata.keywords || [],
      reviewed: false,
      linkedExperienceId: null,
      category: metadata.category || 'achievement',
      impactScore: scores?.impactScore || 0,
      atsScore: scores?.atsScore || 0,
      lastUsedDate: null,
      usageCount: 0,
    };

    const bankBullet = await this.experienceBankService.add({
      userId,
      bulletText,
      metadata: bankMetadata,
    });

    // Delete draft if it was a draft
    if (draftBullet) {
      this.draftBullets.delete(bulletId);
    }

    return {
      success: true,
      bulletId: bankBullet._id.toString(),
    };
  }

  /**
   * Flag bullet with comment
   */
  async flagBullet(
    bulletId: string,
    comment: string,
    reason?: string,
  ): Promise<{
    success: boolean;
    bulletId: string;
  }> {
    await this.experienceBankService.updateBullet(
      new Types.ObjectId(bulletId),
      {
        metadata: {
          needsEditing: true,
          flagComment: comment,
          flagReason: reason || 'inconsistency',
          flaggedAt: new Date(),
        },
      },
    );

    return {
      success: true,
      bulletId,
    };
  }

  /**
   * Remove bullet from Experience Bank
   */
  async removeBulletFromBank(bulletId: string): Promise<{
    success: boolean;
  }> {
    await this.experienceBankService.delete(new Types.ObjectId(bulletId));
    return { success: true };
  }

  /**
   * Get unreviewed bullets
   */
  async getUnreviewedBullets(
    userId: string,
    limit: number = 10,
  ): Promise<{
    success: boolean;
    bullets: Array<{
      id: string;
      text: string;
      metadata: any;
      scores: any;
    }>;
  }> {
    const bullets = await this.experienceBankService.findByUser(userId, {
      reviewed: false,
      limit,
    });

    return {
      success: true,
      bullets: bullets.map(bullet => ({
        id: bullet._id.toString(),
        text: bullet.bulletText,
        metadata: bullet.metadata,
        scores: {
          impactScore: bullet.metadata.impactScore,
          atsScore: bullet.metadata.atsScore,
        },
      })),
    };
  }

  /**
   * Get flagged bullets
   */
  async getFlaggedBullets(userId: string): Promise<{
    success: boolean;
    bullets: Array<{
      id: string;
      text: string;
      comment: string;
      metadata: any;
    }>;
  }> {
    const bullets = await this.experienceBankService.findByUser(userId, {
      needsEditing: true,
    });

    return {
      success: true,
      bullets: bullets
        .filter(bullet => bullet.metadata.needsEditing)
        .map(bullet => ({
          id: bullet._id.toString(),
          text: bullet.bulletText,
          comment: bullet.metadata.flagComment || '',
          metadata: bullet.metadata,
        })),
    };
  }

  /**
   * Edit cover letter LaTeX
   */
  async editCoverLetterLatex(
    coverLetterId: string,
    latex: string,
    editType: string,
  ): Promise<{
    success: boolean;
    updatedLatex: string;
    lintingErrors: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
    }>;
  }> {
    // Update cover letter
    await this.coverLetterService.editCoverLetter(coverLetterId, latex);

    // Get linting errors (simplified - in production, call LaTeX linting service)
    const lintingErrors = this.lintLatex(latex);

    return {
      success: true,
      updatedLatex: latex,
      lintingErrors,
    };
  }

  /**
   * Build cover letter LaTeX to PDF
   */
  async buildCoverLetterLatex(
    coverLetterId: string,
    latex?: string,
  ): Promise<{
    success: boolean;
    pdfUrl: string;
    buildErrors: Array<{
      line: number;
      message: string;
      severity: string;
    }>;
  }> {
    // Get cover letter if latex not provided
    let coverLetterLatex = latex;
    if (!coverLetterLatex) {
      const coverLetter = await this.coverLetterService.getById(coverLetterId);
      if (!coverLetter) {
        throw new Error('Cover letter not found');
      }
      coverLetterLatex = coverLetter.latexContent;
    }

    // Compile LaTeX to PDF
    const latexWorkerUrl =
      this.configService.get<string>('LATEX_WORKER_URL') ||
      'http://localhost:3005';

    const response = await fetch(`${latexWorkerUrl}/latex/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: coverLetterLatex,
        userId: 'system',
        settings: {
          engine: 'xelatex',
          maxPasses: 2,
          timeout: 60000,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        pdfUrl: '',
        buildErrors: [
          {
            line: 0,
            message: `Compilation failed: ${errorText}`,
            severity: 'error',
          },
        ],
      };
    }

    const result = await response.json();
    const buildErrors = this.parseBuildErrors(result.logs || '');

    return {
      success: true,
      pdfUrl: result.pdfUrl || result.pdf,
      buildErrors,
    };
  }

  /**
   * Simple LaTeX linting (simplified)
   */
  private lintLatex(latex: string): Array<{
    line: number;
    column: number;
    message: string;
    severity: string;
  }> {
    const errors: Array<{
      line: number;
      column: number;
      message: string;
      severity: string;
    }> = [];

    const lines = latex.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for unmatched braces
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push({
          line: i + 1,
          column: line.length,
          message: 'Unmatched braces',
          severity: 'error',
        });
      }

      // Check for undefined commands (simplified)
      const undefinedCommandMatch = line.match(/\\([a-zA-Z]+)\{/);
      if (undefinedCommandMatch) {
        const command = undefinedCommandMatch[1];
        const commonCommands = ['documentclass', 'begin', 'end', 'section', 'item', 'textbf', 'textit'];
        if (!commonCommands.includes(command) && !line.includes(`\\usepackage{${command}}`)) {
          errors.push({
            line: i + 1,
            column: undefinedCommandMatch.index || 0,
            message: `Potentially undefined command: \\${command}`,
            severity: 'warning',
          });
        }
      }
    }

    return errors;
  }

  /**
   * Parse build errors from LaTeX compilation logs
   */
  private parseBuildErrors(logs: string): Array<{
    line: number;
    message: string;
    severity: string;
  }> {
    const errors: Array<{
      line: number;
      message: string;
      severity: string;
    }> = [];

    // Simple parsing - look for error patterns
    const errorPattern = /! (.*?)\n.*?l\.(\d+)/g;
    let match;
    while ((match = errorPattern.exec(logs)) !== null) {
      errors.push({
        line: parseInt(match[2], 10),
        message: match[1],
        severity: 'error',
      });
    }

    return errors;
  }
}
