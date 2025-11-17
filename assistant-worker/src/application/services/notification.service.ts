/**
 * Notification Service
 *
 * Centralized notification system for sending notifications via various channels.
 * Supports email, in-app, push, and webhook notifications.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ILogger } from '../ports/logger.port';

export type NotificationChannel =
  | 'email'
  | 'in-app'
  | 'push'
  | 'webhook'
  | 'sms';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  userId: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  priority: NotificationPriority;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  sentAt?: Date;
  readAt?: Date;
}

export interface NotificationOptions {
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
  retryCount?: number;
}

@Injectable()
export class NotificationService {
  private notifications: Map<string, Notification> = new Map();
  private readonly enabledChannels: Set<NotificationChannel>;
  private readonly emailApiKey?: string;
  private readonly emailFrom?: string;
  private readonly pushServerKey?: string;
  private readonly smsAccountSid?: string;
  private readonly smsAuthToken?: string;
  private readonly smsFromNumber?: string;
  private readonly webhookUrl?: string;

  constructor(
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly configService?: ConfigService,
  ) {
    // Get enabled channels from config
    const channelsConfig =
      this.configService?.get<string>('NOTIFICATION_CHANNELS') ||
      process.env.NOTIFICATION_CHANNELS ||
      'in-app,email';
    this.enabledChannels = new Set(
      channelsConfig.split(',').map((c) => c.trim()) as NotificationChannel[],
    );

    this.emailApiKey =
      this.configService?.get<string>('SENDGRID_API_KEY') ||
      process.env.SENDGRID_API_KEY;
    this.emailFrom =
      this.configService?.get<string>('NOTIFICATION_EMAIL_FROM') ||
      process.env.NOTIFICATION_EMAIL_FROM;
    this.pushServerKey =
      this.configService?.get<string>('FCM_SERVER_KEY') ||
      process.env.FCM_SERVER_KEY;
    this.smsAccountSid =
      this.configService?.get<string>('TWILIO_ACCOUNT_SID') ||
      process.env.TWILIO_ACCOUNT_SID;
    this.smsAuthToken =
      this.configService?.get<string>('TWILIO_AUTH_TOKEN') ||
      process.env.TWILIO_AUTH_TOKEN;
    this.smsFromNumber =
      this.configService?.get<string>('TWILIO_FROM_NUMBER') ||
      process.env.TWILIO_FROM_NUMBER;
    this.webhookUrl =
      this.configService?.get<string>('NOTIFICATION_WEBHOOK_URL') ||
      process.env.NOTIFICATION_WEBHOOK_URL;
  }

  /**
   * Send notification
   */
  async sendNotification(
    userId: string,
    title: string,
    message: string,
    options: NotificationOptions = {},
  ): Promise<Notification[]> {
    const channels = options.channels || Array.from(this.enabledChannels);
    const priority = options.priority || 'normal';
    const sentNotifications: Notification[] = [];

    for (const channel of channels) {
      if (!this.enabledChannels.has(channel)) {
        this.logger.debug(`Channel ${channel} is disabled, skipping`);
        continue;
      }

      try {
        const notification = await this.sendToChannel(
          userId,
          channel,
          title,
          message,
          priority,
          options.metadata,
          options,
        );
        sentNotifications.push(notification);
      } catch (error) {
        this.logger.error(
          `Failed to send notification via ${channel}: ${error instanceof Error ? error.message : String(error)}`,
          { userId, channel },
        );
      }
    }

    return sentNotifications;
  }

  /**
   * Send escalation notification
   */
  async sendEscalationNotification(
    userId: string,
    escalationType: string,
    context: Record<string, unknown>,
  ): Promise<Notification[]> {
    const title = `Escalation: ${escalationType}`;
    const message = this.formatEscalationMessage(escalationType, context);

    return this.sendNotification(userId, title, message, {
      channels: ['in-app', 'email'], // Escalations use multiple channels
      priority: 'high',
      metadata: {
        type: 'escalation',
        escalationType,
        ...context,
      },
    });
  }

  /**
   * Send notification to specific channel
   */
  private async sendToChannel(
    userId: string,
    channel: NotificationChannel,
    title: string,
    message: string,
    priority: NotificationPriority,
    metadata?: Record<string, unknown>,
    options?: NotificationOptions,
  ): Promise<Notification> {
    const notification: Notification = {
      id: randomUUID(),
      userId,
      channel,
      title,
      message,
      priority,
      metadata,
      createdAt: new Date(),
    };

    switch (channel) {
      case 'email':
        await this.sendEmail(userId, title, message, metadata, options);
        break;
      case 'in-app':
        await this.sendInApp(userId, title, message, metadata);
        break;
      case 'push':
        await this.sendPush(userId, title, message, metadata, options);
        break;
      case 'webhook':
        await this.sendWebhook(userId, title, message, metadata, options);
        break;
      case 'sms':
        await this.sendSMS(userId, title, message, metadata, options);
        break;
    }

    notification.sentAt = new Date();
    this.notifications.set(notification.id, notification);

    this.logger.info(`Notification sent via ${channel}`, {
      notificationId: notification.id,
      userId,
      priority,
    });

    return notification;
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    userId: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
    options?: NotificationOptions,
  ): Promise<void> {
    if (!this.emailApiKey || !this.emailFrom) {
      this.logger.warn('Email provider not configured, skipping', { userId });
      return;
    }

    const toAddress =
      (metadata?.email as string | undefined) ||
      this.configService?.get<string>('NOTIFICATION_EMAIL_DEFAULT');

    if (!toAddress) {
      this.logger.warn('No recipient email provided for notification', {
        userId,
        title,
      });
      return;
    }

    await this.dispatchWithRetry(async () => {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.emailApiKey}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: toAddress }] }],
          from: { email: this.emailFrom },
          subject: title,
          content: [
            {
              type: 'text/plain',
              value: `${message}${metadata?.details ? `\n\n${metadata.details}` : ''}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `SendGrid request failed (${response.status}): ${errorText}`,
        );
      }
    }, options?.retryCount ?? 1);
  }

  /**
   * Send in-app notification
   */
  private async sendInApp(
    userId: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    // In-app notifications are stored and can be retrieved via API
    // This is handled by storing in the notifications map
    this.logger.debug(`In-app notification created`, { userId, title });
  }

  /**
   * Send push notification
   */
  private async sendPush(
    userId: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
    options?: NotificationOptions,
  ): Promise<void> {
    if (!this.pushServerKey) {
      this.logger.warn('Push provider not configured, skipping', { userId });
      return;
    }

    const deviceToken = metadata?.deviceToken as string | undefined;
    if (!deviceToken) {
      this.logger.warn('Missing device token for push notification', {
        userId,
      });
      return;
    }

    await this.dispatchWithRetry(async () => {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${this.pushServerKey}`,
        },
        body: JSON.stringify({
          to: deviceToken,
          notification: {
            title,
            body: message,
          },
          data: metadata,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `FCM push failed (${response.status}): ${errorBody}`,
        );
      }
    }, options?.retryCount ?? 1);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(
    userId: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
    options?: NotificationOptions,
  ): Promise<void> {
    const targetUrl =
      (metadata?.webhookUrl as string | undefined) || this.webhookUrl;

    if (!targetUrl) {
      this.logger.warn('Webhook notification skipped - no URL configured', {
        userId,
      });
      return;
    }

    await this.dispatchWithRetry(async () => {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title,
          message,
          metadata,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Webhook request failed (${response.status}): ${await response.text()}`,
        );
      }
    }, options?.retryCount ?? 1);
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(
    userId: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
    options?: NotificationOptions,
  ): Promise<void> {
    if (
      !this.smsAccountSid ||
      !this.smsAuthToken ||
      !this.smsFromNumber
    ) {
      this.logger.warn('SMS provider not configured, skipping', { userId });
      return;
    }

    const toNumber = metadata?.phone as string | undefined;
    if (!toNumber) {
      this.logger.warn('Missing phone number for SMS notification', { userId });
      return;
    }

    const body = `${title}: ${message}`;
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.smsAccountSid}/Messages.json`;

    await this.dispatchWithRetry(async () => {
      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${this.smsAccountSid}:${this.smsAuthToken}`,
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: this.smsFromNumber!,
          To: toNumber,
          Body: body,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Twilio request failed (${response.status}): ${errorText}`,
        );
      }
    }, options?.retryCount ?? 1);
  }

  /**
   * Format escalation message
   */
  private formatEscalationMessage(
    escalationType: string,
    context: Record<string, unknown>,
  ): string {
    const baseMessage = `An escalation has been triggered: ${escalationType}`;
    const details = Object.entries(context)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    return details ? `${baseMessage}. Details: ${details}` : baseMessage;
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    limit = 50,
  ): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      return false;
    }

    notification.readAt = new Date();
    return true;
  }

  private async dispatchWithRetry(
    operation: () => Promise<void>,
    retryCount: number,
  ): Promise<void> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retryCount) {
      try {
        await operation();
        return;
      } catch (error) {
        lastError = error;
        attempt += 1;
        const delayMs = Math.min(2000 * attempt, 8000);
        this.logger.warn('Notification dispatch failed, retrying', {
          attempt,
          retryCount,
          error: error instanceof Error ? error.message : String(error),
        });
        if (attempt > retryCount) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Notification dispatch failed');
  }
}
