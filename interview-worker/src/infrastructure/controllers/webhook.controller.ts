/**
 * Webhook Controller
 *
 * REST API endpoints for webhook management.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  WebhookService,
  CreateWebhookDto,
  UpdateWebhookDto,
} from '../../application/services/webhook.service';
import { Webhook } from '../../domain/entities';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * POST /webhooks
   * Create a new webhook
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createWebhook(@Body() dto: CreateWebhookDto): Promise<Webhook> {
    return await this.webhookService.createWebhook(dto);
  }

  /**
   * GET /webhooks?userId=xxx
   * List all webhooks for the current user
   * Note: In production, extract userId from auth token
   */
  @Get()
  async listWebhooks(@Query('userId') userId: string): Promise<Webhook[]> {
    if (!userId) {
      throw new Error('userId is required');
    }
    return await this.webhookService.getWebhooksByUser(userId);
  }

  /**
   * GET /webhooks/:id
   * Get webhook details
   */
  @Get(':id')
  async getWebhook(@Param('id') id: string): Promise<Webhook | null> {
    return await this.webhookService.getWebhookById(id);
  }

  /**
   * PUT /webhooks/:id
   * Update webhook
   */
  @Put(':id')
  async updateWebhook(
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ): Promise<Webhook> {
    return await this.webhookService.updateWebhook(id, dto);
  }

  /**
   * DELETE /webhooks/:id
   * Delete webhook
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWebhook(@Param('id') id: string): Promise<void> {
    return await this.webhookService.deleteWebhook(id);
  }

  /**
   * POST /webhooks/:id/test
   * Test webhook delivery
   */
  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  async testWebhook(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.webhookService.testWebhook(id);
    return { success: true };
  }
}
