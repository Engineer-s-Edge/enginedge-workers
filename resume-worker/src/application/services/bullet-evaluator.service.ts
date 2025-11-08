import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { MessageBrokerPort } from '../ports/message-broker.port';

export interface BulletEvaluationResult {
  overallScore: number;
  passed: boolean;
  checks: {
    [key: string]: {
      passed: boolean;
      score: number;
      feedback: string;
      evidence?: string;
    };
  };
  feedback: string[];
  suggestedFixes?: Array<{
    description: string;
    fixedText: string;
    confidence: number;
    changesApplied: string[];
  }>;
}

@Injectable()
export class BulletEvaluatorService implements OnModuleInit {
  private readonly logger = new Logger(BulletEvaluatorService.name);
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: BulletEvaluationResult) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  constructor(
    @Inject('MessageBrokerPort')
    private readonly messageBroker: MessageBrokerPort,
  ) {}

  async onModuleInit(): Promise<void> {
    // Subscribe to response topic
    if (this.messageBroker.isConnected()) {
      await this.messageBroker.subscribe(
        'resume.bullet.evaluate.response',
        this.handleResponse.bind(this),
      );
    } else {
      // Wait for connection
      await this.messageBroker.connect();
      await this.messageBroker.subscribe(
        'resume.bullet.evaluate.response',
        this.handleResponse.bind(this),
      );
    }
  }

  private async handleResponse(message: unknown): Promise<void> {
    try {
      const response = message as {
        correlationId: string;
        result?: BulletEvaluationResult;
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
        pending.resolve(response.result);
      } else {
        pending.reject(new Error('Invalid response format'));
      }
    } catch (error) {
      this.logger.error('Error handling response:', error);
    }
  }

  /**
   * Evaluate a single bullet point against quality KPIs.
   *
   * This proxies to the spacy-service via Kafka for NLP-based checks,
   * but also performs some local checks.
   */
  async evaluateBullet(
    bulletText: string,
    role?: string,
    useLlm: boolean = false,
    generateFixes: boolean = true,
  ): Promise<BulletEvaluationResult> {
    this.logger.log(`Evaluating bullet: ${bulletText.substring(0, 50)}...`);

    const correlationId = uuidv4();

    // Ensure Kafka is connected
    if (!this.messageBroker.isConnected()) {
      await this.messageBroker.connect();
    }

    // Create promise that will be resolved when response arrives
    return new Promise<BulletEvaluationResult>((resolve, reject) => {
      // Set timeout (30 seconds)
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error('Bullet evaluation timeout'));
      }, 30000);

      // Store pending request
      this.pendingRequests.set(correlationId, {
        resolve,
        reject,
        timeout,
      });

      // Send request to Kafka
      this.messageBroker
        .sendMessage('resume.bullet.evaluate', {
          correlationId,
          bulletText,
          role,
          useLlm,
          generateFixes,
        })
        .catch((error) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(correlationId);
          this.logger.error('Failed to send bullet evaluation request:', error);
          reject(error);
        });
    });
  }

  /**
   * Batch evaluate multiple bullets.
   */
  async evaluateBullets(
    bullets: string[],
    role?: string,
    useLlm: boolean = false,
  ): Promise<BulletEvaluationResult[]> {
    return Promise.all(
      bullets.map((bullet) => this.evaluateBullet(bullet, role, useLlm, false)),
    );
  }
}
