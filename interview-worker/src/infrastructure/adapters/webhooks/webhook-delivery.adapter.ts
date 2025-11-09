/**
 * Webhook Delivery Adapter
 *
 * Handles HTTP delivery of webhook payloads with retry logic and HMAC signing.
 */

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { Webhook, WebhookPayload } from '../../../domain/entities';

@Injectable()
export class WebhookDeliveryAdapter {
  private readonly logger = new Logger(WebhookDeliveryAdapter.name);
  private readonly httpClient: AxiosInstance;
  private readonly maxRetries = 3;
  private readonly timeout = 5000; // 5 seconds

  constructor() {
    this.httpClient = axios.create({
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EnginEdge-Interview-Worker/1.0',
      },
    });
  }

  /**
   * Deliver a webhook payload
   */
  async deliver(webhook: Webhook, payload: WebhookPayload): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: 1s, 2s, 4s, 8s
          const delay = Math.pow(2, attempt - 1) * 1000;
          this.logger.debug(
            `Retrying webhook delivery (attempt ${attempt + 1}/${this.maxRetries + 1}) after ${delay}ms`,
          );
          await this.sleep(delay);
        }

        // Generate HMAC signature
        const signature = this.generateSignature(
          JSON.stringify(payload),
          webhook.secret,
        );

        // Add signature to payload
        const signedPayload = {
          ...payload,
          signature,
        };

        // Deliver webhook
        await this.httpClient.post(webhook.url, signedPayload);

        this.logger.log(
          `Successfully delivered webhook ${webhook.id} to ${webhook.url}`,
        );
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Webhook delivery attempt ${attempt + 1} failed for ${webhook.id}: ${lastError.message}`,
        );

        // If this was the last attempt, throw the error
        if (attempt === this.maxRetries) {
          break;
        }
      }
    }

    // All retries exhausted
    this.logger.error(
      `Failed to deliver webhook ${webhook.id} after ${this.maxRetries + 1} attempts`,
      lastError?.stack,
    );
    throw new Error(
      `Webhook delivery failed after ${this.maxRetries + 1} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Generate HMAC-SHA256 signature for webhook payload
   */
  generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
