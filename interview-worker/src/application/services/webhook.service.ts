import { Injectable } from '@nestjs/common';

@Injectable()
export class WebhookService {
  async triggerWebhooks(
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    // No-op stub for now; replace with actual webhook dispatching
    return;
  }
}
