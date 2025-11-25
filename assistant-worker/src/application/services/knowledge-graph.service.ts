/**
 * Knowledge Graph Service
 *
 * Orchestrates knowledge graph operations for Expert and Genius agents.
 * Supports ICS (Integrated Concept Synthesis) methodology.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';
import {
  Neo4jAdapter,
  ICSLayer,
  KGNode,
  KGEdge,
  QueryResult,
  ResearchStatus,
  SourceCitation,
  ResearchData,
} from '@infrastructure/adapters/knowledge-graph/neo4j.adapter';
import { GraphComponentService } from './graph-component.service';

/**
 * Knowledge Graph Event
 */
export interface KnowledgeGraphEvent {
  type:
    | 'node.created'
    | 'node.updated'
    | 'node.deleted'
    | 'edge.created'
    | 'edge.updated'
    | 'edge.deleted';
  timestamp: Date;
  payload: {
    node?: KGNode;
    edge?: KGEdge;
    nodeId?: string;
    edgeId?: string;
  };
}

export interface ICSTraversalNode {
  id: string;
  label: string;
  type: string;
  layer: ICSLayer;
  layerIndex: number;
  summary?: string;
  confidence?: number;
  researchStatus?: ResearchStatus;
  parentId?: string;
  childIds?: string[];
  depth: number;
  order: number;
  metadata?: Record<string, unknown>;
}

export interface ICSTraversalResult {
  startNodeId: string;
  direction: 'up' | 'down';
  nodes: ICSTraversalNode[];
  layers: ICSLayer[];
}

/**
 * Knowledge Graph Service
 */
@Injectable()
export class KnowledgeGraphService {
  private eventListeners: Set<(event: KnowledgeGraphEvent) => void> = new Set();
  private readonly layerSequence: ICSLayer[] = [
    ICSLayer.L1_OBSERVATIONS,
    ICSLayer.L2_PATTERNS,
    ICSLayer.L3_MODELS,
    ICSLayer.L4_THEORIES,
    ICSLayer.L5_PRINCIPLES,
    ICSLayer.L6_SYNTHESIS,
  ];

  constructor(
    private readonly neo4jAdapter: Neo4jAdapter,
    @Inject('ILogger')
    private readonly logger: ILogger,
    @Optional()
    private readonly componentService?: GraphComponentService,
  ) {}

  /**
   * Subscribe to knowledge graph events
   */
  subscribeToEvents(
    callback: (event: KnowledgeGraphEvent) => void,
  ): () => void {
    this.eventListeners.add(callback);
    return () => {
      this.eventListeners.delete(callback);
    };
  }

  /**
   * Emit a knowledge graph event
   */
  private emitEvent(event: KnowledgeGraphEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        this.logger.error('Error in knowledge graph event listener', { error });
      }
    });
  }

  /**
   * Add a node to the knowledge graph
   */
  async addNode(
    label: string,
    type: string,
    layer: ICSLayer,
    properties: Record<string, any> = {},
  ): Promise<KGNode> {
    this.logger.info('Adding node to knowledge graph', { label, type, layer });

    const node = await this.neo4jAdapter.createNode(
      label,
      type,
      layer,
      properties,
    );

    // Create component for new node if component service is available
    if (this.componentService) {
      const category = properties?.category || type;
      await this.componentService.createComponent(node.id, category);
    }

    return node;
  }

  /**
   * Get a node by ID
   */
  async getNode(nodeId: string): Promise<KGNode | null> {
    return await this.neo4jAdapter.getNode(nodeId);
  }

  /**
   * Update a node
   */
  async updateNode(
    nodeId: string,
    updates: Partial<Omit<KGNode, 'id' | 'createdAt'>>,
  ): Promise<KGNode | null> {
    this.logger.info('Updating node', { nodeId });

    const node = await this.neo4jAdapter.updateNode(nodeId, updates);

    if (node) {
      // Emit event
      this.emitEvent({
        type: 'node.updated',
        timestamp: new Date(),
        payload: { node },
      });
    }

    return node;
  }

  /**
   * Remove a node from the knowledge graph
   */
  async removeNode(nodeId: string): Promise<boolean> {
    this.logger.info('Removing node from knowledge graph', { nodeId });

    const deleted = await this.neo4jAdapter.deleteNode(nodeId);

    if (deleted) {
      // Emit event
      this.emitEvent({
        type: 'node.deleted',
        timestamp: new Date(),
        payload: { nodeId },
      });
    }

    return deleted;
  }

  /**
   * Create a relationship between two nodes
   */
  async createRelationship(
    from: string,
    to: string,
    type: string,
    properties: Record<string, any> = {},
    bidirectional?: boolean,
  ): Promise<KGEdge> {
    this.logger.info('Creating relationship', {
      from,
      to,
      type,
      bidirectional,
    });
    const edge = await this.createRelationshipInternal(
      from,
      to,
      type,
      properties,
      undefined,
      undefined,
      undefined,
      undefined,
      bidirectional,
    );

    // Emit event
    this.emitEvent({
      type: 'edge.created',
      timestamp: new Date(),
      payload: { edge },
    });

    return edge;
  }

  /**
   * Get an edge by ID
   */
  async getEdge(edgeId: string): Promise<KGEdge | null> {
    return await this.neo4jAdapter.getEdge(edgeId);
  }

  /**
   * Update an edge
   */
  async updateEdge(
    edgeId: string,
    updates: Partial<Omit<KGEdge, 'id' | 'createdAt'>>,
  ): Promise<KGEdge | null> {
    this.logger.info('Updating edge', { edgeId });
    const edge = await this.neo4jAdapter.updateEdge(edgeId, updates);

    if (edge) {
      // Emit event
      this.emitEvent({
        type: 'edge.updated',
        timestamp: new Date(),
        payload: { edge },
      });
    }

    return edge;
  }

  /**
   * Remove a relationship
   */
  async removeRelationship(edgeId: string): Promise<boolean> {
    this.logger.info('Removing relationship', { edgeId });

    const deleted = await this.neo4jAdapter.deleteEdge(edgeId);

    if (deleted) {
      // Emit event
      this.emitEvent({
        type: 'edge.deleted',
        timestamp: new Date(),
        payload: { edgeId },
      });
    }

    return deleted;
  }

  /**
   * Get all nodes with pagination and optional layer filter
   */
  async getAllNodes(
    limit?: number,
    offset?: number,
    layers?: ICSLayer[],
  ): Promise<{ nodes: KGNode[]; total: number }> {
    return await this.neo4jAdapter.getAllNodes(limit, offset, layers);
  }

  /**
   * Get all edges with pagination
   */
  async getAllEdges(
    limit?: number,
    offset?: number,
  ): Promise<{ edges: KGEdge[]; total: number }> {
    return await this.neo4jAdapter.getAllEdges(limit, offset);
  }

  /**
   * Bulk delete nodes
   */
  async bulkDeleteNodes(nodeIds: string[]): Promise<{
    deleted: string[];
    failed: Array<{ nodeId: string; error: string }>;
  }> {
    this.logger.info('Bulk deleting nodes', { count: nodeIds.length });

    const deleted: string[] = [];
    const failed: Array<{ nodeId: string; error: string }> = [];

    for (const nodeId of nodeIds) {
      try {
        const success = await this.removeNode(nodeId);
        if (success) {
          deleted.push(nodeId);
        } else {
          failed.push({ nodeId, error: 'Node not found' });
        }
      } catch (error) {
        failed.push({
          nodeId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { deleted, failed };
  }

  /**
   * Bulk update nodes
   */
  async bulkUpdateNodes(
    nodeIds: string[],
    updates: Record<string, any>,
  ): Promise<{
    updated: string[];
    failed: Array<{ nodeId: string; error: string }>;
  }> {
    this.logger.info('Bulk updating nodes', { count: nodeIds.length });

    const updated: string[] = [];
    const failed: Array<{ nodeId: string; error: string }> = [];

    for (const nodeId of nodeIds) {
      try {
        const node = await this.updateNode(nodeId, updates);
        if (node) {
          updated.push(nodeId);
        } else {
          failed.push({ nodeId, error: 'Node not found' });
        }
      } catch (error) {
        failed.push({
          nodeId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { updated, failed };
  }

  /**
   * Get nodes grouped by layer
   */
  async getNodesByLayers(): Promise<Record<string, KGNode[]>> {
    const result: Record<string, KGNode[]> = {};

    for (const layer of Object.values(ICSLayer)) {
      const nodes = await this.getNodesByLayer(layer);
      result[layer] = nodes;
    }

    return result;
  }

  /**
   * Get all nodes in a specific ICS layer
   */
  async getNodesByLayer(layer: ICSLayer): Promise<KGNode[]> {
    return await this.neo4jAdapter.getNodesByLayer(layer);
  }

  /**
   * Get all nodes of a specific type
   */
  async getNodesByType(type: string): Promise<KGNode[]> {
    return await this.neo4jAdapter.getNodesByType(type);
  }

  /**
   * Get neighbors of a node
   */
  async getNeighbors(
    nodeId: string,
    direction: 'in' | 'out' | 'both' = 'both',
  ): Promise<KGNode[]> {
    return await this.neo4jAdapter.getNeighbors(nodeId, direction);
  }

  /**
   * Query the knowledge graph with Cypher
   */
  async query(
    cypher: string,
    params: Record<string, any> = {},
  ): Promise<QueryResult> {
    this.logger.info('Executing knowledge graph query', { cypher });

    return await this.neo4jAdapter.query(cypher, params);
  }

  /**
   * Extract a subgraph around a node
   */
  async getSubgraph(nodeId: string, depth: number = 1): Promise<QueryResult> {
    this.logger.info('Extracting subgraph', { nodeId, depth });

    return await this.neo4jAdapter.getSubgraph(nodeId, depth);
  }

  /**
   * Get all L1 domains connected to a node
   */
  async getConnectedDomains(nodeId: string): Promise<
    Array<{
      domainName: string;
      color: string;
      connectionStrength: number;
      path: string[];
    }>
  > {
    this.logger.info('Getting connected domains', { nodeId });

    const node = await this.getNode(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // If node is L1 and has domain, return itself
    if (node.layer === ICSLayer.L1_OBSERVATIONS && node.domain) {
      return [
        {
          domainName: node.domain,
          color: node.domainColor || '#808080',
          connectionStrength: 1.0,
          path: [nodeId],
        },
      ];
    }

    // Find all L1 nodes with domains
    const l1Nodes = await this.getNodesByLayer(ICSLayer.L1_OBSERVATIONS);
    const domainNodes = l1Nodes.filter((n) => n.domain && n.domainColor);

    const connectedDomains: Array<{
      domainName: string;
      color: string;
      connectionStrength: number;
      path: string[];
    }> = [];

    // For each domain node, check if there's a path to our node
    for (const domainNode of domainNodes) {
      const path = await this.findShortestPath(domainNode.id, nodeId);
      if (path && path.length > 0) {
        // Calculate connection strength (inverse of path length)
        const strength = 1.0 / path.length;
        connectedDomains.push({
          domainName: domainNode.domain!,
          color: domainNode.domainColor!,
          connectionStrength: strength,
          path,
        });
      }
    }

    // Sort by connection strength (strongest first)
    connectedDomains.sort(
      (a, b) => b.connectionStrength - a.connectionStrength,
    );

    return connectedDomains;
  }

  /**
   * Calculate node color based on connections to L1 domains
   */
  async calculateNodeColor(nodeId: string): Promise<string> {
    const node = await this.getNode(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // If node is L1 and has domain color, return it
    if (node.layer === ICSLayer.L1_OBSERVATIONS && node.domainColor) {
      return node.domainColor;
    }

    // Get connected domains
    const connectedDomains = await this.getConnectedDomains(nodeId);

    if (connectedDomains.length === 0) {
      return '#808080'; // Default gray if no connections
    }

    // Mix colors proportionally based on connection strength
    let totalStrength = 0;
    const colorComponents: Array<{
      r: number;
      g: number;
      b: number;
      weight: number;
    }> = [];

    for (const domain of connectedDomains) {
      const hex = domain.color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const weight = domain.connectionStrength;

      colorComponents.push({ r, g, b, weight });
      totalStrength += weight;
    }

    // Calculate weighted average
    let r = 0;
    let g = 0;
    let b = 0;

    for (const comp of colorComponents) {
      const normalizedWeight = comp.weight / totalStrength;
      r += comp.r * normalizedWeight;
      g += comp.g * normalizedWeight;
      b += comp.b * normalizedWeight;
    }

    // Convert to hex
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Find shortest path between two nodes (BFS)
   */
  private async findShortestPath(
    fromId: string,
    toId: string,
  ): Promise<string[]> {
    if (fromId === toId) {
      return [fromId];
    }

    const queue: Array<{ id: string; path: string[] }> = [
      { id: fromId, path: [fromId] },
    ];
    const visited = new Set<string>([fromId]);

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;

      const neighbors = await this.getNeighbors(id, 'both');
      for (const neighbor of neighbors) {
        if (neighbor.id === toId) {
          return [...path, neighbor.id];
        }

        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push({ id: neighbor.id, path: [...path, neighbor.id] });
        }
      }
    }

    return []; // No path found
  }

  /**
   * Search nodes by label or properties
   */
  async searchNodes(searchTerm: string): Promise<KGNode[]> {
    this.logger.info('Searching nodes', { searchTerm });

    return await this.neo4jAdapter.searchNodes(searchTerm);
  }

  /**
   * Get knowledge graph statistics
   */
  async getStats(): Promise<any> {
    return await this.neo4jAdapter.getStats();
  }

  /**
   * Build ICS hierarchy for a concept
   *
   * Creates nodes across all 6 ICS layers and links them hierarchically.
   */
  async buildICSHierarchy(
    concept: string,
    observations: string[],
    patterns: string[],
    models: string[],
    theories: string[],
    principles: string[],
    synthesis: string,
  ): Promise<{
    rootNode: KGNode;
    layerNodes: Record<ICSLayer, KGNode[]>;
  }> {
    this.logger.info('Building ICS hierarchy', { concept });

    const layerNodes: Record<ICSLayer, KGNode[]> = {
      [ICSLayer.L1_OBSERVATIONS]: [],
      [ICSLayer.L2_PATTERNS]: [],
      [ICSLayer.L3_MODELS]: [],
      [ICSLayer.L4_THEORIES]: [],
      [ICSLayer.L5_PRINCIPLES]: [],
      [ICSLayer.L6_SYNTHESIS]: [],
    };

    // Create synthesis node (root)
    const rootNode = await this.addNode(
      synthesis,
      'synthesis',
      ICSLayer.L6_SYNTHESIS,
      { concept },
    );
    layerNodes[ICSLayer.L6_SYNTHESIS].push(rootNode);

    // Create principle nodes and link to synthesis
    for (const principle of principles) {
      const node = await this.addNode(
        principle,
        'principle',
        ICSLayer.L5_PRINCIPLES,
        { concept },
      );
      layerNodes[ICSLayer.L5_PRINCIPLES].push(node);
      await this.createRelationship(node.id, rootNode.id, 'SUPPORTS', {});
    }

    // Create theory nodes and link to principles
    for (const theory of theories) {
      const node = await this.addNode(theory, 'theory', ICSLayer.L4_THEORIES, {
        concept,
      });
      layerNodes[ICSLayer.L4_THEORIES].push(node);

      // Link to relevant principles
      for (const principleNode of layerNodes[ICSLayer.L5_PRINCIPLES]) {
        await this.createRelationship(
          node.id,
          principleNode.id,
          'SUPPORTS',
          {},
        );
      }
    }

    // Create model nodes and link to theories
    for (const model of models) {
      const node = await this.addNode(model, 'model', ICSLayer.L3_MODELS, {
        concept,
      });
      layerNodes[ICSLayer.L3_MODELS].push(node);

      // Link to relevant theories
      for (const theoryNode of layerNodes[ICSLayer.L4_THEORIES]) {
        await this.createRelationship(node.id, theoryNode.id, 'SUPPORTS', {});
      }
    }

    // Create pattern nodes and link to models
    for (const pattern of patterns) {
      const node = await this.addNode(
        pattern,
        'pattern',
        ICSLayer.L2_PATTERNS,
        { concept },
      );
      layerNodes[ICSLayer.L2_PATTERNS].push(node);

      // Link to relevant models
      for (const modelNode of layerNodes[ICSLayer.L3_MODELS]) {
        await this.createRelationship(node.id, modelNode.id, 'SUPPORTS', {});
      }
    }

    // Create observation nodes and link to patterns
    for (const observation of observations) {
      const node = await this.addNode(
        observation,
        'observation',
        ICSLayer.L1_OBSERVATIONS,
        { concept },
      );
      layerNodes[ICSLayer.L1_OBSERVATIONS].push(node);

      // Link to relevant patterns
      for (const patternNode of layerNodes[ICSLayer.L2_PATTERNS]) {
        await this.createRelationship(node.id, patternNode.id, 'SUPPORTS', {});
      }
    }

    return {
      rootNode,
      layerNodes,
    };
  }

  /**
   * Traverse ICS hierarchy upward (from observations to synthesis)
   */
  async traverseUp(startNodeId: string): Promise<ICSTraversalResult> {
    const nodes: ICSTraversalNode[] = [];
    let currentNodeId: string | null = startNodeId;
    let depth = 0;

    while (currentNodeId) {
      const node = await this.getNode(currentNodeId);
      if (!node) {
        break;
      }

      const neighbors = await this.getNeighbors(currentNodeId, 'out');
      const nextNode = this.findHigherLayerNeighbor(node, neighbors);

      nodes.push(
        this.buildTraversalNode(node, {
          parentId: nextNode?.id,
          depth,
          order: depth,
        }),
      );

      currentNodeId = nextNode?.id || null;
      depth += 1;
    }

    const layers = this.buildLayerList(nodes, 'ascending');

    return {
      startNodeId,
      direction: 'up',
      nodes,
      layers,
    };
  }

  /**
   * Traverse ICS hierarchy downward (from synthesis to observations)
   */
  async traverseDown(startNodeId: string): Promise<ICSTraversalResult> {
    const nodes: ICSTraversalNode[] = [];
    const queue: Array<{ nodeId: string; depth: number }> = [
      { nodeId: startNodeId, depth: 0 },
    ];
    const visited = new Set<string>();
    const parentMap = new Map<string, string>();
    const childMap = new Map<string, Set<string>>();

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;

      if (visited.has(nodeId)) {
        continue;
      }
      visited.add(nodeId);

      const node = await this.getNode(nodeId);
      if (!node) {
        continue;
      }

      const childIds = childMap.get(nodeId);
      nodes.push(
        this.buildTraversalNode(node, {
          parentId: parentMap.get(nodeId),
          depth,
          order: nodes.length,
          childIds: childIds ? Array.from(childIds) : undefined,
        }),
      );

      // Get children (nodes that support this node)
      const neighbors = await this.getNeighbors(nodeId, 'in');
      const childCandidates = neighbors
        .filter(
          (neighbor) =>
            this.getLayerIndex(neighbor.layer) < this.getLayerIndex(node.layer),
        )
        .sort(
          (a, b) => this.getLayerIndex(b.layer) - this.getLayerIndex(a.layer),
        );

      // Add lower-layer nodes to queue
      for (const neighbor of childCandidates) {
        if (!parentMap.has(neighbor.id)) {
          parentMap.set(neighbor.id, node.id);
        }
        if (!childMap.has(node.id)) {
          childMap.set(node.id, new Set());
        }
        childMap.get(node.id)!.add(neighbor.id);
        queue.push({ nodeId: neighbor.id, depth: depth + 1 });
      }
    }

    const layers = this.buildLayerList(nodes, 'descending');

    return {
      startNodeId,
      direction: 'down',
      nodes,
      layers,
    };
  }

  /**
   * Lock a node for exclusive access
   * @param nodeId Node to lock
   * @param actorId ID of agent/user acquiring the lock
   * @param reason Reason for locking
   * @returns true if lock acquired, false if already locked
   */
  async lockNode(
    nodeId: string,
    actorId: string,
    reason: string,
  ): Promise<boolean> {
    this.logger.info('Locking node', { nodeId, actorId, reason });
    return await this.neo4jAdapter.lockNode(nodeId, actorId, reason);
  }

  /**
   * Unlock a node
   * @param nodeId Node to unlock
   * @param actorId ID of agent/user releasing the lock (must match lock owner)
   * @returns true if unlocked, false if not locked or wrong actor
   */
  async unlockNode(nodeId: string, actorId: string): Promise<boolean> {
    this.logger.info('Unlocking node', { nodeId, actorId });
    return await this.neo4jAdapter.unlockNode(nodeId, actorId);
  }

  // ============================
  // Research Operations
  // ============================

  /**
   * Get all unresearched nodes, optionally filtered by layer
   */
  async getUnresearchedNodes(layer?: ICSLayer): Promise<KGNode[]> {
    return await this.neo4jAdapter.getUnresearchedNodes(layer);
  }

  /**
   * Lock a node for research
   */
  async lockNodeForResearch(
    nodeId: string,
    agentId: string,
  ): Promise<KGNode | null> {
    this.logger.info('Locking node for research', { nodeId, agentId });
    return await this.neo4jAdapter.lockNodeForResearch(nodeId, agentId);
  }

  /**
   * Add research data to a node
   */
  async addResearchData(
    nodeId: string,
    researchData: ResearchData,
    sources: SourceCitation[],
    confidence: number,
  ): Promise<KGNode | null> {
    this.logger.info('Adding research data to node', { nodeId });
    return await this.neo4jAdapter.addResearchData(
      nodeId,
      researchData,
      sources,
      confidence,
    );
  }

  /**
   * Mark a node as dubious
   */
  async markNodeAsDubious(
    nodeId: string,
    agentId: string,
  ): Promise<KGNode | null> {
    this.logger.warn('Marking node as dubious', { nodeId, agentId });
    return await this.neo4jAdapter.markNodeAsDubious(nodeId, agentId);
  }

  /**
   * Validate a node (increase confidence)
   */
  async validateNode(nodeId: string, agentId: string): Promise<KGNode | null> {
    this.logger.info('Validating node', { nodeId, agentId });
    return await this.neo4jAdapter.validateNode(nodeId, agentId);
  }

  private getLayerIndex(layer: ICSLayer): number {
    return this.layerSequence.indexOf(layer);
  }

  private findHigherLayerNeighbor(
    node: KGNode,
    neighbors: KGNode[],
  ): KGNode | undefined {
    const currentIndex = this.getLayerIndex(node.layer);
    return neighbors
      .filter((candidate) => this.getLayerIndex(candidate.layer) > currentIndex)
      .sort(
        (a, b) => this.getLayerIndex(a.layer) - this.getLayerIndex(b.layer),
      )[0];
  }

  private buildLayerList(
    nodes: ICSTraversalNode[],
    direction: 'ascending' | 'descending',
  ): ICSLayer[] {
    const uniqueLayers = Array.from(new Set(nodes.map((n) => n.layer)));
    return uniqueLayers.sort((a, b) => {
      const comparison = this.getLayerIndex(a) - this.getLayerIndex(b);
      return direction === 'ascending' ? comparison : -comparison;
    });
  }

  private buildTraversalNode(
    node: KGNode,
    context?: {
      parentId?: string;
      depth?: number;
      order?: number;
      childIds?: string[];
    },
  ): ICSTraversalNode {
    const summary =
      node.researchData?.summary ??
      node.properties?.summary ??
      node.properties?.description ??
      node.properties?.details;

    return {
      id: node.id,
      label: node.label,
      type: node.type,
      layer: node.layer,
      layerIndex: this.getLayerIndex(node.layer),
      summary,
      confidence: node.confidence,
      researchStatus: node.researchStatus,
      parentId: context?.parentId,
      childIds: context?.childIds,
      depth: context?.depth ?? 0,
      order: context?.order ?? 0,
      metadata: {
        graphComponentId: node.graphComponentId,
        explorationStatus: node.explorationStatus,
        domain: node.properties?.domain,
        domainColor: node.properties?.domainColor,
      },
    };
  }

  // ============================
  // Enhanced Edge Operations
  // ============================

  /**
   * Get all edges connected to a node
   */
  async getConnectedEdges(nodeId: string): Promise<KGEdge[]> {
    return await this.neo4jAdapter.getConnectedEdges(nodeId);
  }

  /**
   * Get outgoing edges from a node
   */
  async getOutgoingEdges(nodeId: string, type?: string): Promise<KGEdge[]> {
    return await this.neo4jAdapter.getOutgoingEdges(nodeId, type);
  }

  /**
   * Get incoming edges to a node
   */
  async getIncomingEdges(nodeId: string, type?: string): Promise<KGEdge[]> {
    return await this.neo4jAdapter.getIncomingEdges(nodeId, type);
  }

  /**
   * Find edge between two nodes
   */
  async findEdgeBetween(
    from: string,
    to: string,
    type?: string,
  ): Promise<KGEdge | null> {
    return await this.neo4jAdapter.findEdgeBetween(from, to, type);
  }

  // ============================
  // Enhanced Node Operations
  // ============================

  /**
   * Find or create a node with given label and type
   */
  async findOrCreateNode(
    label: string,
    type: string,
    layer: ICSLayer,
  ): Promise<KGNode> {
    return await this.neo4jAdapter.findOrCreateNode(label, type, layer);
  }

  /**
   * Connect two nodes with an edge (with optional properties)
   */
  async connectNodes(
    sourceId: string,
    targetId: string,
    edgeType: string,
    options?: {
      weight?: number;
      confidence?: number;
      equation?: string;
      rationale?: string;
      bidirectional?: boolean;
    },
  ): Promise<KGEdge> {
    // Check if edge already exists
    const existing = await this.findEdgeBetween(sourceId, targetId, edgeType);
    if (existing) {
      // Update existing edge
      return await this.updateRelationship(existing.id, {
        weight: options?.weight ?? existing.weight,
        confidence: options?.confidence ?? existing.confidence,
        equation: options?.equation ?? existing.equation,
        rationale: options?.rationale ?? existing.rationale,
        bidirectional: options?.bidirectional ?? existing.bidirectional,
      });
    }

    // Create new edge
    return await this.createRelationshipInternal(
      sourceId,
      targetId,
      edgeType,
      {},
      options?.weight,
      options?.confidence,
      options?.equation,
      options?.rationale,
      options?.bidirectional,
    );
  }

  /**
   * Update relationship properties
   */
  private async updateRelationship(
    edgeId: string,
    updates: Partial<KGEdge>,
  ): Promise<KGEdge> {
    const edge = await this.neo4jAdapter.getEdge(edgeId);
    if (!edge) {
      throw new Error(`Edge ${edgeId} not found`);
    }

    const updated: KGEdge = { ...edge, ...updates };
    // In production, update in Neo4j
    return updated;
  }

  /**
   * Create relationship with enhanced properties (internal helper)
   */
  private async createRelationshipInternal(
    from: string,
    to: string,
    type: string,
    properties: Record<string, any> = {},
    weight?: number,
    confidence?: number,
    equation?: string,
    rationale?: string,
    bidirectional?: boolean,
  ): Promise<KGEdge> {
    const edge = await this.neo4jAdapter.createEdge(
      from,
      to,
      type,
      properties,
      weight,
      confidence,
      equation,
      rationale,
      bidirectional,
    );

    // Handle component merging if component service is available
    if (this.componentService) {
      const [sourceCompId, targetCompId] = await Promise.all([
        this.componentService.getComponentId(from),
        this.componentService.getComponentId(to),
      ]);

      if (sourceCompId && targetCompId && sourceCompId !== targetCompId) {
        // Merge components
        await this.componentService.mergeComponents(sourceCompId, targetCompId);
      } else if (sourceCompId) {
        // Increment edge count for component
        await this.componentService.incrementEdgeCount(sourceCompId);
      } else if (targetCompId) {
        await this.componentService.incrementEdgeCount(targetCompId);
      }
    }

    return edge;
  }

  /**
   * Get the full graph structure (nodes and edges)
   */
  async getGraphStructure(): Promise<{
    nodes: KGNode[];
    edges: KGEdge[];
  }> {
    const allNodesResult = await this.getAllNodes();
    const allEdgesResult = await this.getAllEdges();
    return { nodes: allNodesResult.nodes, edges: allEdgesResult.edges };
  }

  /**
   * Get graph statistics
   */
  async getGraphStatistics(): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodesByCategory: Record<string, number>;
    nodesByLayer: Record<number, number>;
    nodesByStatus: Record<string, number>;
  }> {
    const stats = await this.neo4jAdapter.getStats();
    const allNodesResult = await this.getAllNodes();
    const allNodes = allNodesResult.nodes;

    const nodesByCategory: Record<string, number> = {};
    const nodesByStatus: Record<string, number> = {};

    for (const node of allNodes) {
      const category = (node.properties?.category as string) || 'Unknown';
      nodesByCategory[category] = (nodesByCategory[category] || 0) + 1;

      const status = node.researchStatus || 'unknown';
      nodesByStatus[status] = (nodesByStatus[status] || 0) + 1;
    }

    return {
      totalNodes: stats.totalNodes,
      totalEdges: stats.totalEdges,
      nodesByCategory,
      nodesByLayer: stats.nodesByLayer as any,
      nodesByStatus,
    };
  }
}
