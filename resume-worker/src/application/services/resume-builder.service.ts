import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExperienceBankService } from './experience-bank.service';
import { BulletEvaluatorService } from './bullet-evaluator.service';

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
        await this.experienceBankService.add({
          userId: session.userId,
          bulletText: bullet,
          metadata: {
            technologies: [], // TODO: Extract from bullet
            role: experience.role,
            company: experience.company,
            dateRange:
              typeof experience.dateRange === 'string'
                ? { start: new Date(), end: null }
                : experience.dateRange,
            metrics: [], // TODO: Extract from bullet
            keywords: [], // TODO: Extract from bullet
            reviewed: false, // Needs review
            linkedExperienceId: null,
            category: 'work',
            impactScore: 0.5, // Default
            atsScore: 0.5, // Default
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
        await this.experienceBankService.add({
          userId: session.userId,
          bulletText: bullet,
          metadata: {
            technologies: [],
            role: 'Project',
            company: project.name,
            dateRange: { start: new Date(), end: null },
            metrics: [],
            keywords: [],
            reviewed: false,
            linkedExperienceId: null,
            category: 'project',
            impactScore: 0.5,
            atsScore: 0.5,
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
   * This would integrate with agent-tool-worker's GitHub tools.
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

    // TODO: Integrate with agent-tool-worker
    // For now, return mock data
    return {
      commits: 150,
      contributions: [
        'Implemented authentication system',
        'Built REST API with 20+ endpoints',
        'Set up CI/CD pipeline',
      ],
      suggestedBullets: [
        'Developed authentication system with JWT and OAuth2, securing 10K+ user accounts',
        'Built RESTful API with 20+ endpoints, handling 1M+ requests per day',
        'Implemented CI/CD pipeline reducing deployment time by 70%',
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
}
