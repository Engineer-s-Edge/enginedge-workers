import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Resume,
  ResumeMetadata,
  ResumeVersion,
} from '../../domain/entities/resume.entity';
import { ResumeSchema } from '../../infrastructure/database/schemas/resume.schema';
import { EvaluationReport } from '../../domain/entities/evaluation-report.entity';

export interface CreateResumeDto {
  userId: string;
  name: string;
  latexContent: string;
  metadata?: Partial<ResumeMetadata>;
}

export interface UpdateResumeDto {
  name?: string;
  latexContent?: string;
  metadata?: Partial<ResumeMetadata>;
}

@Injectable()
export class ResumeService {
  constructor(
    @InjectModel('Resume')
    private readonly resumeModel: Model<ResumeSchema>,
    @InjectModel('EvaluationReport')
    private readonly evaluationReportModel: Model<EvaluationReport>,
  ) {}

  /**
   * Create a new resume
   */
  async create(dto: CreateResumeDto): Promise<Resume> {
    const resume = await this.resumeModel.create({
      userId: dto.userId,
      name: dto.name,
      latexContent: dto.latexContent,
      currentVersion: 1,
      versions: [
        {
          versionNumber: 1,
          content: dto.latexContent,
          timestamp: new Date(),
          changes: 'Initial version',
          hash: this.hashContent(dto.latexContent),
          createdBy: 'user',
        },
      ],
      metadata: {
        bulletPointIds: [],
        status: 'draft',
        ...dto.metadata,
      },
    });

    return this.toEntity(resume);
  }

  /**
   * Find resume by ID
   */
  async findById(id: Types.ObjectId): Promise<Resume> {
    const resume = await this.resumeModel.findById(id).exec();

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    return this.toEntity(resume);
  }

  /**
   * Find all resumes for a user
   */
  async findByUser(
    userId: string,
    options?: { status?: string; limit?: number },
  ): Promise<Resume[]> {
    const filter: any = { userId };

    if (options?.status) {
      filter['metadata.status'] = options.status;
    }

    const query = this.resumeModel.find(filter).sort({ updatedAt: -1 });

    if (options?.limit) {
      query.limit(options.limit);
    }

    const resumes = await query.exec();
    return resumes.map((resume) => this.toEntity(resume));
  }

  /**
   * Update resume
   */
  async update(id: Types.ObjectId, dto: UpdateResumeDto): Promise<Resume> {
    const updateData: any = {};

    if (dto.name) {
      updateData.name = dto.name;
    }

    if (dto.latexContent) {
      updateData.latexContent = dto.latexContent;
    }

    if (dto.metadata) {
      updateData.metadata = dto.metadata;
    }

    const resume = await this.resumeModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true },
    );

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    return this.toEntity(resume);
  }

  /**
   * Delete resume
   */
  async delete(id: Types.ObjectId): Promise<void> {
    const result = await this.resumeModel.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Resume not found');
    }
  }

  /**
   * Add a new version to resume
   */
  async addVersion(
    id: Types.ObjectId,
    version: ResumeVersion,
  ): Promise<Resume> {
    const resume = await this.resumeModel.findById(id);

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    // Limit version history to 100
    if (resume.versions.length >= 100) {
      resume.versions.shift();
    }

    resume.versions.push(version);
    resume.currentVersion = version.versionNumber;
    resume.latexContent = version.content;

    await resume.save();

    return this.toEntity(resume);
  }

  /**
   * Get resume by job posting
   */
  async findByJobPosting(jobPostingId: Types.ObjectId): Promise<Resume | null> {
    const resume = await this.resumeModel
      .findOne({ 'metadata.jobPostingId': jobPostingId })
      .exec();

    return resume ? this.toEntity(resume) : null;
  }

  /**
   * Hash content for version tracking
   */
  private hashContent(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Convert Mongoose document to entity
   */
  private toEntity(doc: ResumeSchema): Resume {
    return {
      id: doc._id,
      userId: doc.userId,
      name: doc.name,
      latexContent: doc.latexContent,
      currentVersion: doc.currentVersion,
      versions: doc.versions as ResumeVersion[],
      metadata: doc.metadata as ResumeMetadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Save layout for resume
   */
  async saveLayout(
    id: Types.ObjectId,
    layout: any,
  ): Promise<{ success: boolean; resumeId: string; layout: any }> {
    const resume = await this.resumeModel
      .findByIdAndUpdate(id, { $set: { layout } }, { new: true })
      .exec();

    if (!resume) {
      throw new Error('Resume not found');
    }

    return {
      success: true,
      resumeId: resume._id.toString(),
      layout,
    };
  }

  /**
   * Get saved layout for resume
   */
  async getLayout(
    id: Types.ObjectId,
  ): Promise<{ resumeId: string; layout: any; lastUpdated?: Date } | null> {
    const resume = await this.resumeModel.findById(id).exec();
    if (!resume) {
      return null;
    }

    const layout = (resume as any).layout;
    if (!layout) {
      return null;
    }

    return {
      resumeId: resume._id.toString(),
      layout,
      lastUpdated: resume.updatedAt,
    };
  }

  /**
   * Export resume as LaTeX
   */
  async exportTex(
    id: Types.ObjectId,
  ): Promise<{ content: string; filename: string }> {
    const resume = await this.resumeModel.findById(id).exec();
    if (!resume) {
      throw new Error('Resume not found');
    }

    return {
      content: resume.latexContent,
      filename: `resume-${resume._id}.tex`,
    };
  }

  /**
   * Export resume as PDF
   */
  async exportPdf(
    id: Types.ObjectId,
  ): Promise<{ pdfUrl: string; filename: string }> {
    const resume = await this.resumeModel.findById(id).exec();
    if (!resume) {
      throw new Error('Resume not found');
    }

    // Compile LaTeX to PDF via latex-worker
    const latexWorkerUrl =
      process.env.LATEX_WORKER_URL || 'http://localhost:3005';
    const response = await fetch(`${latexWorkerUrl}/latex/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: resume.latexContent,
        userId: resume.userId,
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
      filename: `resume-${resume._id}.pdf`,
    };
  }

  /**
   * Get sync status for resume
   */
  async getSyncStatus(id: Types.ObjectId): Promise<{
    isSynced: boolean;
    resumeUpdatedAt: Date;
    lastEvaluationAt: Date | null;
  }> {
    const resume = await this.resumeModel.findById(id).exec();
    if (!resume) {
      throw new Error('Resume not found');
    }

    // Get most recent evaluation
    const lastEvaluation = await this.evaluationReportModel
      .findOne({ resumeId: id.toString() })
      .sort({ createdAt: -1 })
      .exec();

    return {
      isSynced: !lastEvaluation || resume.updatedAt <= lastEvaluation.createdAt,
      resumeUpdatedAt: resume.updatedAt,
      lastEvaluationAt: lastEvaluation?.createdAt || null,
    };
  }

  /**
   * Get location mapping for finding
   */
  async getLocations(
    id: Types.ObjectId,
    finding: string,
    format: string = 'latex-lines',
  ): Promise<any> {
    const resume = await this.resumeModel.findById(id).exec();
    if (!resume) {
      throw new Error('Resume not found');
    }

    // Parse finding location (e.g., "Experience[0].bullets[2]")
    const match = finding.match(/(\w+)\[(\d+)\]\.bullets\[(\d+)\]/);
    if (!match) {
      throw new Error('Invalid finding format');
    }

    const [, section, sectionIndex, bulletIndex] = match;

    if (format === 'latex-lines') {
      // Find line numbers for bullet
      const lines = resume.latexContent.split('\n');
      let currentSection = '';
      let currentSectionIndex = 0;
      let currentBulletIndex = 0;
      let startLine = 0;
      let endLine = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(`\\section{${section}}`)) {
          currentSection = section;
          currentSectionIndex = 0;
        }
        if (line.includes('\\item')) {
          if (
            currentSection === section &&
            parseInt(sectionIndex) === currentSectionIndex &&
            parseInt(bulletIndex) === currentBulletIndex
          ) {
            startLine = i + 1;
            endLine = i + 3; // Assume bullet spans 3 lines
            break;
          }
          currentBulletIndex++;
        }
      }

      return {
        location: finding,
        latexLines: {
          start: startLine,
          end: endLine,
        },
        section,
        sectionIndex: parseInt(sectionIndex),
        bulletIndex: parseInt(bulletIndex),
      };
    } else {
      // PDF coordinates (would require PDF parsing)
      return {
        location: finding,
        pdfCoordinates: {
          page: 1,
          x: 100,
          y: 200,
          width: 400,
          height: 20,
        },
      };
    }
  }

  /**
   * Get current job posting for resume
   */
  async getCurrentJobPosting(id: Types.ObjectId): Promise<{
    resumeId: string;
    currentJobPostingId: string | null;
  }> {
    const resume = await this.resumeModel.findById(id).exec();
    if (!resume) {
      throw new Error('Resume not found');
    }

    return {
      resumeId: resume._id.toString(),
      currentJobPostingId:
        (resume as any).currentJobPostingId?.toString() || null,
    };
  }

  /**
   * Set current job posting for resume
   */
  async setCurrentJobPosting(
    id: Types.ObjectId,
    jobPostingId: string,
  ): Promise<{
    success: boolean;
    resumeId: string;
    currentJobPostingId: string;
  }> {
    const resume = await this.resumeModel
      .findByIdAndUpdate(
        id,
        { $set: { currentJobPostingId: new Types.ObjectId(jobPostingId) } },
        { new: true },
      )
      .exec();

    if (!resume) {
      throw new Error('Resume not found');
    }

    return {
      success: true,
      resumeId: resume._id.toString(),
      currentJobPostingId: jobPostingId,
    };
  }
}
