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

  /**
   * GET /memory/:conversationId/types - Get all active memory types with their stored content
   */
  @Get(':conversationId/types')
  async getMemoryTypes(@Param('conversationId') conversationId: string) {
    this.logger.info('Getting active memory types', { conversationId });

    if (!this.conversations) {
      throw new Error('ConversationsService not available');
    }

    const memories = await this.conversations.getMemories(conversationId);
    const results = [];

    for (const memoryConfig of memories) {
      const memoryType = memoryConfig.type as MemoryType;
      try {
        const messages = await this.memoryService.getMessages(
          conversationId,
          memoryType,
        );
        const context = await this.memoryService.getContext(
          conversationId,
          memoryType,
        );

        let additionalData: any = {};
        if (memoryType === 'summary') {
          try {
            additionalData.summary = await this.memoryService.getSummary(
              conversationId,
            );
          } catch (e) {
            // Summary not available, skip
          }
        }
        if (memoryType === 'entity') {
          try {
            additionalData.entities = await this.memoryService.getEntities(
              conversationId,
            );
          } catch (e) {
            // Entities not available, skip
          }
        }

        results.push({
          id: memoryConfig.id,
          type: memoryType,
          config: memoryConfig.config || {},
          metadata: memoryConfig.metadata || {},
          content: {
            messages: messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
            })),
            context,
            ...additionalData,
          },
        });
      } catch (error) {
        this.logger.warn('Failed to get content for memory type', {
          conversationId,
          memoryType,
          error: error instanceof Error ? error.message : String(error),
        });
        results.push({
          id: memoryConfig.id,
          type: memoryType,
          config: memoryConfig.config || {},
          metadata: memoryConfig.metadata || {},
          content: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      success: true,
      conversationId,
      memories: results,
    };
  }

  /**
   * GET /memory/:conversationId/types/:memoryType - Get stored content for specific memory type
   */
  @Get(':conversationId/types/:memoryType')
  async getMemoryTypeContent(
    @Param('conversationId') conversationId: string,
    @Param('memoryType') memoryType: string,
  ) {
    this.logger.info('Getting memory type content', {
      conversationId,
      memoryType,
    });

    if (!this.conversations) {
      throw new Error('ConversationsService not available');
    }

    const memories = await this.conversations.getMemories(conversationId);
    const memoryConfig = memories.find(
      (m: any) => m.type === memoryType || m.id === memoryType,
    );

    if (!memoryConfig) {
      throw new Error(
        `Memory type '${memoryType}' not found in conversation ${conversationId}`,
      );
    }

    const type = memoryConfig.type as MemoryType;
    const messages = await this.memoryService.getMessages(conversationId, type);
    const context = await this.memoryService.getContext(conversationId, type);

    let additionalData: any = {};
    if (type === 'summary') {
      try {
        additionalData.summary = await this.memoryService.getSummary(
          conversationId,
        );
      } catch (e) {
        // Summary not available, skip
      }
    }
    if (type === 'entity') {
      try {
        additionalData.entities = await this.memoryService.getEntities(
          conversationId,
        );
      } catch (e) {
        // Entities not available, skip
      }
    }

    return {
      success: true,
      conversationId,
      memory: {
        id: memoryConfig.id,
        type: type,
        config: memoryConfig.config || {},
        metadata: memoryConfig.metadata || {},
        content: {
          messages: messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
          context,
          ...additionalData,
        },
      },
    };
  }

  /**
   * POST /memory/:conversationId/types/add - Add new memory type to active list
   */
  @Post(':conversationId/types/add')
  @HttpCode(HttpStatus.CREATED)
  async addMemoryType(
    @Param('conversationId') conversationId: string,
    @Body()
    body: {
      type: string;
      config?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ) {
    this.logger.info('Adding memory type', { conversationId, type: body.type });

    if (!this.conversations) {
      throw new Error('ConversationsService not available');
    }

    // Validate memory type compatibility
    const memories = await this.conversations.getMemories(conversationId);
    const validation = this.validateMemoryTypeCompatibility(
      body.type,
      memories.map((m: any) => m.type),
    );
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const result = await this.conversations.addMemory(conversationId, {
      type: body.type,
      config: body.config || {},
      metadata: body.metadata || {},
    });

    return {
      success: true,
      conversationId,
      memoryId: result.id,
    };
  }

  /**
   * DELETE /memory/:conversationId/types/:memoryType - Remove memory type from active list
   */
  @Delete(':conversationId/types/:memoryType')
  async removeMemoryType(
    @Param('conversationId') conversationId: string,
    @Param('memoryType') memoryType: string,
  ) {
    this.logger.info('Removing memory type', {
      conversationId,
      memoryType,
    });

    if (!this.conversations) {
      throw new Error('ConversationsService not available');
    }

    // Find memory by type or ID
    const memories = await this.conversations.getMemories(conversationId);
    const memoryConfig = memories.find(
      (m: any) => m.type === memoryType || m.id === memoryType,
    );

    if (!memoryConfig) {
      throw new Error(
        `Memory type '${memoryType}' not found in conversation ${conversationId}`,
      );
    }

    await this.conversations.removeMemory(conversationId, memoryConfig.id);

    return {
      success: true,
      conversationId,
      removedMemoryId: memoryConfig.id,
    };
  }

  /**
   * Validate memory type compatibility
   */
  private validateMemoryTypeCompatibility(
    newType: string,
    existingTypes: string[],
  ): { valid: boolean; error?: string } {
    // Define incompatible pairs
    const incompatiblePairs: Record<string, string[]> = {
      buffer: ['window'], // buffer and window are mutually exclusive
      window: ['buffer'],
    };

    // Check if new type conflicts with existing types
    const conflicts = incompatiblePairs[newType] || [];
    for (const existingType of existingTypes) {
      if (conflicts.includes(existingType)) {
        return {
          valid: false,
          error: `Memory type '${newType}' is incompatible with existing type '${existingType}'. Cannot combine these types.`,
        };
      }
    }

    // Check if existing types conflict with new type
    for (const existingType of existingTypes) {
      const existingConflicts = incompatiblePairs[existingType] || [];
      if (existingConflicts.includes(newType)) {
        return {
          valid: false,
          error: `Memory type '${newType}' is incompatible with existing type '${existingType}'. Cannot combine these types.`,
        };
      }
    }

    // Validate memory type is supported
    const supportedTypes = ['buffer', 'window', 'summary', 'vector', 'entity'];
    if (!supportedTypes.includes(newType)) {
      return {
        valid: false,
        error: `Unsupported memory type '${newType}'. Supported types: ${supportedTypes.join(', ')}`,
      };
    }

    return { valid: true };
  }
}
