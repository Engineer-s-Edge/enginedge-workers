/**
 * Domain entities for the Tool system
 *
 * Following Domain-Driven Design principles with hexagonal architecture.
 */

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult<TArgs = unknown, TOutput = unknown> {
  success: boolean;
  call: ToolCall;
  output?: TOutput;
  error?: ToolError;
  startTime: Date;
  endTime: Date;
  attempts: number;
  durationMs: number;
}

export interface ToolSuccess<TArgs = unknown, TOutput = unknown>
  extends ToolResult<TArgs, TOutput> {
  success: true;
  output: TOutput;
}

export interface ToolFailure<TArgs = unknown> extends ToolResult<TArgs> {
  success: false;
  error: ToolError;
}

export interface ToolError {
  name: string;
  message: string;
  guidance?: string;
  retryable: boolean;
}

export interface ToolOutput {
  // Base interface for all tool outputs
  [key: string]: unknown;
}

export interface RAGConfig {
  similarity?: number;
  topK?: number;
  includeMetadata?: boolean;
  filters?: Record<string, unknown>;
}

export enum ActorCategory {
  INTERNAL_SANDBOX = 'INTERNAL_SANDBOX',
  INTERNAL_SYSTEM = 'INTERNAL_SYSTEM',
  EXTERNAL_API = 'EXTERNAL_API',
  EXTERNAL_STORAGE = 'EXTERNAL_STORAGE',
  EXTERNAL_PRODUCTIVITY = 'EXTERNAL_PRODUCTIVITY',
  EXTERNAL_SECURITY = 'EXTERNAL_SECURITY',
  EXTERNAL_VISUALIZATION = 'EXTERNAL_VISUALIZATION',
}

export enum RetrievalType {
  WEB_SEARCH = 'WEB_SEARCH',
  FILE_SYSTEM = 'FILE_SYSTEM',
  DATABASE = 'DATABASE',
  API_DATA = 'API_DATA',
  COMPUTATION = 'COMPUTATION',
  OCR = 'OCR',
  VIDEO_TRANSCRIPT = 'VIDEO_TRANSCRIPT',
}
