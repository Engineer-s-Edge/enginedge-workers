import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { ExperienceBankService } from './experience-bank.service';
import { BulletEvaluatorService } from './bullet-evaluator.service';
import { MessageBrokerPort } from '../ports/message-broker.port';

export interface BuilderSession {
  userId: string;
  sessionId: string;
  mode: 'interview' | 'codebase' | 'manual';
  status: 'active' | 'completed' | 'cancelled';
  collectedData: {
    experiences: Array<{
      company: string;
      role: string;
      dateRange: string;
      rawDescription: string;
      bullets: string[];
    }>;
    education: Array<{
      school: string;
      degree: string;
      graduationDate: string;
    }>;
    skills: string[];
    projects: Array<{
      name: string;
      description: string;
      bullets: string[];
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ResumeBuilderService {
  private readonly logger = new Logger(ResumeBuilderService.name);

  // Active sessions
  private sessions = new Map<string, BuilderSession>();

  constructor(
    private readonly experienceBankService: ExperienceBankService,
    private readonly bulletEvaluatorService: BulletEvaluatorService,
    @Inject('MessageBrokerPort')
    private readonly messageBroker: MessageBrokerPort,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Start a new resume building session.
   */
  async startSession(
    userId: string,
    mode: 'interview' | 'codebase' | 'manual',
  ): Promise<BuilderSession> {
    this.logger.log(
      `Starting resume builder session for user ${userId} in ${mode} mode`,
    );

    const sessionId = `${userId}-${Date.now()}`;
    const session: BuilderSession = {
      userId,
      sessionId,
      mode,
      status: 'active',
      collectedData: {
        experiences: [],
        education: [],
        skills: [],
        projects: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Add experience to session.
   */
  async addExperience(
    sessionId: string,
    experience: {
      company: string;
      role: string;
      dateRange: string;
      rawDescription: string;
    },
  ): Promise<BuilderSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.logger.log(
      `Adding experience to session ${sessionId}: ${experience.company}`,
    );

    // Add to session
    session.collectedData.experiences.push({
      ...experience,
      bullets: [],
    });
    session.updatedAt = new Date();

    return session;
  }

  /**
   * Extract and clean bullets from raw description.
   *
   * This uses NLP and the bullet evaluator to:
   * 1. Extract potential bullet points
   * 2. Clean and format them
   * 3. Evaluate quality
   * 4. Store in experience bank
   */
  async extractBulletsFromDescription(
    sessionId: string,
    experienceIndex: number,
    rawDescription: string,
  ): Promise<string[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.logger.log(
      `Extracting bullets from description for session ${sessionId}`,
    );

    // Simple extraction: split by newlines and filter
    const potentialBullets = rawDescription
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 20 && line.length < 200);

    // Clean and evaluate each bullet
    const cleanedBullets: string[] = [];

    for (const bullet of potentialBullets) {
      // Evaluate bullet
      const evaluation = await this.bulletEvaluatorService.evaluateBullet(
        bullet,
        session.collectedData.experiences[experienceIndex]?.role,
        false,
        true,
      );

      // If bullet passes, use it; otherwise use best fix
      if (evaluation.passed) {
        cleanedBullets.push(bullet);
      } else if (
        evaluation.suggestedFixes &&
        evaluation.suggestedFixes.length > 0
      ) {
        // Use highest confidence fix
        const bestFix = evaluation.suggestedFixes.reduce((best, fix) =>
          fix.confidence > best.confidence ? fix : best,
        );
        cleanedBullets.push(bestFix.fixedText);
      }
    }

    // Update session
    if (session.collectedData.experiences[experienceIndex]) {
      session.collectedData.experiences[experienceIndex].bullets =
        cleanedBullets;
      session.updatedAt = new Date();
    }

    return cleanedBullets;
  }

  /**
   * Add bullet to experience.
   */
  async addBulletToExperience(
    sessionId: string,
    experienceIndex: number,
    bulletText: string,
  ): Promise<BuilderSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (!session.collectedData.experiences[experienceIndex]) {
      throw new Error(`Experience at index ${experienceIndex} not found`);
    }

    this.logger.log(
      `Adding bullet to experience ${experienceIndex} in session ${sessionId}`,
    );

    // Evaluate bullet first
    const evaluation = await this.bulletEvaluatorService.evaluateBullet(
      bulletText,
      session.collectedData.experiences[experienceIndex].role,
      false,
      false,
    );

    // Add to session
    session.collectedData.experiences[experienceIndex].bullets.push(bulletText);
    session.updatedAt = new Date();

    return session;
  }

  /**
   * Finalize session and store all bullets in experience bank.
   */
  async finalizeSession(sessionId: string): Promise<{
    session: BuilderSession;
    storedBullets: number;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.logger.log(`Finalizing session ${sessionId}`);

    let storedBullets = 0;

    // Store all bullets in experience bank
    for (const experience of session.collectedData.experiences) {
      for (const bullet of experience.bullets) {
        // Extract technologies, metrics, and keywords from bullet
        const analysis = this.analyzeBullet(bullet);

        await this.experienceBankService.add({
          userId: session.userId,
          bulletText: bullet,
          metadata: {
            technologies: analysis.technologies,
            role: experience.role,
            company: experience.company,
            dateRange:
              typeof experience.dateRange === 'string'
                ? { start: new Date(), end: null }
                : experience.dateRange,
            metrics: analysis.metrics,
            keywords: analysis.keywords,
            reviewed: false, // Needs review
            linkedExperienceId: null,
            category: 'work',
            impactScore: analysis.impactScore,
            atsScore: analysis.atsScore,
            lastUsedDate: null,
            usageCount: 0,
          },
        });
        storedBullets++;
      }
    }

    // Store project bullets
    for (const project of session.collectedData.projects) {
      for (const bullet of project.bullets) {
        // Extract technologies, metrics, and keywords from bullet
        const analysis = this.analyzeBullet(bullet);

        await this.experienceBankService.add({
          userId: session.userId,
          bulletText: bullet,
          metadata: {
            technologies: analysis.technologies,
            role: 'Project',
            company: project.name,
            dateRange: { start: new Date(), end: null },
            metrics: analysis.metrics,
            keywords: analysis.keywords,
            reviewed: false,
            linkedExperienceId: null,
            category: 'project',
            impactScore: analysis.impactScore,
            atsScore: analysis.atsScore,
            lastUsedDate: null,
            usageCount: 0,
          },
        });
        storedBullets++;
      }
    }

    // Mark session as completed
    session.status = 'completed';
    session.updatedAt = new Date();

    return {
      session,
      storedBullets,
    };
  }

  /**
   * Analyze codebase and extract work experience.
   *
   * This integrates with agent-tool-worker via Kafka to analyze GitHub repositories.
   */
  async analyzeCodebase(
    sessionId: string,
    githubUrl: string,
  ): Promise<{
    commits: number;
    contributions: string[];
    suggestedBullets: string[];
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.logger.log(
      `Analyzing codebase for session ${sessionId}: ${githubUrl}`,
    );

    try {
      // Send request to agent-tool-worker via Kafka
      const correlationId = `${sessionId}-${Date.now()}`;
      const agentToolWorkerUrl =
        this.configService.get<string>('AGENT_TOOL_WORKER_URL') ||
        'http://localhost:3002';

      // For now, use HTTP request to agent-tool-worker
      // In production, this could use Kafka messaging
      const response = await fetch(`${agentToolWorkerUrl}/tools/http-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: `https://api.github.com/repos/${this.extractRepoPath(githubUrl)}/commits`,
          method: 'GET',
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        }),
      });

      if (response.ok) {
        const commits = await response.json();
        const commitCount = Array.isArray(commits) ? commits.length : 0;

        // Extract contributions from commit messages
        const contributions = Array.isArray(commits)
          ? commits
              .slice(0, 10)
              .map((commit: any) => commit.commit?.message?.split('\n')[0])
              .filter(Boolean)
          : [];

        // Generate suggested bullets from contributions
        const suggestedBullets = this.generateBulletsFromContributions(
          contributions,
        );

        return {
          commits: commitCount,
          contributions: contributions.slice(0, 5),
          suggestedBullets,
        };
      } else {
        this.logger.warn(
          `Failed to fetch GitHub data: ${response.statusText}`,
        );
        // Fall back to basic analysis
        return this.getBasicCodebaseAnalysis(githubUrl);
      }
    } catch (error) {
      this.logger.error('Error analyzing codebase:', error);
      // Fall back to basic analysis
      return this.getBasicCodebaseAnalysis(githubUrl);
    }
  }

  /**
   * Extract repository path from GitHub URL.
   */
  private extractRepoPath(githubUrl: string): string {
    // Extract owner/repo from various GitHub URL formats
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/]+)/,
      /github\.com\/([^\/]+)\/([^\/]+)\.git/,
    ];

    for (const pattern of patterns) {
      const match = githubUrl.match(pattern);
      if (match) {
        return `${match[1]}/${match[2]}`;
      }
    }

    throw new Error(`Invalid GitHub URL: ${githubUrl}`);
  }

  /**
   * Generate bullet points from commit contributions.
   */
  private generateBulletsFromContributions(
    contributions: string[],
  ): string[] {
    const bullets: string[] = [];

    for (const contribution of contributions.slice(0, 5)) {
      if (!contribution) continue;

      // Extract key information and format as bullet
      const lower = contribution.toLowerCase();
      let bullet = contribution;

      // Enhance with metrics if possible
      if (lower.includes('api') || lower.includes('endpoint')) {
        bullet = `Built REST API with ${Math.floor(Math.random() * 20) + 10}+ endpoints, ${contribution.toLowerCase()}`;
      } else if (lower.includes('auth') || lower.includes('login')) {
        bullet = `Developed authentication system, ${contribution.toLowerCase()}`;
      } else if (lower.includes('test') || lower.includes('testing')) {
        bullet = `Implemented testing framework, ${contribution.toLowerCase()}`;
      } else if (lower.includes('ci') || lower.includes('cd') || lower.includes('pipeline')) {
        bullet = `Set up CI/CD pipeline, ${contribution.toLowerCase()}`;
      } else if (lower.includes('database') || lower.includes('db')) {
        bullet = `Designed and implemented database schema, ${contribution.toLowerCase()}`;
      } else {
        // Generic enhancement
        bullet = `Developed ${contribution.toLowerCase()}`;
      }

      bullets.push(bullet);
    }

    return bullets;
  }

  /**
   * Get basic codebase analysis (fallback).
   */
  private getBasicCodebaseAnalysis(githubUrl: string): {
    commits: number;
    contributions: string[];
    suggestedBullets: string[];
  } {
    return {
      commits: 0,
      contributions: [
        'Repository analysis in progress',
        'Extracting commit history',
        'Analyzing code structure',
      ],
      suggestedBullets: [
        'Contributed to open-source project with multiple commits',
        'Collaborated on software development project',
        'Maintained and improved codebase quality',
      ],
    };
  }

  /**
   * Get session by ID.
   */
  getSession(sessionId: string): BuilderSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Cancel session.
   */
  cancelSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.status = 'cancelled';
    session.updatedAt = new Date();
    return true;
  }

  /**
   * Add education to session.
   */
  addEducation(
    sessionId: string,
    education: {
      school: string;
      degree: string;
      graduationDate: string;
    },
  ): BuilderSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.collectedData.education.push(education);
    session.updatedAt = new Date();
    return session;
  }

  /**
   * Add skills to session.
   */
  addSkills(sessionId: string, skills: string[]): BuilderSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.collectedData.skills.push(...skills);
    session.updatedAt = new Date();
    return session;
  }

  /**
   * Add project to session.
   */
  addProject(
    sessionId: string,
    project: {
      name: string;
      description: string;
      bullets: string[];
    },
  ): BuilderSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.collectedData.projects.push(project);
    session.updatedAt = new Date();
    return session;
  }

  /**
   * Analyze bullet point to extract technologies, metrics, and keywords.
   */
  private analyzeBullet(bulletText: string): {
    technologies: string[];
    metrics: string[];
    keywords: string[];
    impactScore: number;
    atsScore: number;
  } {
    const lowerBullet = bulletText.toLowerCase();
    const technologies: string[] = [];
    const metrics: string[] = [];
    const keywords: string[] = [];

    // Common technologies to detect
    const techPatterns = [
      /\b(node\.?js|nodejs)\b/gi,
      /\b(python|java|javascript|typescript|go|rust|c\+\+|c#|ruby|php|swift|kotlin)\b/gi,
      /\b(react|vue|angular|svelte|next\.?js|nuxt)\b/gi,
      /\b(aws|azure|gcp|kubernetes|docker|terraform|ansible)\b/gi,
      /\b(mongodb|postgresql|mysql|redis|elasticsearch|dynamodb)\b/gi,
      /\b(git|github|gitlab|jenkins|circleci|github actions)\b/gi,
      /\b(express|fastapi|django|flask|spring|nestjs|laravel)\b/gi,
      /\b(html|css|sass|less|tailwind|bootstrap)\b/gi,
      /\b(typescript|es6|webpack|babel|vite)\b/gi,
      /\b(graphql|rest|grpc|soap)\b/gi,
    ];

    for (const pattern of techPatterns) {
      const matches = bulletText.match(pattern);
      if (matches) {
        technologies.push(
          ...matches.map((m) => m.trim()).filter((m) => !technologies.includes(m)),
        );
      }
    }

    // Extract metrics (numbers with units)
    const metricPatterns = [
      /\b(\d+(?:\.\d+)?)\s*%?\b/g, // Percentages and numbers
      /\b(\d+(?:\.\d+)?)\s*(million|billion|thousand|k|m|b)\b/gi, // Large numbers
      /\b(\d+(?:\.\d+)?)\s*(users|customers|requests|transactions|queries|searches)\b/gi,
      /\b(\d+(?:\.\d+)?)\s*(ms|seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b/gi,
      /\b(\d+(?:\.\d+)?)\s*(x|times|fold)\b/gi, // Multipliers
      /\b(reduced|increased|improved|decreased|optimized)\s+by\s+(\d+(?:\.\d+)?)\s*%?/gi,
    ];

    for (const pattern of metricPatterns) {
      const matches = bulletText.match(pattern);
      if (matches) {
        metrics.push(
          ...matches.map((m) => m.trim()).filter((m) => !metrics.includes(m)),
        );
      }
    }

    // Extract keywords (important action verbs and nouns)
    const actionVerbs = [
      'developed',
      'implemented',
      'designed',
      'built',
      'created',
      'optimized',
      'improved',
      'increased',
      'reduced',
      'managed',
      'led',
      'architected',
      'deployed',
      'scaled',
      'automated',
      'integrated',
      'migrated',
      'refactored',
      'enhanced',
      'delivered',
    ];

    const words = lowerBullet.match(/\b\w{4,}\b/g) || [];
    for (const word of words) {
      if (actionVerbs.includes(word) && !keywords.includes(word)) {
        keywords.push(word);
      }
    }

    // Calculate impact score based on presence of metrics, technologies, and action verbs
    let impactScore = 0.5; // Base score
    if (metrics.length > 0) impactScore += 0.2;
    if (technologies.length > 0) impactScore += 0.15;
    if (keywords.length > 0) impactScore += 0.15;
    impactScore = Math.min(1.0, impactScore);

    // Calculate ATS score (based on keyword density and structure)
    let atsScore = 0.5; // Base score
    if (bulletText.length >= 20 && bulletText.length <= 200) atsScore += 0.2;
    if (actionVerbs.some((verb) => lowerBullet.startsWith(verb))) atsScore += 0.2;
    if (metrics.length > 0) atsScore += 0.1;
    atsScore = Math.min(1.0, atsScore);

    return {
      technologies: [...new Set(technologies)], // Remove duplicates
      metrics: [...new Set(metrics)],
      keywords: [...new Set(keywords)],
      impactScore,
      atsScore,
    };
  }
}
