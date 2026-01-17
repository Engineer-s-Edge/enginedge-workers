/**
 * BaseRetriever - Abstract base class for retriever-style tools
 *
 * Retrievers query and retrieve data from various sources.
 * They use RAG parameters for search optimization and may cache results.
 */

import { BaseTool } from './base-tool';
import { ToolOutput, RAGConfig } from '../../entities/tool.entities';
import {
  RetrieverConfig,
  ErrorEvent,
} from '../../value-objects/tool-config.value-objects';

export abstract class BaseRetriever<
  TArgs = unknown,
  TOutput extends ToolOutput = ToolOutput,
> extends BaseTool<TArgs, TOutput> {
  /** Always 'retriever'; retrievers use RAG config */
  readonly type = 'retriever' as const;

  constructor(
    public readonly metadata: RetrieverConfig,
    public readonly errorEvents: ErrorEvent[],
  ) {
    super();
  }

  /**
   * Execute the concrete retriever logic with RAG parameters
   */
  protected abstract retrieve(
    args: TArgs & { ragConfig: RAGConfig },
  ): Promise<TOutput>;

  /**
   * Internal dispatch: merges provided ragConfig with defaults, then calls `retrieve`
   */
  protected override async executeTool(
    args: TArgs & { ragConfig?: RAGConfig },
  ): Promise<TOutput> {
    const ragConfig = { ...this.metadata.defaultRAGConfig, ...args.ragConfig };
    return await this.retrieve({ ...args, ragConfig });
  }

  /**
   * Get the retrieval type for organization and filtering
   */
  abstract get retrievalType(): string;

  /**
   * Check if this retriever uses caching
   */
  abstract get caching(): boolean;
}
