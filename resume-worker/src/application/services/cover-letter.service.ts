import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { JobPosting } from '../../domain/entities/job-posting.entity';
import { ExperienceBankService } from './experience-bank.service';
import { MessageBrokerPort } from '../ports/message-broker.port';
import { CoverLetterSchema } from '../../infrastructure/database/schemas/cover-letter.schema';

export interface CoverLetter {
  _id?: string;
  userId: string;
  resumeId: string;
  jobPostingId?: string;
  latexContent: string;
  pdfUrl?: string;
  metadata: {
    company: string;
    position: string;
    tone: 'professional' | 'casual' | 'enthusiastic';
    length: 'short' | 'medium' | 'long';
    experiencesUsed: string[]; // IDs from experience bank
  };
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateCoverLetterOptions {
  resumeId: string;
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
    @InjectModel('CoverLetter')
    private readonly coverLetterModel: Model<CoverLetterSchema>,
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
    const coverLetter = await this.coverLetterModel.create({
      userId,
      resumeId: new Types.ObjectId(options.resumeId),
      jobPostingId: options.jobPostingId
        ? new Types.ObjectId(options.jobPostingId)
        : undefined,
      latexContent: `\\documentclass{letter}\n\\begin{document}\n${content}\n\\end{document}`,
      metadata: {
        company: jobPosting.parsed.company.hiringOrganization || 'Company',
        position: jobPosting.parsed.role.titleRaw,
        tone: options.tone || 'professional',
        length: options.length || 'medium',
        experiencesUsed: relevantExperiences.map((e) => e._id),
      },
      version: 1,
    });

    return this.toCoverLetter(coverLetter);
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
          description:
            description || `${companyName} is a leading technology company.`,
          mission: mission || 'To innovate and deliver exceptional products.',
          values:
            values.length > 0
              ? values
              : ['Innovation', 'Collaboration', 'Excellence'],
          recentNews:
            recentNews.length > 0
              ? recentNews
              : [
                  'Recently launched new product line',
                  'Expanded to new markets',
                ],
        };
      } else {
        this.logger.warn(
          `Failed to fetch company website: ${response.statusText}`,
        );
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
    const metaMatch = html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
    );
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

    const experienceBullets = experiences.map((e) => e.bulletText).join('\n- ');

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
   * Create cover letter
   */
  async create(
    userId: string,
    resumeId: string,
    jobPostingId: string | undefined,
    latexContent: string,
  ): Promise<CoverLetter> {
    const coverLetter = await this.coverLetterModel.create({
      userId,
      resumeId: new Types.ObjectId(resumeId),
      jobPostingId: jobPostingId ? new Types.ObjectId(jobPostingId) : undefined,
      latexContent,
      metadata: {
        company: '',
        position: '',
        tone: 'professional',
        length: 'medium',
        experiencesUsed: [],
      },
      version: 1,
    });

    return this.toCoverLetter(coverLetter);
  }

  /**
   * Get cover letter by ID
   */
  async getById(id: string): Promise<CoverLetter | null> {
    const coverLetter = await this.coverLetterModel.findById(id).exec();
    return coverLetter ? this.toCoverLetter(coverLetter) : null;
  }

  /**
   * Update cover letter
   */
  async update(
    id: string,
    updates: { latexContent?: string; version?: number },
  ): Promise<CoverLetter> {
    const updateData: any = {};
    if (updates.latexContent) {
      updateData.latexContent = updates.latexContent;
    }
    if (updates.version) {
      updateData.version = updates.version;
    }

    const coverLetter = await this.coverLetterModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .exec();

    if (!coverLetter) {
      throw new Error('Cover letter not found');
    }

    return this.toCoverLetter(coverLetter);
  }

  /**
   * Get cover letters for resume
   */
  async getByResumeId(resumeId: string): Promise<CoverLetter[]> {
    const coverLetters = await this.coverLetterModel
      .find({ resumeId: new Types.ObjectId(resumeId) })
      .sort({ createdAt: -1 })
      .exec();

    return coverLetters.map((cl) => this.toCoverLetter(cl));
  }

  /**
   * Delete cover letter
   */
  async delete(id: string): Promise<{ success: boolean }> {
    await this.coverLetterModel.deleteOne({ _id: id }).exec();
    return { success: true };
  }

  /**
   * Export cover letter as LaTeX
   */
  async exportTex(id: string): Promise<{ content: string; filename: string }> {
    const coverLetter = await this.coverLetterModel.findById(id).exec();
    if (!coverLetter) {
      throw new Error('Cover letter not found');
    }

    return {
      content: coverLetter.latexContent,
      filename: `cover-letter-${id}.tex`,
    };
  }

  /**
   * Export cover letter as PDF
   */
  async exportPdf(id: string): Promise<{ pdfUrl: string; filename: string }> {
    const coverLetter = await this.coverLetterModel.findById(id).exec();
    if (!coverLetter) {
      throw new Error('Cover letter not found');
    }

    // Compile LaTeX to PDF
    const latexWorkerUrl =
      this.configService.get<string>('LATEX_WORKER_URL') ||
      'http://localhost:3005';
    const response = await fetch(`${latexWorkerUrl}/latex/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: coverLetter.latexContent,
        userId: coverLetter.userId,
        settings: {
          engine: 'xelatex',
          maxPasses: 2,
          timeout: 60000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to compile LaTeX to PDF');
    }

    const result = await response.json();
    return {
      pdfUrl: result.pdfUrl || result.pdf,
      filename: `cover-letter-${id}.pdf`,
    };
  }

  /**
   * Regenerate cover letter with different options.
   */
  async regenerateCoverLetter(
    coverLetterId: string,
    options: Partial<GenerateCoverLetterOptions>,
  ): Promise<CoverLetter> {
    this.logger.log(`Regenerating cover letter ${coverLetterId}`);

    const existing = await this.coverLetterModel.findById(coverLetterId).exec();
    if (!existing) {
      throw new Error(`Cover letter ${coverLetterId} not found`);
    }

    // Get job posting
    const jobPosting = existing.jobPostingId
      ? await this.jobPostingModel.findById(existing.jobPostingId).exec()
      : null;
    if (!jobPosting && existing.jobPostingId) {
      throw new Error(`Job posting ${existing.jobPostingId} not found`);
    }

    if (!jobPosting) {
      throw new Error('Job posting required for regeneration');
    }

    // Research company again if needed
    const companyResearch = await this.researchCompany(
      jobPosting.parsed.company.hiringOrganization || 'Company',
    );

    // Get experiences
    const relevantExperiences = await this.findRelevantExperiences(
      existing.userId,
      jobPosting,
      options.includeExperiences ||
        existing.metadata.experiencesUsed.map((id) => id.toString()),
    );

    // Merge options
    const mergedOptions: GenerateCoverLetterOptions = {
      resumeId: existing.resumeId.toString(),
      jobPostingId: existing.jobPostingId?.toString() || '',
      tone:
        options.tone ||
        (existing.metadata.tone as 'professional' | 'casual' | 'enthusiastic'),
      length:
        options.length ||
        (existing.metadata.length as 'short' | 'medium' | 'long'),
      includeExperiences:
        options.includeExperiences ||
        existing.metadata.experiencesUsed.map((id) => id.toString()),
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
    existing.latexContent = `\\documentclass{letter}\n\\begin{document}\n${newContent}\n\\end{document}`;
    existing.metadata.tone = mergedOptions.tone || existing.metadata.tone;
    existing.metadata.length = mergedOptions.length || existing.metadata.length;
    existing.metadata.experiencesUsed =
      mergedOptions.includeExperiences?.map((id) => new Types.ObjectId(id)) ||
      existing.metadata.experiencesUsed;
    existing.version = (existing.version || 1) + 1;

    await existing.save();
    return this.toCoverLetter(existing);
  }

  /**
   * Edit cover letter content.
   */
  async editCoverLetter(
    coverLetterId: string,
    newContent: string,
  ): Promise<CoverLetter> {
    this.logger.log(`Editing cover letter ${coverLetterId}`);

    const existing = await this.coverLetterModel.findById(coverLetterId).exec();
    if (!existing) {
      throw new Error(`Cover letter ${coverLetterId} not found`);
    }

    existing.latexContent = newContent;
    existing.version = (existing.version || 1) + 1;

    await existing.save();
    return this.toCoverLetter(existing);
  }

  /**
   * Convert Mongoose document to CoverLetter entity
   */
  private toCoverLetter(doc: CoverLetterSchema): CoverLetter {
    return {
      _id: doc._id.toString(),
      userId: doc.userId,
      resumeId: doc.resumeId.toString(),
      jobPostingId: doc.jobPostingId?.toString(),
      latexContent: doc.latexContent,
      pdfUrl: doc.pdfUrl,
      metadata: {
        company: doc.metadata.company,
        position: doc.metadata.position,
        tone: doc.metadata.tone as 'professional' | 'casual' | 'enthusiastic',
        length: doc.metadata.length as 'short' | 'medium' | 'long',
        experiencesUsed: doc.metadata.experiencesUsed.map((id) =>
          id.toString(),
        ),
      },
      version: doc.version,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
