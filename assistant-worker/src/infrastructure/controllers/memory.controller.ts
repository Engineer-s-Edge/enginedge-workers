/**
 * Memory Controller
 *
 * REST API endpoints for conversation memory management.
 * Supports all memory types: buffer, window, summary, vector, entity.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  MemoryService,
  MemoryType,
} from '@application/services/memory.service';
import { Message, MessageRole } from '@domain/value-objects/message.vo';
import { ConversationsService } from '@application/services/conversations.service';

// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Memory Controller
 */
@Controller('memory')
export class MemoryController {
  constructor(
    private readonly memoryService: MemoryService,
    @Inject('ILogger')
    private readonly logger: Logger,
    private readonly conversations?: ConversationsService,
  ) {}

  /**
   * POST /memory/:conversationId/messages - Add message to memory
   */
  @Post(':conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  async addMessage(
    @Param('conversationId') conversationId: string,
    @Body()
    body: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      memoryType?: MemoryType;
      metadata?: Record<string, unknown>;
    },
  ) {
    this.logger.info('Adding message to memory', { conversationId });

    const message = Message.create(
      body.role as MessageRole,
      body.content,
      body.metadata,
    );

    await this.memoryService.addMessage(
      conversationId,
      message,
      body.memoryType || 'buffer',
    );

    // Also append to conversations event log if service available
    try {
      if (this.conversations) {
        await this.conversations.addMessage(conversationId, {
          messageId: message.id,
          role: body.role,
          content: body.content,
          metadata: body.metadata,
        });
      }
    } catch (e) {
      this.logger.warn('Failed to mirror memory message to conversations', {
        conversationId,
      });
    }

    return {
      success: true,
      conversationId,
      messageAdded: true,
    };
  }

  /**
   * GET /memory/:conversationId - Get conversation messages
   */
  @Get(':conversationId')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query('memoryType') memoryType?: MemoryType,
    @Query('limit') limit?: number,
  ) {
    this.logger.info('Getting conversation messages', { conversationId });

    const messages = await this.memoryService.getMessages(
      conversationId,
      memoryType || 'buffer',
      limit ? parseInt(limit.toString()) : undefined,
    );

    return {
      conversationId,
      memoryType: memoryType || 'buffer',
      messages,
      total: messages.length,
    };
  }

  /**
   * GET /memory/:conversationId/context - Get formatted context
   */
  @Get(':conversationId/context')
  async getContext(
    @Param('conversationId') conversationId: string,
    @Query('memoryType') memoryType?: MemoryType,
    @Query('query') query?: string,
  ) {
    this.logger.info('Getting conversation context', { conversationId });

    const context = await this.memoryService.getContext(
      conversationId,
      memoryType || 'buffer',
      query,
    );

    return {
      conversationId,
      memoryType: memoryType || 'buffer',
      context,
    };
  }

  /**
   * DELETE /memory/:conversationId - Clear conversation memory
   */
  @Delete(':conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearMemory(
    @Param('conversationId') conversationId: string,
    @Query('memoryType') memoryType?: MemoryType,
  ) {
    this.logger.info('Clearing conversation memory', { conversationId });

    await this.memoryService.clearMemory(
      conversationId,
      memoryType || 'buffer',
    );

    return {
      success: true,
      message: 'Memory cleared',
    };
  }

  /**
   * GET /memory/:conversationId/summary - Get conversation summary
   */
  @Get(':conversationId/summary')
  async getSummary(@Param('conversationId') conversationId: string) {
    this.logger.info('Getting conversation summary', { conversationId });

    const summary = await this.memoryService.getSummary(conversationId);

    return {
      conversationId,
      summary,
    };
  }

  /**
   * POST /memory/:conversationId/search - Search for similar messages
   */
  @Post(':conversationId/search')
  @HttpCode(HttpStatus.OK)
  async searchSimilar(
    @Param('conversationId') conversationId: string,
    @Body()
    body: {
      query: string;
      topK?: number;
    },
  ) {
    this.logger.info('Searching for similar messages', {
      conversationId,
      query: body.query,
    });

    const messages = await this.memoryService.searchSimilar(
      conversationId,
      body.query,
      body.topK,
    );

    return {
      conversationId,
      query: body.query,
      results: messages,
      total: messages.length,
    };
  }

  /**
   * GET /memory/:conversationId/entities - Get extracted entities
   */
  @Get(':conversationId/entities')
  async getEntities(@Param('conversationId') conversationId: string) {
    this.logger.info('Getting conversation entities', { conversationId });

    const entities = await this.memoryService.getEntities(conversationId);

    return {
      conversationId,
      entities,
      total: entities.length,
    };
  }

  /**
   * POST /memory/:conversationId/entities/search - Search entities
   */
  @Post(':conversationId/entities/search')
  @HttpCode(HttpStatus.OK)
  async searchEntities(
    @Param('conversationId') conversationId: string,
    @Body()
    body: {
      query: string;
    },
  ) {
    this.logger.info('Searching entities', {
      conversationId,
      query: body.query,
    });

    const entities = await this.memoryService.searchEntities(
      conversationId,
      body.query,
    );

    return {
      conversationId,
      query: body.query,
      entities,
      total: entities.length,
    };
  }

  /**
   * GET /memory/conversations - List conversations for user
   */
  @Get('conversations/list')
  async listConversations(
    @Query('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    this.logger.info('Listing conversations', { userId });

    const conversations = await this.memoryService.listConversations(
      userId,
      limit ? parseInt(limit.toString()) : undefined,
    );

    return {
      userId,
      conversations,
      total: conversations.length,
    };
  }

  /**
   * POST /memory/conversations/search - Search conversations
   */
  @Post('conversations/search')
  @HttpCode(HttpStatus.OK)
  async searchConversations(@Body() body: { userId: string; query: string }) {
    this.logger.info('Searching conversations', {
      userId: body.userId,
      query: body.query,
    });

    const conversations = await this.memoryService.searchConversations(
      body.userId,
      body.query,
    );

    return {
      userId: body.userId,
      query: body.query,
      conversations,
      total: conversations.length,
    };
  }

  /**
   * GET /memory/stats - Get memory statistics
   */
  @Get('stats/:userId')
  async getStats(@Param('userId') userId: string) {
    this.logger.info('Getting memory statistics', { userId });

    const stats = await this.memoryService.getStats(userId);

    return {
      userId,
      stats,
    };
  }
}
