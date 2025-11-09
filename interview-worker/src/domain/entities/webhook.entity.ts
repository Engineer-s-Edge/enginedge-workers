/**
 * Webhook Entity
 *
 * Represents a webhook configuration for interview events.
 */

import { WebhookEvent } from '../value-objects/webhook-event.value-object';

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  secret: string; // Required for HMAC signing
  events: WebhookEvent[]; // Array of subscribed events
  enabled: boolean;
  retryCount: number;
  lastDeliveryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
  signature?: string; // HMAC-SHA256 signature
}
