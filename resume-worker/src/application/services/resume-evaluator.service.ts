import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EvaluationReport } from '../../domain/entities/evaluation-report.entity';
import { Resume } from '../../domain/entities/resume.entity';
import { JobPosting } from '../../domain/entities/job-posting.entity';
import { BulletEvaluatorService } from './bullet-evaluator.service';
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
    private readonly bulletEvaluatorService: BulletEvaluatorService
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
    options: EvaluateResumeOptions
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
      options.useLlm
    );

    // Step 4: Repetition analysis
    const repetitionAnalysis = this.analyzeRepetition(parsedResume);

    // Step 5: Role/JD alignment
    let alignmentScore = null;
    let coverage = null;
    if (options.mode === 'jd-match' && options.jobPostingId) {
      const jobPosting = await this.jobPostingModel.findById(options.jobPostingId).exec();
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
      alignmentScore
    );

    // Create evaluation report
    const report = new this.evaluationReportModel({
      resumeId,
      userId: resume.userId,
      mode: options.mode,
      scores,
      gates: {
        atsCompatible: atsChecks.passed,
        spellcheckPassed: true, // TODO: Implement
        minBulletQuality: scores.avgBulletScore >= 0.7,
        noRepetition: repetitionAnalysis.score >= 0.8,
        roleAlignment: alignmentScore ? alignmentScore >= 0.7 : null
      },
      findings: this.generateFindings(atsChecks, bulletEvaluations, repetitionAnalysis),
      coverage,
      repetition: repetitionAnalysis,
      suggestedSwaps: [], // TODO: Implement experience bank integration
      createdAt: new Date()
    });

    return report.save();
  }

  /**
   * Parse resume PDF via NLP service.
   */
  private async parseResumePdf(latexContent: string): Promise<any> {
    // TODO: Compile LaTeX to PDF via latex-worker
    // Then send PDF to NLP service for parsing
    
    // For now, return mock data
    return {
      metadata: {
        pages: 1,
        fontsMinPt: 10,
        layoutFlags: {
          tables: false,
          columns: false,
          icons: false,
          images: false
        }
      },
      sections: {
        contact: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '555-1234',
          linkedin: 'linkedin.com/in/johndoe',
          github: 'github.com/johndoe'
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
              'Improved system performance by 30%'
            ]
          }
        ],
        education: [
          {
            school: 'University',
            degree: 'BS Computer Science',
            grad: '2019'
          }
        ],
        skills_raw: 'Python, JavaScript, React, Node.js, AWS',
        projects: []
      },
      rawText: 'Resume text...'
    };
  }

  /**
   * Perform ATS compatibility checks.
   */
  private async performAtsChecks(parsedResume: any): Promise<any> {
    const checks = {
      passed: true,
      issues: [] as string[],
      warnings: [] as string[]
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
    useLlm?: boolean
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
      useLlm
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
        const phrase = `${words[i]} ${words[i+1]} ${words[i+2]}`;
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
      score: repeated.length === 0 ? 1.0 : Math.max(0, 1.0 - repeated.length * 0.1),
      repeatedPhrases: repeated,
      diversity: phrases.size / allBullets.length
    };
  }

  /**
   * Analyze alignment with job posting.
   */
  private async analyzeAlignment(parsedResume: any, jobPosting: JobPosting): Promise<any> {
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

    const coverageScore = requiredSkills.length > 0
      ? coveredSkills.length / requiredSkills.length
      : 1.0;

    return {
      score: coverageScore,
      coverage: {
        requiredSkills,
        coveredSkills,
        missingSkills,
        coveragePercent: Math.round(coverageScore * 100)
      }
    };
  }

  /**
   * Generate auto-fixes for issues.
   */
  private async generateAutoFixes(
    parsedResume: any,
    bulletEvaluations: any[],
    atsChecks: any
  ): Promise<any[]> {
    const fixes: any[] = [];

    // Generate fixes for low-scoring bullets
    for (let i = 0; i < bulletEvaluations.length; i++) {
      const eval = bulletEvaluations[i];
      if (eval.overallScore < 0.7 && eval.suggestedFixes) {
        for (const fix of eval.suggestedFixes) {
          fixes.push({
            type: 'bullet_improvement',
            bulletIndex: i,
            description: fix.description,
            latexPatch: `% Replace bullet ${i}\n${fix.fixedText}`,
            confidence: fix.confidence
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
    alignmentScore: number | null
  ): any {
    const avgBulletScore = bulletEvaluations.length > 0
      ? bulletEvaluations.reduce((sum, e) => sum + e.overallScore, 0) / bulletEvaluations.length
      : 0;

    const atsScore = atsChecks.passed ? 1.0 : 0.5;

    let overallScore = (avgBulletScore * 0.5) + (atsScore * 0.3) + (repetitionAnalysis.score * 0.2);

    if (alignmentScore !== null) {
      overallScore = (overallScore * 0.7) + (alignmentScore * 0.3);
    }

    return {
      overall: Math.round(overallScore * 100),
      atsScore: Math.round(atsScore * 100),
      avgBulletScore: Math.round(avgBulletScore * 100),
      repetitionScore: Math.round(repetitionAnalysis.score * 100),
      alignmentScore: alignmentScore !== null ? Math.round(alignmentScore * 100) : null
    };
  }

  /**
   * Generate findings from checks.
   */
  private generateFindings(atsChecks: any, bulletEvaluations: any[], repetitionAnalysis: any): any[] {
    const findings: any[] = [];

    // ATS issues
    for (const issue of atsChecks.issues) {
      findings.push({
        type: 'ats',
        code: 'ATS_INCOMPATIBLE',
        location: null,
        evidence: issue,
        autoFixes: []
      });
    }

    // Bullet issues
    for (let i = 0; i < bulletEvaluations.length; i++) {
      const eval = bulletEvaluations[i];
      if (eval.overallScore < 0.7) {
        findings.push({
          type: 'bullet',
          code: 'LOW_QUALITY_BULLET',
          location: { bulletIndex: i },
          evidence: eval.feedback.join('; '),
          autoFixes: eval.suggestedFixes || []
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
        autoFixes: []
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
}

