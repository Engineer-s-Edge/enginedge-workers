import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JobPosting } from '../../domain/entities/job-posting.entity';
import { ExperienceBankService } from './experience-bank.service';

export interface CoverLetter {
  _id?: string;
  userId: string;
  jobPostingId: string;
  content: string;
  metadata: {
    company: string;
    position: string;
    tone: 'professional' | 'casual' | 'enthusiastic';
    length: 'short' | 'medium' | 'long';
    experiencesUsed: string[]; // IDs from experience bank
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateCoverLetterOptions {
  jobPostingId: string;
  tone?: 'professional' | 'casual' | 'enthusiastic';
  length?: 'short' | 'medium' | 'long';
  includeExperiences?: string[]; // Specific experience bank IDs to include
  customInstructions?: string;
}

@Injectable()
export class CoverLetterService {
  private readonly logger = new Logger(CoverLetterService.name);

  constructor(
    @InjectModel('JobPosting')
    private readonly jobPostingModel: Model<JobPosting>,
    private readonly experienceBankService: ExperienceBankService
  ) {}

  /**
   * Generate a cover letter for a job posting.
   * 
   * This uses a ReAct agent to:
   * 1. Research the company (using agent-tool-worker)
   * 2. Analyze the job posting
   * 3. Pull relevant experiences from experience bank
   * 4. Generate tailored cover letter
   */
  async generateCoverLetter(
    userId: string,
    options: GenerateCoverLetterOptions
  ): Promise<CoverLetter> {
    this.logger.log(`Generating cover letter for user ${userId}`);

    // Step 1: Get job posting
    const jobPosting = await this.jobPostingModel.findById(options.jobPostingId).exec();
    if (!jobPosting) {
      throw new Error(`Job posting ${options.jobPostingId} not found`);
    }

    // Step 2: Research company
    const companyResearch = await this.researchCompany(
      jobPosting.parsed.company.hiringOrganization || 'Company'
    );

    // Step 3: Find relevant experiences
    const relevantExperiences = await this.findRelevantExperiences(
      userId,
      jobPosting,
      options.includeExperiences
    );

    // Step 4: Generate cover letter
    const content = await this.generateContent(
      jobPosting,
      companyResearch,
      relevantExperiences,
      options
    );

    // Step 5: Create cover letter document
    const coverLetter: CoverLetter = {
      userId,
      jobPostingId: options.jobPostingId,
      content,
      metadata: {
        company: jobPosting.parsed.company.hiringOrganization || 'Company',
        position: jobPosting.parsed.role.titleRaw,
        tone: options.tone || 'professional',
        length: options.length || 'medium',
        experiencesUsed: relevantExperiences.map(e => e._id.toString()),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return coverLetter;
  }

  /**
   * Research company using agent-tool-worker.
   */
  private async researchCompany(companyName: string): Promise<{
    description: string;
    mission: string;
    values: string[];
    recentNews: string[];
  }> {
    this.logger.log(`Researching company: ${companyName}`);

    // TODO: Integrate with agent-tool-worker for web scraping
    // For now, return mock data
    return {
      description: `${companyName} is a leading technology company.`,
      mission: 'To innovate and deliver exceptional products.',
      values: ['Innovation', 'Collaboration', 'Excellence'],
      recentNews: [
        'Recently launched new product line',
        'Expanded to new markets',
      ],
    };
  }

  /**
   * Find relevant experiences from experience bank.
   */
  private async findRelevantExperiences(
    userId: string,
    jobPosting: JobPosting,
    specificIds?: string[]
  ): Promise<any[]> {
    this.logger.log('Finding relevant experiences from experience bank');

    if (specificIds && specificIds.length > 0) {
      // Use specific experiences
      const experiences = [];
      for (const id of specificIds) {
        const exp = await this.experienceBankService.getById(id);
        if (exp) {
          experiences.push(exp);
        }
      }
      return experiences;
    }

    // Search for relevant experiences based on job posting
    const requiredSkills = jobPosting.parsed.skills.skillsExplicit || [];
    const allExperiences: any[] = [];

    for (const skill of requiredSkills.slice(0, 5)) {
      const results = await this.experienceBankService.search(userId, {
        query: skill,
        filters: {
          reviewed: true,
          minImpactScore: 0.7,
        },
        limit: 2,
      });
      allExperiences.push(...results);
    }

    // Deduplicate and take top 5
    const uniqueExperiences = Array.from(
      new Map(allExperiences.map(e => [e._id.toString(), e])).values()
    ).slice(0, 5);

    return uniqueExperiences;
  }

  /**
   * Generate cover letter content.
   */
  private async generateContent(
    jobPosting: JobPosting,
    companyResearch: any,
    experiences: any[],
    options: GenerateCoverLetterOptions
  ): Promise<string> {
    this.logger.log('Generating cover letter content');

    // TODO: Send to assistant-worker agent for generation
    // For now, create template-based content

    const company = jobPosting.parsed.company.hiringOrganization || 'Your Company';
    const position = jobPosting.parsed.role.titleRaw;

    const intro = this.generateIntro(company, position, options.tone || 'professional');
    const body = this.generateBody(experiences, jobPosting, options.tone || 'professional');
    const closing = this.generateClosing(company, options.tone || 'professional');

    return `${intro}\n\n${body}\n\n${closing}`;
  }

  /**
   * Generate introduction paragraph.
   */
  private generateIntro(company: string, position: string, tone: string): string {
    const intros = {
      professional: `I am writing to express my strong interest in the ${position} position at ${company}. With my proven track record in software development and passion for innovation, I am confident I would be a valuable addition to your team.`,
      casual: `I'm excited to apply for the ${position} role at ${company}! Your company's mission really resonates with me, and I believe my experience would be a great fit.`,
      enthusiastic: `I am thrilled to apply for the ${position} position at ${company}! Your company's innovative approach and commitment to excellence align perfectly with my career goals and values.`,
    };

    return intros[tone] || intros.professional;
  }

  /**
   * Generate body paragraphs from experiences.
   */
  private generateBody(experiences: any[], jobPosting: JobPosting, tone: string): string {
    const paragraphs: string[] = [];

    // Group experiences by theme
    const techExperiences = experiences.filter(e =>
      e.metadata.category === 'work'
    );

    if (techExperiences.length > 0) {
      const bullets = techExperiences
        .slice(0, 3)
        .map(e => e.bulletText)
        .join(' Additionally, ');

      paragraphs.push(
        `In my previous roles, I have ${bullets.toLowerCase()}`
      );
    }

    // Add skills alignment
    const requiredSkills = jobPosting.parsed.skills.skillsExplicit || [];
    if (requiredSkills.length > 0) {
      paragraphs.push(
        `I am particularly excited about this opportunity because of my expertise in ${requiredSkills.slice(0, 3).join(', ')}, which aligns perfectly with your requirements.`
      );
    }

    return paragraphs.join('\n\n');
  }

  /**
   * Generate closing paragraph.
   */
  private generateClosing(company: string, tone: string): string {
    const closings = {
      professional: `I am eager to bring my skills and experience to ${company} and contribute to your continued success. Thank you for considering my application. I look forward to the opportunity to discuss how I can contribute to your team.`,
      casual: `I'd love to chat more about how I can contribute to ${company}'s success. Thanks for taking the time to review my application!`,
      enthusiastic: `I am incredibly excited about the possibility of joining ${company} and making a meaningful impact. Thank you for considering my application, and I look forward to speaking with you soon!`,
    };

    return closings[tone] || closings.professional;
  }

  /**
   * Regenerate cover letter with different options.
   */
  async regenerateCoverLetter(
    coverLetterId: string,
    options: Partial<GenerateCoverLetterOptions>
  ): Promise<CoverLetter> {
    // TODO: Implement regeneration
    throw new Error('Not implemented');
  }

  /**
   * Edit cover letter content.
   */
  async editCoverLetter(
    coverLetterId: string,
    newContent: string
  ): Promise<CoverLetter> {
    // TODO: Implement editing
    throw new Error('Not implemented');
  }
}

