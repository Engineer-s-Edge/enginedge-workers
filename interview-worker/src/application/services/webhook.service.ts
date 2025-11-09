/**
 * Webhook Service
 *
 * Application service for managing webhooks and triggering webhook deliveries.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Webhook, WebhookPayload } from '../../domain/entities';
import { WebhookEvent } from '../../domain/value-objects/webhook-event.value-object';
import { IWebhookRepository } from '../ports/repositories.port';
import { WebhookDeliveryAdapter } from '../../infrastructure/adapters/webhooks/webhook-delivery.adapter';

export interface CreateWebhookDto {
  userId: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  enabled?: boolean;
}

export interface UpdateWebhookDto {
  url?: string;
  secret?: string;
  events?: WebhookEvent[];
  enabled?: boolean;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject('IWebhookRepository')
    private readonly webhookRepository: IWebhookRepository,
    private readonly deliveryAdapter: WebhookDeliveryAdapter,
  ) {}

  /**
   * Create a new webhook
   */
  async createWebhook(dto: CreateWebhookDto): Promise<Webhook> {
    const webhook: Webhook = {
      id: uuidv4(),
      userId: dto.userId,
      url: dto.url,
      secret: dto.secret,
      events: dto.events,
      enabled: dto.enabled ?? true,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return await this.webhookRepository.save(webhook);
  }

  /**
   * Update an existing webhook
   */
  async updateWebhook(
    webhookId: string,
    dto: UpdateWebhookDto,
  ): Promise<Webhook> {
    const existing = await this.webhookRepository.findById(webhookId);
    if (!existing) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    const updated: Webhook = {
      ...existing,
      ...dto,
      updatedAt: new Date(),
    };

    const result = await this.webhookRepository.update(webhookId, updated);
    if (!result) {
      throw new Error(`Failed to update webhook: ${webhookId}`);
    }

    return result;
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    const deleted = await this.webhookRepository.delete(webhookId);
    if (!deleted) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }
  }

  /**
   * Get all webhooks for a user
   */
  async getWebhooksByUser(userId: string): Promise<Webhook[]> {
    return await this.webhookRepository.findByUserId(userId);
  }

  /**
   * Get all webhooks subscribed to a specific event
   */
  async getWebhooksByEvent(event: WebhookEvent): Promise<Webhook[]> {
    return await this.webhookRepository.findByEvent(event);
  }

  /**
   * Get a webhook by ID
   */
  async getWebhookById(webhookId: string): Promise<Webhook | null> {
    return await this.webhookRepository.findById(webhookId);
  }

  /**
   * Trigger webhooks for a specific event
   */
  async triggerWebhook(
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const webhooks = await this.getWebhooksByEvent(event);

    // Filter to only enabled webhooks
    const enabledWebhooks = webhooks.filter((w) => w.enabled);

    if (enabledWebhooks.length === 0) {
      this.logger.debug(`No enabled webhooks found for event: ${event}`);
      return;
    }

    this.logger.log(
      `Triggering ${enabledWebhooks.length} webhook(s) for event: ${event}`,
    );

    // Deliver to all webhooks in parallel
    const deliveryPromises = enabledWebhooks.map((webhook) =>
      this.deliverWebhook(webhook, event, payload).catch((error) => {
        this.logger.error(
          `Failed to deliver webhook ${webhook.id}: ${error.message}`,
          error.stack,
        );
      }),
    );

    await Promise.allSettled(deliveryPromises);
  }

  /**
   * Deliver a webhook payload
   */
  async deliverWebhook(
    webhook: Webhook,
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const webhookPayload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    try {
      await this.deliveryAdapter.deliver(webhook, webhookPayload);

      // Update last delivery time
      await this.webhookRepository.update(webhook.id, {
        lastDeliveryAt: new Date(),
        retryCount: 0,
      });
    } catch (error) {
      // Increment retry count
      const newRetryCount = webhook.retryCount + 1;
      await this.webhookRepository.update(webhook.id, {
        retryCount: newRetryCount,
      });

      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    return this.deliveryAdapter.verifySignature(payload, signature, secret);
  }

  /**
   * Test webhook delivery
   */
  async testWebhook(webhookId: string): Promise<void> {
    const webhook = await this.getWebhookById(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    const testPayload = {
      test: true,
      message: 'This is a test webhook delivery',
      timestamp: new Date().toISOString(),
    };

    await this.deliverWebhook(
      webhook,
      webhook.events[0] || WebhookEvent.INTERVIEW_STARTED,
      testPayload,
    );
  }
}
