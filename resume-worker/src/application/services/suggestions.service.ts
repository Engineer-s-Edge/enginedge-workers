import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ResumeSchema } from '../../infrastructure/database/schemas/resume.schema';
import { JobPostingSchema } from '../../infrastructure/database/schemas/job-posting.schema';
import { ResumeEvaluatorService } from './resume-evaluator.service';
import { ExperienceBankService } from './experience-bank.service';
import { BulletEvaluatorService } from './bullet-evaluator.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SuggestionsService {
  private readonly logger = new Logger(SuggestionsService.name);

  constructor(
    @InjectModel('Resume')
    private readonly resumeModel: Model<ResumeSchema>,
    @InjectModel('JobPosting')
    private readonly jobPostingModel: Model<JobPostingSchema>,
    private readonly resumeEvaluatorService: ResumeEvaluatorService,
    private readonly experienceBankService: ExperienceBankService,
    private readonly bulletEvaluatorService: BulletEvaluatorService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Score a single bullet point against a job posting
   */
  async scoreBullet(
    bulletText: string,
    jobPostingId: string,
    userId: string,
  ): Promise<{
    bulletText: string;
    score: number;
    breakdown: {
      keywordMatch: number;
      skillAlignment: number;
      roleRelevance: number;
    };
    matchedKeywords: string[];
    missingKeywords: string[];
  }> {
    const jobPosting = await this.jobPostingModel.findById(jobPostingId).exec();
    if (!jobPosting) {
      throw new Error('Job posting not found');
    }

    const requiredSkills = jobPosting.parsed?.skills?.skillsExplicit || [];
    const jobText = (jobPosting.rawText || '').toLowerCase();
    const bulletLower = bulletText.toLowerCase();

    // Extract keywords from job posting
    const keywords = this.extractKeywords(jobText);

    // Check keyword matches
    const matchedKeywords: string[] = [];
    const missingKeywords: string[] = [];

    for (const keyword of keywords) {
      if (bulletLower.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      } else {
        missingKeywords.push(keyword);
      }
    }

    // Calculate keyword match score
    const keywordMatch =
      keywords.length > 0 ? matchedKeywords.length / keywords.length : 0.5;

    // Check skill alignment
    const matchedSkills: string[] = [];
    for (const skill of requiredSkills) {
      if (bulletLower.includes(skill.toLowerCase())) {
        matchedSkills.push(skill);
      }
    }
    const skillAlignment =
      requiredSkills.length > 0
        ? matchedSkills.length / requiredSkills.length
        : 0.5;

    // Role relevance (simplified - check if bullet mentions role-related terms)
    const roleTitle = jobPosting.parsed?.role?.titleRaw || '';
    const roleRelevance =
      roleTitle && bulletLower.includes(roleTitle.toLowerCase()) ? 0.9 : 0.7;

    const overallScore =
      keywordMatch * 0.4 + skillAlignment * 0.4 + roleRelevance * 0.2;

    return {
      bulletText,
      score: overallScore,
      breakdown: {
        keywordMatch,
        skillAlignment,
        roleRelevance,
      },
      matchedKeywords,
      missingKeywords: missingKeywords.slice(0, 10), // Limit to top 10
    };
  }

  /**
   * Score resume with a bullet point slotted in
   */
  async scoreResumeWithBullet(
    resumeId: string,
    bulletText: string,
    bulletId: string | undefined,
    targetSection: string,
    targetIndex: number,
    jobPostingId: string,
    replaceExisting: boolean,
    existingBulletId: string | undefined,
  ): Promise<{
    resumeId: string;
    currentScore: number;
    newScore: number;
    scoreImprovement: number;
    breakdown: {
      overall: number;
      ats: number;
      content: number;
      alignment: number;
    };
    changes: {
      bulletReplaced?: string;
      bulletAdded?: string;
    };
  }> {
    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error('Resume not found');
    }

    // Get current score
    const currentEvaluation = await this.resumeEvaluatorService.evaluateResume(
      resumeId,
      {
        mode: 'jd-match',
        jobPostingId,
        useLlm: false,
        generateAutoFixes: false,
      },
    );
    const currentScore = currentEvaluation.scores.overall / 100;

    // Create temporary resume with bullet slotted in
    const tempLatex = this.slotBulletIntoResume(
      resume.latexContent,
      bulletText,
      targetSection,
      targetIndex,
      replaceExisting,
    );

    // Create temporary resume document for evaluation
    const tempResume = await this.resumeModel.create({
      userId: resume.userId,
      name: `temp_${resume.name}`,
      latexContent: tempLatex,
      currentVersion: 1,
      versions: [],
      metadata: resume.metadata,
    });

    try {
      // Evaluate temporary resume
      const newEvaluation = await this.resumeEvaluatorService.evaluateResume(
        tempResume._id.toString(),
        {
          mode: 'jd-match',
          jobPostingId,
          useLlm: false,
          generateAutoFixes: false,
        },
      );
      const newScore = newEvaluation.scores.overall / 100;

      // Clean up temporary resume
      await this.resumeModel.deleteOne({ _id: tempResume._id }).exec();

      return {
        resumeId,
        currentScore,
        newScore,
        scoreImprovement: newScore - currentScore,
        breakdown: {
          overall: newScore,
          ats: newEvaluation.scores.atsParseability / 100,
          content: newEvaluation.scores.bulletQuality / 100,
          alignment: newEvaluation.scores.roleJdAlignment
            ? newEvaluation.scores.roleJdAlignment / 100
            : 0,
        },
        changes: {
          bulletReplaced: replaceExisting ? existingBulletId : undefined,
          bulletAdded: bulletId,
        },
      };
    } catch (error) {
      // Clean up on error
      await this.resumeModel.deleteOne({ _id: tempResume._id }).exec();
      throw error;
    }
  }

  /**
   * Get text improvement suggestions for a bullet
   */
  async getBulletImprovements(
    resumeId: string,
    bulletText: string,
    jobPostingId: string | undefined,
    minScoreImprovement: number,
    userId: string,
  ): Promise<{
    suggestions: Array<{
      currentText: string;
      suggestedText: string;
      scoreImprovement: {
        bulletScore: number;
        resumeScore: number;
      };
      reason: string;
      confidence: number;
    }>;
    currentBulletScore: number;
    jobPostingId?: string;
  }> {
    // Get current bullet score
    let currentBulletScore = 0.65; // Default
    if (jobPostingId) {
      const bulletScore = await this.scoreBullet(
        bulletText,
        jobPostingId,
        userId,
      );
      currentBulletScore = bulletScore.score;
    } else {
      const evaluation = await this.bulletEvaluatorService.evaluateBullet(
        bulletText,
        undefined,
        false,
        false,
      );
      currentBulletScore = evaluation.overallScore;
    }

    // Generate improvement suggestions (simplified - in production, use LLM)
    const suggestions: Array<{
      currentText: string;
      suggestedText: string;
      scoreImprovement: { bulletScore: number; resumeScore: number };
      reason: string;
      confidence: number;
    }> = [];

    // Simple improvement: add quantifiable metrics if missing
    if (!bulletText.match(/\d+%|\d+\s*(percent|times|years|months)/i)) {
      const improved = `${bulletText} resulting in 30% improvement`;
      let improvedScore = currentBulletScore;
      if (jobPostingId) {
        const score = await this.scoreBullet(improved, jobPostingId, userId);
        improvedScore = score.score;
      }

      const bulletScoreImprovement = improvedScore - currentBulletScore;
      if (bulletScoreImprovement >= minScoreImprovement) {
        suggestions.push({
          currentText: bulletText,
          suggestedText: improved,
          scoreImprovement: {
            bulletScore: bulletScoreImprovement,
            resumeScore: bulletScoreImprovement * 0.1, // Approximate resume impact
          },
          reason: 'Adds quantifiable metrics',
          confidence: 0.8,
        });
      }
    }

    // Add technology suggestions if job posting provided
    if (jobPostingId) {
      const jobPosting = await this.jobPostingModel
        .findById(jobPostingId)
        .exec();
      if (jobPosting) {
        const requiredSkills = jobPosting.parsed?.skills?.skillsExplicit || [];
        const missingSkills = requiredSkills
          .filter(
            (skill: string) =>
              !bulletText.toLowerCase().includes(skill.toLowerCase()),
          )
          .slice(0, 2);

        for (const skill of missingSkills) {
          const improved = `${bulletText} using ${skill}`;
          const score = await this.scoreBullet(improved, jobPostingId, userId);
          const bulletScoreImprovement = score.score - currentBulletScore;

          if (bulletScoreImprovement >= minScoreImprovement) {
            suggestions.push({
              currentText: bulletText,
              suggestedText: improved,
              scoreImprovement: {
                bulletScore: bulletScoreImprovement,
                resumeScore: bulletScoreImprovement * 0.1,
              },
              reason: `Adds missing skill: ${skill}`,
              confidence: 0.9,
            });
          }
        }
      }
    }

    return {
      suggestions,
      currentBulletScore,
      jobPostingId,
    };
  }

  /**
   * Get experience bank swap suggestions
   */
  async getBankSwaps(
    resumeId: string,
    jobPostingId: string | undefined,
    userId: string,
    minScoreImprovement: number,
    limit: number,
  ): Promise<{
    suggestions: Array<{
      currentBullet: {
        id: string;
        text: string;
        section: string;
        index: number;
        currentScore: number;
      };
      suggestedBullet: {
        id: string;
        text: string;
        source: string;
        suggestedScore: number;
      };
      scoreImprovement: {
        bulletScore: number;
        resumeScore: number;
      };
      reason: string;
      confidence: number;
    }>;
    currentResumeScore: number;
    jobPostingId?: string;
  }> {
    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error('Resume not found');
    }

    // Get current resume score
    let currentResumeScore = 0.75;
    if (jobPostingId) {
      const evaluation = await this.resumeEvaluatorService.evaluateResume(
        resumeId,
        {
          mode: 'jd-match',
          jobPostingId,
          useLlm: false,
          generateAutoFixes: false,
        },
      );
      currentResumeScore = evaluation.scores.overall / 100;
    }

    // Parse resume to find bullets
    const parsedResume = this.parseResumeBullets(resume.latexContent);

    // Search experience bank for potential swaps
    const searchQuery = jobPostingId
      ? await this.getJobPostingSearchQuery(jobPostingId)
      : '';

    const bankBullets = await this.experienceBankService.search(userId, {
      query: searchQuery,
      filters: {
        reviewed: true,
        minImpactScore: 0.7,
      },
      limit: 50,
    });

    const suggestions: Array<{
      currentBullet: {
        id: string;
        text: string;
        section: string;
        index: number;
        currentScore: number;
      };
      suggestedBullet: {
        id: string;
        text: string;
        source: string;
        suggestedScore: number;
      };
      scoreImprovement: {
        bulletScore: number;
        resumeScore: number;
      };
      reason: string;
      confidence: number;
    }> = [];

    // For each bullet in resume, try swapping with bank bullets
    for (const bullet of parsedResume.bullets) {
      for (const bankBullet of bankBullets.slice(0, 10)) {
        // Score current bullet
        let currentBulletScore = 0.65;
        if (jobPostingId) {
          const score = await this.scoreBullet(
            bullet.text,
            jobPostingId,
            userId,
          );
          currentBulletScore = score.score;
        }

        // Score suggested bullet
        let suggestedBulletScore = bankBullet.metadata.impactScore;
        if (jobPostingId) {
          const score = await this.scoreBullet(
            bankBullet.bulletText,
            jobPostingId,
            userId,
          );
          suggestedBulletScore = score.score;
        }

        const bulletScoreImprovement =
          suggestedBulletScore - currentBulletScore;

        if (bulletScoreImprovement >= minScoreImprovement) {
          // Score resume with swap
          const swapScore = await this.scoreResumeWithBullet(
            resumeId,
            bankBullet.bulletText,
            bankBullet._id.toString(),
            bullet.section,
            bullet.index,
            jobPostingId!,
            true,
            bullet.id,
          );

          const resumeScoreImprovement = swapScore.scoreImprovement;

          if (resumeScoreImprovement >= minScoreImprovement) {
            suggestions.push({
              currentBullet: {
                id: bullet.id,
                text: bullet.text,
                section: bullet.section,
                index: bullet.index,
                currentScore: currentBulletScore,
              },
              suggestedBullet: {
                id: bankBullet._id.toString(),
                text: bankBullet.bulletText,
                source: 'experience-bank',
                suggestedScore: suggestedBulletScore,
              },
              scoreImprovement: {
                bulletScore: bulletScoreImprovement,
                resumeScore: resumeScoreImprovement,
              },
              reason: 'Better quantifiable metrics and specific technologies',
              confidence: 0.95,
            });
          }
        }
      }
    }

    // Sort by resume score improvement and limit
    suggestions.sort(
      (a, b) => b.scoreImprovement.resumeScore - a.scoreImprovement.resumeScore,
    );

    return {
      suggestions: suggestions.slice(0, limit),
      currentResumeScore,
      jobPostingId,
    };
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction (in production, use NLP)
    const words = text.match(/\b\w{4,}\b/g) || [];
    const wordFreq = new Map<string, number>();

    for (const word of words) {
      const lower = word.toLowerCase();
      wordFreq.set(lower, (wordFreq.get(lower) || 0) + 1);
    }

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  }

  /**
   * Get search query from job posting
   */
  private async getJobPostingSearchQuery(
    jobPostingId: string,
  ): Promise<string> {
    const jobPosting = await this.jobPostingModel.findById(jobPostingId).exec();
    if (!jobPosting) {
      return '';
    }

    const skills = jobPosting.parsed?.skills?.skillsExplicit || [];
    return skills.slice(0, 3).join(' ');
  }

  /**
   * Parse resume to extract bullets
   */
  private parseResumeBullets(latexContent: string): {
    bullets: Array<{
      id: string;
      text: string;
      section: string;
      index: number;
    }>;
  } {
    const bullets: Array<{
      id: string;
      text: string;
      section: string;
      index: number;
    }> = [];

    // Simple parsing - extract \item commands
    const itemMatches = latexContent.matchAll(/\\item\s+([^\n]+)/g);
    let index = 0;
    for (const match of itemMatches) {
      bullets.push({
        id: `bullet_${index}`,
        text: match[1].trim(),
        section: 'experience', // Simplified
        index: index++,
      });
    }

    return { bullets };
  }

  /**
   * Slot bullet into resume LaTeX
   */
  private slotBulletIntoResume(
    latexContent: string,
    bulletText: string,
    targetSection: string,
    targetIndex: number,
    replaceExisting: boolean,
  ): string {
    // Simple implementation - in production, use proper LaTeX parser
    if (replaceExisting) {
      // Replace bullet at targetIndex
      const items = latexContent.match(/\\item\s+[^\n]+/g) || [];
      if (items[targetIndex]) {
        return latexContent.replace(items[targetIndex], `\\item ${bulletText}`);
      }
    } else {
      // Insert bullet at targetIndex
      const items = latexContent.match(/\\item\s+[^\n]+/g) || [];
      if (items[targetIndex]) {
        return latexContent.replace(
          items[targetIndex],
          `${items[targetIndex]}\n\\item ${bulletText}`,
        );
      }
    }

    return latexContent;
  }
}
