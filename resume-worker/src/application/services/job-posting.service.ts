import {
  Injectable,
  Logger,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JobPosting } from '../../domain/entities/job-posting.entity';
import { v4 as uuidv4 } from 'uuid';
import { MessageBrokerPort } from '../ports/message-broker.port';

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
        const jobPosting = new this.jobPostingModel({
          userId: response.result.userId,
          url: response.result.url,
          rawText: response.result.rawText,
          rawHtml: response.result.rawHtml,
          parsed: response.result.parsed,
          extractionMethod: 'nlp',
          confidence: response.result.confidence || 0.75,
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
        pending.reject(error instanceof Error ? error : new Error(String(error)));
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
}
