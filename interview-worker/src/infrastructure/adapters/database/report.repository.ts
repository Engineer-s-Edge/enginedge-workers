/**
 * InterviewReport Repository - MongoDB Implementation
 */

import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, Collection } from 'mongodb';
import { InterviewReport } from '../../../domain/entities';
import { IInterviewReportRepository } from '../../../application/ports/repositories.port';

@Injectable()
export class MongoInterviewReportRepository
  implements IInterviewReportRepository, OnModuleInit
{
  private readonly logger = new Logger(MongoInterviewReportRepository.name);
  private collection!: Collection;

  constructor(
    @Inject('MONGODB_DB') private readonly db: Db,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.collection = this.db.collection('interview_reports');

    // Create indexes
    await this.collection.createIndex({ reportId: 1 }, { unique: true });
    await this.collection.createIndex({ sessionId: 1 }, { unique: true });
    await this.collection.createIndex({ generatedAt: -1 });

    this.logger.log('MongoInterviewReportRepository initialized');
  }

  async save(report: InterviewReport): Promise<InterviewReport> {
    try {
      const doc = report.toObject();
      await this.collection.updateOne(
        { reportId: report.reportId },
        { $set: doc },
        { upsert: true },
      );
      return report;
    } catch (error) {
      this.logger.error(
        `Failed to save report: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findById(reportId: string): Promise<InterviewReport | null> {
    try {
      const doc = await this.collection.findOne({ reportId });
      return doc ? InterviewReport.fromObject(doc) : null;
    } catch (error) {
      this.logger.error(
        `Failed to find report: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async findBySessionId(sessionId: string): Promise<InterviewReport | null> {
    try {
      const doc = await this.collection.findOne({ sessionId });
      return doc ? InterviewReport.fromObject(doc) : null;
    } catch (error) {
      this.logger.error(
        `Failed to find report by session: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async delete(reportId: string): Promise<boolean> {
    try {
      const result = await this.collection.deleteOne({ reportId });
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete report: ${error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
