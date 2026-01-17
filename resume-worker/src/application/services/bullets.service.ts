import { Injectable, Logger } from '@nestjs/common';
import { ExperienceBankService } from './experience-bank.service';
import { Types } from 'mongoose';

@Injectable()
export class BulletsService {
  private readonly logger = new Logger(BulletsService.name);

  constructor(private readonly experienceBankService: ExperienceBankService) {}

  /**
   * Check if bullet text matches existing bank entry
   */
  async checkMatch(
    bulletText: string,
    userId: string,
  ): Promise<{
    matches: boolean;
    bulletId?: string;
    exactMatch: boolean;
    similarBullets: Array<{
      id: string;
      text: string;
      similarity: number;
    }>;
  }> {
    return this.experienceBankService.checkMatch(bulletText, userId);
  }

  /**
   * Create bullet reference
   */
  async createReference(
    bulletText: string,
    userId: string,
    metadata?: any,
    autoAddToBank: boolean = true,
  ): Promise<{
    referenceId: string;
    created: boolean;
    bulletId: string;
    referenceCommand: string;
  }> {
    // Check if bullet matches existing entry
    const match = await this.experienceBankService.checkMatch(
      bulletText,
      userId,
    );

    if (match.matches && match.bulletId) {
      return {
        referenceId: match.bulletId,
        created: false,
        bulletId: match.bulletId,
        referenceCommand: `\\bulletref{${match.bulletId}}`,
      };
    }

    // If no match and autoAddToBank, create new entry
    if (autoAddToBank) {
      const bankMetadata = {
        technologies: metadata?.technologies || [],
        role: metadata?.role || '',
        company: metadata?.company || '',
        dateRange: metadata?.dateRange || {
          start: new Date(),
          end: null,
        },
        metrics: metadata?.metrics || [],
        keywords: metadata?.keywords || [],
        reviewed: false,
        linkedExperienceId: null,
        category: metadata?.category || 'achievement',
        impactScore: 0,
        atsScore: 0,
        lastUsedDate: null,
        usageCount: 0,
      };

      const bankBullet = await this.experienceBankService.add({
        userId,
        bulletText,
        metadata: bankMetadata,
      });

      return {
        referenceId: bankBullet._id.toString(),
        created: true,
        bulletId: bankBullet._id.toString(),
        referenceCommand: `\\bulletref{${bankBullet._id}}`,
      };
    }

    throw new Error('Bullet not found and autoAddToBank is false');
  }

  /**
   * Resolve bullet references in LaTeX
   */
  async resolveReferences(
    latexContent: string,
    userId: string,
  ): Promise<{
    resolvedLatex: string;
    references: Array<{
      referenceId: string;
      resolvedText: string;
      status: string;
    }>;
    unresolvedReferences: string[];
  }> {
    // Find all bullet references
    const refMatches = Array.from(
      latexContent.matchAll(/\\bulletref\{([^}]+)\}/g),
    );
    const references: Array<{
      referenceId: string;
      resolvedText: string;
      status: string;
    }> = [];
    const unresolvedReferences: string[] = [];

    let resolvedLatex = latexContent;

    for (const match of refMatches) {
      const bulletId = match[1];
      try {
        const bullet = await this.experienceBankService.findById(
          new Types.ObjectId(bulletId),
        );

        if (bullet && bullet.userId === userId) {
          // Replace reference with actual text
          resolvedLatex = resolvedLatex.replace(match[0], bullet.bulletText);
          references.push({
            referenceId: bulletId,
            resolvedText: bullet.bulletText,
            status: 'resolved',
          });
        } else {
          unresolvedReferences.push(bulletId);
        }
      } catch (error) {
        unresolvedReferences.push(bulletId);
      }
    }

    return {
      resolvedLatex,
      references,
      unresolvedReferences,
    };
  }
}
