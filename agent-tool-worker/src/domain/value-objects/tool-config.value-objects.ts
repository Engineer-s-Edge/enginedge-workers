/**
 * Value Objects for Tool Configuration
 *
 * Immutable objects representing tool metadata and configuration.
 */

import { ActorCategory, RetrievalType, RAGConfig } from '../entities/tool.entities';

export class ToolId {
  constructor(private readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('Tool ID cannot be empty');
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ToolId): boolean {
    return this.value === other.value;
  }
}

export class ToolMetadata {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly useCase: string,
    public readonly inputSchema: object,
    public readonly outputSchema: object,
    public readonly invocationExample: object[],
    public readonly retries: number = 3,
    public readonly maxIterations: number = 1,
    public readonly parallel: boolean = false,
    public readonly concatenate: boolean = false,
    public readonly pauseBeforeUse: boolean = false,
    public readonly userModifyQuery: boolean = false,
  ) {
    if (!name || name.trim().length === 0) {
      throw new Error('Tool name cannot be empty');
    }
    if (!description || description.trim().length === 0) {
      throw new Error('Tool description cannot be empty');
    }
  }
}

export class ActorConfig extends ToolMetadata {
  constructor(
    name: string,
    description: string,
    useCase: string,
    inputSchema: object,
    outputSchema: object,
    invocationExample: object[],
    public readonly category: ActorCategory,
    public readonly requiresAuth: boolean = false,
    retries: number = 3,
    maxIterations: number = 1,
    parallel: boolean = false,
    concatenate: boolean = false,
    pauseBeforeUse: boolean = false,
    userModifyQuery: boolean = false,
  ) {
    super(
      name,
      description,
      useCase,
      inputSchema,
      outputSchema,
      invocationExample,
      retries,
      maxIterations,
      parallel,
      concatenate,
      pauseBeforeUse,
      userModifyQuery,
    );
  }
}

export class RetrieverConfig extends ToolMetadata {
  constructor(
    name: string,
    description: string,
    useCase: string,
    inputSchema: object,
    outputSchema: object,
    invocationExample: object[],
    public readonly retrievalType: RetrievalType,
    public readonly caching: boolean = true,
    public readonly defaultRAGConfig: RAGConfig = {},
    retries: number = 3,
    maxIterations: number = 1,
    parallel: boolean = false,
    concatenate: boolean = false,
    pauseBeforeUse: boolean = false,
    userModifyQuery: boolean = false,
  ) {
    super(
      name,
      description,
      useCase,
      inputSchema,
      outputSchema,
      invocationExample,
      retries,
      maxIterations,
      parallel,
      concatenate,
      pauseBeforeUse,
      userModifyQuery,
    );
  }
}

export class ErrorEvent {
  constructor(
    public readonly name: string,
    public readonly guidance: string,
    public readonly retryable: boolean = false,
  ) {}
}