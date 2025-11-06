import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Resume,
  ResumeMetadata,
  ResumeVersion,
} from '../../domain/entities/resume.entity';
import { ResumeSchema } from '../../infrastructure/database/schemas/resume.schema';

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
}
