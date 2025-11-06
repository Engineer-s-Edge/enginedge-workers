import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationService {
  async sendEmailNotification(
    recipient: string,
    subject: string,
    body: string,
  ): Promise<void> {
    // No-op stub for now; integrate with email provider later
    return;
  }
}
