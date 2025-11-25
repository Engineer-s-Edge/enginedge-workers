import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JobPosting } from '../../domain/entities/job-posting.entity';
import { v4 as uuidv4 } from 'uuid';
import { MessageBrokerPort } from '../ports/message-broker.port';
import * as crypto from 'crypto';

@Injectable()
export class JobPostingService implements OnModuleInit {
  private readonly logger = new Logger(JobPostingService.name);
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: JobPosting) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  constructor(
    @InjectModel('JobPosting')
    private readonly jobPostingModel: Model<JobPosting>,
    @Inject('MessageBrokerPort')
    private readonly messageBroker: MessageBrokerPort,
  ) {}

  async onModuleInit(): Promise<void> {
    // Subscribe to response topic
    if (this.messageBroker.isConnected()) {
      await this.messageBroker.subscribe(
        'resume.posting.extract.response',
        this.handleResponse.bind(this),
      );
    } else {
      // Wait for connection
      await this.messageBroker.connect();
      await this.messageBroker.subscribe(
        'resume.posting.extract.response',
        this.handleResponse.bind(this),
      );
    }
  }

  private async handleResponse(message: unknown): Promise<void> {
    try {
      const response = message as {
        correlationId: string;
        result?: any; // Parsed job posting data
        error?: string;
      };

      const pending = this.pendingRequests.get(response.correlationId);
      if (!pending) {
        this.logger.warn(
          `Received response for unknown correlation ID: ${response.correlationId}`,
        );
        return;
      }

      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.correlationId);

      if (response.error) {
        pending.reject(new Error(response.error));
      } else if (response.result) {
        // Create JobPosting from parsed data
        const checksum = crypto
          .createHash('sha256')
          .update(response.result.rawText)
          .digest('hex');
        const jobPosting = new this.jobPostingModel({
          userId: response.result.userId,
          url: response.result.url,
          rawText: response.result.rawText,
          rawHtml: response.result.rawHtml,
          parsed: {
            ...response.result.parsed,
            metadata: {
              ...(response.result.parsed?.metadata || {}),
              checksumSha256: checksum,
            },
          },
          extractionMethod: 'nlp',
          confidence: response.result.confidence || 0.75,
          tags: [],
          notes: '',
          createdAt: new Date(),
        });
        const saved = await jobPosting.save();
        pending.resolve(saved);
      } else {
        pending.reject(new Error('Invalid response format'));
      }
    } catch (error) {
      this.logger.error('Error handling response:', error);
      const response = message as { correlationId: string };
      const pending = this.pendingRequests.get(response.correlationId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.correlationId);
        pending.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }
  }

  /**
   * Extract structured data from job posting text.
   */
  async extractFromText(
    userId: string,
    text: string,
    url?: string,
    html?: string,
  ): Promise<JobPosting> {
    this.logger.log(`Extracting job posting for user ${userId}`);

    // Check if posting already extracted (by checksum)
    const checksum = crypto.createHash('sha256').update(text).digest('hex');
    const existing = await this.jobPostingModel
      .findOne({
        userId,
        'parsed.metadata.checksumSha256': checksum,
      })
      .exec();

    if (existing) {
      this.logger.log(`Job posting already extracted, returning existing`);
      return existing;
    }

    const correlationId = uuidv4();

    // Ensure Kafka is connected
    if (!this.messageBroker.isConnected()) {
      await this.messageBroker.connect();
    }

    // Create promise that will be resolved when response arrives
    return new Promise<JobPosting>((resolve, reject) => {
      // Set timeout (60 seconds for job posting extraction)
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error('Job posting extraction timeout'));
      }, 60000);

      // Store pending request
      this.pendingRequests.set(correlationId, {
        resolve,
        reject,
        timeout,
      });

      // Send request to Kafka
      this.messageBroker
        .sendMessage('resume.posting.extract', {
          correlationId,
          userId,
          text,
          url,
          html,
        })
        .catch((error) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(correlationId);
          this.logger.error(
            'Failed to send job posting extraction request:',
            error,
          );
          reject(error);
        });
    });
  }

  /**
   * Get job posting by ID.
   */
  async getById(id: string): Promise<JobPosting | null> {
    return this.jobPostingModel.findById(id).exec();
  }

  /**
   * Get all job postings for a user.
   */
  async getByUserId(userId: string): Promise<JobPosting[]> {
    return this.jobPostingModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  /**
   * Delete job posting.
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.jobPostingModel.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  /**
   * Update job posting metadata
   */
  async update(
    id: string,
    updates: { tags?: string[]; notes?: string },
  ): Promise<JobPosting> {
    const updateData: any = {};
    if (updates.tags !== undefined) {
      updateData.tags = updates.tags;
    }
    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }

    const posting = await this.jobPostingModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .exec();

    if (!posting) {
      throw new Error('Job posting not found');
    }

    return posting;
  }

  /**
   * Search and filter job postings
   */
  async searchAndFilter(
    userId: string,
    options: {
      search?: string;
      tags?: string[];
      company?: string;
      role?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    results: any[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const query: any = { userId };

    // Text search
    if (options.search) {
      query.$or = [
        { rawText: { $regex: options.search, $options: 'i' } },
        { 'parsed.role.titleRaw': { $regex: options.search, $options: 'i' } },
        {
          'parsed.company.hiringOrganization': {
            $regex: options.search,
            $options: 'i',
          },
        },
      ];
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      query.tags = { $in: options.tags };
    }

    // Filter by company
    if (options.company) {
      query['parsed.company.hiringOrganization'] = {
        $regex: options.company,
        $options: 'i',
      };
    }

    // Filter by role
    if (options.role) {
      query['parsed.role.titleRaw'] = { $regex: options.role, $options: 'i' };
    }

    // Filter by date range
    if (options.startDate || options.endDate) {
      query.createdAt = {};
      if (options.startDate) {
        query.createdAt.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        query.createdAt.$lte = new Date(options.endDate);
      }
    }

    // Count total
    const total = await this.jobPostingModel.countDocuments(query).exec();

    // Build query
    let mongoQuery = this.jobPostingModel.find(query);

    // Sort
    const sortField = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
    mongoQuery = mongoQuery.sort({ [sortField]: sortOrder });

    // Paginate
    mongoQuery = mongoQuery
      .skip(options.offset || 0)
      .limit(options.limit || 50);

    const results = await mongoQuery.exec();

    return {
      results,
      total,
      limit: options.limit || 50,
      offset: options.offset || 0,
    };
  }

  /**
   * Get summary of job postings
   */
  async getSummary(
    userId: string,
    query: any,
  ): Promise<{
    results: Array<{
      _id: string;
      position: string;
      company: string;
      dateEntered: Date;
      tags: string[];
    }>;
    total: number;
  }> {
    const searchResult = await this.searchAndFilter(userId, {
      ...query,
      limit: query.limit || 50,
      offset: query.offset || 0,
    });

    const results = searchResult.results.map((posting) => ({
      _id: posting._id.toString(),
      position: posting.parsed?.role?.titleRaw || '',
      company: posting.parsed?.company?.hiringOrganization || '',
      dateEntered: posting.createdAt,
      tags: posting.tags || [],
    }));

    return {
      results,
      total: searchResult.total,
    };
  }
}
