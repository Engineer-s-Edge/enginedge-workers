/**
 * Webhook Entity
 *
 * Represents a webhook configuration for interview events.
 */

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookPayload {
  event: string;
  timestamp: Date;
  data: Record<string, unknown>;
}
