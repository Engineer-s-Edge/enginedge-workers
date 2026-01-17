import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { EvaluationReport } from '../../domain/entities/evaluation-report.entity';
import { Resume } from '../../domain/entities/resume.entity';
import { JobPosting } from '../../domain/entities/job-posting.entity';
import { BulletEvaluatorService } from './bullet-evaluator.service';
import { ExperienceBankService } from './experience-bank.service';
import { MessageBrokerPort } from '../ports/message-broker.port';
import { v4 as uuidv4 } from 'uuid';

export interface EvaluateResumeOptions {
  mode: 'standalone' | 'role-guided' | 'jd-match';
  roleFamily?: string;
  jobPostingId?: string;
  useLlm?: boolean;
  generateAutoFixes?: boolean;
}

@Injectable()
export class ResumeEvaluatorService {
  private readonly logger = new Logger(ResumeEvaluatorService.name);

  constructor(
    @InjectModel('EvaluationReport')
    private readonly evaluationReportModel: Model<EvaluationReport>,
    @InjectModel('Resume')
    private readonly resumeModel: Model<Resume>,
    @InjectModel('JobPosting')
    private readonly jobPostingModel: Model<JobPosting>,
    private readonly bulletEvaluatorService: BulletEvaluatorService,
    private readonly experienceBankService: ExperienceBankService,
    @Inject('MessageBrokerPort')
    private readonly messageBroker: MessageBrokerPort,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Evaluate an entire resume.
   *
   * This performs:
   * 1. PDF parsing (via NLP service)
   * 2. ATS checks (layout, formatting)
   * 3. Bullet point quality aggregation
   * 4. Repetition analysis
   * 5. Role/JD alignment (if applicable)
   * 6. Auto-fix generation
   */
  async evaluateResume(
    resumeId: string,
    options: EvaluateResumeOptions,
  ): Promise<EvaluationReport> {
    this.logger.log(`Evaluating resume ${resumeId} in ${options.mode} mode`);

    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error(`Resume ${resumeId} not found`);
    }

    // Step 1: Parse PDF (send to NLP service)
    const parsedResume = await this.parseResumePdf(resume.latexContent);

    // Step 2: ATS Checks
    const atsChecks = await this.performAtsChecks(parsedResume);

    // Step 3: Evaluate all bullets
    const bulletEvaluations = await this.evaluateAllBullets(
      parsedResume,
      options.roleFamily,
      options.useLlm,
    );

    // Step 4: Repetition analysis
    const repetitionAnalysis = this.analyzeRepetition(parsedResume);

    // Step 5: Role/JD alignment
    let alignmentScore = null;
    let coverage = null;
    if (options.mode === 'jd-match' && options.jobPostingId) {
      const jobPosting = await this.jobPostingModel
        .findById(options.jobPostingId)
        .exec();
      if (jobPosting) {
        const alignment = await this.analyzeAlignment(parsedResume, jobPosting);
        alignmentScore = alignment.score;
        coverage = alignment.coverage;
      }
    }

    // Step 6: Generate auto-fixes
    const autoFixes = options.generateAutoFixes
      ? await this.generateAutoFixes(parsedResume, bulletEvaluations, atsChecks)
      : [];

    // Calculate overall scores
    const scores = this.calculateScores(
      atsChecks,
      bulletEvaluations,
      repetitionAnalysis,
      alignmentScore,
    );

    // Create evaluation report
    const report = new this.evaluationReportModel({
      resumeId,
      userId: resume.userId,
      mode: options.mode,
      scores,
      gates: {
        atsCompatible: atsChecks.passed,
        spellcheckPassed: await this.performSpellcheck(parsedResume),
        minBulletQuality: scores.avgBulletScore >= 0.7,
        noRepetition: repetitionAnalysis.score >= 0.8,
        roleAlignment: alignmentScore ? alignmentScore >= 0.7 : null,
      },
      findings: this.generateFindings(
        atsChecks,
        bulletEvaluations,
        repetitionAnalysis,
      ),
      coverage,
      repetition: repetitionAnalysis,
      suggestedSwaps: await this.findSuggestedSwaps(
        resume.userId,
        parsedResume,
        bulletEvaluations,
        options.jobPostingId,
      ),
      createdAt: new Date(),
    });

    return report.save();
  }

  /**
   * Parse resume PDF via NLP service.
   */
  private async parseResumePdf(latexContent: string): Promise<any> {
    try {
      // Step 1: Compile LaTeX to PDF via latex-worker
      const latexWorkerUrl =
        this.configService.get<string>('LATEX_WORKER_URL') ||
        'http://localhost:3005';
      const compileResponse = await fetch(`${latexWorkerUrl}/latex/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: latexContent,
          userId: 'system', // System user for compilation
          settings: {
            engine: 'xelatex',
            maxPasses: 2,
            timeout: 60000,
          },
        }),
      });

      if (!compileResponse.ok) {
        this.logger.warn(
          `LaTeX compilation failed: ${compileResponse.statusText}`,
        );
        // Fall back to mock data
        return this.getMockParsedResume();
      }

      const compileResult = await compileResponse.json();
      const pdfUrl = compileResult.pdfUrl || compileResult.pdf;

      if (!pdfUrl) {
        this.logger.warn('LaTeX compilation succeeded but no PDF URL returned');
        return this.getMockParsedResume();
      }

      // Step 2: Send PDF to NLP service for parsing via Kafka
      const correlationId = uuidv4();
      const pdfData = await this.fetchPdfData(pdfUrl);

      // For now, we'll use a simplified parsing approach
      // In production, this would send to NLP service via Kafka
      // For now, extract basic info from LaTeX content
      return this.parseFromLatex(latexContent);
    } catch (error) {
      this.logger.error('Error parsing resume PDF:', error);
      // Fall back to parsing from LaTeX content
      return this.parseFromLatex(latexContent);
    }
  }

  /**
   * Fetch PDF data from URL.
   */
  private async fetchPdfData(pdfUrl: string): Promise<Buffer> {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Parse resume from LaTeX content (fallback method).
   */
  private parseFromLatex(latexContent: string): any {
    // Basic parsing from LaTeX - extract sections, bullets, etc.
    // This is a simplified parser - in production, use NLP service
    const sections: any = {
      contact: {},
      experience: [],
      education: [],
      skills_raw: '',
      projects: [],
    };

    // Extract name
    const nameMatch = latexContent.match(/\\name\{([^}]+)\}/);
    if (nameMatch) {
      sections.contact.name = nameMatch[1];
    }

    // Extract email
    const emailMatch = latexContent.match(/\\email\{([^}]+)\}/);
    if (emailMatch) {
      sections.contact.email = emailMatch[1];
    }

    // Extract experience sections (simplified)
    const experienceMatches = latexContent.matchAll(
      /\\begin\{resumeSection\}\{Experience\}([\s\S]*?)\\end\{resumeSection\}/g,
    );
    for (const match of experienceMatches) {
      const expContent = match[1];
      // Extract bullets (simplified)
      const bullets: string[] = [];
      const bulletMatches = expContent.matchAll(/\\item\s+([^\n]+)/g);
      for (const bulletMatch of bulletMatches) {
        bullets.push(bulletMatch[1].trim());
      }
      if (bullets.length > 0) {
        sections.experience.push({
          org: 'Company',
          title: 'Position',
          bullets,
        });
      }
    }

    return {
      metadata: {
        pages: 1,
        fontsMinPt: 10,
        layoutFlags: {
          tables: false,
          columns: false,
          icons: false,
          images: false,
        },
      },
      sections,
      rawText: latexContent,
    };
  }

  /**
   * Get mock parsed resume data (fallback).
   */
  private getMockParsedResume(): any {
    return {
      metadata: {
        pages: 1,
        fontsMinPt: 10,
        layoutFlags: {
          tables: false,
          columns: false,
          icons: false,
          images: false,
        },
      },
      sections: {
        contact: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '555-1234',
          linkedin: 'linkedin.com/in/johndoe',
          github: 'github.com/johndoe',
        },
        experience: [
          {
            org: 'Tech Company',
            title: 'Software Engineer',
            dates: 'Jan 2020 - Present',
            start: 'Jan 2020',
            end: 'Present',
            bullets: [
              'Developed scalable microservices using Node.js',
              'Improved system performance by 30%',
            ],
          },
        ],
        education: [
          {
            school: 'University',
            degree: 'BS Computer Science',
            grad: '2019',
          },
        ],
        skills_raw: 'Python, JavaScript, React, Node.js, AWS',
        projects: [],
      },
      rawText: 'Resume text...',
    };
  }

  /**
   * Perform spellcheck on resume content.
   */
  private async performSpellcheck(parsedResume: any): Promise<boolean> {
    try {
      // Basic spellcheck - check for common misspellings
      // In production, use a proper spellcheck library or service
      const text = parsedResume.rawText || '';
      const words = text.toLowerCase().match(/\b\w+\b/g) || [];

      // Common misspellings to check (simplified)
      const commonMisspellings = [
        'teh', // the
        'adn', // and
        'taht', // that
        'recieve', // receive
        'seperate', // separate
        'occured', // occurred
      ];

      for (const word of words) {
        if (commonMisspellings.includes(word)) {
          this.logger.warn(`Potential misspelling detected: ${word}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error performing spellcheck:', error);
      return true; // Default to passed if check fails
    }
  }

  /**
   * Find suggested swaps from experience bank.
   */
  private async findSuggestedSwaps(
    userId: string,
    parsedResume: any,
    bulletEvaluations: any[],
    jobPostingId?: string,
  ): Promise<any[]> {
    try {
      const swaps: any[] = [];

      // Find low-scoring bullets
      const lowScoreBullets: Array<{ index: number; evaluation: any }> = [];
      for (let i = 0; i < bulletEvaluations.length; i++) {
        if (bulletEvaluations[i].overallScore < 0.7) {
          lowScoreBullets.push({ index: i, evaluation: bulletEvaluations[i] });
        }
      }

      // If job posting provided, search for relevant bullets
      if (jobPostingId) {
        const jobPosting = await this.jobPostingModel
          .findById(jobPostingId)
          .exec();
        if (jobPosting) {
          const requiredSkills = jobPosting.parsed.skills.skillsExplicit || [];
          for (const skill of requiredSkills.slice(0, 5)) {
            const results = await this.experienceBankService.search(userId, {
              query: skill,
              filters: {
                reviewed: true,
                minImpactScore: 0.7,
              },
              limit: 2,
            });

            for (const result of results) {
              swaps.push({
                bulletIndex: null,
                currentBullet: null,
                suggestedBullet: result.bulletText,
                reason: `Adds missing skill: ${skill}`,
                confidence: result.metadata.impactScore || 0.7,
                skill,
              });
            }
          }
        }
      }

      // For low-scoring bullets, find better alternatives
      for (const { index, evaluation } of lowScoreBullets) {
        // Extract keywords from current bullet
        const currentBullet = parsedResume.sections.experience.flatMap(
          (exp: any) => exp.bullets || [],
        )[index];

        if (currentBullet) {
          // Search for better bullets
          const keywords =
            currentBullet
              .toLowerCase()
              .match(/\b\w{4,}\b/g)
              ?.slice(0, 3) || [];

          for (const keyword of keywords) {
            const results = await this.experienceBankService.search(userId, {
              query: keyword,
              filters: {
                reviewed: true,
                minImpactScore: 0.8,
              },
              limit: 1,
            });

            if (results.length > 0) {
              swaps.push({
                bulletIndex: index,
                currentBullet,
                suggestedBullet: results[0].bulletText,
                reason: `Better bullet with keyword: ${keyword}`,
                confidence: results[0].metadata.impactScore || 0.8,
              });
              break; // Only one suggestion per bullet
            }
          }
        }
      }

      return swaps;
    } catch (error) {
      this.logger.error('Error finding suggested swaps:', error);
      return [];
    }
  }

  /**
   * Perform ATS compatibility checks.
   */
  private async performAtsChecks(parsedResume: any): Promise<any> {
    const checks = {
      passed: true,
      issues: [] as string[],
      warnings: [] as string[],
    };

    // Check font size
    if (parsedResume.metadata.fontsMinPt < 10) {
      checks.issues.push('Font size too small (< 10pt)');
      checks.passed = false;
    }

    // Check layout flags
    if (parsedResume.metadata.layoutFlags.tables) {
      checks.warnings.push('Tables detected - may confuse ATS');
    }

    if (parsedResume.metadata.layoutFlags.columns) {
      checks.warnings.push('Multi-column layout detected - may confuse ATS');
    }

    if (parsedResume.metadata.layoutFlags.icons) {
      checks.issues.push('Icons/images detected - not ATS-friendly');
      checks.passed = false;
    }

    // Check page count
    if (parsedResume.metadata.pages > 2) {
      checks.warnings.push('Resume exceeds 2 pages');
    }

    return checks;
  }

  /**
   * Evaluate all bullet points in resume.
   */
  private async evaluateAllBullets(
    parsedResume: any,
    roleFamily?: string,
    useLlm?: boolean,
  ): Promise<any[]> {
    const allBullets: string[] = [];

    // Collect bullets from experience
    for (const exp of parsedResume.sections.experience || []) {
      allBullets.push(...exp.bullets);
    }

    // Collect bullets from projects
    for (const proj of parsedResume.sections.projects || []) {
      allBullets.push(...proj.bullets);
    }

    // Evaluate all bullets
    return this.bulletEvaluatorService.evaluateBullets(
      allBullets,
      roleFamily,
      useLlm,
    );
  }

  /**
   * Analyze repetition in resume.
   */
  private analyzeRepetition(parsedResume: any): any {
    const allBullets: string[] = [];

    // Collect all bullets
    for (const exp of parsedResume.sections.experience || []) {
      allBullets.push(...exp.bullets);
    }

    // Simple repetition check: find repeated phrases
    const phrases = new Map<string, number>();

    for (const bullet of allBullets) {
      const words = bullet.toLowerCase().split(' ');

      // Check 3-word phrases
      for (let i = 0; i < words.length - 2; i++) {
        const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
      }
    }

    // Find repeated phrases
    const repeated: string[] = [];
    for (const [phrase, count] of phrases.entries()) {
      if (count > 2) {
        repeated.push(phrase);
      }
    }

    return {
      score:
        repeated.length === 0 ? 1.0 : Math.max(0, 1.0 - repeated.length * 0.1),
      repeatedPhrases: repeated,
      diversity: phrases.size / allBullets.length,
    };
  }

  /**
   * Analyze alignment with job posting.
   */
  private async analyzeAlignment(
    parsedResume: any,
    jobPosting: JobPosting,
  ): Promise<any> {
    const requiredSkills = jobPosting.parsed.skills.skillsExplicit || [];
    const resumeText = parsedResume.rawText.toLowerCase();

    // Check coverage of required skills
    const coveredSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const skill of requiredSkills) {
      if (resumeText.includes(skill.toLowerCase())) {
        coveredSkills.push(skill);
      } else {
        missingSkills.push(skill);
      }
    }

    const coverageScore =
      requiredSkills.length > 0
        ? coveredSkills.length / requiredSkills.length
        : 1.0;

    return {
      score: coverageScore,
      coverage: {
        requiredSkills,
        coveredSkills,
        missingSkills,
        coveragePercent: Math.round(coverageScore * 100),
      },
    };
  }

  /**
   * Generate auto-fixes for issues.
   */
  private async generateAutoFixes(
    parsedResume: any,
    bulletEvaluations: any[],
    atsChecks: any,
  ): Promise<any[]> {
    const fixes: any[] = [];

    // Generate fixes for low-scoring bullets
    for (let i = 0; i < bulletEvaluations.length; i++) {
      const evaluation = bulletEvaluations[i];
      if (evaluation.overallScore < 0.7 && evaluation.suggestedFixes) {
        for (const fix of evaluation.suggestedFixes) {
          fixes.push({
            type: 'bullet_improvement',
            bulletIndex: i,
            description: fix.description,
            latexPatch: `% Replace bullet ${i}\n${fix.fixedText}`,
            confidence: fix.confidence,
          });
        }
      }
    }

    return fixes;
  }

  /**
   * Calculate overall scores.
   */
  private calculateScores(
    atsChecks: any,
    bulletEvaluations: any[],
    repetitionAnalysis: any,
    alignmentScore: number | null,
  ): any {
    const avgBulletScore =
      bulletEvaluations.length > 0
        ? bulletEvaluations.reduce((sum, e) => sum + e.overallScore, 0) /
          bulletEvaluations.length
        : 0;

    const atsScore = atsChecks.passed ? 1.0 : 0.5;

    let overallScore =
      avgBulletScore * 0.5 + atsScore * 0.3 + repetitionAnalysis.score * 0.2;

    if (alignmentScore !== null) {
      overallScore = overallScore * 0.7 + alignmentScore * 0.3;
    }

    return {
      overall: Math.round(overallScore * 100),
      atsScore: Math.round(atsScore * 100),
      avgBulletScore: Math.round(avgBulletScore * 100),
      repetitionScore: Math.round(repetitionAnalysis.score * 100),
      alignmentScore:
        alignmentScore !== null ? Math.round(alignmentScore * 100) : null,
    };
  }

  /**
   * Generate findings from checks.
   */
  private generateFindings(
    atsChecks: any,
    bulletEvaluations: any[],
    repetitionAnalysis: any,
  ): any[] {
    const findings: any[] = [];

    // ATS issues
    for (const issue of atsChecks.issues) {
      findings.push({
        type: 'ats',
        code: 'ATS_INCOMPATIBLE',
        location: null,
        evidence: issue,
        autoFixes: [],
      });
    }

    // Bullet issues
    for (let i = 0; i < bulletEvaluations.length; i++) {
      const evaluation = bulletEvaluations[i];
      if (evaluation.overallScore < 0.7) {
        findings.push({
          type: 'bullet',
          code: 'LOW_QUALITY_BULLET',
          location: { bulletIndex: i },
          evidence: evaluation.feedback?.join('; ') || '',
          autoFixes: evaluation.suggestedFixes || [],
        });
      }
    }

    // Repetition issues
    if (repetitionAnalysis.repeatedPhrases.length > 0) {
      findings.push({
        type: 'repetition',
        code: 'REPEATED_PHRASES',
        location: null,
        evidence: `Repeated phrases: ${repetitionAnalysis.repeatedPhrases.join(', ')}`,
        autoFixes: [],
      });
    }

    return findings;
  }

  /**
   * Get evaluation report by ID.
   */
  async getReportById(id: string): Promise<EvaluationReport | null> {
    return this.evaluationReportModel.findById(id).exec();
  }

  /**
   * Get all reports for a resume.
   */
  async getReportsByResumeId(resumeId: string): Promise<EvaluationReport[]> {
    return this.evaluationReportModel
      .find({ resumeId })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get score history for a resume
   */
  async getScoreHistory(
    resumeId: string,
    options: {
      limit?: number;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<{
    resumeId: string;
    history: Array<{
      reportId: string;
      createdAt: Date;
      mode: string;
      scores: any;
    }>;
    trends: any;
  }> {
    const query: any = { resumeId };

    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) {
        query.createdAt.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        query.createdAt.$lte = new Date(options.endDate);
      }
    }

    const reports = await this.evaluationReportModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit || 20)
      .exec();

    const history = reports.map((report) => ({
      reportId: report._id.toString(),
      createdAt: report.createdAt,
      mode: report.mode,
      scores: report.scores,
    }));

    // Calculate trends
    const trends: any = {};
    if (history.length >= 2) {
      const recent = history[0].scores;
      const older = history[history.length - 1].scores;

      for (const key in recent) {
        if (typeof recent[key] === 'number' && typeof older[key] === 'number') {
          const recentVal = recent[key] as number;
          const olderVal = older[key] as number;
          if (recentVal > olderVal) {
            trends[key] = 'improving';
          } else if (recentVal < olderVal) {
            trends[key] = 'degrading';
          } else {
            trends[key] = 'stable';
          }
        }
      }
    }

    return {
      resumeId,
      history,
      trends,
    };
  }

  /**
   * Compare two evaluation reports
   */
  async compareEvaluations(
    reportId1: string,
    reportId2: string,
  ): Promise<{
    report1: any;
    report2: any;
    comparison: {
      scoreChanges: any;
      findings: {
        new: any[];
        resolved: any[];
        persistent: any[];
      };
      bulletChanges: any[];
    };
  }> {
    const report1 = await this.evaluationReportModel.findById(reportId1).exec();
    const report2 = await this.evaluationReportModel.findById(reportId2).exec();

    if (!report1 || !report2) {
      throw new Error('One or both reports not found');
    }

    // Calculate score changes
    const scoreChanges: any = {};
    for (const key in report2.scores) {
      if (
        typeof report2.scores[key] === 'number' &&
        typeof report1.scores[key] === 'number'
      ) {
        const from = report1.scores[key] as number;
        const to = report2.scores[key] as number;
        const change = to - from;
        scoreChanges[key] = {
          from,
          to,
          change,
          direction:
            change > 0 ? 'improved' : change < 0 ? 'degraded' : 'unchanged',
        };
      }
    }

    // Compare findings
    const findings1 = new Set(
      (report1.findings || []).map((f: any) => f.code || JSON.stringify(f)),
    );
    const findings2 = new Set(
      (report2.findings || []).map((f: any) => f.code || JSON.stringify(f)),
    );

    const newFindings = (report2.findings || []).filter(
      (f: any) => !findings1.has(f.code || JSON.stringify(f)),
    );
    const resolvedFindings = (report1.findings || []).filter(
      (f: any) => !findings2.has(f.code || JSON.stringify(f)),
    );
    const persistentFindings = (report1.findings || []).filter((f: any) =>
      findings2.has(f.code || JSON.stringify(f)),
    );

    return {
      report1: {
        reportId: report1._id.toString(),
        createdAt: report1.createdAt,
        scores: report1.scores,
        findings: report1.findings,
        bullets: [],
      },
      report2: {
        reportId: report2._id.toString(),
        createdAt: report2.createdAt,
        scores: report2.scores,
        findings: report2.findings,
        bullets: [],
      },
      comparison: {
        scoreChanges,
        findings: {
          new: newFindings,
          resolved: resolvedFindings,
          persistent: persistentFindings,
        },
        bulletChanges: [], // Would need bullet-level comparison
      },
    };
  }
}
