import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ConversationsService } from '@application/services/conversations.service';
import { FoldersService } from '@application/services/folders.service';

// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly service: ConversationsService,
    @Inject('ILogger') private readonly logger: Logger,
    @Inject('FoldersService') private readonly foldersService?: FoldersService,
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
    const list = await this.service.listConversations(
      userId,
      limit ? Number(limit) : undefined,
    );
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
  async events(
    @Param('id') id: string,
    @Query('since') since?: string,
    @Query('limit') limit?: number,
  ) {
    const list = await this.service.getEvents(
      id,
      since ? new Date(since) : undefined,
      limit ? Number(limit) : undefined,
    );
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

  @Patch(':id/settings')
  async updateSettings(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await this.service.updateSettings(id, body);
    return { success: true };
  }

  @Get(':id/memories')
  async getMemories(@Param('id') id: string) {
    const memories = await this.service.getMemories(id);
    return { success: true, memories };
  }

  @Post(':id/memories')
  @HttpCode(HttpStatus.CREATED)
  async addMemory(@Param('id') id: string, @Body() body: any) {
    const result = await this.service.addMemory(id, body);
    return { success: true, memoryId: result.id };
  }

  @Patch(':id/memories/:memoryId')
  async updateMemory(
    @Param('id') id: string,
    @Param('memoryId') memoryId: string,
    @Body() body: any,
  ) {
    await this.service.updateMemory(id, memoryId, body);
    return { success: true };
  }

  @Delete(':id/memories/:memoryId')
  async removeMemory(
    @Param('id') id: string,
    @Param('memoryId') memoryId: string,
  ) {
    await this.service.removeMemory(id, memoryId);
    return { success: true };
  }

  @Get(':id/checkpoints')
  async getCheckpoints(@Param('id') id: string) {
    const checkpoints = await this.service.getCheckpoints(id);
    return { success: true, checkpoints };
  }

  @Post(':id/checkpoints/:checkpointId/restore')
  async restoreCheckpoint(
    @Param('id') id: string,
    @Param('checkpointId') checkpointId: string,
  ) {
    await this.service.restoreCheckpoint(id, checkpointId);
    return { success: true };
  }

  @Get('search')
  async search(
    @Query('userId') userId: string,
    @Query('query') query?: string,
    @Query('agentType') agentType?: string,
    @Query('status') status?: string,
    @Query('folderId') folderId?: string,
    @Query('tags') tags?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.service.searchConversations(userId, {
      query,
      agentType,
      status,
      folderId,
      tags: tags ? tags.split(',') : undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return { success: true, ...result };
  }

  @Get('search/snippets')
  async searchSnippets(
    @Query('userId') userId: string,
    @Query('query') query: string,
    @Query('conversationIds') conversationIds?: string,
    @Query('contextLines') contextLines?: string,
    @Query('limit') limit?: string,
  ) {
    const results = await this.service.searchSnippets(userId, query, {
      conversationIds: conversationIds
        ? conversationIds.split(',')
        : undefined,
      contextLines: contextLines ? Number(contextLines) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return { success: true, snippets: results };
  }

  @Post('bulk-delete')
  async bulkDelete(@Body() body: { userId: string; conversationIds: string[] }) {
    const results = await this.service.bulkDelete(
      body.userId,
      body.conversationIds,
    );
    return { success: true, results };
  }

  @Post('bulk-archive')
  async bulkArchive(@Body() body: { userId: string; conversationIds: string[] }) {
    const results = await this.service.bulkArchive(
      body.userId,
      body.conversationIds,
    );
    return { success: true, results };
  }

  @Get(':id/statistics')
  async getStatistics(@Param('id') id: string) {
    const stats = await this.service.getStatistics(id);
    return { success: true, statistics: stats };
  }

  @Get('statistics/aggregate')
  async getAggregateStatistics(
    @Query('userId') userId: string,
    @Query('agentType') agentType?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const stats = await this.service.getAggregateStatistics(userId, {
      agentType,
      status,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });
    return { success: true, statistics: stats };
  }

  @Post(':id/export')
  async exportConversation(
    @Param('id') id: string,
    @Query('format') format: string,
    @Body() body: any,
  ) {
    const result = await this.service.exportConversation(
      id,
      (format || 'json') as 'json' | 'markdown' | 'csv',
      {
        includeTranscripts: body.includeTranscripts !== false,
        includeMetadata: body.includeMetadata === true,
        includeToolCalls: body.includeToolCalls === true,
      },
    );
    return {
      success: true,
      content: result.content,
      mimeType: result.mimeType,
      filename: result.filename,
    };
  }

  @Post('bulk-export')
  async bulkExport(
    @Body()
    body: {
      userId: string;
      conversationIds: string[];
      format?: string;
      includeTranscripts?: boolean;
      includeMetadata?: boolean;
      includeToolCalls?: boolean;
    },
  ) {
    const result = await this.service.bulkExport(
      body.userId,
      body.conversationIds,
      (body.format || 'json') as 'json' | 'markdown' | 'csv',
      {
        includeTranscripts: body.includeTranscripts !== false,
        includeMetadata: body.includeMetadata === true,
        includeToolCalls: body.includeToolCalls === true,
      },
    );
    return {
      success: true,
      content: result.content,
      mimeType: result.mimeType,
      filename: result.filename,
    };
  }

  @Patch(':id/pin')
  async pinConversation(@Param('id') id: string) {
    await this.service.pinConversation(id);
    return { success: true };
  }

  @Patch(':id/unpin')
  async unpinConversation(@Param('id') id: string) {
    await this.service.unpinConversation(id);
    return { success: true };
  }

  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  async duplicateConversation(
    @Param('id') id: string,
    @Body() body: { userId?: string },
  ) {
    const newConv = await this.service.duplicateConversation(
      id,
      body.userId,
    );
    return { success: true, conversation: newConv };
  }

  @Post('bulk-tag')
  async bulkTag(
    @Body()
    body: {
      userId: string;
      conversationIds: string[];
      tags: string[];
      operation: 'add' | 'remove' | 'replace';
    },
  ) {
    const results = await this.service.bulkTag(
      body.userId,
      body.conversationIds,
      body.tags,
      body.operation,
    );
    return { success: true, results };
  }

  @Post('merge')
  async mergeConversations(
    @Body()
    body: {
      userId: string;
      conversationIds: string[];
      targetConversationId?: string;
    },
  ) {
    const merged = await this.service.mergeConversations(
      body.userId,
      body.conversationIds,
      body.targetConversationId,
    );
    return { success: true, conversation: merged };
  }

  @Post(':id/move-to-folder')
  async moveToFolder(
    @Param('id') id: string,
    @Body() body: { folderId: string | null },
  ) {
    if (!this.foldersService) {
      throw new Error('FoldersService not available');
    }
    await this.foldersService.moveConversationToFolder(id, body.folderId);
    return { success: true };
  }

  @Post('bulk-move-to-folder')
  async bulkMoveToFolder(
    @Body() body: { conversationIds: string[]; folderId: string | null },
  ) {
    if (!this.foldersService) {
      throw new Error('FoldersService not available');
    }
    await this.foldersService.bulkMoveToFolder(body.conversationIds, body.folderId);
    return { success: true };
  }

  // Folder management endpoints
  @Post('folders')
  @HttpCode(HttpStatus.CREATED)
  async createFolder(@Body() body: { userId: string; name: string; description?: string }) {
    if (!this.foldersService) {
      throw new Error('FoldersService not available');
    }
    const folder = await this.foldersService.createFolder(
      body.userId,
      body.name,
      body.description,
    );
    return { success: true, folder };
  }

  @Get('folders')
  async listFolders(@Query('userId') userId: string) {
    if (!this.foldersService) {
      throw new Error('FoldersService not available');
    }
    const folders = await this.foldersService.listFolders(userId);
    return { success: true, folders };
  }

  @Patch('folders/:folderId')
  async updateFolder(
    @Param('folderId') folderId: string,
    @Body() body: { name?: string; description?: string },
  ) {
    if (!this.foldersService) {
      throw new Error('FoldersService not available');
    }
    await this.foldersService.updateFolder(folderId, body);
    return { success: true };
  }

  @Delete('folders/:folderId')
  async deleteFolder(
    @Param('folderId') folderId: string,
    @Query('userId') userId: string,
    @Body() body: { moveConversationsToFolderId?: string; deleteConversations?: boolean } = {},
  ) {
    if (!this.foldersService) {
      throw new Error('FoldersService not available');
    }
    await this.foldersService.deleteFolder(folderId, userId, body);
    return { success: true };
  }

  // Tag management endpoints
  @Post(':id/tags')
  async addTags(
    @Param('id') id: string,
    @Body() body: { tags: string[] },
  ) {
    const conv = await this.service.getConversation(id);
    if (!conv) {
      throw new Error(`Conversation ${id} not found`);
    }
    const currentTags = (conv as any).tags || [];
    const newTags = [...new Set([...currentTags, ...body.tags])];
    await this.service['repo'].updateTags(id, newTags);
    return { success: true };
  }

  @Delete(':id/tags/:tagId')
  async removeTag(
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ) {
    const conv = await this.service.getConversation(id);
    if (!conv) {
      throw new Error(`Conversation ${id} not found`);
    }
    const currentTags = (conv as any).tags || [];
    const newTags = currentTags.filter((t: string) => t !== tagId);
    await this.service['repo'].updateTags(id, newTags);
    return { success: true };
  }

  @Get('tags')
  async listTags(@Query('userId') userId: string) {
    // Get all conversations for user and extract unique tags
    const conversations = await this.service.listConversations(userId, 10000);
    const allTags = new Set<string>();
    for (const conv of conversations) {
      const tags = (conv as any).tags || [];
      tags.forEach((tag: string) => allTags.add(tag));
    }
    return { success: true, tags: Array.from(allTags) };
  }

  @Post(':id/tools/:toolId/execute')
  async executeTool(
    @Param('id') id: string,
    @Param('toolId') toolId: string,
    @Body() body: { parameters?: Record<string, unknown> },
  ) {
    const result = await this.service.executeTool(
      id,
      toolId,
      body.parameters || {},
    );
    return result;
  }
}
