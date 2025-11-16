/**
 * HITL Controller
 *
 * Centralized REST endpoints for Human-in-the-Loop (HITL) operations.
 * Provides CRUD operations for HITL requests across all agent types.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { HITLService, HITLRequest, HITLRequestType, HITLStatus } from '@application/services/hitl.service';

// Logger interface for infrastructure use
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

@Controller('hitl')
export class HITLController {
  constructor(
    private readonly hitlService: HITLService,
    @Inject('ILogger')
    private readonly logger: Logger,
  ) {}

  /**
   * POST /hitl/requests - Create a new HITL request
   */
  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  async createRequest(
    @Body()
    body: {
      agentId: string;
      userId: string;
      type: HITLRequestType;
      prompt: string;
      context?: any;
      timeoutMs?: number;
    },
  ): Promise<HITLRequest> {
    if (!body.agentId || !body.userId || !body.type || !body.prompt) {
      throw new BadRequestException(
        'agentId, userId, type, and prompt are required',
      );
    }

    try {
      const request = await this.hitlService.createRequest(
        body.agentId,
        body.userId,
        body.type,
        body.prompt,
        body.context,
        body.timeoutMs,
      );

      return request;
    } catch (error) {
      this.logger.error('Failed to create HITL request', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * GET /hitl/requests/:requestId - Get a specific HITL request
   */
  @Get('requests/:requestId')
  @HttpCode(HttpStatus.OK)
  async getRequest(@Param('requestId') requestId: string): Promise<HITLRequest> {
    const request = await this.hitlService.getRequest(requestId);

    if (!request) {
      throw new NotFoundException(`HITL request '${requestId}' not found`);
    }

    return request;
  }

  /**
   * GET /hitl/agents/:agentId/requests - List all requests for an agent
   */
  @Get('agents/:agentId/requests')
  @HttpCode(HttpStatus.OK)
  async listAgentRequests(
    @Param('agentId') agentId: string,
    @Query('status') status?: HITLStatus,
  ): Promise<HITLRequest[]> {
    const requests = await this.hitlService.listAgentRequests(agentId);

    if (status) {
      return requests.filter((req) => req.status === status);
    }

    return requests;
  }

  /**
   * GET /hitl/agents/:agentId/requests/pending - List pending requests for an agent
   */
  @Get('agents/:agentId/requests/pending')
  @HttpCode(HttpStatus.OK)
  async listPendingRequests(
    @Param('agentId') agentId: string,
  ): Promise<HITLRequest[]> {
    return await this.hitlService.listPendingRequests(agentId);
  }

  /**
   * PATCH /hitl/requests/:requestId/respond - Respond to a HITL request
   */
  @Patch('requests/:requestId/respond')
  @HttpCode(HttpStatus.OK)
  async respondToRequest(
    @Param('requestId') requestId: string,
    @Body()
    body: {
      response: any;
      approved?: boolean;
    },
  ): Promise<HITLRequest> {
    if (body.response === undefined) {
      throw new BadRequestException('response is required');
    }

    try {
      const request = await this.hitlService.respondToRequest(
        requestId,
        body.response,
        body.approved !== false, // Default to approved if not specified
      );

      return request;
    } catch (error) {
      this.logger.error('Failed to respond to HITL request', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * DELETE /hitl/requests/:requestId - Cancel a pending HITL request
   */
  @Delete('requests/:requestId')
  @HttpCode(HttpStatus.OK)
  async cancelRequest(@Param('requestId') requestId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const cancelled = await this.hitlService.cancelRequest(requestId);

    if (!cancelled) {
      throw new NotFoundException(
        `HITL request '${requestId}' not found or not pending`,
      );
    }

    return {
      success: true,
      message: `HITL request '${requestId}' cancelled`,
    };
  }

  /**
   * DELETE /hitl/agents/:agentId/requests - Clear all requests for an agent
   */
  @Delete('agents/:agentId/requests')
  @HttpCode(HttpStatus.OK)
  async clearAgentRequests(
    @Param('agentId') agentId: string,
  ): Promise<{
    success: boolean;
    clearedCount: number;
    message: string;
  }> {
    const clearedCount = await this.hitlService.clearAgentRequests(agentId);

    return {
      success: true,
      clearedCount,
      message: `Cleared ${clearedCount} HITL request(s) for agent '${agentId}'`,
    };
  }

  /**
   * GET /hitl/stats - Get HITL statistics
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStats(): Promise<{
    totalRequests: number;
    pendingRequests: number;
    completedRequests: number;
    rejectedRequests: number;
    timedOutRequests: number;
    requestsByType: Record<HITLRequestType, number>;
  }> {
    return await this.hitlService.getStats();
  }

  /**
   * GET /hitl/stats/agents/:agentId - Get HITL statistics for a specific agent
   */
  @Get('stats/agents/:agentId')
  @HttpCode(HttpStatus.OK)
  async getAgentStats(
    @Param('agentId') agentId: string,
  ): Promise<{
    agentId: string;
    totalRequests: number;
    pendingRequests: number;
    completedRequests: number;
    rejectedRequests: number;
    timedOutRequests: number;
    requestsByType: Record<HITLRequestType, number>;
  }> {
    const requests = await this.hitlService.listAgentRequests(agentId);

    const stats = {
      agentId,
      totalRequests: requests.length,
      pendingRequests: 0,
      completedRequests: 0,
      rejectedRequests: 0,
      timedOutRequests: 0,
      requestsByType: {
        input: 0,
        approval: 0,
        escalation: 0,
        clarification: 0,
      } as Record<HITLRequestType, number>,
    };

    for (const request of requests) {
      switch (request.status) {
        case 'pending':
          stats.pendingRequests++;
          break;
        case 'completed':
          stats.completedRequests++;
          break;
        case 'rejected':
          stats.rejectedRequests++;
          break;
        case 'timeout':
          stats.timedOutRequests++;
          break;
      }

      stats.requestsByType[request.type]++;
    }

    return stats;
  }
}
