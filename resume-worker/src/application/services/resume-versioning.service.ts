import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Resume, ResumeVersion } from '../../domain/entities/resume.entity';
import * as crypto from 'crypto';

interface CreateVersionOptions {
  content: string;
  changes: string;
  createdBy: 'user' | 'agent' | 'system';
}

@Injectable()
export class ResumeVersioningService {
  private readonly logger = new Logger(ResumeVersioningService.name);

  constructor(
    @InjectModel('Resume')
    private readonly resumeModel: Model<Resume>,
  ) {}

  /**
   * Create a new version of a resume.
   */
  async createVersion(
    resumeId: string,
    options: CreateVersionOptions,
  ): Promise<Resume> {
    this.logger.log(`Creating new version for resume ${resumeId}`);

    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error(`Resume ${resumeId} not found`);
    }

    // Calculate hash
    const hash = this.calculateHash(options.content);

    // Calculate diff from current version
    const diff = this.calculateDiff(resume.latexContent, options.content);

    // Create new version
    const newVersion: ResumeVersion = {
      versionNumber: resume.currentVersion + 1,
      content: options.content,
      timestamp: new Date(),
      changes: options.changes,
      hash,
      createdBy: options.createdBy,
      diff,
    };

    // Update resume
    resume.versions.push(newVersion);
    resume.currentVersion = newVersion.versionNumber;
    resume.latexContent = options.content;
    resume.updatedAt = new Date();

    return resume.save();
  }

  /**
   * Rollback to a previous version.
   */
  async rollbackToVersion(
    resumeId: string,
    versionNumber: number,
  ): Promise<Resume> {
    this.logger.log(
      `Rolling back resume ${resumeId} to version ${versionNumber}`,
    );

    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error(`Resume ${resumeId} not found`);
    }

    // Find target version
    const targetVersion = resume.versions.find(
      (v: ResumeVersion) => v.versionNumber === versionNumber,
    );
    if (!targetVersion) {
      throw new Error(`Version ${versionNumber} not found`);
    }

    // Create a new version with the old content (rollback is a new version)
    return this.createVersion(resumeId, {
      content: targetVersion.content,
      changes: `Rolled back to version ${versionNumber}`,
      createdBy: 'user',
    });
  }

  /**
   * Get version history for a resume.
   */
  async getVersionHistory(resumeId: string): Promise<ResumeVersion[]> {
    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error(`Resume ${resumeId} not found`);
    }

    return resume.versions;
  }

  /**
   * Get a specific version.
   */
  async getVersion(
    resumeId: string,
    versionNumber: number,
  ): Promise<ResumeVersion | null> {
    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error(`Resume ${resumeId} not found`);
    }

    return (
      resume.versions.find(
        (v: ResumeVersion) => v.versionNumber === versionNumber,
      ) || null
    );
  }

  /**
   * Compare two versions.
   */
  async compareVersions(
    resumeId: string,
    version1: number,
    version2: number,
  ): Promise<{
    version1: ResumeVersion;
    version2: ResumeVersion;
    diff: string;
  }> {
    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error(`Resume ${resumeId} not found`);
    }

    const v1 = resume.versions.find(
      (v: ResumeVersion) => v.versionNumber === version1,
    );
    const v2 = resume.versions.find(
      (v: ResumeVersion) => v.versionNumber === version2,
    );

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const diff = this.calculateDiff(v1.content, v2.content);

    return {
      version1: v1,
      version2: v2,
      diff,
    };
  }

  /**
   * Calculate SHA-256 hash of content.
   */
  private calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Calculate diff between two versions.
   *
   * This is a simple line-based diff. For production, consider using
   * a library like 'diff' or 'fast-diff'.
   */
  private calculateDiff(oldContent: string, newContent: string): string {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    const diff: string[] = [];
    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';

      if (oldLine !== newLine) {
        if (oldLine) {
          diff.push(`- ${oldLine}`);
        }
        if (newLine) {
          diff.push(`+ ${newLine}`);
        }
      }
    }

    return diff.join('\n');
  }

  /**
   * Get diff between current version and a specific version.
   */
  async getDiffFromCurrent(
    resumeId: string,
    versionNumber: number,
  ): Promise<string> {
    const resume = await this.resumeModel.findById(resumeId).exec();
    if (!resume) {
      throw new Error(`Resume ${resumeId} not found`);
    }

    const targetVersion = resume.versions.find(
      (v: ResumeVersion) => v.versionNumber === versionNumber,
    );
    if (!targetVersion) {
      throw new Error(`Version ${versionNumber} not found`);
    }

    return this.calculateDiff(targetVersion.content, resume.latexContent);
  }
}
