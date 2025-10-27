/**
 * Response DTOs (Presenters)
 */

import { Agent } from '../../domain/entities/agent.entity';
import { ExecutionContext } from './types';

/**
 * Agent response DTO
 */
export class AgentResponseDTO {
  readonly id: string;
  readonly name: string;
  readonly agentType: string;
  readonly state: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(agent: Agent) {
    this.id = agent.id;
    this.name = agent.name;
    this.agentType = agent.agentType;
    this.state = agent.getState().getCurrentState();
    this.createdAt = agent.createdAt;
    this.updatedAt = agent.updatedAt;
  }

  static fromAgent(agent: Agent): AgentResponseDTO {
    return new AgentResponseDTO(agent);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      agentType: this.agentType,
      state: this.state,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

/**
 * Execution result DTO
 */
export class ExecutionResultDTO {
  readonly agentId: string;
  readonly status: 'success' | 'failed' | 'timeout';
  readonly messages: Array<{ role: string; content: string }>;
  readonly result: string | null;
  readonly error: string | null;
  readonly duration: number; // in milliseconds
  readonly timestamp: Date;

  constructor(data: {
    agentId: string;
    status: 'success' | 'failed' | 'timeout';
    messages: Array<{ role: string; content: string }>;
    result?: string | null;
    error?: string | null;
    duration: number;
    timestamp?: Date;
  }) {
    this.agentId = data.agentId;
    this.status = data.status;
    this.messages = data.messages;
    this.result = data.result ?? null;
    this.error = data.error ?? null;
    this.duration = data.duration;
    this.timestamp = data.timestamp ?? new Date();
  }

  toJSON() {
    return {
      agentId: this.agentId,
      status: this.status,
      messagesCount: this.messages.length,
      result: this.result,
      error: this.error,
      duration: this.duration,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Streaming execution update DTO
 */
export class StreamingExecutionUpdateDTO {
  readonly type: 'start' | 'update' | 'complete' | 'error';
  readonly data: ExecutionContext;
  readonly timestamp: Date;
  readonly sequenceNumber: number;

  constructor(data: {
    type: 'start' | 'update' | 'complete' | 'error';
    data: ExecutionContext;
    timestamp?: Date;
    sequenceNumber?: number;
  }) {
    this.type = data.type;
    this.data = data.data;
    this.timestamp = data.timestamp ?? new Date();
    this.sequenceNumber = data.sequenceNumber ?? 0;
  }

  toJSON() {
    return {
      type: this.type,
      data: this.data,
      timestamp: this.timestamp,
      sequenceNumber: this.sequenceNumber,
    };
  }
}

/**
 * Paginated response DTO
 */
export class PaginatedResponseDTO<T> {
  readonly items: T[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;

  constructor(data: {
    items: T[];
    page: number;
    limit: number;
    total: number;
  }) {
    this.items = data.items;
    this.page = data.page;
    this.limit = data.limit;
    this.total = data.total;
    this.totalPages = Math.ceil(data.total / data.limit);
    this.hasNext = data.page < this.totalPages - 1;
    this.hasPrevious = data.page > 0;
  }

  toJSON() {
    return {
      items: this.items,
      pagination: {
        page: this.page,
        limit: this.limit,
        total: this.total,
        totalPages: this.totalPages,
        hasNext: this.hasNext,
        hasPrevious: this.hasPrevious,
      },
    };
  }
}

/**
 * Error response DTO
 */
export class ErrorResponseDTO {
  readonly code: string;
  readonly message: string;
  readonly statusCode: number;
  readonly timestamp: Date;
  readonly path?: string;

  constructor(data: {
    code: string;
    message: string;
    statusCode: number;
    path?: string;
    timestamp?: Date;
  }) {
    this.code = data.code;
    this.message = data.message;
    this.statusCode = data.statusCode;
    this.timestamp = data.timestamp ?? new Date();
    this.path = data.path;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      path: this.path,
    };
  }
}
