/**
 * Knowledge Graph Retriever - Infrastructure Layer
 *
 * Read-only access to the Knowledge Graph for any agent.
 * Provides safe, read-only queries to the persistent knowledge base.
 */

import { Injectable, Inject } from '@nestjs/common';
import { BaseRetriever } from '@domain/tools/base/base-retriever';
import {
  RetrieverConfig,
  ErrorEvent,
} from '@domain/value-objects/tool-config.value-objects';
import {
  ToolOutput,
  RAGConfig,
  RetrievalType,
} from '@domain/entities/tool.entities';

export interface KnowledgeGraphArgs {
  operation:
    | 'get_node'
    | 'search_nodes'
    | 'get_neighbors'
    | 'get_subgraph'
    | 'get_stats'
    | 'query';
  nodeId?: string;
  searchTerm?: string;
  layer?: string;
  type?: string;
  depth?: number;
  limit?: number;
  cypher?: string;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface KnowledgeGraphOutput extends ToolOutput {
  success: boolean;
  operation: string;
  node?: Record<string, unknown>;
  nodes?: Record<string, unknown>[];
  edges?: Record<string, unknown>[];
  stats?: Record<string, unknown>;
  result?: Record<string, unknown>;
  message?: string;
}

@Injectable()
export class KnowledgeGraphRetriever extends BaseRetriever<
  KnowledgeGraphArgs,
  KnowledgeGraphOutput
> {
  readonly name = 'knowledge-graph-retriever';
  readonly description =
    'Read-only access to the Knowledge Graph for querying nodes, edges, and graph structure';

  readonly metadata: RetrieverConfig;

  readonly errorEvents: ErrorEvent[];

  private readonly assistantWorkerUrl: string;

  constructor(@Inject('ASSISTANT_WORKER_URL') assistantWorkerUrl?: string) {
    const errorEvents = [
      new ErrorEvent(
        'kg-connection-failed',
        'Failed to connect to Knowledge Graph service - check assistant-worker is running',
        false,
      ),
      new ErrorEvent(
        'kg-node-not-found',
        'Requested node not found in Knowledge Graph',
        false,
      ),
      new ErrorEvent(
        'kg-query-error',
        'Knowledge Graph query failed - check query syntax',
        false,
      ),
      new ErrorEvent(
        'kg-timeout',
        'Knowledge Graph query timed out - consider simplifying query',
        true,
      ),
    ];

    const metadata = new RetrieverConfig(
      'knowledge-graph-retriever',
      'Read-only access to the Knowledge Graph',
      'Query nodes, edges, and graph structure from the persistent knowledge base. Read-only access.',
      {
        type: 'object',
        additionalProperties: false,
        required: ['operation'],
        properties: {
          operation: {
            type: 'string',
            enum: [
              'get_node',
              'search_nodes',
              'get_neighbors',
              'get_subgraph',
              'get_stats',
              'query',
            ],
            description: 'The Knowledge Graph operation to perform',
          },
          nodeId: {
            type: 'string',
            description:
              'Node ID (required for get_node, get_neighbors, get_subgraph)',
          },
          searchTerm: {
            type: 'string',
            description:
              'Search term for node search (required for search_nodes)',
          },
          layer: {
            type: 'string',
            enum: [
              'L1_OBSERVATIONS',
              'L2_PATTERNS',
              'L3_MODELS',
              'L4_THEORIES',
              'L5_PRINCIPLES',
              'L6_SYNTHESIS',
            ],
            description: 'ICS layer to filter by',
          },
          type: {
            type: 'string',
            description: 'Node type to filter by',
          },
          depth: {
            type: 'number',
            description: 'Depth for subgraph extraction (default: 1)',
            default: 1,
            minimum: 1,
            maximum: 5,
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 10,
            minimum: 1,
            maximum: 100,
          },
          cypher: {
            type: 'string',
            description: 'Cypher query string (required for query operation)',
          },
          params: {
            type: 'object',
            description: 'Parameters for Cypher query',
          },
        },
      },
      {
        retrievalType: RetrievalType.SEMANTIC,
        supportsRAG: true,
        caching: true,
        maxCacheAge: 3600, // 1 hour
      },
    );

    super();
    this.metadata = metadata;
    this.errorEvents = errorEvents;
    this.assistantWorkerUrl =
      assistantWorkerUrl ||
      process.env.ASSISTANT_WORKER_URL ||
      'http://localhost:3001';
  }

  protected async executeInternal(call: {
    args: KnowledgeGraphArgs;
  }): Promise<KnowledgeGraphOutput> {
    const {
      operation,
      nodeId,
      searchTerm,
      layer,
      type,
      depth,
      limit,
      cypher,
      params,
    } = call.args;

    try {
      switch (operation) {
        case 'get_node':
          if (!nodeId) {
            throw new Error('nodeId is required for get_node operation');
          }
          return await this.getNode(nodeId);

        case 'search_nodes':
          if (!searchTerm) {
            throw new Error(
              'searchTerm is required for search_nodes operation',
            );
          }
          return await this.searchNodes(searchTerm, layer, type, limit);

        case 'get_neighbors':
          if (!nodeId) {
            throw new Error('nodeId is required for get_neighbors operation');
          }
          return await this.getNeighbors(nodeId, limit);

        case 'get_subgraph':
          if (!nodeId) {
            throw new Error('nodeId is required for get_subgraph operation');
          }
          return await this.getSubgraph(nodeId, depth || 1);

        case 'get_stats':
          return await this.getStats();

        case 'query':
          if (!cypher) {
            throw new Error('cypher is required for query operation');
          }
          return await this.query(cypher, params);

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        operation,
        message: `Knowledge Graph operation failed: ${message}`,
      };
    }
  }

  private async getNode(nodeId: string): Promise<KnowledgeGraphOutput> {
    const response = await fetch(
      `${this.assistantWorkerUrl}/knowledge-graph/nodes/${nodeId}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Node not found');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      operation: 'get_node',
      node: data.node || data,
    };
  }

  private async searchNodes(
    searchTerm: string,
    layer?: string,
    type?: string,
    limit?: number,
  ): Promise<KnowledgeGraphOutput> {
    const queryParams = new URLSearchParams({
      search: searchTerm,
      ...(limit && { limit: limit.toString() }),
      ...(layer && { layer }),
      ...(type && { type }),
    });

    const response = await fetch(
      `${this.assistantWorkerUrl}/knowledge-graph/nodes/search?${queryParams}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      operation: 'search_nodes',
      nodes: data.nodes || [],
    };
  }

  private async getNeighbors(
    nodeId: string,
    limit?: number,
  ): Promise<KnowledgeGraphOutput> {
    const queryParams = limit ? `?limit=${limit}` : '';
    const response = await fetch(
      `${this.assistantWorkerUrl}/knowledge-graph/nodes/${nodeId}/neighbors${queryParams}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      operation: 'get_neighbors',
      nodes: data.neighbors || [],
    };
  }

  private async getSubgraph(
    nodeId: string,
    depth: number,
  ): Promise<KnowledgeGraphOutput> {
    const response = await fetch(
      `${this.assistantWorkerUrl}/knowledge-graph/nodes/${nodeId}/subgraph?depth=${depth}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      operation: 'get_subgraph',
      nodes: data.subgraph?.nodes || [],
      edges: data.subgraph?.edges || [],
    };
  }

  private async getStats(): Promise<KnowledgeGraphOutput> {
    const response = await fetch(
      `${this.assistantWorkerUrl}/knowledge-graph/stats`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      operation: 'get_stats',
      stats: data.stats || data,
    };
  }

  private async query(
    cypher: string,
    params?: Record<string, unknown>,
  ): Promise<KnowledgeGraphOutput> {
    const response = await fetch(
      `${this.assistantWorkerUrl}/knowledge-graph/query`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cypher, params: params || {} }),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      operation: 'query',
      result: data.result || data,
    };
  }
}
