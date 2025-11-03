/**
 * Human-in-the-Loop (HITL) Service
 *
 * Manages user interactions during agent execution.
 * Supports input nodes, approval nodes, and escalations.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';

export type HITLRequestType =
  | 'input'
  | 'approval'
  | 'escalation'
  | 'clarification';
export type HITLStatus = 'pending' | 'completed' | 'rejected' | 'timeout';

export interface HITLRequest {
  id: string;
  agentId: string;
  userId: string;
  type: HITLRequestType;
  prompt: string;
  context?: any;
  status: HITLStatus;
  response?: any;
  createdAt: Date;
  respondedAt?: Date;
  timeoutAt?: Date;
}

/**
 * HITL Service
 */
@Injectable()
export class HITLService {
  private requests: Map<string, HITLRequest> = new Map();
  private pendingRequests: Map<string, string[]> = new Map(); // agentId -> request IDs

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {}

  /**
   * Create a HITL request
   */
  async createRequest(
    agentId: string,
    userId: string,
    type: HITLRequestType,
    prompt: string,
    context?: any,
    timeoutMs?: number,
  ): Promise<HITLRequest> {
    const request: HITLRequest = {
      id: `hitl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      userId,
      type,
      prompt,
      context,
      status: 'pending',
      createdAt: new Date(),
      timeoutAt: timeoutMs ? new Date(Date.now() + timeoutMs) : undefined,
    };

    this.requests.set(request.id, request);

    // Track pending requests by agent
    if (!this.pendingRequests.has(agentId)) {
      this.pendingRequests.set(agentId, []);
    }
    this.pendingRequests.get(agentId)!.push(request.id);

    this.logger.info('HITL request created', {
      requestId: request.id,
      agentId,
      type,
    });

    // Set timeout if specified
    if (timeoutMs) {
      setTimeout(() => {
        this.handleTimeout(request.id);
      }, timeoutMs);
    }

    return request;
  }

  /**
   * Get a HITL request by ID
   */
  async getRequest(requestId: string): Promise<HITLRequest | null> {
    return this.requests.get(requestId) || null;
  }

  /**
   * List pending requests for an agent
   */
  async listPendingRequests(agentId: string): Promise<HITLRequest[]> {
    const requestIds = this.pendingRequests.get(agentId) || [];

    return requestIds
      .map((id) => this.requests.get(id))
      .filter(
        (req): req is HITLRequest =>
          req !== undefined && req.status === 'pending',
      );
  }

  /**
   * List all requests for an agent
   */
  async listAgentRequests(agentId: string): Promise<HITLRequest[]> {
    return Array.from(this.requests.values())
      .filter((req) => req.agentId === agentId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Respond to a HITL request
   */
  async respondToRequest(
    requestId: string,
    response: any,
    approved: boolean = true,
  ): Promise<HITLRequest> {
    const request = this.requests.get(requestId);

    if (!request) {
      throw new Error(`HITL request ${requestId} not found`);
    }

    if (request.status !== 'pending') {
      throw new Error(
        `HITL request ${requestId} is not pending (status: ${request.status})`,
      );
    }

    request.response = response;
    request.status = approved ? 'completed' : 'rejected';
    request.respondedAt = new Date();

    // Remove from pending list
    const pendingIds = this.pendingRequests.get(request.agentId);
    if (pendingIds) {
      const index = pendingIds.indexOf(requestId);
      if (index > -1) {
        pendingIds.splice(index, 1);
      }
    }

    this.logger.info('HITL request responded', {
      requestId,
      status: request.status,
    });

    return request;
  }

  /**
   * Wait for a request to be completed
   */
  async waitForResponse(
    requestId: string,
    pollIntervalMs: number = 1000,
    maxWaitMs?: number,
  ): Promise<HITLRequest> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        const request = await this.getRequest(requestId);

        if (!request) {
          clearInterval(checkInterval);
          reject(new Error(`HITL request ${requestId} not found`));
          return;
        }

        // Check if completed or rejected
        if (request.status === 'completed' || request.status === 'rejected') {
          clearInterval(checkInterval);
          resolve(request);
          return;
        }

        // Check for timeout
        if (request.status === 'timeout') {
          clearInterval(checkInterval);
          reject(new Error(`HITL request ${requestId} timed out`));
          return;
        }

        // Check max wait time
        if (maxWaitMs && Date.now() - startTime > maxWaitMs) {
          clearInterval(checkInterval);
          reject(new Error(`HITL request ${requestId} exceeded max wait time`));
          return;
        }
      }, pollIntervalMs);
    });
  }

  /**
   * Handle request timeout
   */
  private async handleTimeout(requestId: string): Promise<void> {
    const request = this.requests.get(requestId);

    if (!request || request.status !== 'pending') {
      return;
    }

    request.status = 'timeout';
    request.respondedAt = new Date();

    // Remove from pending list
    const pendingIds = this.pendingRequests.get(request.agentId);
    if (pendingIds) {
      const index = pendingIds.indexOf(requestId);
      if (index > -1) {
        pendingIds.splice(index, 1);
      }
    }

    this.logger.warn('HITL request timed out', { requestId });
  }

  /**
   * Cancel a pending request
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    const request = this.requests.get(requestId);

    if (!request || request.status !== 'pending') {
      return false;
    }

    request.status = 'rejected';
    request.respondedAt = new Date();

    // Remove from pending list
    const pendingIds = this.pendingRequests.get(request.agentId);
    if (pendingIds) {
      const index = pendingIds.indexOf(requestId);
      if (index > -1) {
        pendingIds.splice(index, 1);
      }
    }

    this.logger.info('HITL request cancelled', { requestId });

    return true;
  }

  /**
   * Clear all requests for an agent
   */
  async clearAgentRequests(agentId: string): Promise<number> {
    const requests = await this.listAgentRequests(agentId);
    let clearedCount = 0;

    for (const request of requests) {
      if (this.requests.delete(request.id)) {
        clearedCount++;
      }
    }

    this.pendingRequests.delete(agentId);
    this.logger.info('Agent HITL requests cleared', {
      agentId,
      count: clearedCount,
    });

    return clearedCount;
  }

  /**
   * Get HITL statistics
   */
  async getStats(): Promise<{
    totalRequests: number;
    pendingRequests: number;
    completedRequests: number;
    rejectedRequests: number;
    timedOutRequests: number;
    requestsByType: Record<HITLRequestType, number>;
  }> {
    const stats = {
      totalRequests: this.requests.size,
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

    for (const request of this.requests.values()) {
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
