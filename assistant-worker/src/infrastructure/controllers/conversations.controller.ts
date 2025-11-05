import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ConversationsService } from '@application/services/conversations.service';
import { ILogger } from '@application/ports/logger.port';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly service: ConversationsService,
    @Inject('ILogger') private readonly logger: ILogger,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any) {
    const conv = await this.service.createConversation({
      userId: body.userId,
      rootAgentId: body.rootAgentId,
      type: body.type,
      settingsOverrides: body.settingsOverrides,
      initialMessage: body.initialMessage,
      parentConversationId: body.parentConversationId,
    });
    return { success: true, conversation: conv };
  }

  @Get()
  async list(@Query('userId') userId: string, @Query('limit') limit?: number) {
    const list = await this.service.listConversations(userId, limit ? Number(limit) : undefined);
    return { success: true, conversations: list, count: list.length };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const conv = await this.service.getConversation(id);
    return { success: !!conv, conversation: conv };
  }

  @Patch(':id/messages')
  async addMessage(@Param('id') id: string, @Body() body: any) {
    const res = await this.service.addMessage(id, {
      messageId: body.messageId,
      role: body.role,
      content: body.content,
      metadata: body.metadata,
    });
    return { success: true, version: res.version };
  }

  @Post(':id/tool-calls')
  async toolCall(@Param('id') id: string, @Body() body: any) {
    await this.service.recordToolCall(id, body);
    return { success: true };
  }

  @Post(':id/checkpoints')
  async checkpoint(@Param('id') id: string, @Body() body: any) {
    await this.service.createCheckpoint(id, body);
    return { success: true };
  }

  @Patch(':id/messages/:messageId')
  async editMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() body: any,
  ) {
    await this.service.editMessage(id, {
      messageId,
      version: body.version,
      role: body.role,
      content: body.content,
      editedBy: body.editedBy,
      diff: body.diff,
    });
    return { success: true };
  }

  @Post(':id/pause')
  async pause(@Param('id') id: string) {
    await this.service.pause(id);
    return { success: true };
  }

  @Post(':id/resume')
  async resume(@Param('id') id: string) {
    await this.service.resume(id);
    return { success: true };
  }

  @Get(':id/events')
  async events(@Param('id') id: string, @Query('since') since?: string, @Query('limit') limit?: number) {
    const list = await this.service.getEvents(id, since ? new Date(since) : undefined, limit ? Number(limit) : undefined);
    return { success: true, events: list };
  }

  @Post(':id/children')
  async addChild(@Param('id') id: string, @Body() body: any) {
    await this.service.addChildConversation(id, body.childId);
    return { success: true };
  }

  @Patch(':id/state')
  async updateState(@Param('id') id: string, @Body() body: any) {
    await this.service.updateAgentState(id, body);
    return { success: true };
  }
}
