import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { JobPosting } from '../../domain/entities/job-posting.entity';
import { ExperienceBankService } from './experience-bank.service';
import { MessageBrokerPort } from '../ports/message-broker.port';

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

  // Store cover letters in memory (in production, use MongoDB)
  private coverLetters = new Map<string, CoverLetter>();

  constructor(
    @InjectModel('JobPosting')
    private readonly jobPostingModel: Model<JobPosting>,
    private readonly experienceBankService: ExperienceBankService,
    @Inject('MessageBrokerPort')
    private readonly messageBroker: MessageBrokerPort,
    private readonly configService: ConfigService,
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
    options: GenerateCoverLetterOptions,
  ): Promise<CoverLetter> {
    this.logger.log(`Generating cover letter for user ${userId}`);

    // Step 1: Get job posting
    const jobPosting = await this.jobPostingModel
      .findById(options.jobPostingId)
      .exec();
    if (!jobPosting) {
      throw new Error(`Job posting ${options.jobPostingId} not found`);
    }

    // Step 2: Research company
    const companyResearch = await this.researchCompany(
      jobPosting.parsed.company.hiringOrganization || 'Company',
    );

    // Step 3: Find relevant experiences
    const relevantExperiences = await this.findRelevantExperiences(
      userId,
      jobPosting,
      options.includeExperiences,
    );

    // Step 4: Generate cover letter
    const content = await this.generateContent(
      jobPosting,
      companyResearch,
      relevantExperiences,
      options,
    );

    // Step 5: Create cover letter document
    const coverLetterId = `${userId}-${options.jobPostingId}-${Date.now()}`;
    const coverLetter: CoverLetter = {
      _id: coverLetterId,
      userId,
      jobPostingId: options.jobPostingId,
      content,
      metadata: {
        company: jobPosting.parsed.company.hiringOrganization || 'Company',
        position: jobPosting.parsed.role.titleRaw,
        tone: options.tone || 'professional',
        length: options.length || 'medium',
        experiencesUsed: relevantExperiences.map((e) => e._id.toString()),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in memory (in production, save to MongoDB)
    this.coverLetters.set(coverLetterId, coverLetter);

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

    try {
      const agentToolWorkerUrl =
        this.configService.get<string>('AGENT_TOOL_WORKER_URL') ||
        'http://localhost:3002';

      // Use HTTP request actor to scrape company website
      const companyUrl = `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com`;

      const response = await fetch(`${agentToolWorkerUrl}/tools/http-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: companyUrl,
          method: 'GET',
        }),
      });

      if (response.ok) {
        const html = await response.text();
        // Basic extraction from HTML (in production, use proper HTML parsing)
        const description = this.extractDescription(html, companyName);
        const mission = this.extractMission(html);
        const values = this.extractValues(html);
        const recentNews = this.extractNews(html);

        return {
          description: description || `${companyName} is a leading technology company.`,
          mission: mission || 'To innovate and deliver exceptional products.',
          values: values.length > 0 ? values : ['Innovation', 'Collaboration', 'Excellence'],
          recentNews: recentNews.length > 0 ? recentNews : [
            'Recently launched new product line',
            'Expanded to new markets',
          ],
        };
      } else {
        this.logger.warn(`Failed to fetch company website: ${response.statusText}`);
        return this.getDefaultCompanyInfo(companyName);
      }
    } catch (error) {
      this.logger.error('Error researching company:', error);
      return this.getDefaultCompanyInfo(companyName);
    }
  }

  /**
   * Extract description from HTML.
   */
  private extractDescription(html: string, companyName: string): string {
    // Simple extraction - look for meta description or first paragraph
    const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (metaMatch) {
      return metaMatch[1];
    }

    const paragraphMatch = html.match(/<p[^>]*>([^<]{50,200})<\/p>/i);
    if (paragraphMatch) {
      return paragraphMatch[1].trim();
    }

    return `${companyName} is a leading technology company.`;
  }

  /**
   * Extract mission statement from HTML.
   */
  private extractMission(html: string): string {
    const missionPatterns = [
      /mission["']?\s*:?\s*["']?([^"']{20,200})/i,
      /<h[23][^>]*>mission[^<]*<\/h[23]>\s*<p[^>]*>([^<]{20,200})<\/p>/i,
    ];

    for (const pattern of missionPatterns) {
      const match = html.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return 'To innovate and deliver exceptional products.';
  }

  /**
   * Extract company values from HTML.
   */
  private extractValues(html: string): string[] {
    const values: string[] = [];
    const valuesPattern = /<li[^>]*>([^<]{5,50})<\/li>/gi;
    let match;

    while ((match = valuesPattern.exec(html)) !== null && values.length < 5) {
      const value = match[1].trim();
      if (value.length > 3 && value.length < 50) {
        values.push(value);
      }
    }

    return values;
  }

  /**
   * Extract recent news from HTML.
   */
  private extractNews(html: string): string[] {
    const news: string[] = [];
    const newsPattern = /<h[23][^>]*>([^<]{10,100})<\/h[23]>/gi;
    let match;
    let count = 0;

    while ((match = newsPattern.exec(html)) !== null && count < 3) {
      const headline = match[1].trim();
      if (headline.length > 10 && headline.length < 100) {
        news.push(headline);
        count++;
      }
    }

    return news;
  }

  /**
   * Get default company info (fallback).
   */
  private getDefaultCompanyInfo(companyName: string): {
    description: string;
    mission: string;
    values: string[];
    recentNews: string[];
  } {
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
    specificIds?: string[],
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
      new Map(allExperiences.map((e) => [e._id.toString(), e])).values(),
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
    options: GenerateCoverLetterOptions,
  ): Promise<string> {
    this.logger.log('Generating cover letter content');

    try {
      // Try to use assistant-worker for LLM-based generation
      const assistantWorkerUrl =
        this.configService.get<string>('ASSISTANT_WORKER_URL') ||
        'http://localhost:3001';

      const prompt = this.buildCoverLetterPrompt(
        jobPosting,
        companyResearch,
        experiences,
        options,
      );

      const response = await fetch(`${assistantWorkerUrl}/llm/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert cover letter writer. Write professional, compelling cover letters that highlight relevant experience and align with company values.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          maxTokens: 1000,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.content) {
          return result.content;
        }
      }

      this.logger.warn('LLM generation failed, using template-based content');
      // Fall back to template-based content
      return this.generateTemplateContent(
        jobPosting,
        companyResearch,
        experiences,
        options,
      );
    } catch (error) {
      this.logger.error('Error generating cover letter with LLM:', error);
      // Fall back to template-based content
      return this.generateTemplateContent(
        jobPosting,
        companyResearch,
        experiences,
        options,
      );
    }
  }

  /**
   * Build prompt for LLM cover letter generation.
   */
  private buildCoverLetterPrompt(
    jobPosting: JobPosting,
    companyResearch: any,
    experiences: any[],
    options: GenerateCoverLetterOptions,
  ): string {
    const company = jobPosting.parsed.company.hiringOrganization || 'Company';
    const position = jobPosting.parsed.role.titleRaw;
    const tone = options.tone || 'professional';
    const length = options.length || 'medium';

    const experienceBullets = experiences
      .map((e) => e.bulletText)
      .join('\n- ');

    return `Write a ${tone} ${length} cover letter for the ${position} position at ${company}.

Company Information:
- Description: ${companyResearch.description}
- Mission: ${companyResearch.mission}
- Values: ${companyResearch.values.join(', ')}

Relevant Experience:
- ${experienceBullets}

Job Requirements:
${jobPosting.parsed.skills.skillsExplicit?.slice(0, 5).join(', ') || 'Not specified'}

${options.customInstructions ? `Custom Instructions: ${options.customInstructions}` : ''}

Please write a compelling cover letter that:
1. Demonstrates alignment with company values
2. Highlights relevant experience from the bullet points
3. Shows enthusiasm for the role
4. Is ${tone} in tone
5. Is ${length} in length`;
  }

  /**
   * Generate template-based content (fallback).
   */
  private generateTemplateContent(
    jobPosting: JobPosting,
    companyResearch: any,
    experiences: any[],
    options: GenerateCoverLetterOptions,
  ): string {
    const company =
      jobPosting.parsed.company.hiringOrganization || 'Your Company';
    const position = jobPosting.parsed.role.titleRaw;

    const intro = this.generateIntro(
      company,
      position,
      options.tone || 'professional',
    );
    const body = this.generateBody(
      experiences,
      jobPosting,
      options.tone || 'professional',
    );
    const closing = this.generateClosing(
      company,
      options.tone || 'professional',
    );

    return `${intro}\n\n${body}\n\n${closing}`;
  }

  /**
   * Generate introduction paragraph.
   */
  private generateIntro(
    company: string,
    position: string,
    tone: string,
  ): string {
    const intros: Record<string, string> = {
      professional: `I am writing to express my strong interest in the ${position} position at ${company}. With my proven track record in software development and passion for innovation, I am confident I would be a valuable addition to your team.`,
      casual: `I'm excited to apply for the ${position} role at ${company}! Your company's mission really resonates with me, and I believe my experience would be a great fit.`,
      enthusiastic: `I am thrilled to apply for the ${position} position at ${company}! Your company's innovative approach and commitment to excellence align perfectly with my career goals and values.`,
    };

    return intros[tone] || intros.professional;
  }

  /**
   * Generate body paragraphs from experiences.
   */
  private generateBody(
    experiences: any[],
    jobPosting: JobPosting,
    tone: string,
  ): string {
    const paragraphs: string[] = [];

    // Group experiences by theme
    const techExperiences = experiences.filter(
      (e) => e.metadata.category === 'work',
    );

    if (techExperiences.length > 0) {
      const bullets = techExperiences
        .slice(0, 3)
        .map((e) => e.bulletText)
        .join(' Additionally, ');

      paragraphs.push(`In my previous roles, I have ${bullets.toLowerCase()}`);
    }

    // Add skills alignment
    const requiredSkills = jobPosting.parsed.skills.skillsExplicit || [];
    if (requiredSkills.length > 0) {
      paragraphs.push(
        `I am particularly excited about this opportunity because of my expertise in ${requiredSkills.slice(0, 3).join(', ')}, which aligns perfectly with your requirements.`,
      );
    }

    return paragraphs.join('\n\n');
  }

  /**
   * Generate closing paragraph.
   */
  private generateClosing(company: string, tone: string): string {
    const closings: Record<string, string> = {
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
    options: Partial<GenerateCoverLetterOptions>,
  ): Promise<CoverLetter> {
    this.logger.log(`Regenerating cover letter ${coverLetterId}`);

    const existing = this.coverLetters.get(coverLetterId);
    if (!existing) {
      throw new Error(`Cover letter ${coverLetterId} not found`);
    }

    // Get job posting
    const jobPosting = await this.jobPostingModel
      .findById(existing.jobPostingId)
      .exec();
    if (!jobPosting) {
      throw new Error(`Job posting ${existing.jobPostingId} not found`);
    }

    // Research company again if needed
    const companyResearch = await this.researchCompany(
      jobPosting.parsed.company.hiringOrganization || 'Company',
    );

    // Get experiences
    const relevantExperiences = await this.findRelevantExperiences(
      existing.userId,
      jobPosting,
      options.includeExperiences || existing.metadata.experiencesUsed,
    );

    // Merge options
    const mergedOptions: GenerateCoverLetterOptions = {
      jobPostingId: existing.jobPostingId,
      tone: options.tone || existing.metadata.tone,
      length: options.length || existing.metadata.length,
      includeExperiences: options.includeExperiences || existing.metadata.experiencesUsed,
      customInstructions: options.customInstructions,
    };

    // Generate new content
    const newContent = await this.generateContent(
      jobPosting,
      companyResearch,
      relevantExperiences,
      mergedOptions,
    );

    // Update cover letter
    existing.content = newContent;
    existing.metadata.tone = mergedOptions.tone || existing.metadata.tone;
    existing.metadata.length = mergedOptions.length || existing.metadata.length;
    existing.metadata.experiencesUsed = mergedOptions.includeExperiences || existing.metadata.experiencesUsed;
    existing.updatedAt = new Date();

    this.coverLetters.set(coverLetterId, existing);
    return existing;
  }

  /**
   * Edit cover letter content.
   */
  async editCoverLetter(
    coverLetterId: string,
    newContent: string,
  ): Promise<CoverLetter> {
    this.logger.log(`Editing cover letter ${coverLetterId}`);

    const existing = this.coverLetters.get(coverLetterId);
    if (!existing) {
      throw new Error(`Cover letter ${coverLetterId} not found`);
    }

    existing.content = newContent;
    existing.updatedAt = new Date();

    this.coverLetters.set(coverLetterId, existing);
    return existing;
  }
}
