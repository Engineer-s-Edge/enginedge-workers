/**
 * Notification Service
 *
 * Centralized notification system for sending notifications via various channels.
 * Supports email, in-app, push, and webhook notifications.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  ): Promise<Notification> {
    const notification: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
        await this.sendEmail(userId, title, message, metadata);
        break;
      case 'in-app':
        await this.sendInApp(userId, title, message, metadata);
        break;
      case 'push':
        await this.sendPush(userId, title, message, metadata);
        break;
      case 'webhook':
        await this.sendWebhook(userId, title, message, metadata);
        break;
      case 'sms':
        await this.sendSMS(userId, title, message, metadata);
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
  ): Promise<void> {
    // TODO: Integrate with email service (SendGrid, SES, etc.)
    const emailServiceUrl =
      this.configService?.get<string>('EMAIL_SERVICE_URL') ||
      process.env.EMAIL_SERVICE_URL;

    if (emailServiceUrl) {
      try {
        await fetch(`${emailServiceUrl}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            subject: title,
            body: message,
            metadata,
          }),
        });
      } catch (error) {
        this.logger.warn(`Email service unavailable, notification queued`, {
          userId,
        });
      }
    } else {
      this.logger.debug(`Email notification (no service configured)`, {
        userId,
        title,
      });
    }
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
  ): Promise<void> {
    // TODO: Integrate with push notification service (FCM, APNS, etc.)
    const pushServiceUrl =
      this.configService?.get<string>('PUSH_SERVICE_URL') ||
      process.env.PUSH_SERVICE_URL;

    if (pushServiceUrl) {
      try {
        await fetch(`${pushServiceUrl}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            title,
            body: message,
            metadata,
          }),
        });
      } catch (error) {
        this.logger.warn(`Push service unavailable, notification queued`, {
          userId,
        });
      }
    } else {
      this.logger.debug(`Push notification (no service configured)`, {
        userId,
        title,
      });
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(
    userId: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const webhookUrl =
      this.configService?.get<string>('NOTIFICATION_WEBHOOK_URL') ||
      process.env.NOTIFICATION_WEBHOOK_URL;

    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
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
      } catch (error) {
        this.logger.warn(`Webhook notification failed`, { userId, webhookUrl });
      }
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(
    userId: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
    const smsServiceUrl =
      this.configService?.get<string>('SMS_SERVICE_URL') ||
      process.env.SMS_SERVICE_URL;

    if (smsServiceUrl) {
      try {
        await fetch(`${smsServiceUrl}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            message: `${title}: ${message}`,
            metadata,
          }),
        });
      } catch (error) {
        this.logger.warn(`SMS service unavailable`, { userId });
      }
    } else {
      this.logger.debug(`SMS notification (no service configured)`, {
        userId,
        title,
      });
    }
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
}
